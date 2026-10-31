import {
  getFileCommits,
  searchRepositoryDiscussions
} from "./github.js";

const STOP_WORDS = new Set([
  "about", "after", "before", "code", "does", "exist", "file", "from", "here", "into", "that", "this",
  "the", "what", "when", "where", "which", "with", "why", "would"
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

function deduplicate(items) {
  return [...new Set(items)].slice(0, 5);
}

export function createFallbackAnalysis({ mode, path, content, snippet = "", evidence = [] }) {
  const target = snippet || content;
  const scope = snippet ? "selected snippet" : "file";
  const lines = target.split("\n").length;

  if (mode === "optimize") {
    const insights = [];
    if (/while\s*\(|for\s*\(/.test(target)) insights.push("Verify that loop bounds are predictable and avoid repeated network or storage work inside the loop.");
    if (/await\s+/.test(target)) insights.push("Check whether independent asynchronous operations can run together with Promise.all.");
    if (/\.reduce\(|\.map\(|\.filter\(/.test(target)) insights.push("Keep the collection pass readable; combine passes only when profiling shows a meaningful cost.");
    if (lines > 35) insights.push("Extract one responsibility into a named helper so the main path is easier to test.");
    if (!insights.length) insights.push("The selected code is already compact; prioritize clearer names and tests before micro-optimizing it.");
    return {
      title: `Optimization review for ${path.split("/").at(-1)}`,
      explanation: `GhostTrace reviewed the ${scope} for avoidable work and maintainability costs. These are conservative suggestions—measure performance before changing working code.`,
      confidence: 70,
      insights: deduplicate(insights),
      evidence: evidence.slice(-4)
    };
  }

  if (mode === "risk") {
    const insights = [];
    if (/localStorage|sessionStorage/.test(target)) insights.push("Browser storage is readable by page scripts; do not store secrets or long-lived credentials without a clear threat model.");
    if (/innerHTML|eval\s*\(|new Function/.test(target)) insights.push("Dynamic code or HTML execution needs strict input sanitization to prevent injection.");
    if (/fetch\s*\(|apiClient|axios/.test(target)) insights.push("Handle timeouts, non-success responses, and untrusted server data explicitly.");
    if (/catch\s*\([^)]*\)\s*\{/.test(target)) insights.push("Confirm caught errors are logged or surfaced without exposing sensitive details.");
    if (!insights.length) insights.push("No obvious high-risk pattern was found by the local rules; dependency and data-flow review is still required.");
    return {
      title: `Risk scan for ${path.split("/").at(-1)}`,
      explanation: `This fast scan checks the ${scope} for common security and reliability signals. It is a contributor aid, not a substitute for a full security audit.`,
      confidence: 68,
      insights: deduplicate(insights),
      evidence: evidence.slice(-4)
    };
  }

  if (mode === "contributor") {
    const symbols = [...target.matchAll(/(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)]
      .map((match) => match[1])
      .slice(0, 4);
    return {
      title: `Contributor brief for ${path.split("/").at(-1)}`,
      explanation: `Start with this ${lines}-line ${scope}, then use the linked history to understand its constraints before proposing a change.`,
      confidence: 72,
      insights: deduplicate([
        symbols.length ? `Key symbols to understand: ${symbols.join(", ")}.` : "Identify the public entry points and their callers before editing.",
        "Read the most recent file commits and linked discussions before changing behavior.",
        "Add or update a focused test that demonstrates the intended behavior.",
        "Keep the pull request small and explain which historical constraint it preserves."
      ]),
      evidence: evidence.slice(-5)
    };
  }

  return { ...createFallbackTrace({ path, evidence }), insights: [] };
}
