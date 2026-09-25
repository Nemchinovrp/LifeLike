import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distance,
  parsePlaces,
  score,
  defaultWeights,
  type OsmElement,
} from "../lib/geo";
import { cached } from "../lib/server";
test("haversine handles coincident points and known equatorial distance", () => {
  assert.equal(distance({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  assert.ok(
    Math.abs(distance({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111195) < 1,
  );
});
test("OSM parsing classifies centers, removes duplicate IDs and objects outside radius", () => {
  const elements: OsmElement[] = [
    {
      type: "node",
      id: 1,
      lat: 0,
      lon: 0,
      tags: { shop: "supermarket", name: "Test" },
    },
    {
      type: "way",
      id: 2,
      center: { lat: 0, lon: 0.001 },
      tags: { leisure: "park" },
    },
    { type: "node", id: 3, lat: 10, lon: 10, tags: { amenity: "school" } },
  ];
  const places = parsePlaces(
    [...elements, elements[0]],
    { lat: 0, lon: 0, label: "" },
    500,
  );
  assert.equal(places.length, 2);
  assert.equal(places[1].category, "parks");
  assert.equal(places[1].distance, 111);
});
test("weights exclude categories and all zero weights do not produce a score", () => {
  assert.equal(score([], defaultWeights), 0);
  assert.equal(
    score([], { shops: 0, parks: 0, schools: 0, transport: 0 }),
    null,
  );
  const places = parsePlaces(
    [{ type: "node", id: 1, lat: 0, lon: 0, tags: { amenity: "school" } }],
    { lat: 0, lon: 0, label: "" },
    500,
  );
  assert.equal(
    score(places, { shops: 0, schools: 5, parks: 0, transport: 0 }),
    33,
  );
});
test("cache coalesces simultaneous requests and does not cache failures", async () => {
  let calls = 0;
  const loader = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return 42;
  };
  assert.deepEqual(
    await Promise.all([
      cached("test", 1000, loader),
      cached("test", 1000, loader),
    ]),
    [42, 42],
  );
  await cached("test", 1000, loader);
  assert.equal(calls, 1);
  await assert.rejects(
    cached("failure", 1000, async () => {
      throw new Error("offline");
    }),
  );
  assert.equal(await cached("failure", 1000, async () => 7), 7);
});
