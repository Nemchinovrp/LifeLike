import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as nearby } from "../app/api/nearby/route";
import { GET as search } from "../app/api/search/route";

test("invalid coordinates, unsupported radii and short searches are rejected", async () => {
  for (const query of [
    "lat=91&lon=0&radius=500",
    "lat=&lon=0&radius=500",
    "lat=0&lon=0&radius=501",
    "lat=NaN&lon=0&radius=500",
  ]) {
    assert.equal(
      (await nearby(new Request(`http://localhost/api/nearby?${query}`)))
        .status,
      400,
    );
  }
  assert.equal(
    (await search(new Request("http://localhost/api/search?q=ab"))).status,
    400,
  );
});

test("partial Overpass replies are errors, retried success is cached", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.ok(String(init?.body).includes("around"));
    return Response.json(
      calls === 1
        ? { elements: [], remark: "runtime error: timeout" }
        : {
            elements: [
              {
                type: "node",
                id: 123,
                lat: 1,
                lon: 1,
                tags: { shop: "supermarket" },
              },
            ],
          },
    );
  };
  try {
    const request = () =>
      new Request("http://localhost/api/nearby?lat=1&lon=1&radius=500");
    assert.equal((await nearby(request())).status, 502);
    const result = await nearby(request());
    assert.equal(result.status, 200);
    assert.equal((await result.json()).places.length, 1);
    assert.equal((await nearby(request())).status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
