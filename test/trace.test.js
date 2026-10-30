import test from "node:test";
import assert from "node:assert/strict";
import { createFallbackTrace, deriveSearchTerms } from "../src/trace.js";

test("deriveSearchTerms combines useful filename and question words", () => {
  assert.equal(
    deriveSearchTerms("src/auth/session.ts", "Why is the refresh retry needed?"),
    "session refresh retry needed"
  );
});

test("createFallbackTrace is honest when history is missing", () => {
  const trace = createFallbackTrace({ path: "src/empty.js", evidence: [] });
  assert.equal(trace.confidence, 20);
  assert.match(trace.explanation, /could not find enough public history/);
});

test("createFallbackTrace points to the strongest discussion", () => {
  const trace = createFallbackTrace({
    path: "src/auth.js",
    evidence: [
      {
        type: "issue",
        label: "Fix session expiry",
        detail: "Users are signed out early",
        url: "https://github.com/example/repo/issues/1"
      }
    ]
  });
  assert.equal(trace.title, "Fix session expiry");
  assert.equal(trace.confidence, 62);
});
