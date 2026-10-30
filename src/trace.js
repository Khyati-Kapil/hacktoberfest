import {
  getFileCommits,
  searchRepositoryDiscussions
} from "./github.js";

const STOP_WORDS = new Set([
  "about", "after", "before", "code", "does", "exist", "file", "from", "here", "into", "that", "this",
  "what", "when", "where", "which", "with", "why", "would"
]);

export function deriveSearchTerms(path, question = "") {
  const filename = path.split("/").at(-1)?.replace(/\.[^.]+$/, "") || "";
  const words = `${filename} ${question}`
    .toLowerCase()
    .match(/[a-z][a-z0-9_-]{2,}/g) || [];

  return [...new Set(words.filter((word) => !STOP_WORDS.has(word)))].slice(0, 5).join(" ");
}

function uniqueEvidence(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.url || `${item.type}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function collectEvidence({ owner, repo, path, question }) {
  const searchTerms = deriveSearchTerms(path, question);
  const [commits, discussions] = await Promise.all([
    getFileCommits(owner, repo, path),
    searchTerms ? searchRepositoryDiscussions(owner, repo, searchTerms) : Promise.resolve([])
  ]);

  const evidence = uniqueEvidence([...discussions, ...commits])
    .sort((left, right) => new Date(left.date || 0) - new Date(right.date || 0))
    .slice(0, 12);

  return { searchTerms, evidence };
}

export function createFallbackTrace({ path, evidence }) {
  const filename = path.split("/").at(-1);
  const discussions = evidence.filter((item) => item.type !== "commit");
  const commits = evidence.filter((item) => item.type === "commit");
  const strongest = discussions[0] || commits.at(-1);

  if (!strongest) {
    return {
      title: "The repository history is limited",
      explanation: `GhostTrace could not find enough public history to explain why ${filename} exists. The file may have been added before detailed commit messages or issue tracking were used.`,
      confidence: 20,
      evidence: []
    };
  }

  const explanation = discussions.length
    ? `${filename} appears connected to “${strongest.label}”. Review the linked discussion and commits below to confirm the original reason for this code.`
    : `${filename} has changed through ${commits.length} recorded commit${commits.length === 1 ? "" : "s"}. The clearest available clue is “${strongest.label}”.`;

  return {
    title: strongest.label,
    explanation,
    confidence: discussions.length ? 62 : 45,
    evidence: evidence.slice(-6)
  };
}
