import { demoRepository } from "./demo-data.js";

const languageByExtension = {
  js: "JavaScript", jsx: "JavaScript", ts: "TypeScript", tsx: "TypeScript",
  py: "Python", java: "Java", go: "Go", rs: "Rust", rb: "Ruby", php: "PHP",
  html: "HTML", css: "CSS", scss: "SCSS", vue: "Vue", svelte: "Svelte",
  json: "JSON", md: "Markdown", yml: "YAML", yaml: "YAML", sh: "Shell"
};

const state = {
  repositoryUrl: "",
  repository: demoRepository,
  selectedFile: demoRepository.files[0],
  selectedSnippet: "",
  analysisMode: "history",
  mode: "demo"
};

const analysisModes = {
  history: { question: "Why does this code exist?", button: "Trace history", heading: "Historical context", eyebrow: "Why this code exists", loading: "Tracing repository history" },
  optimize: { question: "How can this code be improved without changing behavior?", button: "Review optimization", heading: "Optimization suggestions", eyebrow: "Optimization review", loading: "Reviewing code efficiency" },
  risk: { question: "What security or reliability risks are present?", button: "Run risk scan", heading: "Risk findings", eyebrow: "Security and reliability", loading: "Scanning code risks" },
  contributor: { question: "What should a new contributor know before changing this?", button: "Build contributor brief", heading: "Contributor next steps", eyebrow: "Contributor briefing", loading: "Building contributor brief" }
};

const ids = [
  "repository-form", "repository-url", "repository-name", "repository-branch", "mode-badge",
  "file-filter", "file-list", "selected-path", "language-badge", "question", "trace-button",
  "code-filename", "code-content", "file-details", "selection-hint", "trace-snippet-button",
  "empty-state", "loading-state", "answer-content", "answer-title", "answer-text", "confidence",
  "evidence-list", "timeline", "toast", "scope-note", "analysis-modes", "insights-section",
  "insights-heading", "insights-list", "answer-eyebrow", "loading-title", "loading-text",
  "answer-panel-toggle", "mode-visual", "evidence-section", "timeline-section"
];
const elements = Object.fromEntries(
  ids.map((id) => [id.replaceAll("-", "_"), document.querySelector(`#${id}`)])
);

function extension(path) {
  return path.includes(".") ? path.split(".").at(-1).toLowerCase().slice(0, 4) : "file";
}

