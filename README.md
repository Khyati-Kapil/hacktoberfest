# GhostTrace

GhostTrace explains **why code exists** by connecting a file to the commits, issues, and pull requests that shaped it.

New contributors often understand what a function does but cannot find the original reason behind it. GhostTrace gathers the repository history, asks a configured AI model to explain it in simple language, and keeps every answer linked to evidence.

## What it does

1. Paste a public GitHub repository URL.
2. Select a source file.
3. Optionally select a code snippet.
4. Choose History, Optimize, Risk scan, or Contributor brief.
5. Review the mode-specific report, confidence, and sources.

If a local model is unavailable, GhostTrace still shows an evidence-only result. If the history is weak, it says so instead of inventing a reason.

## Features

- Public GitHub repository browser
- File viewer and filter
- File and snippet-level analysis
- History, optimization, risk, and contributor modes
- File-specific commit history
- Related issue and pull-request search
- Hosted AI through Groq, or local models through Ollama
- Evidence cards that open the original GitHub source
- Visual decision timeline
- Expandable analysis report
- Honest confidence and missing-history states
- Built-in sample repository for offline demonstrations

## Stack

- Node.js built-in HTTP server
- Plain HTML, CSS, and JavaScript
- GitHub REST API
- Groq API or Ollama
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

## Enable Groq

Set `GROQ_API_KEY` on the server (or in Vercel environment variables). Groq takes priority when this key is present. The default model is `openai/gpt-oss-20b`; optionally override it with `GROQ_MODEL`. Keys stay on the backend. Redeploy after changing Vercel environment variables.

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

## Deploy to Vercel

GhostTrace includes a Vercel serverless adapter and serves the frontend from `public/`.

1. Import `Khyati-Kapil/hacktoberfest` at [vercel.com/new](https://vercel.com/new).
2. Leave **Framework Preset** as `Other`.
3. Leave the root directory as the repository root.
4. Add `GITHUB_TOKEN` under **Project Settings → Environment Variables** for Production, Preview, and Development.
5. Add `GROQ_API_KEY` to enable hosted AI explanations.
6. Click **Deploy**.

The local Ollama process cannot run inside Vercel. On Vercel, use `GROQ_API_KEY` for hosted AI. Without a key or a separately hosted `OLLAMA_URL`, GhostTrace uses evidence-only and local-rule fallbacks. Do not expose an unauthenticated Ollama server to the public internet.

To deploy from the CLI instead:

```bash
npx vercel
npx vercel env add GITHUB_TOKEN
npx vercel --prod
```

## Test

```bash
npm test
```

## Project structure

```text
public/             Browser interface
  index.html        Application layout
  styles.clean.css  Visual design
  app.js            UI behavior and API calls
  demo-data.js      Offline demonstration
src/
  github.js         GitHub REST API client
  trace.js          Evidence collection and fallback explanation
  ai.js             Groq and local Ollama connections
  cache.js          Short-lived response cache
test/               Unit tests
local-server.js     HTTP server and API routes
api/                 Vercel serverless adapter
vercel.json          Vercel configuration
```

See [Architecture](docs/ARCHITECTURE.md) for the request flow and [Demo Guide](docs/DEMO.md) for a short presentation script.

## License

This project is available under the repository's license.
