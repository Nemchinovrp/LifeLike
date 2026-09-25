import { loadOverpass, OverpassUnavailable } from "@/lib/overpass-client";
import { nearbyQuery } from "@/lib/overpass";
import { cached, overpass, apiError } from "@/lib/server";
import { parsePlaces } from "@/lib/geo";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get("lat")),
    lon = Number(p.get("lon")),
    radius = Number(p.get("radius"));
  if (
    !p.get("lat")?.trim() ||
    !p.get("lon")?.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    ![500, 1000, 2000].includes(radius)
  )
    return Response.json(
      { error: "Некорректные координаты или радиус." },
      { status: 400 },
    );
  try {
    const result = await cached(
      `nearby:v2:${lat}:${lon}:${radius}`,
      3600000,
      () =>
        overpass(async () => {
          const query = nearbyQuery(lat, lon, radius);
          const elements = await loadOverpass(query);
          return {
            places: parsePlaces(elements, { lat, lon, label: "" }, radius),
            radius,
            fetchedAt: new Date().toISOString(),
          };
        }),
    );
    return Response.json(result);
  } catch (e) {
    if (e instanceof OverpassUnavailable)
      return Response.json(
        { error: e.message },
        { status: 503, headers: { "Retry-After": "60" } },
      );
    return apiError(e);
  }
}
