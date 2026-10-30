import { MemoryCache } from "./cache.js";

const GITHUB_API = "https://api.github.com";
const responseCache = new MemoryCache();

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "cs", "cpp", "c", "h",
  "html", "css", "scss", "vue", "svelte", "json", "md", "yml", "yaml", "toml", "sh"
]);

export function parseGitHubUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid GitHub repository URL.");
  }

  if (url.hostname !== "github.com") {
    throw new Error("Only public github.com repositories are supported.");
  }

  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/, "");
  if (!owner || !repo) {
    throw new Error("The URL must include both an owner and repository name.");
  }

  return { owner, repo };
}

async function githubRequest(path) {
  const cached = responseCache.get(path);
  if (cached) return cached;

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GhostTrace",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`${GITHUB_API}${path}`, { headers });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Repository or file not found.");
    if (response.status === 403) throw new Error("GitHub rate limit reached. Add GITHUB_TOKEN and try again.");
    throw new Error(`GitHub request failed with status ${response.status}.`);
  }

  const data = await response.json();
  responseCache.set(path, data);
  return data;
}

export async function getRepository(owner, repo) {
  const data = await githubRequest(`/repos/${owner}/${repo}`);
  return {
    owner: data.owner.login,
    name: data.name,
    description: data.description,
    branch: data.default_branch,
    url: data.html_url,
    stars: data.stargazers_count
  };
}

export async function getRepositoryFiles(owner, repo, branch) {
  const tree = await githubRequest(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );

  return tree.tree
    .filter((item) => item.type === "blob")
    .filter((item) => CODE_EXTENSIONS.has(item.path.split(".").at(-1)?.toLowerCase()))
    .filter((item) => !item.path.includes("node_modules/") && !item.path.includes("vendor/"))
    .slice(0, 500)
    .map((item) => ({ path: item.path, size: item.size, sha: item.sha }));
}

export async function getFileContent(owner, repo, path, branch) {
  const data = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`
  );

  if (data.encoding !== "base64" || !data.content) {
    throw new Error("This file cannot be displayed as text.");
  }

  return Buffer.from(data.content.replaceAll("\n", ""), "base64").toString("utf8").slice(0, 40_000);
}

export async function getFileCommits(owner, repo, path) {
  const commits = await githubRequest(
    `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=12`
  );

  return commits.map((item) => ({
    type: "commit",
    sha: item.sha,
    label: item.commit.message.split("\n")[0],
    detail: `Changed by ${item.commit.author?.name || item.author?.login || "unknown contributor"}`,
    date: item.commit.author?.date,
    url: item.html_url
  }));
}

export async function searchRepositoryDiscussions(owner, repo, terms) {
  const query = encodeURIComponent(`repo:${owner}/${repo} ${terms}`);
  const result = await githubRequest(`/search/issues?q=${query}&per_page=8&sort=updated`);

  return result.items.map((item) => ({
    type: item.pull_request ? "pull request" : "issue",
    number: item.number,
    label: item.title,
    detail: item.body?.replace(/\s+/g, " ").slice(0, 180) || "No description provided.",
    date: item.created_at,
    url: item.html_url
  }));
}
