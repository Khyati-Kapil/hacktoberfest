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
  mode: "demo"
};

const ids = [
  "repository-form", "repository-url", "repository-name", "repository-branch", "mode-badge",
  "file-filter", "file-list", "selected-path", "language-badge", "question", "trace-button",
  "code-filename", "code-content", "empty-state", "loading-state", "answer-content",
  "answer-title", "answer-text", "confidence", "evidence-list", "timeline", "toast", "scope-note"
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
  elements.repository_name.textContent = state.repository.name;
  elements.repository_branch.textContent = state.repository.branch;
  elements.selected_path.textContent = file.path;
  elements.language_badge.textContent = file.language || languageFor(file.path);
  elements.code_filename.textContent = file.path.split("/").at(-1);
  elements.code_content.textContent = file.content || "Select the file to load its contents.";
  resetAnswer();
}

function renderAnswer(trace) {
  elements.answer_title.textContent = trace.title;
  elements.answer_text.textContent = trace.explanation;
  elements.confidence.textContent = `${trace.confidence}% confidence`;
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
  elements.trace_button.disabled = true;

  try {
    if (state.mode === "demo") {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      renderAnswer(state.selectedFile.trace);
      return;
    }

    const trace = await api("/api/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repositoryUrl: state.repositoryUrl,
        path: state.selectedFile.path,
        question: elements.question.value
      })
    });
    renderAnswer(trace);
    showToast(trace.model === "evidence-only" ? "Ollama unavailable; showing evidence-only result." : `Explained with ${trace.model}.`);
  } catch (error) {
    resetAnswer();
    showToast(error.message, true);
  } finally {
    elements.trace_button.disabled = false;
  }
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
