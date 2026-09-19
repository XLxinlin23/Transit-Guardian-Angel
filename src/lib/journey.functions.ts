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
  /** Walking distance in metres (walk legs only). */
  metres?: number;
  points: Array<{ lat: number; lng: number; name: string }>;
};

export type Journey = {
  legs: JourneyLeg[];
  minutes: number;
  /** Total walking distance across the whole trip. */
  walkMetres: number;
  /** Total time spent on foot. */
  walkMinutes: number;
  /** Estimated adult fare in SGD. */
  fare: number;
  /** Number of vehicle-to-vehicle changes. */
  transfers: number;
  /** One line explaining why this option won, e.g. "Fastest · 54 min". */
  reason: string;
  /** How many distinct options were compared. */
  alternatives: number;
  note?: string;
};


const LRT_LINES = new Set(["BP", "SE", "SW", "PE", "PW", "PTC", "STC"]);
const WALK_METRES_PER_MIN = 75;
/** Straight-line distance underestimates real footpaths. */
const WALK_DETOUR = 1.3;

function walkMinutes(metres: number) {
  return Math.max(1, Math.round((metres * WALK_DETOUR) / WALK_METRES_PER_MIN));
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
        const minutes = walkMinutes(origin.metres) + 4 + Math.round(rides * 1.8) + walkMinutes(walkOut);
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

/** Bus hop lookups are expensive; memoise them per request. */
function hopCache(key: string) {
  const cache = new Map<string, Promise<BusHop | null>>();
  return (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    if (!key) return Promise.resolve(null);
    const id = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    const existing = cache.get(id);
    if (existing) return existing;
    const pending = findBusHop(key, from, to).catch((error) => {
      console.error("bus hop lookup failed", error);
      return null;
    });
    cache.set(id, pending);
    return pending;
  };
}

type Point = { lat: number; lng: number; name: string };

function walkLegBetween(from: Point, to: Point): JourneyLeg[] {
  const straight = distanceMetres(from.lat, from.lng, to.lat, to.lng);
  if (straight < 60) return [];
  return [
    {
      mode: "walk",
      badge: "Walk",
      from: from.name,
      to: to.name,
      detail: `${straight < 1000 ? `${straight} m` : `${(straight / 1000).toFixed(1)} km`} on foot`,
      minutes: walkMinutes(straight),
      metres: straight,
      points: [
        { lat: from.lat, lng: from.lng, name: from.name },
        { lat: to.lat, lng: to.lng, name: to.name },
      ],
    },
  ];
}

/** Turn a single-service bus hop into walk + bus + walk legs. */
function hopToLegs(hop: BusHop, from: Point, to: Point): JourneyLeg[] {
  const legs: JourneyLeg[] = [];
  if (hop.walkIn > 60) {
    legs.push({
      mode: "walk",
      badge: "Walk",
      from: from.name,
      to: hop.fromStop.name,
      detail: `${hop.walkIn} m to bus stop ${hop.fromStop.code}`,
      minutes: walkMinutes(hop.walkIn),
      metres: hop.walkIn,
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
    minutes: 4 + Math.round(hop.rides * 1.8),
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
      metres: hop.walkOut,
      points: [
        { lat: hop.toStop.lat, lng: hop.toStop.lng, name: hop.toStop.name },
        { lat: to.lat, lng: to.lng, name: to.name },
      ],
    });
  }
  return legs;
}

type Candidate = {
  legs: JourneyLeg[];
  minutes: number;
  walkMetres: number;
  walkMinutes: number;
  fare: number;
  transfers: number;
  signature: string;
};

function pathMetres(points: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceMetres(points[i - 1]!.lat, points[i - 1]!.lng, points[i]!.lat, points[i]!.lng);
  }
  return total;
}

/** Rough SG distance-fare estimate: flat base then a small per-km step. */
function estimateFare(legs: JourneyLeg[]): number {
  const ridden = legs.filter((leg) => leg.mode !== "walk");
  if (!ridden.length) return 0;
  const km = ridden.reduce((total, leg) => total + pathMetres(leg.points), 0) / 1000;
  const fare = 1.19 + Math.max(0, km - 3.2) * 0.075;
  return Math.round(fare * 100) / 100;
}

function toCandidate(legs: JourneyLeg[]): Candidate | null {
  if (!legs.length) return null;
  const changes = Math.max(0, legs.filter((leg) => leg.mode !== "walk").length - 1);
  const minutes = legs.reduce((total, leg) => total + leg.minutes, 0) + changes * 2;
  const walkMetres = legs.reduce((total, leg) => total + (leg.metres ?? 0), 0);
  const walkMinutes = legs.filter((leg) => leg.mode === "walk").reduce((total, leg) => total + leg.minutes, 0);
  const signature = legs.map((leg) => `${leg.mode}:${leg.badge}:${leg.from}>${leg.to}`).join("|");
  return { legs, minutes, walkMetres, walkMinutes, fare: estimateFare(legs), transfers: changes, signature };
}


const PRIMARY_ORDER = ["speed", "walking", "sheltered", "transfers", "cost", "crowd"] as const;

function primaryPreference(preferences: string[]): string {
  for (const value of PRIMARY_ORDER) {
    if (preferences.includes(value)) return value;
  }
  return "speed";
}

