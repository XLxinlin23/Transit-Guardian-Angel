import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { STATION_INDEX, nearestStation, planRoute } from "./mrt-network";
import { distanceMetres, loadBusRoutes, loadBusStops, type BusStopRecord } from "./lta-static.server";

export type TravelMode = "walk" | "bus" | "mrt" | "lrt";

export type JourneyLeg = {
  mode: TravelMode;
  /** Short badge: "Walk", bus service number, or the rail line code. */
  badge: string;
  from: string;
  to: string;
  detail: string;
  minutes: number;
  points: Array<{ lat: number; lng: number; name: string }>;
};

export type Journey = {
  legs: JourneyLeg[];
  minutes: number;
  note?: string;
};

const LRT_LINES = new Set(["BP", "SE", "SW", "PE", "PW", "PTC", "STC"]);
const WALK_METRES_PER_MIN = 80;

function walkMinutes(metres: number) {
  return Math.max(1, Math.round(metres / WALK_METRES_PER_MIN));
}

function stopsNear(stops: BusStopRecord[], lat: number, lng: number, radius: number, limit: number) {
  return stops
    .map((stop) => ({ stop, metres: distanceMetres(lat, lng, stop.lat, stop.lng) }))
    .filter((entry) => entry.metres <= radius)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, limit);
}

type BusHop = {
  service: string;
  fromStop: BusStopRecord;
  toStop: BusStopRecord;
  rides: number;
  walkIn: number;
  walkOut: number;
  minutes: number;
  path: BusStopRecord[];
};

async function findBusHop(
  key: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<BusHop | null> {
  const [stops, routes] = await Promise.all([loadBusStops(key), loadBusRoutes(key)]);
  const byCode = new Map(stops.map((stop) => [stop.code, stop]));
  const origins = stopsNear(stops, from.lat, from.lng, 700, 8);
  const targets = stopsNear(stops, to.lat, to.lng, 700, 8);
  if (!origins.length || !targets.length) return null;

  const targetByCode = new Map(targets.map((entry) => [entry.stop.code, entry.metres]));
  let best: BusHop | null = null;

  for (const origin of origins) {
    const originRoutes = routes.byStop.get(origin.stop.code) ?? [];
    for (const route of originRoutes) {
      const sequence = routes.sequences.get(route.key);
      if (!sequence) continue;
      const startAt = sequence.findIndex((item) => item.seq === route.seq && item.code === origin.stop.code);
      if (startAt < 0) continue;
      for (let i = startAt + 1; i < sequence.length; i += 1) {
        const stopEntry = sequence[i]!;
        const walkOut = targetByCode.get(stopEntry.code);
        if (walkOut === undefined) continue;
        const rides = i - startAt;
        const minutes = walkMinutes(origin.metres) + 5 + Math.round(rides * 2.2) + walkMinutes(walkOut);
        if (best && minutes >= best.minutes) continue;
        const toStop = byCode.get(stopEntry.code);
        if (!toStop) continue;
        const path = sequence
          .slice(startAt, i + 1)
          .map((item) => byCode.get(item.code))
          .filter((item): item is BusStopRecord => Boolean(item));
        best = {
          service: route.key.split("|")[0]!,
          fromStop: origin.stop,
          toStop,
          rides,
          walkIn: origin.metres,
          walkOut,
          minutes,
          path,
        };
      }
    }
  }

  return best;
}

/** Walk, or walk + bus, between a street point and a rail station (or another street point). */
async function accessLegs(
  key: string,
  from: { lat: number; lng: number; name: string },
  to: { lat: number; lng: number; name: string },
  options: { preferWalk: boolean; walkLimit: number },
): Promise<JourneyLeg[]> {
  const straight = distanceMetres(from.lat, from.lng, to.lat, to.lng);
  if (straight < 60) return [];

  const walkLeg: JourneyLeg = {
    mode: "walk",
    badge: "Walk",
    from: from.name,
    to: to.name,
    detail: `${straight < 1000 ? `${straight} m` : `${(straight / 1000).toFixed(1)} km`} on foot`,
    minutes: walkMinutes(straight),
    points: [
      { lat: from.lat, lng: from.lng, name: from.name },
      { lat: to.lat, lng: to.lng, name: to.name },
    ],
  };

  if (straight <= options.walkLimit || !key) return [walkLeg];

  const hop = await findBusHop(key, from, to).catch(() => null);
  if (!hop) return [walkLeg];
  if (options.preferWalk && hop.minutes >= walkLeg.minutes) return [walkLeg];
  if (hop.minutes >= walkLeg.minutes) return [walkLeg];

  const legs: JourneyLeg[] = [];
  if (hop.walkIn > 60) {
    legs.push({
      mode: "walk",
      badge: "Walk",
      from: from.name,
      to: hop.fromStop.name,
      detail: `${hop.walkIn} m to bus stop ${hop.fromStop.code}`,
      minutes: walkMinutes(hop.walkIn),
      points: [
        { lat: from.lat, lng: from.lng, name: from.name },
        { lat: hop.fromStop.lat, lng: hop.fromStop.lng, name: hop.fromStop.name },
      ],
    });
  }
  legs.push({
    mode: "bus",
    badge: hop.service,
    from: hop.fromStop.name,
    to: hop.toStop.name,
    detail: `Bus ${hop.service} · ${hop.rides} stop${hop.rides > 1 ? "s" : ""}`,
    minutes: 5 + Math.round(hop.rides * 2.2),
    points: hop.path.map((stop) => ({ lat: stop.lat, lng: stop.lng, name: stop.name })),
  });
  if (hop.walkOut > 60) {
    legs.push({
      mode: "walk",
      badge: "Walk",
      from: hop.toStop.name,
      to: to.name,
      detail: `${hop.walkOut} m on foot`,
      minutes: walkMinutes(hop.walkOut),
      points: [
        { lat: hop.toStop.lat, lng: hop.toStop.lng, name: hop.toStop.name },
        { lat: to.lat, lng: to.lng, name: to.name },
      ],
    });
  }
  return legs;
}

const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().min(1).max(120),
});

