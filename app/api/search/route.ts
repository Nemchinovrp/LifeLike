import { cached, geocode, headers, apiError } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3 || q.length > 200)
    return Response.json(
      { error: "Введите адрес длиной от 3 до 200 символов." },
      { status: 400 },
    );
  try {
    const results = await cached(
      `search:${q.toLocaleLowerCase("ru")}`,
      86400000,
      () =>
        geocode(async () => {
          const url = new URL(
            "/search",
            process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org",
          );
          url.search = new URLSearchParams({
            q,
            format: "jsonv2",
            limit: "5",
            "accept-language": "ru",
          }).toString();
          const res = await fetch(url, {
            headers: headers(),
            signal: AbortSignal.timeout(12000),
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`Nominatim ${res.status}`);
          const data = (await res.json()) as {
            lat: string;
            lon: string;
            display_name: string;
          }[];
          return data.map((p) => ({
            lat: Number(p.lat),
            lon: Number(p.lon),
            label: p.display_name,
          }));
        }),
    );
    return Response.json(results);
  } catch (e) {
    return apiError(e);
  }
}
