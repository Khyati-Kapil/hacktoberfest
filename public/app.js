import { demoRepository } from "./demo-data.js";

const state = {
  repository: demoRepository,
  selectedFile: demoRepository.files[0]
};

const elements = {
  repositoryForm: document.querySelector("#repository-form"),
  repositoryUrl: document.querySelector("#repository-url"),
  repositoryName: document.querySelector("#repository-name"),
  repositoryBranch: document.querySelector("#repository-branch"),
  modeBadge: document.querySelector("#mode-badge"),
  fileFilter: document.querySelector("#file-filter"),
  fileList: document.querySelector("#file-list"),
  selectedPath: document.querySelector("#selected-path"),
  languageBadge: document.querySelector("#language-badge"),
  question: document.querySelector("#question"),
  traceButton: document.querySelector("#trace-button"),
  codeFilename: document.querySelector("#code-filename"),
  codeContent: document.querySelector("#code-content"),
  emptyState: document.querySelector("#empty-state"),
  loadingState: document.querySelector("#loading-state"),
  answerContent: document.querySelector("#answer-content"),
  answerTitle: document.querySelector("#answer-title"),
  answerText: document.querySelector("#answer-text"),
  confidence: document.querySelector("#confidence"),
  evidenceList: document.querySelector("#evidence-list"),
  timeline: document.querySelector("#timeline"),
  toast: document.querySelector("#toast")
};

function fileExtension(path) {
  return path.includes(".") ? path.split(".").at(-1).slice(0, 4) : "file";
}

function shortDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function evidenceIcon(type) {
  if (type === "issue") return "#";
  if (type === "pull request") return "PR";
  return "C";
}

function renderFiles(filter = "") {
  const normalizedFilter = filter.toLowerCase();
  const files = state.repository.files.filter((file) => file.path.toLowerCase().includes(normalizedFilter));

  elements.fileList.innerHTML = files
    .map((file) => {
      const filename = file.path.split("/").at(-1);
      const activeClass = file.path === state.selectedFile.path ? "active" : "";
      return `<button class="file-button ${activeClass}" data-path="${file.path}" data-extension="${fileExtension(file.path)}">${filename}</button>`;
    })
    .join("");
}

function renderSelectedFile() {
  const file = state.selectedFile;
  elements.repositoryName.textContent = state.repository.name;
  elements.repositoryBranch.textContent = state.repository.branch;
  elements.selectedPath.textContent = file.path;
  elements.languageBadge.textContent = file.language;
  elements.codeFilename.textContent = file.path.split("/").at(-1);
  elements.codeContent.textContent = file.content;
  elements.emptyState.classList.remove("hidden");
  elements.loadingState.classList.add("hidden");
  elements.answerContent.classList.add("hidden");
}

function renderAnswer(trace) {
  elements.answerTitle.textContent = trace.title;
  elements.answerText.textContent = trace.explanation;
  elements.confidence.textContent = `${trace.confidence}% confidence`;
  elements.evidenceList.innerHTML = trace.evidence
    .map(
      (item) => `<a class="evidence-card" href="${item.url}" target="_blank" rel="noreferrer">
        <span class="evidence-icon">${evidenceIcon(item.type)}</span>
        <span><strong>${item.label}</strong><small>${item.detail}</small></span>
        <span class="evidence-arrow">›</span>
      </a>`
    )
    .join("");

  const timelineItems = [...trace.evidence]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  elements.timeline.innerHTML = timelineItems
    .map((item) => `<li><strong>${item.type}</strong>${shortDate(item.date)}</li>`)
    .join("");

  elements.emptyState.classList.add("hidden");
  elements.loadingState.classList.add("hidden");
  elements.answerContent.classList.remove("hidden");
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.remove("hidden");
  window.setTimeout(() => elements.toast.classList.add("hidden"), 2600);
}

elements.fileList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-path]");
  if (!button) return;
  state.selectedFile = state.repository.files.find((file) => file.path === button.dataset.path);
  renderFiles(elements.fileFilter.value);
  renderSelectedFile();
});

elements.fileFilter.addEventListener("input", (event) => renderFiles(event.target.value));

elements.traceButton.addEventListener("click", () => {
  elements.emptyState.classList.add("hidden");
  elements.answerContent.classList.add("hidden");
  elements.loadingState.classList.remove("hidden");
  elements.traceButton.disabled = true;

  window.setTimeout(() => {
    renderAnswer(state.selectedFile.trace);
    elements.traceButton.disabled = false;
  }, 650);
});

elements.repositoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("The live GitHub connection is added in the next step.");
});

renderFiles();
renderSelectedFile();
