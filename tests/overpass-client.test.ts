import { test } from "node:test";
import assert from "node:assert/strict";
import { loadOverpass, OverpassUnavailable } from "../lib/overpass-client";
test("upstream 504 falls back, complete response succeeds; unhealthy endpoint is skipped", async () => {
  const original = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return String(url).includes("primary")
      ? new Response("<html>busy</html>", { status: 504 })
      : Response.json({ elements: [] });
  };
  try {
    const endpoints = ["https://primary.test/api", "https://fallback.test/api"];
    assert.deepEqual(await loadOverpass("query", endpoints), []);
    assert.deepEqual(await loadOverpass("query", endpoints), []);
    assert.deepEqual(seen, [endpoints[0], endpoints[1], endpoints[1]]);
  } finally {
    globalThis.fetch = original;
  }
});
test("partial and non-JSON replies fail, never presented as zero objects", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () =>
    ++calls === 1
      ? Response.json({ elements: [], remark: "timeout" })
      : new Response("<html>broken</html>");
  try {
    await assert.rejects(
      loadOverpass("query", [
        "https://partial.test/api",
        "https://html.test/api",
      ]),
      OverpassUnavailable,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("bad query is not retried against another provider", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("parse error", { status: 400 });
  };
  try {
    await assert.rejects(
      loadOverpass("query", [
        "https://syntax.test/api",
        "https://unused.test/api",
      ]),
      /OVERPASS_INVALID_QUERY/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
