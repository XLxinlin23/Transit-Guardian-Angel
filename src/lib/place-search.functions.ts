import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
  postal: string | null;
  lat: number;
  lng: number;
  kind: "bus-stop" | "address";
};

const ONEMAP_SEARCH = "https://www.onemap.gov.sg/api/common/elastic/search";
const LTA_BUS_STOPS = "https://datamall2.mytransport.sg/ltaodataservice/BusStops";

/** Singapore bounding box — anything outside is rejected. */
export const SG_BOUNDS = { minLat: 1.15, maxLat: 1.48, minLng: 103.6, maxLng: 104.1 };

export function isInSingapore(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= SG_BOUNDS.minLat &&
    lat <= SG_BOUNDS.maxLat &&
    lng >= SG_BOUNDS.minLng &&
    lng <= SG_BOUNDS.maxLng
  );
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type OneMapResult = {
  SEARCHVAL?: string;
  ADDRESS?: string;
  POSTAL?: string;
  BLK_NO?: string;
  ROAD_NAME?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
};

type LtaBusStop = { BusStopCode: string; Description: string; RoadName: string; Latitude: number; Longitude: number };

function scoreResult(query: string, name: string, postal: string | null): number {
  const q = normalise(query);
  const n = normalise(name);
  let score = 0;
  if (/^\d{6}$/.test(q) && postal === q) score += 140;
  if (n === q) score += 100;
  else if (n.startsWith(q)) score += 55;
  else if (n.includes(q)) score += 25;
  // A result that only mentions the query inside a longer, unrelated name ranks lower.
  score -= Math.min(30, Math.max(0, n.length - q.length) / 4);
  if (/[()]/.test(name)) score -= 6;
  return score;
}

async function searchOneMap(query: string): Promise<PlaceSuggestion[]> {
  const url = `${ONEMAP_SEARCH}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return [];
  const payload = (await response.json()) as { results?: OneMapResult[] };
  const out: PlaceSuggestion[] = [];
  for (const row of payload.results ?? []) {
    const lat = Number(row.LATITUDE);
    const lng = Number(row.LONGITUDE);
    if (!isInSingapore(lat, lng)) continue;
    const postal = row.POSTAL && /^\d{6}$/.test(row.POSTAL) ? row.POSTAL : null;
    const name = (row.SEARCHVAL || row.ADDRESS || query).trim();
    const address = (row.ADDRESS || [row.BLK_NO, row.ROAD_NAME].filter(Boolean).join(" ")).trim();
    out.push({ id: `${name}-${lat}-${lng}`, name, address, postal, lat, lng, kind: "address" });
  }
  return out;
}

async function searchBusStops(query: string, accountKey: string): Promise<PlaceSuggestion[]> {
  const target = query.trim().toLowerCase();
  const byCode = /^\d{5}$/.test(target);
  const out: PlaceSuggestion[] = [];
  for (let skip = 0; skip < 8000 && out.length < 5; skip += 500) {
    const response = await fetch(`${LTA_BUS_STOPS}?$skip=${skip}`, {
      headers: { AccountKey: accountKey, accept: "application/json" },
    });
    if (!response.ok) break;
    const payload = (await response.json()) as { value?: LtaBusStop[] };
    const page = payload.value ?? [];
    if (!page.length) break;
    for (const stop of page) {
      const match = byCode
        ? stop.BusStopCode === target
        : `${stop.Description} ${stop.RoadName}`.toLowerCase().includes(target);
      if (!match) continue;
      if (!isInSingapore(stop.Latitude, stop.Longitude)) continue;
      out.push({
        id: `bus-${stop.BusStopCode}`,
        name: stop.Description,
        address: `${stop.RoadName} · bus stop ${stop.BusStopCode}`,
        postal: null,
        lat: stop.Latitude,
        lng: stop.Longitude,
        kind: "bus-stop",
      });
      if (out.length >= 5) break;
    }
  }
  return out;
}

/** Ranked place suggestions for the From/To pickers. The user must confirm one before routing. */
export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ query: z.string().min(2).max(80) }).parse(data))
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const query = data.query.trim();
    const accountKey = process.env["LTA_ACCOUNT_KEY"];

    const [places, stops] = await Promise.all([
      searchOneMap(query).catch(() => [] as PlaceSuggestion[]),
      /^\d{5}$/.test(query) && accountKey
        ? searchBusStops(query, accountKey).catch(() => [] as PlaceSuggestion[])
        : Promise.resolve([] as PlaceSuggestion[]),
    ]);

    const busStops =
      stops.length || !accountKey || /^\d{6}$/.test(query)
        ? stops
        : await searchBusStops(query, accountKey).catch(() => [] as PlaceSuggestion[]);

    const seen = new Set<string>();
    return [...places, ...busStops]
      .filter((item) => (seen.has(item.id) ? false : seen.add(item.id)))
      .map((item) => ({ item, score: scoreResult(query, item.name, item.postal) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.item);
  });
