# Demo guide

## One-line pitch

GhostTrace helps new contributors understand why unfamiliar code exists by connecting it to the repository's real history.

## 90-second demonstration

1. Open GhostTrace and point out the built-in sample repository.
2. Select `src/auth/session.ts`.
3. Ask: “Why is this retry needed?”
4. Click **Trace history**.
5. Read the explanation about slow-network login failures.
6. Show the issue, pull request, and commit evidence cards.
7. Point out the decision timeline and confidence score.
8. Switch to **Optimize** and show the current-versus-recommended comparison.
9. Switch to **Risk scan** and show the risk dashboard.
10. Expand the report panel and highlight a code snippet.

## Key message for judges

Repository code preserves the final implementation, while the reasoning is scattered across discussions and commits. GhostTrace brings that reasoning back into the code-reading experience without hiding its sources.

## Honest limitations

- Only public GitHub repositories are supported.
- Search quality depends on commit messages and issue descriptions.
- Large or binary files are intentionally excluded.
- The local Gemma model must already be installed for AI explanations.
