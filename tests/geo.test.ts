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
    score(
      [],
      Object.fromEntries(
        Object.keys(defaultWeights).map((k) => [k, 0]),
      ) as typeof defaultWeights,
    ),
    null,
  );
  const places = parsePlaces(
    [{ type: "node", id: 1, lat: 0, lon: 0, tags: { amenity: "school" } }],
    { lat: 0, lon: 0, label: "" },
    500,
  );
  assert.equal(
    score(places, {
      ...Object.fromEntries(Object.keys(defaultWeights).map((k) => [k, 0])),
      schools: 5,
    } as typeof defaultWeights),
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

test("place details preserve OSM addresses and opening hours without inventing missing data", () => {
  const places = parsePlaces(
    [
      {
        type: "node",
        id: 10,
        lat: 0,
        lon: 0,
        tags: {
          shop: "supermarket",
          name: "Магазин",
          "addr:city": "Москва",
          "addr:street": "Тверская улица",
          "addr:housenumber": "13",
          opening_hours: "Mo-Fr 09:00-21:00",
        },
      },
      {
        type: "way",
        id: 11,
        center: { lat: 0, lon: 0 },
        tags: {
          leisure: "park",
          "addr:full": "Полный адрес",
          "addr:street": "Не использовать",
          opening_hours: "24/7",
        },
      },
      { type: "node", id: 12, lat: 0, lon: 0, tags: { amenity: "school" } },
    ],
    { lat: 0, lon: 0, label: "A" },
    500,
  );
  assert.equal(places[0].address, "Москва, Тверская улица, 13");
  assert.equal(places[0].openingHours, "Mo-Fr 09:00-21:00");
  assert.equal(places[1].address, "Полный адрес");
  assert.equal(places[1].openingHours, "24/7");
  assert.equal(places[2].address, undefined);
  assert.equal(places[2].openingHours, undefined);
});
