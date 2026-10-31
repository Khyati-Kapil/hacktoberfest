const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "gemma3:4b";

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate) throw new Error("The model did not return JSON.");
  return JSON.parse(candidate);
}

function buildPrompt({ path, question, content, snippet, evidence, mode = "history" }) {
  const sources = evidence.map((item, index) => ({
    source: index + 1,
    type: item.type,
    title: item.label,
    detail: item.detail,
    date: item.date
  }));

  const taskByMode = {
    history: "Explain why the code exists and connect the explanation to repository history.",
    optimize: "Suggest conservative performance and maintainability improvements. Do not rewrite code unless a change has clear value.",
    risk: "Identify concrete security, reliability, and error-handling risks. Avoid generic warnings.",
    contributor: "Create a brief for a new contributor: key responsibilities, safe change boundaries, and tests to add."
  };

  return `You are GhostTrace, a careful open-source code intelligence assistant.
Task: ${taskByMode[mode] || taskByMode.history}
Use repository evidence for historical claims. If evidence is weak, say so.
Do not invent an issue, pull request, commit, date, or reason.

File: ${path}
Question: ${question}

Selected snippet (focus on this when present):
${snippet || "No snippet selected; explain the file as a whole."}

Code excerpt:
${content.slice(0, 12_000)}

Repository evidence:
${JSON.stringify(sources, null, 2)}

Return only valid JSON with this shape:
{
  "title": "short explanation heading",
  "explanation": "two or three clear sentences for a new contributor",
  "confidence": 0,
  "insights": ["specific actionable point", "specific actionable point"],
  "sourceNumbers": [1, 2]
}

Return 2 to 5 concise insights. Confidence must be an integer from 0 to 100. sourceNumbers may only contain supplied source numbers.`;
}

export async function explainWithGemma(input) {
  if (process.env.VERCEL && !process.env.OLLAMA_URL) return null;
  const baseUrl = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(input),
        stream: false,
        format: "json",
        options: { temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(45_000)
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const result = extractJson(payload.response || "");
    const sourceNumbers = Array.isArray(result.sourceNumbers) ? result.sourceNumbers : [];
    const selectedEvidence = sourceNumbers
      .map((number) => input.evidence[number - 1])
      .filter(Boolean);

    return {
      title: String(result.title || "Repository history explanation").slice(0, 140),
      explanation: String(result.explanation || "").slice(0, 1200),
      confidence: Math.max(0, Math.min(100, Number(result.confidence) || 0)),
      insights: Array.isArray(result.insights)
        ? result.insights.map((item) => String(item).slice(0, 300)).slice(0, 5)
        : [],
      evidence: selectedEvidence.length ? selectedEvidence : input.evidence.slice(-6),
      model
    };
  } catch {
    return null;
  }
}
