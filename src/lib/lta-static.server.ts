/** Cached static LTA DataMall reference data (bus stops and bus route sequences). */

const BASE = "https://datamall2.mytransport.sg/ltaodataservice";
const CACHE_MS = 24 * 60 * 60 * 1000;

export type BusStopRecord = {
  code: string;
  name: string;
  road: string;
  lat: number;
  lng: number;
};

export type RouteStop = { code: string; seq: number };

export type BusRouteIndex = {
  /** `${service}|${direction}` -> ordered stop codes */
  sequences: Map<string, RouteStop[]>;
  /** stop code -> route keys with the sequence number at that stop */
  byStop: Map<string, Array<{ key: string; seq: number }>>;
};

type Cache<T> = { value: T; loadedAt: number } | null;

let stopCache: Cache<BusStopRecord[]> = null;
let routeCache: Cache<BusRouteIndex> = null;
let stopPromise: Promise<BusStopRecord[]> | null = null;
let routePromise: Promise<BusRouteIndex> | null = null;

export function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

async function fetchPage(path: string, key: string, skip: number) {
  const res = await fetch(`${BASE}/${path}?$skip=${skip}`, {
    headers: { AccountKey: key, accept: "application/json" },
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { value?: unknown[] };
  return payload.value ?? [];
}

async function fetchAll(path: string, key: string, maxRows: number) {
  const rows: unknown[] = [];
  const batch = 8;
  for (let start = 0; start < maxRows; start += 500 * batch) {
    const skips: number[] = [];
    for (let i = 0; i < batch; i += 1) {
      const skip = start + i * 500;
      if (skip < maxRows) skips.push(skip);
    }
    const pages = await Promise.all(skips.map((skip) => fetchPage(path, key, skip)));
    let short = false;
    for (const page of pages) {
      rows.push(...page);
      if (page.length < 500) short = true;
    }
    if (short) break;
  }
  return rows;
}

export async function loadBusStops(key: string): Promise<BusStopRecord[]> {
  if (stopCache && Date.now() - stopCache.loadedAt < CACHE_MS) return stopCache.value;
  if (stopPromise) return stopPromise;

  stopPromise = (async () => {
    const rows = (await fetchAll("BusStops", key, 8000)) as Array<{
      BusStopCode: string;
      Description: string;
      RoadName: string;
      Latitude: number;
      Longitude: number;
    }>;
    const stops = rows.map((s) => ({
      code: s.BusStopCode,
      name: s.Description,
      road: s.RoadName,
      lat: s.Latitude,
      lng: s.Longitude,
    }));
    if (stops.length) stopCache = { value: stops, loadedAt: Date.now() };
    return stops;
  })();

  try {
    return await stopPromise;
  } finally {
    stopPromise = null;
  }
}

export async function loadBusRoutes(key: string): Promise<BusRouteIndex> {
  if (routeCache && Date.now() - routeCache.loadedAt < CACHE_MS) return routeCache.value;
  if (routePromise) return routePromise;

  routePromise = (async () => {
    const rows = (await fetchAll("BusRoutes", key, 30000)) as Array<{
      ServiceNo: string;
      Direction: number;
      StopSequence: number;
      BusStopCode: string;
    }>;
    const sequences = new Map<string, RouteStop[]>();
    const byStop = new Map<string, Array<{ key: string; seq: number }>>();
    for (const row of rows) {
      if (!row?.ServiceNo || !row.BusStopCode) continue;
      const key = `${row.ServiceNo}|${row.Direction}`;
      const list = sequences.get(key) ?? [];
      list.push({ code: row.BusStopCode, seq: row.StopSequence });
      sequences.set(key, list);
      const stopList = byStop.get(row.BusStopCode) ?? [];
      stopList.push({ key, seq: row.StopSequence });
      byStop.set(row.BusStopCode, stopList);
    }
    for (const list of sequences.values()) list.sort((a, b) => a.seq - b.seq);
    const index: BusRouteIndex = { sequences, byStop };
    if (rows.length) routeCache = { value: index, loadedAt: Date.now() };
    return index;
  })();

  try {
    return await routePromise;
  } finally {
    routePromise = null;
  }
}
