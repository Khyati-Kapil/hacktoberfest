# GhostTrace

GhostTrace explains **why code exists** by connecting a file to the commits, issues, and pull requests that shaped it.

New contributors often understand what a function does but cannot find the original reason behind it. GhostTrace gathers the repository history, asks a local Gemma model to explain it in simple language, and keeps every answer linked to evidence.

## What it does

1. Paste a public GitHub repository URL.
2. Select a source file.
3. Ask why the code exists.
4. Review a simple explanation, confidence score, sources, and timeline.

If a local model is unavailable, GhostTrace still shows an evidence-only result. If the history is weak, it says so instead of inventing a reason.

## Features

- Public GitHub repository browser
- File viewer and filter
- File-specific commit history
- Related issue and pull-request search
- Local Gemma explanations through Ollama
- Evidence cards that open the original GitHub source
- Visual decision timeline
- Honest confidence and missing-history states
- Built-in sample repository for offline demonstrations

## Stack

- Node.js built-in HTTP server
- Plain HTML, CSS, and JavaScript
- GitHub REST API
- Ollama with Gemma 3
- Node's built-in test runner

There are no runtime package dependencies, which keeps setup and presentation simple.

## Run locally

Requirements:

- Node.js 20 or newer
- Ollama for AI explanations (optional)

```bash
git clone https://github.com/Khyati-Kapil/hacktoberfest.git
cd hacktoberfest
npm start
```

Open [http://localhost:8000](http://localhost:8000).

The sample repository works immediately. Paste a public GitHub URL to use live data.

## Enable Gemma

Install Ollama, then run:

```bash
ollama pull gemma3:4b
ollama serve
```

GhostTrace automatically connects to Ollama at `http://127.0.0.1:11434`.

Optional environment variables:

```bash
export GITHUB_TOKEN="your-token"
export OLLAMA_MODEL="gemma3:4b"
export OLLAMA_URL="http://127.0.0.1:11434"
npm start
```

`GITHUB_TOKEN` raises the public GitHub API rate limit. Never commit a token.

## Test

```bash
npm test
```

## Project structure

```text
public/             Browser interface
  index.html        Application layout
  styles.css        Visual design
  app.js            UI behavior and API calls
  demo-data.js      Offline demonstration
src/
  github.js         GitHub REST API client
  trace.js          Evidence collection and fallback explanation
  ollama.js         Local Gemma connection
  cache.js          Short-lived response cache
test/               Unit tests
server.js           HTTP server and API routes
```

See [Architecture](docs/ARCHITECTURE.md) for the request flow and [Demo Guide](docs/DEMO.md) for a short presentation script.

## License

This project is available under the repository's license.
