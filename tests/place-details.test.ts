import { test } from "node:test";
import assert from "node:assert/strict";
import { walkingUrl } from "../components/place-details";
test("walking directions use the selected address as origin, not device location", () => {
  const url = new URL(
    walkingUrl(
      { lat: 55.7, lon: 37.6, label: "B" },
      { lat: 55.71, lon: 37.61, label: "Shop" },
    ),
  );
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("origin"), "55.7,37.6");
  assert.equal(url.searchParams.get("destination"), "55.71,37.61");
  assert.equal(url.searchParams.get("travelmode"), "walking");
});
