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
  {
    id: "pharmacies",
    label: "Аптеки",
    singular: "Аптека",
    color: "#bc5275",
    target: 3,
  },
  {
    id: "clinics",
    label: "Поликлиники",
    singular: "Поликлиника",
    color: "#348e9c",
    target: 2,
  },
  {
    id: "kindergartens",
    label: "Детские сады",
    singular: "Детский сад",
    color: "#b27b28",
    target: 3,
  },
  {
    id: "sports",
    label: "Спортплощадки",
    singular: "Спортплощадка",
    color: "#647ca3",
    target: 4,
  },
  {
    id: "pickup",
    label: "Пункты выдачи",
    singular: "Пункт выдачи",
    color: "#a268ae",
    target: 4,
  },
] as const;
export type Category = (typeof categories)[number]["id"];
export type Point = { lat: number; lon: number; label: string };
export type Place = Point & {
  id: string;
  category: Category;
  distance: number;
  address?: string;
  openingHours?: string;
  hasName?: boolean;
  distanceBasis?: "point" | "center" | "entrance";
  sourceIds?: string[];
  transportIdentity?: {
    name: string;
    ref?: string;
    direction?: string;
    mode: string;
    representation: string;
  };
};
export type Analysis = { places: Place[]; fetchedAt: string; radius: number };
export type Weights = Record<Category, number>;
export const defaultWeights = Object.fromEntries(
  categories.map((c) => [c.id, 3]),
) as Weights;
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
  nodes?: number[];
  members?: { type: string; ref: number; role?: string }[];
};
export function parsePlaces(
  elements: OsmElement[],
  origin: Point,
  radius: number,
): Place[] {
  const seen = new Set<string>();
  const byId = new Map(elements.map((e) => [`${e.type}/${e.id}`, e]));
  return deduplicateStops(
    elements
      .flatMap((e) => {
        const t = e.tags ?? {};
        const raw = e.center ?? e;
        if (typeof raw.lat !== "number" || typeof raw.lon !== "number")
          return [];
        let pos: { lat: number; lon: number } = { lat: raw.lat, lon: raw.lon };
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
        const resolved = category ?? classifyExtra(t);
        if (!resolved) return [];
        let distanceBasis: Place["distanceBasis"] = e.center
          ? "center"
          : "point";
        if (resolved === "parks") {
          const entrances = parkEntrances(e, byId).sort(
            (a, b) => distance(origin, a) - distance(origin, b),
          );
          if (entrances[0]) {
            pos = entrances[0];
            distanceBasis = "entrance";
          }
        }
        const d = distance(origin, { lat: pos.lat, lon: pos.lon });
        const key = `${e.type}/${e.id}`;
        if (d > radius || seen.has(key)) return [];
        seen.add(key);
        return [
          {
            id: key,
            lat: pos.lat,
            lon: pos.lon,
            label:
              t.name?.trim() ||
              t.brand?.trim() ||
              categories.find((c) => c.id === resolved)!.singular,
            hasName: Boolean(t.name?.trim() || t.brand?.trim()),
            distanceBasis,
            sourceIds: [key],
            transportIdentity:
              resolved === "transport"
                ? {
                    name: (t.name || "")
                      .trim()
                      .toLocaleLowerCase("ru")
                      .replace(/ё/g, "е")
                      .replace(/\s+/g, " "),
                    ref: t.ref,
                    direction: t.direction,
                    mode:
                      t.railway === "station" || t.railway === "halt"
                        ? "rail"
                        : t.highway === "bus_stop" || t.bus === "yes"
                          ? "bus"
                          : t.tram === "yes"
                            ? "tram"
                            : "unknown",
                    representation:
                      t.highway === "bus_stop" ? "stop" : "platform",
                  }
                : undefined,
            address:
              t["addr:full"]?.trim() ||
              [
                t["addr:city"],
                [t["addr:street"] || t["addr:place"], t["addr:housenumber"]]
                  .filter(Boolean)
                  .join(", "),
                t["addr:unit"] ? `пом. ${t["addr:unit"]}` : undefined,
              ]
                .filter(Boolean)
                .join(", ") ||
              undefined,
            openingHours: t.opening_hours?.trim() || undefined,
            category: resolved,
            distance: Math.round(d),
          },
        ];
      })
      .sort((a, b) => a.distance - b.distance),
  );
}

function classifyExtra(t: Record<string, string>): Category | undefined {
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy")
    return "pharmacies";
  if (t.amenity === "clinic" || t.healthcare === "clinic") return "clinics";
  if (t.amenity === "kindergarten") return "kindergartens";
  if (["pitch", "fitness_station"].includes(t.leisure)) return "sports";
  if (
    t.shop === "outpost" ||
    (t.amenity === "parcel_locker" && t.parcel_pickup !== "no") ||
    t["post_office:parcel_pickup"] === "yes"
  )
    return "pickup";
}
function parkEntrances(
  park: OsmElement,
  byId: Map<string, OsmElement>,
): Point[] {
  const ways =
    park.type === "way"
      ? [park]
      : (park.members ?? [])
          .filter((m) => m.type === "way" && (!m.role || m.role === "outer"))
          .flatMap((m) => byId.get(`way/${m.ref}`) ?? []);
  const ids = new Set(ways.flatMap((w) => w.nodes ?? []));
  return [...ids].flatMap((id) => {
    const n = byId.get(`node/${id}`);
    const t = n?.tags ?? {};
    const entrance =
      ["yes", "main", "secondary", "entrance"].includes(t.entrance) ||
      ["gate", "kissing_gate", "swing_gate"].includes(t.barrier);
    const allowed =
      t.foot === "yes" ||
      t.foot === "designated" ||
      (!["no", "private"].includes(t.foot) &&
        !["no", "private"].includes(t.access));
    return entrance &&
      allowed &&
      typeof n?.lat === "number" &&
      typeof n.lon === "number"
      ? [{ lat: n.lat, lon: n.lon, label: "" }]
      : [];
  });
}
function deduplicateStops(places: Place[]): Place[] {
  const result: Place[] = [];
  for (const p of places) {
    const a = p.transportIdentity;
    const duplicate =
      a?.name &&
      result.find((q) => {
        const b = q.transportIdentity;
        return (
          b &&
          a.name === b.name &&
          a.mode === b.mode &&
          a.mode !== "unknown" &&
          a.representation !== b.representation &&
          !(a.ref && b.ref && a.ref !== b.ref) &&
          !(a.direction && b.direction && a.direction !== b.direction) &&
          distance(p, q) <= 12
        );
      });
    if (duplicate) {
      duplicate.sourceIds!.push(...p.sourceIds!);
      duplicate.address ??= p.address;
      duplicate.openingHours ??= p.openingHours;
    } else result.push(p);
  }
  return result;
}
export function dataQuality(places: Place[]) {
  const total = places.length;
  const named = places.filter((p) => p.hasName).length;
  const addressed = places.filter((p) => p.address).length;
  const scheduled = places.filter((p) => p.openingHours).length;
  const parks = places.filter((p) => p.category === "parks");
  return {
    total,
    named,
    addressed,
    scheduled,
    percent: total
      ? Math.round(((named + addressed + scheduled) / (total * 3)) * 100)
      : null,
    merged: places.reduce(
      (n, p) => n + Math.max(0, (p.sourceIds?.length ?? 1) - 1),
      0,
    ),
    parks: parks.length,
    entrances: parks.filter((p) => p.distanceBasis === "entrance").length,
  };
}
