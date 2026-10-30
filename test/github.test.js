import test from "node:test";
import assert from "node:assert/strict";
import { parseGitHubUrl } from "../src/github.js";

test("parseGitHubUrl reads owner and repository", () => {
  assert.deepEqual(parseGitHubUrl("https://github.com/Khyati-Kapil/hacktoberfest"), {
    owner: "Khyati-Kapil",
    repo: "hacktoberfest"
  });
});

test("parseGitHubUrl removes a git suffix", () => {
  assert.deepEqual(parseGitHubUrl("https://github.com/example/project.git"), {
    owner: "example",
    repo: "project"
  });
});

test("parseGitHubUrl rejects other hosts", () => {
  assert.throws(
    () => parseGitHubUrl("https://example.com/team/project"),
    /Only public github.com repositories/
  );
});
