import { requestHandler } from "../server.js";

function createNodeRequest(request) {
  const url = new URL(request.url);

  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: Object.fromEntries(request.headers),
    body: null,
    async *[Symbol.asyncIterator]() {
      if (this.body) yield this.body;
    }
  };
}

function createNodeResponse() {
  const headers = new Headers();
  let status = 200;
  let body = "";

  return {
    setHeader(name, value) {
      headers.set(name, value);
    },
    writeHead(nextStatus, nextHeaders = {}) {
      status = nextStatus;
      Object.entries(nextHeaders).forEach(([name, value]) => headers.set(name, value));
    },
    end(value = "") {
      body = value;
    },
    toResponse() {
      return new Response(body, { status, headers });
    }
  };
}

export default {
  async fetch(request) {
    const nodeRequest = createNodeRequest(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      nodeRequest.body = await request.text();
    }

    const nodeResponse = createNodeResponse();
    await requestHandler(nodeRequest, nodeResponse);
    return nodeResponse.toResponse();
  }
};
