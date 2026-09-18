import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchCrowd, fetchDisruption } from "./transit.server";

export type StationExit = { name: string; distanceMetres: number };

export type StationDetail = {
  configured: boolean;
  disrupted: boolean;
  affectsStation: boolean;
  message?: string | undefined;
  crowd: Record<string, string>;
  exits: StationExit[];
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const exitCache = new Map<string, { at: number; exits: StationExit[] }>();

function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

async function loadExits(name: string, lat: number, lng: number): Promise<StationExit[]> {
  const key = name.toLowerCase();
  const cached = exitCache.get(key);
  if (cached && Date.now() - cached.at < 24 * 60 * 60 * 1000) return cached.exits;

  const query = `[out:json][timeout:20];node(around:450,${lat},${lng})["railway"="subway_entrance"];out body;`;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { elements?: Array<{ lat: number; lon: number; tags?: Record<string, string> }> };
    const exits: StationExit[] = (json.elements ?? [])
      .map((el) => ({
        name: el.tags?.["ref"]
          ? `Exit ${el.tags["ref"]}`
          : (el.tags?.["name"] ?? "Station entrance"),
        distanceMetres: metres(lat, lng, el.lat, el.lon),
      }))
      .sort((a, b) => a.distanceMetres - b.distanceMetres)
      .slice(0, 8);
    exitCache.set(key, { at: Date.now(), exits });
    return exits;
  } catch (error) {
    console.error("station exit lookup failed", error);
    return [];
  }
}

export const getStationDetail = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(1).max(60),
        lat: z.number(),
        lng: z.number(),
        lines: z.array(z.string().min(1).max(4)).max(6),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<StationDetail> => {
    const [disruption, exits] = await Promise.all([
      fetchDisruption().catch(() => null),
      loadExits(data.name, data.lat, data.lng),
    ]);

    const crowd: Record<string, string> = {};
    await Promise.all(
      data.lines.map(async (line) => {
        try {
          const levels = await fetchCrowd(line);
          const level = levels[data.name.toUpperCase()];
          if (level) crowd[line] = level;
        } catch {
          /* crowd data is optional */
        }
      }),
    );

    const affectedLines = disruption?.lines ?? [];
    return {
      configured: disruption?.configured ?? false,
      disrupted: Boolean(disruption?.disrupted),
      affectsStation: affectedLines.some((line) => data.lines.includes(line)),
      message: disruption?.message,
      crowd,
      exits,
    };
  });
