import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type NearbyTrafficIncident = {
  type: string;
  lat: number;
  lng: number;
  message: string;
  distanceKm: number | null;
};

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Closest distance from an incident to a straight corridor sampled between two points. */
export function distanceToCorridor(
  incident: { lat: number; lng: number },
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    const point = { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
    best = Math.min(best, distanceKm(incident, point));
  }
  return best;
}

export const getTrafficIncidents = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
        radiusKm: z.number().min(0.5).max(50).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<{ configured: boolean; incidents: NearbyTrafficIncident[] }> => {
    const { fetchTrafficIncidents } = await import("@/lib/transit.server");
    const { configured, incidents } = await fetchTrafficIncidents().catch(() => ({ configured: false, incidents: [] }));
    const here = typeof data.lat === "number" && typeof data.lng === "number" ? { lat: data.lat, lng: data.lng } : null;
    const radius = data.radiusKm ?? 10;

    const mapped: NearbyTrafficIncident[] = incidents.map((incident) => ({
      ...incident,
      distanceKm: here ? distanceKm(incident, here) : null,
    }));

    const filtered = here ? mapped.filter((incident) => (incident.distanceKm ?? 0) <= radius) : mapped;
    filtered.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    return { configured, incidents: filtered.slice(0, 12) };
  });
