import { cached, overpass, headers, apiError } from "@/lib/server";
import { parsePlaces, type OsmElement } from "@/lib/geo";
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
    const result = await cached(`nearby:${lat}:${lon}:${radius}`, 3600000, () =>
      overpass(async () => {
        const around = `(around:${radius},${lat},${lon})`;
        const query = `[out:json][timeout:25];(nwr[shop~"^(supermarket|convenience|grocery)$"]${around};nwr[amenity=school]${around};nwr[leisure~"^(park|garden)$"]${around};nwr[highway=bus_stop]${around};nwr[public_transport=platform]${around};nwr[railway~"^(station|halt)$"]${around};);out center tags;`;
        const res = await fetch(
          process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
          {
            method: "POST",
            headers: {
              ...headers(),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ data: query }),
            signal: AbortSignal.timeout(30000),
            cache: "no-store",
          },
        );
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const data = (await res.json()) as {
          elements: OsmElement[];
          remark?: string;
        };
        if (data.remark || !Array.isArray(data.elements))
          throw new Error("Incomplete response");
        return {
          places: parsePlaces(data.elements, { lat, lon, label: "" }, radius),
          radius,
          fetchedAt: new Date().toISOString(),
        };
      }),
    );
    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}