export const planJourney = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        from: pointSchema,
        to: pointSchema,
        preferences: z.array(z.string()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<Journey | null> => {
    const key = process.env["LTA_ACCOUNT_KEY"] ?? "";
    const preferWalk = data.preferences.includes("walking") === false;
    const leastWalking = data.preferences.includes("walking");
    const walkLimit = leastWalking ? 500 : 1000;

    const fromStation = nearestStation(data.from.lat, data.from.lng);
    const toStation = nearestStation(data.to.lat, data.to.lng);
    const origin = { lat: data.from.lat, lng: data.from.lng, name: data.from.label };
    const destination = { lat: data.to.lat, lng: data.to.lng, name: data.to.label };

    // Short trip, or both ends served by the same station: stay on the street.
    const directMetres = distanceMetres(origin.lat, origin.lng, destination.lat, destination.lng);
    if (!fromStation || !toStation || fromStation.name === toStation.name || directMetres < 1200) {
      const legs = await accessLegs(key, origin, destination, { preferWalk: !leastWalking, walkLimit });
      if (!legs.length) return null;
      return { legs, minutes: legs.reduce((total, leg) => total + leg.minutes, 0) };
    }

    const rail = planRoute(fromStation.name, toStation.name, data.preferences as never);
    if (!rail) {
      const legs = await accessLegs(key, origin, destination, { preferWalk: !leastWalking, walkLimit });
      if (!legs.length) return null;
      return { legs, minutes: legs.reduce((total, leg) => total + leg.minutes, 0) };
    }

    const fromNode = STATION_INDEX.get(fromStation.name) ?? fromStation;
    const toNode = STATION_INDEX.get(toStation.name) ?? toStation;

    const head = await accessLegs(
      key,
      origin,
      { lat: fromNode.lat, lng: fromNode.lng, name: `${fromStation.name} station` },
      { preferWalk, walkLimit },
    );
    const tail = await accessLegs(
      key,
      { lat: toNode.lat, lng: toNode.lng, name: `${toStation.name} station` },
      destination,
      { preferWalk, walkLimit },
    );

    const railLegs: JourneyLeg[] = rail.legs.map((leg) => {
      const stops = leg.stations.length - 1;
      return {
        mode: LRT_LINES.has(leg.line) ? "lrt" : "mrt",
        badge: leg.line,
        from: leg.stations[0]!.name,
        to: leg.stations[leg.stations.length - 1]!.name,
        detail: `${stops} stop${stops > 1 ? "s" : ""}`,
        minutes: Math.max(2, Math.round(stops * 2.4)),
        points: leg.stations.map((station) => ({ lat: station.lat, lng: station.lng, name: station.name })),
      };
    });

    const legs = [...head, ...railLegs, ...tail];
    const changes = Math.max(0, legs.length - 1);
    const minutes = legs.reduce((total, leg) => total + leg.minutes, 0) + changes * 2;
    return { legs, minutes };
  });
