import test from "node:test";
import assert from "node:assert/strict";
import { createFallbackAnalysis, createFallbackTrace, deriveSearchTerms } from "../src/trace.js";

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

test("optimization fallback returns actionable insights", () => {
  const result = createFallbackAnalysis({
    mode: "optimize",
    path: "src/load.js",
    content: "for (const item of items) { await load(item); }",
    evidence: []
  });
  assert.equal(result.title, "Optimization review for load.js");
  assert.ok(result.insights.length >= 2);
});

test("risk fallback identifies browser storage", () => {
  const result = createFallbackAnalysis({
    mode: "risk",
    path: "src/token.js",
    content: "localStorage.setItem('token', value);",
    evidence: []
  });
  assert.match(result.insights[0], /Browser storage/);
});