function scoreFor(candidate: Candidate, preference: string): number {
  switch (preference) {
    case "walking":
      return candidate.walkMetres * 10 + candidate.minutes;
    case "sheltered":
      // Sheltered = as little open-air walking as possible, with rail preferred over bus waits.
      return candidate.walkMetres * 12 + candidate.transfers * 40 + candidate.minutes;
    case "transfers":
      return candidate.transfers * 1000 + candidate.minutes;
    case "cost":
      return candidate.transfers * 60 + candidate.minutes;
    case "crowd":
      return candidate.transfers * 80 + candidate.minutes;
    default:
      return candidate.minutes;
  }
}

function reasonFor(candidate: Candidate, preference: string): string {
  const walk = candidate.walkMetres >= 1000
    ? `${(candidate.walkMetres / 1000).toFixed(1)} km walking`
    : `${Math.round(candidate.walkMetres)} m walking`;
  switch (preference) {
    case "walking":
      return `Least walking · ${walk}`;
    case "sheltered":
      return `Most sheltered · ${walk}`;
    case "transfers":
      return `Fewest transfers · ${candidate.transfers} transfer${candidate.transfers === 1 ? "" : "s"}`;
    case "cost":
      return `Lowest cost · ${candidate.transfers} transfer${candidate.transfers === 1 ? "" : "s"} · ${candidate.minutes} min`;
    case "crowd":
      return `Lower crowding · ${candidate.minutes} min`;
    default:
      return `Fastest · ${candidate.minutes} min`;
  }
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
    const preference = primaryPreference(data.preferences);
    const lookupHop = hopCache(key);

    const origin: Point = { lat: data.from.lat, lng: data.from.lng, name: data.from.label };
    const destination: Point = { lat: data.to.lat, lng: data.to.lng, name: data.to.label };

    const candidates: Candidate[] = [];
    const add = (legs: JourneyLeg[]) => {
      const candidate = toCandidate(legs);
      if (!candidate) return;
      if (candidates.some((item) => item.signature === candidate.signature)) return;
      candidates.push(candidate);
    };

    // 1. Straight walk door to door.
    const directMetres = distanceMetres(origin.lat, origin.lng, destination.lat, destination.lng);
    if (directMetres < 3000) add(walkLegBetween(origin, destination));

    // 2. One direct bus door to door.
    const directHop = await lookupHop(origin, destination);
    if (directHop) add(hopToLegs(directHop, origin, destination));

    // 3. Rail options, with walking access and with bus access to/from the stations.
    const fromStation = nearestStation(origin.lat, origin.lng);
    const toStation = nearestStation(destination.lat, destination.lng);

    if (fromStation && toStation && fromStation.name !== toStation.name) {
      const fromNode = STATION_INDEX.get(fromStation.name) ?? fromStation;
      const toNode = STATION_INDEX.get(toStation.name) ?? toStation;
      const headPoint: Point = { lat: fromNode.lat, lng: fromNode.lng, name: `${fromStation.name} station` };
      const tailPoint: Point = { lat: toNode.lat, lng: toNode.lng, name: `${toStation.name} station` };

      const railVariants = ["speed", "transfers", "walking", "cost"].map((value) =>
        planRoute(fromStation.name, toStation.name, [value] as never),
      );

      const headWalk = walkLegBetween(origin, headPoint);
      const tailWalk = walkLegBetween(tailPoint, destination);
      const headHop = await lookupHop(origin, headPoint);
      const tailHop = await lookupHop(tailPoint, destination);
      const headBus = headHop ? hopToLegs(headHop, origin, headPoint) : null;
      const tailBus = tailHop ? hopToLegs(tailHop, tailPoint, destination) : null;

      const seenRail = new Set<string>();
      for (const rail of railVariants) {
        if (!rail) continue;
        const railKey = rail.stations.map((station) => station.name).join(">");
        if (seenRail.has(railKey)) continue;
        seenRail.add(railKey);

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

        for (const head of [headWalk, headBus].filter(Boolean) as JourneyLeg[][]) {
          for (const tail of [tailWalk, tailBus].filter(Boolean) as JourneyLeg[][]) {
            add([...head, ...railLegs, ...tail]);
          }
        }
      }
    }

    if (!candidates.length) {
      const fallback = toCandidate(walkLegBetween(origin, destination));
      if (!fallback) return null;
      return {
        legs: fallback.legs,
        minutes: fallback.minutes,
        walkMetres: fallback.walkMetres,
        transfers: fallback.transfers,
        reason: "Only one route is currently available.",
        alternatives: 1,
      };
    }

    const ranked = [...candidates].sort((a, b) => scoreFor(a, preference) - scoreFor(b, preference));
    const winner = ranked[0]!;

    const journey: Journey = {
      legs: winner.legs,
      minutes: winner.minutes,
      walkMetres: Math.round(winner.walkMetres),
      transfers: winner.transfers,
      reason: candidates.length < 2 ? "Only one route is currently available." : reasonFor(winner, preference),
      alternatives: candidates.length,
    };

    const busOnly = winner.legs.every((leg) => leg.mode === "walk" || leg.mode === "bus");
    const busLeg = winner.legs.find((leg) => leg.mode === "bus");
    if (busOnly && busLeg && candidates.length > 1) {
      journey.note = `Direct bus ${busLeg.badge} beats the train on this trip.`;
    }

    return journey;
  });
