# Architecture

GhostTrace uses a small three-part design that is easy to explain.

```text
Browser interface
      |
      | repository URL, file, question
      v
Node.js server
      |
      +---- GitHub API: files, commits, issues, pull requests
      |
      +---- Ollama: local Gemma explanation
      |
      v
Evidence-backed answer
```

## 1. Browser interface

The browser displays the repository files, selected source code, explanation, evidence cards, and timeline. It never receives a GitHub token.

## 2. Node.js server

The server exposes three small API routes:

- `GET /api/repository` loads repository information and text files.
- `GET /api/file` loads one selected file.
- `POST /api/trace` collects history and creates an explanation.

GitHub responses are cached for five minutes to make repeated demonstrations faster and reduce rate-limit usage.

## 3. Explanation pipeline

The trace route:

1. Reads the selected file.
2. Gets commits that changed the file.
3. Searches related issues and pull requests.
4. Sends the code and numbered evidence to Gemma.
5. Accepts only source numbers that were actually supplied.
6. Returns the explanation with the original evidence links.

Gemma runs locally through Ollama. When Ollama is unavailable, the server builds a cautious evidence-only summary so the application remains usable.