function languageFor(path) {
  return languageByExtension[extension(path)] || "Text";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function evidenceIcon(type) {
  if (type === "issue") return "#";
  if (type === "pull request") return "PR";
  return "C";
}

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function renderFiles(filter = "") {
  const normalizedFilter = filter.toLowerCase();
  const files = state.repository.files.filter((file) => file.path.toLowerCase().includes(normalizedFilter));

  elements.file_list.innerHTML = files
    .map((file) => {
      const filename = file.path.split("/").at(-1);
      const activeClass = file.path === state.selectedFile?.path ? "active" : "";
      return `<button class="file-button ${activeClass}" data-path="${escapeHtml(file.path)}" data-extension="${escapeHtml(extension(file.path))}">${escapeHtml(filename)}</button>`;
    })
    .join("");
}

function resetAnswer() {
  elements.empty_state.classList.remove("hidden");
  elements.loading_state.classList.add("hidden");
  elements.answer_content.classList.add("hidden");
}

function renderSelectedFile() {
  const file = state.selectedFile;
  state.selectedSnippet = "";
  elements.repository_name.textContent = state.repository.name;
  elements.repository_branch.textContent = state.repository.branch;
  elements.selected_path.textContent = file.path;
  elements.language_badge.textContent = file.language || languageFor(file.path);
  elements.code_filename.textContent = file.path.split("/").at(-1);
  elements.code_content.textContent = file.content || "Select the file to load its contents.";
  renderFileDetails(file);
  elements.selection_hint.textContent = "Select a few lines to trace only that decision.";
  elements.trace_snippet_button.disabled = true;
  resetAnswer();
}

function renderFileDetails(file) {
  const content = file.content || "";
  const lines = content ? content.split("\n").length : "—";
  const size = file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${content.length} chars`;
  elements.file_details.innerHTML = [
    ["LINES", lines],
    ["SIZE", size],
    ["TYPE", file.language || languageFor(file.path)],
    ["SCOPE", "public history"]
  ].map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("");
}

function renderAnswer(trace) {
  document.querySelector(".answer-panel").dataset.analysisMode = state.analysisMode;
  elements.answer_title.textContent = trace.title;
  elements.answer_text.textContent = trace.explanation;
  elements.answer_eyebrow.textContent = analysisModes[state.analysisMode].eyebrow;
  elements.confidence.textContent = `${trace.confidence}% confidence`;
  const insights = Array.isArray(trace.insights) ? trace.insights : [];
  elements.insights_heading.textContent = analysisModes[state.analysisMode].heading;
  elements.insights_list.innerHTML = insights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  elements.insights_section.classList.toggle("hidden", !insights.length);
  renderModeVisual(trace, insights);
  elements.evidence_list.innerHTML = trace.evidence.length
    ? trace.evidence
        .map(
          (item) => `<a class="evidence-card" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
            <span class="evidence-icon">${evidenceIcon(item.type)}</span>
            <span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span>
            <span class="evidence-arrow">›</span>
          </a>`
        )
        .join("")
    : `<p class="answer-text">No linked evidence was found for this file.</p>`;

  const timelineItems = [...trace.evidence]
    .filter((item) => item.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-3);
  elements.timeline.innerHTML = timelineItems.length
    ? timelineItems.map((item) => `<li><strong>${escapeHtml(item.type)}</strong>${shortDate(item.date)}</li>`).join("")
    : `<li><strong>No dates</strong>History unavailable</li>`;

  elements.empty_state.classList.add("hidden");
  elements.loading_state.classList.add("hidden");
  elements.answer_content.classList.remove("hidden");
}

function renderModeVisual(trace, insights) {
  const mode = state.analysisMode;
  elements.evidence_section.classList.toggle("hidden", mode === "optimize" || mode === "risk");
  elements.timeline_section.classList.toggle("hidden", mode !== "history");

  if (mode === "optimize") {
    const scope = state.selectedSnippet ? `${state.selectedSnippet.split("\n").length}-line snippet` : "Current file";
    const recommendation = insights[0] || "Keep the current implementation until profiling identifies a measurable bottleneck.";
    elements.mode_visual.innerHTML = `<div class="comparison-board">
      <article class="comparison-card current"><span>Current</span><h3>${escapeHtml(scope)}</h3><p>${escapeHtml(trace.explanation)}</p></article>
      <div class="comparison-arrow" aria-hidden="true">→</div>
      <article class="comparison-card proposed"><span>Recommended</span><h3>Safer direction</h3><p>${escapeHtml(recommendation)}</p></article>
    </div>
    <div class="optimization-metrics"><span><b>${insights.length}</b> opportunities</span><span><b>${trace.confidence}%</b> confidence</span><span><b>${state.selectedSnippet ? "Snippet" : "File"}</b> scope</span></div>`;
    return;
  }

  if (mode === "risk") {
    const riskScore = Math.min(92, 28 + insights.length * 14);
    const level = riskScore >= 70 ? "Elevated" : riskScore >= 45 ? "Review" : "Low signal";
    elements.mode_visual.innerHTML = `<div class="risk-dashboard">
      <div class="risk-score"><span>Risk signal</span><strong>${riskScore}</strong><small>/ 100</small></div>
      <div class="risk-summary"><span class="risk-level">${level}</span><h3>${insights.length} finding${insights.length === 1 ? "" : "s"} require attention</h3><div class="risk-track"><i style="width:${riskScore}%"></i></div><p>Prioritize validation and testing before changing this path.</p></div>
    </div>`;
    return;
  }

  if (mode === "contributor") {
    const steps = [
      ["01", "Understand", insights[0] || "Identify the code's responsibility and callers."],
      ["02", "Validate", insights[1] || "Read linked history and reproduce the current behaviour."],
      ["03", "Contribute", insights[2] || "Add a focused test and keep the pull request small."]
    ];
    elements.mode_visual.innerHTML = `<div class="contributor-path">${steps.map(([number, title, text]) => `<article><span>${number}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div></article>`).join("")}</div>`;
    return;
  }

  elements.mode_visual.innerHTML = `<div class="history-summary"><span>Repository archaeology</span><strong>${trace.evidence.length}</strong><small>historical sources connected</small></div>`;
}

function demoAnalysis() {
  const base = state.selectedFile.trace;
  const filename = state.selectedFile.path.split("/").at(-1);
  const scoped = state.selectedSnippet ? `the selected ${state.selectedSnippet.split("\n").length} lines` : filename;
  if (state.analysisMode === "optimize") return {
    ...base,
    title: `Keep ${filename} simple and bounded`,
    explanation: `The retry loop is intentionally small. Optimize clarity and observability before changing its runtime behavior.`,
    confidence: 84,
    insights: ["Keep MAX_REFRESH_RETRIES explicit so retry behavior stays reviewable.", "Add a timeout at the API-client layer rather than inside this function.", `Add a focused test for ${scoped} covering success after one retry.`]
  };
  if (state.analysisMode === "risk") return {
    ...base,
    title: "Session failure handling needs careful boundaries",
    explanation: "The code correctly clears a failed session, but error reporting and retry timing still deserve review.",
    confidence: 79,
    insights: ["Avoid exposing raw authentication errors to the user.", "Ensure the API client applies a request timeout.", "Confirm concurrent refresh calls cannot overwrite a newer session."]
  };
  if (state.analysisMode === "contributor") return {
    ...base,
    title: `Contributor brief for ${filename}`,
    explanation: "This file owns session refresh recovery and should remain small. Changes must preserve the one-retry boundary and session cleanup.",
    confidence: 88,
    insights: ["Read token.ts before changing cleanup behavior.", "Preserve the one-retry limit unless repository evidence supports a change.", "Test success, retry success, and final failure.", "Link the pull request to the session-expiry issue."]
  };
  return state.selectedSnippet
    ? { ...base, title: `Snippet from ${filename}`, explanation: `${base.explanation} GhostTrace narrowed this read to the ${state.selectedSnippet.split("\n").length}-line selection you highlighted.`, insights: [] }
    : { ...base, insights: [] };
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.remove("hidden");
  window.setTimeout(() => elements.toast.classList.add("hidden"), 3000);
}

async function loadRepository(repositoryUrl) {
  elements.mode_badge.textContent = "Loading";
  elements.mode_badge.classList.remove("live");
  const repository = await api(`/api/repository?url=${encodeURIComponent(repositoryUrl)}`);
  if (!repository.files.length) throw new Error("No supported text files were found.");

  state.repositoryUrl = repositoryUrl;
  state.repository = repository;
  state.selectedFile = repository.files[0];
  state.mode = "live";
  elements.mode_badge.textContent = "Live repository";
  elements.mode_badge.classList.add("live");
  elements.scope_note.lastChild.textContent = ` ${repository.files.length} files available`;
  elements.file_filter.value = "";
  renderFiles();
  await loadSelectedFile();
}

async function loadSelectedFile() {
  const file = state.selectedFile;
  renderSelectedFile();
  if (file.content || state.mode === "demo") return;

  elements.code_content.textContent = "Loading file...";
  const result = await api(
    `/api/file?url=${encodeURIComponent(state.repositoryUrl)}&path=${encodeURIComponent(file.path)}`
  );
  file.content = result.content;
  renderSelectedFile();
}

async function traceSelectedFile() {
  elements.empty_state.classList.add("hidden");
  elements.answer_content.classList.add("hidden");
  elements.loading_state.classList.remove("hidden");
  elements.loading_title.textContent = analysisModes[state.analysisMode].loading;
  elements.loading_text.textContent = state.selectedSnippet ? "Analyzing the selected code and related evidence..." : "Analyzing the file and related repository evidence...";
  elements.trace_button.disabled = true;

  try {
    if (state.mode === "demo") {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      renderAnswer(demoAnalysis());
      return;
    }

    const trace = await api("/api/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repositoryUrl: state.repositoryUrl,
        path: state.selectedFile.path,
        question: elements.question.value,
        snippet: state.selectedSnippet,
        mode: state.analysisMode
      })
    });
    renderAnswer(trace);
  } catch (error) {
    resetAnswer();
    showToast(error.message, true);
  } finally {
    elements.trace_button.disabled = false;
  }
}

function updateSnippetSelection() {
  const selection = window.getSelection()?.toString().trim() || "";
  const insideCode = selection && elements.code_content.contains(window.getSelection()?.anchorNode);
  state.selectedSnippet = insideCode ? selection : "";
  elements.trace_snippet_button.disabled = !state.selectedSnippet;
  elements.selection_hint.textContent = state.selectedSnippet
    ? `${state.selectedSnippet.split("\n").length} lines selected · ready to trace`
    : "Select a few lines to trace only that decision.";
}

elements.file_list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-path]");
  if (!button) return;
  state.selectedFile = state.repository.files.find((file) => file.path === button.dataset.path);
  renderFiles(elements.file_filter.value);
  try {
    await loadSelectedFile();
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.file_filter.addEventListener("input", (event) => renderFiles(event.target.value));
elements.trace_button.addEventListener("click", traceSelectedFile);
elements.code_content.addEventListener("mouseup", updateSnippetSelection);
elements.code_content.addEventListener("keyup", updateSnippetSelection);
elements.trace_snippet_button.addEventListener("click", traceSelectedFile);
elements.answer_panel_toggle.addEventListener("click", () => {
  const shell = document.querySelector(".app-shell");
  const expanded = shell.classList.toggle("answer-expanded");
  elements.answer_panel_toggle.setAttribute("aria-expanded", String(expanded));
  elements.answer_panel_toggle.textContent = expanded ? "Restore layout" : "Expand report";
});
elements.analysis_modes.addEventListener("click", (event) => {
  const button = event.target.closest("[data-analysis-mode]");
  if (!button) return;
  state.analysisMode = button.dataset.analysisMode;
  document.querySelector(".answer-panel").dataset.analysisMode = state.analysisMode;
  elements.analysis_modes.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  elements.question.value = analysisModes[state.analysisMode].question;
  elements.trace_button.textContent = analysisModes[state.analysisMode].button;
  elements.trace_snippet_button.textContent = state.analysisMode === "history" ? "Trace selected snippet" : `Analyze selected snippet`;
  resetAnswer();
});

elements.repository_form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadRepository(elements.repository_url.value.trim());
    showToast(`Loaded ${state.repository.owner}/${state.repository.name}.`);
  } catch (error) {
    elements.mode_badge.textContent = state.mode === "demo" ? "Demo mode" : "Live repository";
    showToast(error.message, true);
  }
});

renderFiles();
renderSelectedFile();
