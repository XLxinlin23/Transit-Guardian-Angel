import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LTA_BUS_STOPS = "https://datamall2.mytransport.sg/ltaodataservice/BusStops";

export type BusStop = {
  code: string;
  name: string;
  road: string;
  lat: number;
  lng: number;
};

export type NearbyBusStop = BusStop & { distanceMetres: number };

type LtaBusStop = {
  BusStopCode: string;
  Description: string;
  RoadName: string;
  Latitude: number;
  Longitude: number;
};

let cache: { stops: BusStop[]; loadedAt: number } | null = null;
const CACHE_MS = 24 * 60 * 60 * 1000;

async function loadAllStops(key: string): Promise<BusStop[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_MS) return cache.stops;

  const stops: BusStop[] = [];
  for (let skip = 0; skip < 8000; skip += 500) {
    const res = await fetch(`${LTA_BUS_STOPS}?$skip=${skip}`, {
      headers: { AccountKey: key, accept: "application/json" },
    });
    if (!res.ok) break;
    const payload = (await res.json()) as { value?: LtaBusStop[] };
    const page = payload.value ?? [];
    if (!page.length) break;
    for (const s of page) {
      stops.push({
        code: s.BusStopCode,
        name: s.Description,
        road: s.RoadName,
        lat: s.Latitude,
        lng: s.Longitude,
      });
    }
    if (page.length < 500) break;
  }

  if (stops.length) cache = { stops, loadedAt: Date.now() };
  return stops;
}

function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export const getNearbyBusStops = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ lat: z.number(), lng: z.number(), limit: z.number().min(1).max(10).optional() }).parse(data),
  )
  .handler(async ({ data }): Promise<{ configured: boolean; stops: NearbyBusStop[] }> => {
    const key = process.env["LTA_ACCOUNT_KEY"] ?? "";
    if (!key) return { configured: false, stops: [] };

    const all = await loadAllStops(key);
    const limit = data.limit ?? 5;
    const stops = all
      .map((stop) => ({ ...stop, distanceMetres: distanceMetres(data.lat, data.lng, stop.lat, stop.lng) }))
      .sort((a, b) => a.distanceMetres - b.distanceMetres)
      .slice(0, limit);
    return { configured: true, stops };
  });

export const searchBusStops = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ query: z.string().min(2).max(60) }).parse(data))
  .handler(async ({ data }): Promise<{ configured: boolean; stops: BusStop[] }> => {
    const key = process.env["LTA_ACCOUNT_KEY"] ?? "";
    if (!key) return { configured: false, stops: [] };

    const all = await loadAllStops(key);
    const q = data.query.trim().toLowerCase();
    if (/^\d{3,5}$/.test(q)) {
      return { configured: true, stops: all.filter((s) => s.code.startsWith(q)).slice(0, 8) };
    }
    const stops = all
      .filter((s) => `${s.name} ${s.road}`.toLowerCase().includes(q))
      .slice(0, 8);
    return { configured: true, stops };
  });
