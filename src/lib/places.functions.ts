import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ResolvedPlace = {
  label: string;
  lat: number;
  lng: number;
  kind: "bus-stop" | "address";
};

const ONEMAP_SEARCH = "https://www.onemap.gov.sg/api/common/elastic/search";
const LTA_BUS_STOPS = "https://datamall2.mytransport.sg/ltaodataservice/BusStops";

type LtaBusStop = { BusStopCode: string; Description: string; RoadName: string; Latitude: number; Longitude: number };

async function findBusStop(query: string, accountKey: string): Promise<ResolvedPlace | null> {
  const target = query.trim().toLowerCase();
  const byCode = /^\d{5}$/.test(target);
  for (let skip = 0; skip < 6000; skip += 500) {
    const response = await fetch(`${LTA_BUS_STOPS}?$skip=${skip}`, { headers: { AccountKey: accountKey, accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { value?: LtaBusStop[] };
    const stops = payload.value ?? [];
    if (!stops.length) return null;
    const hit = stops.find((stop) =>
      byCode ? stop.BusStopCode === target : `${stop.Description} ${stop.RoadName}`.toLowerCase().includes(target),
    );
    if (hit) {
      return { label: `${hit.Description} (bus stop ${hit.BusStopCode})`, lat: hit.Latitude, lng: hit.Longitude, kind: "bus-stop" };
    }
  }
  return null;
}

export const resolvePlace = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ query: z.string().min(2).max(80) }).parse(data))
  .handler(async ({ data }): Promise<ResolvedPlace | null> => {
    const query = data.query.trim();
    const accountKey = process.env["LTA_ACCOUNT_KEY"];

    if (/^\d{5}$/.test(query) && accountKey) {
      const stop = await findBusStop(query, accountKey);
      if (stop) return stop;
    }

    const url = `${ONEMAP_SEARCH}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.ok) {
      const payload = (await response.json()) as {
        results?: Array<{ SEARCHVAL?: string; ADDRESS?: string; LATITUDE?: string; LONGITUDE?: string }>;
      };
      const hit = payload.results?.[0];
      if (hit?.LATITUDE && hit.LONGITUDE) {
        return {
          label: hit.SEARCHVAL || hit.ADDRESS || query,
          lat: Number(hit.LATITUDE),
          lng: Number(hit.LONGITUDE),
          kind: "address",
        };
      }
    }

    if (accountKey) {
      const stop = await findBusStop(query, accountKey);
      if (stop) return stop;
    }
    return null;
  });
