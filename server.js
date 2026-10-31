import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getFileContent,
  getRepository,
  getRepositoryFiles,
  parseGitHubUrl
} from "./src/github.js";
import { collectEvidence, createFallbackAnalysis } from "./src/trace.js";
import { explainWithGemma } from "./src/ollama.js";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = join(rootDirectory, "public");
const port = Number(process.env.PORT || 8000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": contentTypes[".json"] });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) : {};
}

async function repositoryRoute(url, response) {
  const repositoryUrl = url.searchParams.get("url");
  const { owner, repo } = parseGitHubUrl(repositoryUrl || "");
  const repository = await getRepository(owner, repo);
  const files = await getRepositoryFiles(owner, repo, repository.branch);
  sendJson(response, 200, { ...repository, files });
}

async function fileRoute(url, response) {
  const repositoryUrl = url.searchParams.get("url");
  const path = url.searchParams.get("path");
  if (!path) throw new Error("Choose a file first.");

  const { owner, repo } = parseGitHubUrl(repositoryUrl || "");
  const repository = await getRepository(owner, repo);
  const content = await getFileContent(owner, repo, path, repository.branch);
  sendJson(response, 200, { path, content });
}

async function traceRoute(request, response) {
  const { repositoryUrl, path, question = "Why does this code exist?", snippet = "", mode = "history" } = await readJson(request);
  if (!path) throw new Error("Choose a file first.");
  if (!new Set(["history", "optimize", "risk", "contributor"]).has(mode)) throw new Error("Choose a valid analysis mode.");

  const { owner, repo } = parseGitHubUrl(repositoryUrl || "");
  const repository = await getRepository(owner, repo);
  const content = await getFileContent(owner, repo, path, repository.branch);
  const evidenceQuestion = snippet ? `${question} ${snippet.slice(0, 500)}` : question;
  const { evidence, searchTerms } = await collectEvidence({ owner, repo, path, question: evidenceQuestion });
  const generatedTrace = await explainWithGemma({ path, question, content, snippet, evidence, mode });
  const trace = generatedTrace || createFallbackAnalysis({ mode, path, content, snippet, evidence });
  sendJson(response, 200, {
    ...trace,
    searchTerms,
    model: generatedTrace?.model || (mode === "history" ? "evidence-only" : "local-rules")
  });
}

async function staticRoute(url, response) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(publicDirectory, safePath);

  if (!filePath.startsWith(publicDirectory)) {
    sendJson(response, 403, { error: "Access denied." });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Page not found." });
      return;
    }
    throw error;
  }
}

async function requestHandler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  );

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/repository") {
      await repositoryRoute(url, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/file") {
      await fileRoute(url, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/trace") {
      await traceRoute(request, response);
      return;
    }
    if (request.method === "GET" || request.method === "HEAD") {
      await staticRoute(url, response);
      return;
    }
    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Request contains invalid JSON." : error.message;
    sendJson(response, 400, { error: message || "Unexpected server error." });
  }
}

const isDirectRun = !process.env.VERCEL
  && process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
const server = isDirectRun ? createServer(requestHandler) : null;

if (server) {
  server.listen(port, () => {
    console.log(`GhostTrace running at http://localhost:${port}`);
  });
}

export { requestHandler, server };
