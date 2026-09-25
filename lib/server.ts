// Process-local bounded TTL cache and coalescing. Use shared storage for multiple replicas.
const cache = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
export async function cached<T>(
  key: string,
  ttl: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const task = loader()
    .then((value) => {
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + ttl });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
let geocodeBusy = false;
let nextGeocode = 0;
export class BusyError extends Error {}
export async function geocode<T>(loader: () => Promise<T>) {
  if (geocodeBusy || Date.now() < nextGeocode)
    throw new BusyError("Подождите секунду перед следующим поиском.");
  geocodeBusy = true;
  nextGeocode = Date.now() + 1100;
  try {
    return await loader();
  } finally {
    geocodeBusy = false;
  }
}
let overpassActive = 0;
export async function overpass<T>(loader: () => Promise<T>) {
  if (overpassActive >= 2)
    throw new BusyError(
      "Сервис занят. Повторите запрос через несколько секунд.",
    );
  overpassActive++;
  try {
    return await loader();
  } finally {
    overpassActive--;
  }
}
export const headers = () => ({
  "User-Agent":
    process.env.OSM_USER_AGENT || "LifeLike/0.1 (local portfolio project)",
  Accept: "application/json",
});
export function apiError(error: unknown) {
  const busy = error instanceof BusyError;
  return Response.json(
    {
      error: busy
        ? error.message
        : "Сервис карт временно недоступен. Попробуйте ещё раз.",
    },
    {
      status: busy ? 429 : 502,
      headers: busy ? { "Retry-After": "2" } : undefined,
    },
  );
}
