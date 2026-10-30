import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getFileContent,
  getRepository,
  getRepositoryFiles,
  parseGitHubUrl
} from "./src/github.js";

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

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

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
      await readJson(request);
      sendJson(response, 501, { error: "History tracing is added in the next step." });
      return;
    }
    if (request.method === "GET") {
      await staticRoute(url, response);
      return;
    }
    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Request contains invalid JSON." : error.message;
    sendJson(response, 400, { error: message || "Unexpected server error." });
  }
});

server.listen(port, () => {
  console.log(`GhostTrace running at http://localhost:${port}`);
});

export { server };
