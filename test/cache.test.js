import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCache } from "../src/cache.js";

test("MemoryCache stores and clears values", () => {
  const cache = new MemoryCache();
  cache.set("repo", { name: "ghosttrace" });
  assert.deepEqual(cache.get("repo"), { name: "ghosttrace" });
  cache.clear();
  assert.equal(cache.get("repo"), undefined);
});

test("MemoryCache removes expired values", () => {
  const cache = new MemoryCache(-1);
  cache.set("old", true);
  assert.equal(cache.get("old"), undefined);
});
