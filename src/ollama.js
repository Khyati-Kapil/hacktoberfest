const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "gemma3:4b";

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate) throw new Error("The model did not return JSON.");
  return JSON.parse(candidate);
}

function buildPrompt({ path, question, content, evidence }) {
  const sources = evidence.map((item, index) => ({
    source: index + 1,
    type: item.type,
    title: item.label,
    detail: item.detail,
    date: item.date
  }));

  return `You are GhostTrace, an assistant that explains why open-source code exists.
Use only the supplied repository evidence. If the evidence is weak, say so.
Do not invent an issue, pull request, commit, date, or reason.

File: ${path}
Question: ${question}

Code excerpt:
${content.slice(0, 12_000)}

Repository evidence:
${JSON.stringify(sources, null, 2)}

Return only valid JSON with this shape:
{
  "title": "short explanation heading",
  "explanation": "two or three clear sentences for a new contributor",
  "confidence": 0,
  "sourceNumbers": [1, 2]
}

Confidence must be an integer from 0 to 100. sourceNumbers may only contain supplied source numbers.`;
}

export async function explainWithGemma(input) {
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
      evidence: selectedEvidence.length ? selectedEvidence : input.evidence.slice(-6),
      model
    };
  } catch {
    return null;
  }
}
