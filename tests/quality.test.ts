import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlaces, dataQuality, type OsmElement } from "../lib/geo";
const origin = { lat: 0, lon: 0, label: "A" };
const node = (
  id: number,
  lon: number,
  tags: Record<string, string>,
): OsmElement => ({ type: "node", id, lat: 0, lon, tags });
test("five new categories and alternative tags are classified; delivery-only lockers excluded", () => {
  const tags = [
    { amenity: "pharmacy" },
    { healthcare: "clinic" },
    { amenity: "kindergarten" },
    { leisure: "fitness_station" },
    { shop: "outpost" },
    { amenity: "parcel_locker", parcel_pickup: "no" },
    { amenity: "parcel_locker" },
    { "post_office:parcel_pickup": "yes" },
  ] as Record<string, string>[];
  const places = parsePlaces(
    tags.map((t, i) => node(i, 0, t)),
    origin,
    500,
  );
  assert.deepEqual(
    places.map((p) => p.category),
    [
      "pharmacies",
      "clinics",
      "kindergartens",
      "sports",
      "pickup",
      "pickup",
      "pickup",
    ],
  );
});
test("nearest public entrance on park boundary replaces center even when center is outside radius", () => {
  const park: OsmElement = {
    type: "way",
    id: 1,
    center: { lat: 0, lon: 0.02 },
    nodes: [10, 11, 12],
    tags: { leisure: "park" },
  };
  const places = parsePlaces(
    [
      park,
      node(10, 0.001, { entrance: "main", access: "private" }),
      node(11, 0.002, { barrier: "gate" }),
      node(12, 0.003, { entrance: "yes" }),
      node(13, 0.0001, { entrance: "yes" }),
    ],
    origin,
    500,
  );
  assert.equal(places.length, 1);
  assert.equal(places[0].distanceBasis, "entrance");
  assert.equal(places[0].lon, 0.002);
  assert.equal(places[0].distance, 222);
});
test("multipolygon outer boundary entrances work; inner/building entrances are not used", () => {
  const park: OsmElement = {
    type: "relation",
    id: 1,
    center: { lat: 0, lon: 0.02 },
    members: [
      { type: "way", ref: 2, role: "outer" },
      { type: "way", ref: 3, role: "inner" },
    ],
    tags: { leisure: "park" },
  };
  const places = parsePlaces(
    [
      park,
      { type: "way", id: 2, nodes: [10] },
      { type: "way", id: 3, nodes: [11] },
      node(10, 0.002, { entrance: "main" }),
      node(11, 0.001, { entrance: "yes" }),
    ],
    origin,
    500,
  );
  assert.equal(places[0].lon, 0.002);
});
test("missing entrance is marked as center fallback and out-of-radius entrances exclude park", () => {
  const park: OsmElement = {
    type: "way",
    id: 1,
    center: { lat: 0, lon: 0.001 },
    nodes: [10],
    tags: { leisure: "park" },
  };
  assert.equal(parsePlaces([park], origin, 500)[0].distanceBasis, "center");
  assert.equal(
    parsePlaces([park, node(10, 0.02, { entrance: "yes" })], origin, 500)
      .length,
    0,
  );
});
test("duplicate stop/platform pairs are merged and retain useful fields and source IDs", () => {
  const places = parsePlaces(
    [
      node(1, 0, { highway: "bus_stop", name: " Ёлки " }),
      node(2, 0.00005, {
        public_transport: "platform",
        bus: "yes",
        name: "елки",
        "addr:full": "Улица, 1",
      }),
    ],
    origin,
    500,
  );
  assert.equal(places.length, 1);
  assert.deepEqual(places[0].sourceIds, ["node/1", "node/2"]);
  assert.equal(places[0].address, "Улица, 1");
  assert.equal(dataQuality(places).merged, 1);
});
test("stops with different directions, refs, modes, names or separation remain separate", () => {
  const first = node(1, 0, {
    highway: "bus_stop",
    name: "Школа",
    ref: "1",
    direction: "north",
  });
  for (const [lon, tags] of [
    [
      0.00005,
      {
        public_transport: "platform",
        bus: "yes",
        name: "Школа",
        direction: "south",
      },
    ],
    [
      0.00005,
      { public_transport: "platform", bus: "yes", name: "Школа", ref: "2" },
    ],
    [0.00005, { public_transport: "platform", tram: "yes", name: "Школа" }],
    [0.00005, { public_transport: "platform", bus: "yes", name: "Парк" }],
    [0.001, { public_transport: "platform", bus: "yes", name: "Школа" }],
  ] as [number, Record<string, string>][]) {
    assert.equal(
      parsePlaces([first, node(2, lon, tags)], origin, 500).length,
      2,
    );
  }
});
test("quality measures field presence, not completeness of regional coverage", () => {
  assert.equal(dataQuality([]).percent, null);
  const places = parsePlaces(
    [
      node(1, 0, {
        amenity: "pharmacy",
        name: "Аптека",
        "addr:full": "Улица, 1",
        opening_hours: "24/7",
      }),
      node(2, 0, { leisure: "park" }),
    ],
    origin,
    500,
  );
  assert.deepEqual(dataQuality(places), {
    total: 2,
    named: 1,
    addressed: 1,
    scheduled: 1,
    percent: 50,
    merged: 0,
    parks: 1,
    entrances: 0,
  });
});
