import { headers } from "./server";
import type { OsmElement } from "./geo";
const primary = "https://overpass-api.de/api/interpreter";
const fallback = "https://overpass.private.coffee/api/interpreter";
const cooldown = new Map<string, number>();
export class OverpassUnavailable extends Error {
  constructor() {
    super(
      "Серверы OpenStreetMap сейчас перегружены или недоступны. Повторите загрузку через минуту.",
    );
  }
}
export function overpassEndpoints() {
  const first = process.env.OVERPASS_URL || primary;
  const second =
    process.env.OVERPASS_FALLBACK_URL ?? (first === primary ? fallback : "");
  return [...new Set([first, second].filter(Boolean))];
}
export async function loadOverpass(
  query: string,
  endpoints = overpassEndpoints(),
): Promise<OsmElement[]> {
  const available = endpoints.filter(
    (url) => (cooldown.get(url) ?? 0) <= Date.now(),
  );
  if (!available.length) throw new OverpassUnavailable();
  for (const endpoint of available.slice(0, 2)) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...headers(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(28000),
        cache: "no-store",
      });
      if (response.status === 400) throw new Error("OVERPASS_INVALID_QUERY");
      if (!response.ok) throw new OverpassUnavailable();
      const data = (await response.json()) as {
        elements?: OsmElement[];
        remark?: string;
      };
      if (data.remark || !Array.isArray(data.elements))
        throw new OverpassUnavailable();
      cooldown.delete(endpoint);
      return data.elements;
    } catch (error) {
      if (error instanceof Error && error.message === "OVERPASS_INVALID_QUERY")
        throw error;
      // No coordinates, search strings or raw upstream responses are logged.
      console.warn(
        "Overpass unavailable:",
        new URL(endpoint).host,
        error instanceof Error ? error.name : "UnknownError",
      );
      cooldown.set(endpoint, Date.now() + 60000);
    }
  }
  throw new OverpassUnavailable();
}
