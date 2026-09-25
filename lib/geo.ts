export const categories = [
  {
    id: "shops",
    label: "Продуктовые",
    singular: "Магазин",
    color: "#de963a",
    target: 8,
  },
  {
    id: "schools",
    label: "Школы",
    singular: "Школа",
    color: "#7870cb",
    target: 3,
  },
  {
    id: "parks",
    label: "Парки и скверы",
    singular: "Парк",
    color: "#318664",
    target: 3,
  },
  {
    id: "transport",
    label: "Остановки",
    singular: "Остановка",
    color: "#427fc2",
    target: 10,
  },
] as const;
export type Category = (typeof categories)[number]["id"];
export type Point = { lat: number; lon: number; label: string };
export type Place = Point & {
  id: string;
  category: Category;
  distance: number;
};
export type Analysis = { places: Place[]; fetchedAt: string; radius: number };
export type Weights = Record<Category, number>;
export const defaultWeights: Weights = {
  shops: 3,
  schools: 3,
  parks: 3,
  transport: 3,
};
export function distance(
  a: Pick<Point, "lat" | "lon">,
  b: Pick<Point, "lat" | "lon">,
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function score(places: Place[], weights: Weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (!total) return null;
  return Math.round(
    (categories.reduce(
      (sum, c) =>
        sum +
        Math.min(
          1,
          places.filter((p) => p.category === c.id).length / c.target,
        ) *
          weights[c.id],
      0,
    ) /
      total) *
      100,
  );
}
export type OsmElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
export function parsePlaces(
  elements: OsmElement[],
  origin: Point,
  radius: number,
): Place[] {
  const seen = new Set<string>();
  return elements
    .flatMap((e) => {
      const t = e.tags ?? {};
      const pos = e.center ?? e;
      if (typeof pos.lat !== "number" || typeof pos.lon !== "number") return [];
      const category: Category | undefined = [
        "supermarket",
        "convenience",
        "grocery",
      ].includes(t.shop)
        ? "shops"
        : t.amenity === "school"
          ? "schools"
          : ["park", "garden"].includes(t.leisure)
            ? "parks"
            : t.highway === "bus_stop" ||
                t.public_transport === "platform" ||
                t.railway === "station" ||
                t.railway === "halt"
              ? "transport"
              : undefined;
      if (!category) return [];
      const d = distance(origin, { lat: pos.lat, lon: pos.lon });
      const key = `${e.type}/${e.id}`;
      if (d > radius || seen.has(key)) return [];
      seen.add(key);
      return [
        {
          id: key,
          lat: pos.lat,
          lon: pos.lon,
          label: t.name ?? categories.find((c) => c.id === category)!.singular,
          category,
          distance: Math.round(d),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
}
