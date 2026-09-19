import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { STATION_INDEX, nearestStation, planRoute, stationsBetween, type BlockedSegment } from "./mrt-network";
import { distanceMetres, loadBusRoutes, loadBusStops, type BusStopRecord } from "./lta-static.server";

/** Stretches of track the fallback route must not use (matches the simulated incident). */
const CLOSED_SEGMENTS: BlockedSegment[] = [{ line: "EW", a: "Simei", b: "Tanah Merah" }];

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
  /** Stable ID derived from the route's actual sequence of legs. */
  id: string;
  legs: JourneyLeg[];
  minutes: number;
  totalDurationMinutes: number;
  /** Total walking distance across the whole trip. */
  walkMetres: number;
  totalWalkingDistanceMetres: number;
  /** Total time spent on foot. */
  walkMinutes: number;
  totalWalkingTimeMinutes: number;
  /** Adult fare in SGD — from the operator when available, otherwise estimated. */
  fare: number;
  /** True when the fare is our own distance estimate rather than published data. */
  fareEstimated: boolean;
  /** Number of vehicle-to-vehicle changes. */
  transfers: number;
  numberOfTransfers: number;
  /** Live platform crowding from LTA PCDRealTime, when the route uses rail. */
  crowdLevel: "low" | "moderate" | "high" | "unknown";
  /** Where the route data came from, shown to the user. */
  dataSource: string;
  /** ISO timestamp of when this route was calculated. */
  updatedAt: string;
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

export type JourneyCandidate = {
  id: string;
  legs: JourneyLeg[];
  totalDurationMinutes: number;
  totalWalkingDistanceMetres: number;
  totalWalkingTimeMinutes: number;
  fare: number;
  fareEstimated: boolean;
  numberOfTransfers: number;
  /** 0 = not crowded, 1 = moderate, 2 = crowded. Null when no live data covers this route. */
  crowdScore: number | null;
  source: string;
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

function routeId(signature: string): string {
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `route-${(hash >>> 0).toString(36)}`;
}

function toCandidate(legs: JourneyLeg[], fareOverride?: number | null, source = "LTA DataMall"): JourneyCandidate | null {
  if (!legs.length) return null;

  const changes = Math.max(0, legs.filter((leg) => leg.mode !== "walk").length - 1);
  const minutes = legs.reduce((total, leg) => total + leg.minutes, 0) + changes * 2;
  const walkMetres = legs.reduce((total, leg) => total + (leg.metres ?? 0), 0);
  const walkMinutes = legs.filter((leg) => leg.mode === "walk").reduce((total, leg) => total + leg.minutes, 0);
  const signature = legs
    .map(
      (leg) =>
        `${leg.mode}:${leg.badge}:${leg.from}>${leg.to}:${leg.points
          .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`)
          .join(">")}`,
    )
    .join("|");
  const published = typeof fareOverride === "number";
  return {
    id: routeId(signature),
    legs,
    totalDurationMinutes: minutes,
    totalWalkingDistanceMetres: walkMetres,
    totalWalkingTimeMinutes: walkMinutes,
    fare: published ? fareOverride : estimateFare(legs),
    fareEstimated: !published,
    numberOfTransfers: changes,
    crowdScore: null,
    source,
    signature,
  };
}

/** Public transport = at least one ridden leg. */
function usesTransit(candidate: JourneyCandidate): boolean {
  return candidate.legs.some((leg) => leg.mode !== "walk");
}

const MAX_WALK_ONLY_METRES = 3000;
const MAX_TOTAL_WALK_METRES = 2000;

/**
 * Drop routes no one would actually take before ranking:
 * all-walking routes over 3 km, and routes with more than 2 km of walking
 * whenever a reasonable public-transport route exists.
 */
export function eligibleCandidates(candidates: JourneyCandidate[], directMetres: number): JourneyCandidate[] {
  if (!candidates.length) return [];
  const transit = candidates.filter(usesTransit);
  let pool = transit.length ? transit : candidates;
  if (!transit.length && directMetres > MAX_WALK_ONLY_METRES) return [];
  const shortWalk = pool.filter((candidate) => candidate.totalWalkingDistanceMetres <= MAX_TOTAL_WALK_METRES);
  if (shortWalk.length) pool = shortWalk;
  return pool;
}

const CROWD_VALUE: Record<string, number> = { l: 0, m: 1, h: 2 };

/** Attach live platform crowding (LTA PCDRealTime) to every rail route. */
async function attachCrowd(candidates: JourneyCandidate[]): Promise<void> {
  const lines = new Set<string>();
  for (const candidate of candidates) {
    for (const leg of candidate.legs) if (leg.mode === "mrt" || leg.mode === "lrt") lines.add(leg.badge.toUpperCase());
  }
  if (!lines.size) return;
  try {
    const { fetchCrowd } = await import("./transit.server");
    const byLine = new Map<string, Record<string, string>>();
    await Promise.all(
      [...lines].map(async (line) => {
        const data = await fetchCrowd(line).catch(() => ({}));
        if (Object.keys(data).length) byLine.set(line, data);
      }),
    );
    if (!byLine.size) return;
    for (const candidate of candidates) {
      const readings: number[] = [];
      for (const leg of candidate.legs) {
        if (leg.mode !== "mrt" && leg.mode !== "lrt") continue;
        const table = byLine.get(leg.badge.toUpperCase());
        if (!table) continue;
        for (const point of leg.points) {
          const level = table[point.name.toUpperCase()];
          const value = level ? CROWD_VALUE[level] : undefined;
          if (value !== undefined) readings.push(value);
        }
      }
      if (readings.length) {
        candidate.crowdScore = readings.reduce((total, value) => total + value, 0) / readings.length;
      }
    }
  } catch (error) {
    console.error("crowd lookup failed", error);
  }
}

function crowdLabel(score: number | null): "low" | "moderate" | "high" | "unknown" {
  if (score === null) return "unknown";
  if (score < 0.67) return "low";
  if (score < 1.34) return "moderate";
  return "high";
}

/** Walking in the open is the only sheltered signal we actually measure. */
function openAirMetres(candidate: JourneyCandidate): number {
  return candidate.totalWalkingDistanceMetres;
}


const PRIMARY_ORDER = ["speed", "walking", "sheltered", "transfers", "cost", "crowd"] as const;


function primaryPreference(preferences: string[]): string {
  for (const value of PRIMARY_ORDER) {
    if (preferences.includes(value)) return value;
  }
  return "speed";
}

function scoreFor(candidate: JourneyCandidate, preference: string): number {
  switch (preference) {
    case "sheltered":
      // Measured signal: open-air walking distance, then transfers (each one adds exposure).
      return openAirMetres(candidate) * 12 + candidate.numberOfTransfers * 40 + candidate.totalDurationMinutes;
    case "transfers":
      // Minimise transfers first; shortest duration breaks the tie.
      return candidate.numberOfTransfers * 1000 + candidate.totalDurationMinutes;
    case "cost":
      return candidate.fare * 100 + candidate.totalDurationMinutes;
    case "crowd":
      // Live PCDRealTime reading where we have one; unknown routes sit mid-table.
      return (candidate.crowdScore ?? 1) * 600 + candidate.numberOfTransfers * 80 + candidate.totalDurationMinutes;
    default:
      return candidate.totalDurationMinutes;
  }
}

export function rankCandidates(candidates: JourneyCandidate[], preference: string): JourneyCandidate[] {
  return [...candidates].sort((a, b) => {
    if (preference === "walking") {
      return (
        a.totalWalkingDistanceMetres - b.totalWalkingDistanceMetres ||
        a.totalDurationMinutes - b.totalDurationMinutes ||
        a.id.localeCompare(b.id)
      );
    }
    return scoreFor(a, preference) - scoreFor(b, preference) || a.id.localeCompare(b.id);
  });
}

const CROWD_TEXT: Record<string, string> = {
  low: "platforms reported not crowded",
  moderate: "platforms reported moderately crowded",
  high: "platforms reported crowded",
};

function reasonFor(candidate: JourneyCandidate, preference: string, next?: JourneyCandidate): string {
  const walkingMetres = Math.round(candidate.totalWalkingDistanceMetres);
  const walk = walkingMetres >= 1000
    ? `${(walkingMetres / 1000).toFixed(1)} km walking`
    : `${walkingMetres} m walking`;
  switch (preference) {
    case "walking":
      return next
        ? `Least walking: ${walkingMetres} m, ${Math.max(0, Math.round(next.totalWalkingDistanceMetres - candidate.totalWalkingDistanceMetres))} m less than the next route.`
        : "Only one route is available — least walking cannot be compared.";
    case "sheltered":
      return `Most sheltered · ${walk} in the open, ${candidate.numberOfTransfers} transfer${candidate.numberOfTransfers === 1 ? "" : "s"} (ranked by open-air walking — no covered-link dataset).`;
    case "transfers":
      return `Fewest transfers · ${candidate.numberOfTransfers} transfer${candidate.numberOfTransfers === 1 ? "" : "s"} · ${candidate.totalDurationMinutes} min`;
    case "cost":
      return `Lowest cost · ${candidate.fareEstimated ? "estimated fare " : ""}$${candidate.fare.toFixed(2)} · ${candidate.totalDurationMinutes} min`;
    case "crowd": {
      const level = crowdLabel(candidate.crowdScore);
      return level === "unknown"
        ? `Lower crowding · live crowd data unavailable for this route, ranked by transfers and time (${candidate.totalDurationMinutes} min).`
        : `Lower crowding · ${CROWD_TEXT[level]} (LTA PCDRealTime) · ${candidate.totalDurationMinutes} min`;
    }
    default:
      return `Fastest · ${candidate.totalDurationMinutes} min`;
  }
}


const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().min(1).max(120),
});

type PlanInput = {
  from: { lat: number; lng: number; label: string };
  to: { lat: number; lng: number; label: string };
};

async function buildCandidates(data: PlanInput): Promise<JourneyCandidate[]> {
  const key = process.env["LTA_ACCOUNT_KEY"] ?? "";
  const lookupHop = hopCache(key);

  const origin: Point = { lat: data.from.lat, lng: data.from.lng, name: data.from.label };
  const destination: Point = { lat: data.to.lat, lng: data.to.lng, name: data.to.label };

  const candidates: JourneyCandidate[] = [];
  let source = "LTA DataMall";
  const add = (legs: JourneyLeg[], fare?: number | null, from = source) => {
    const candidate = toCandidate(legs, fare, from);
    if (!candidate) return;
    if (candidates.some((item) => item.signature === candidate.signature)) return;
    candidates.push(candidate);
  };

  // 0. Google Maps walking/bus/MRT routes first — they follow real paths and timetables.
  try {
    const { googleRoutePlans } = await import("./google-routes.server");
    for (const plan of await googleRoutePlans(origin, destination)) add(plan.legs, plan.fare, "Google Maps Routes");
  } catch (error) {
    console.error("Google route lookup failed", error);
  }
  /** A rail route that keeps off the given lines or closed stretches, so a disruption always has a real fallback. */
  const addRailAvoiding = (avoidLines: string[], blockedSegments: BlockedSegment[] = []) => {
    const start = nearestStation(origin.lat, origin.lng);
    const end = nearestStation(destination.lat, destination.lng);
    if (!start || !end || start.name === end.name) return;
    const rail = planRoute(start.name, end.name, ["transfers"] as never, avoidLines, blockedSegments);
    if (!rail) return;
    if (rail.legs.some((leg) => avoidLines.includes(leg.line))) return;
    const startNode = STATION_INDEX.get(start.name) ?? start;
    const endNode = STATION_INDEX.get(end.name) ?? end;
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
    add(
      [
        ...walkLegBetween(origin, { lat: startNode.lat, lng: startNode.lng, name: `${start.name} station` }),
        ...railLegs,
        ...walkLegBetween({ lat: endNode.lat, lng: endNode.lng, name: `${end.name} station` }, destination),
      ],
      null,
      "LTA DataMall",
    );
  };

  if (candidates.length) {
    // Keep at least one option clear of the closed stretch, so a disrupted trip can be
    // compared against a genuinely different set of legs and line badges.
    addRailAvoiding([], CLOSED_SEGMENTS);
    // Second fallback that keeps off the East West Line entirely, e.g.
    // Downtown Line to MacPherson → Circle Line to Marina Bay → North South Line.
    addRailAvoiding(["EW"], CLOSED_SEGMENTS);
    await attachCrowd(candidates);
    return candidates;
  }
  source = "LTA DataMall";




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

  addRailAvoiding([], CLOSED_SEGMENTS);
  addRailAvoiding(["EW"], CLOSED_SEGMENTS);

  if (!candidates.length) {
    const fallback = toCandidate(walkLegBetween(origin, destination));
    if (fallback) candidates.push(fallback);
  }

  await attachCrowd(candidates);
  return candidates;

}

function logCandidateMetrics(candidates: JourneyCandidate[]) {
  console.table(
    candidates.map((candidate) => ({
      id: candidate.id,
      walkingDistanceMetres: Math.round(candidate.totalWalkingDistanceMetres),
      walkingTimeMinutes: candidate.totalWalkingTimeMinutes,
      durationMinutes: candidate.totalDurationMinutes,
      transfers: candidate.numberOfTransfers,
      transit: usesTransit(candidate),
      crowdScore: candidate.crowdScore,
    })),
  );
}

function pickJourney(candidates: JourneyCandidate[], preference: string): Journey | null {
  if (!candidates.length) return null;
  const ranked = rankCandidates(candidates, preference);
  const winner = ranked[0]!;

  const journey: Journey = {
    id: winner.id,
    legs: winner.legs,
    minutes: winner.totalDurationMinutes,
    totalDurationMinutes: winner.totalDurationMinutes,
    walkMetres: Math.round(winner.totalWalkingDistanceMetres),
    totalWalkingDistanceMetres: Math.round(winner.totalWalkingDistanceMetres),
    walkMinutes: winner.totalWalkingTimeMinutes,
    totalWalkingTimeMinutes: winner.totalWalkingTimeMinutes,
    fare: winner.fare,
    fareEstimated: winner.fareEstimated,
    transfers: winner.numberOfTransfers,
    numberOfTransfers: winner.numberOfTransfers,
    crowdLevel: crowdLabel(winner.crowdScore),
    dataSource: winner.source,
    updatedAt: new Date().toISOString(),
    reason:
      preference === "walking"
        ? reasonFor(winner, preference, ranked[1])
        : candidates.length < 2
          ? "Only one route is currently available."
          : reasonFor(winner, preference, ranked[1]),
    alternatives: candidates.length,
  };

  const busOnly = winner.legs.every((leg) => leg.mode === "walk" || leg.mode === "bus");
  const busLeg = winner.legs.find((leg) => leg.mode === "bus");
  if (busOnly && busLeg && candidates.length > 1) {
    journey.note = `Direct bus ${busLeg.badge} beats the train on this trip.`;
  }

  return journey;
}

function directDistance(data: PlanInput): number {
  return distanceMetres(data.from.lat, data.from.lng, data.to.lat, data.to.lng);
}

export type PlanResult =
  | { ok: true; journey: Journey }
  | { ok: false; message: string };

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
  .handler(async ({ data }): Promise<PlanResult> => {
    const all = await buildCandidates(data);
    const candidates = eligibleCandidates(all, directDistance(data));
    if (process.env["NODE_ENV"] !== "production") logCandidateMetrics(all);
    if (!candidates.length) {
      const km = (directDistance(data) / 1000).toFixed(1);
      return {
        ok: false,
        message: `No reasonable public transport route was found for this ${km} km trip. The only option returned was a very long walk, so nothing is recommended — try a nearby station or stop as your start or end point.`,
      };
    }
    const journey = pickJourney(candidates, primaryPreference(data.preferences));
    return journey ? { ok: true, journey } : { ok: false, message: "No route could be calculated for this trip." };
  });

export type JourneyOption = { preference: string; journey: Journey };

/** True when any rail leg of this route rides straight through a closed stretch of track. */
function crossesClosedSegment(legs: JourneyLeg[]): boolean {
  const clean = (name: string) => name.toLowerCase().replace(/\s*(mrt|lrt)?\s*station$/i, "").trim();
  return legs.some((leg) => {
    if (leg.mode !== "mrt" && leg.mode !== "lrt") return false;
    return CLOSED_SEGMENTS.some((segment) => {
      if (leg.badge.toUpperCase() !== segment.line.toUpperCase()) return false;
      const travelled = stationsBetween(segment.line, clean(leg.from), clean(leg.to));
      return travelled.includes(segment.a) && travelled.includes(segment.b);
    });
  });
}

/** One best route per preference, so the user can compare side by side. */
export const compareJourneys = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ from: pointSchema, to: pointSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<JourneyOption[]> => {
    const all = await buildCandidates(data);
    const candidates = eligibleCandidates(all, directDistance(data));
    if (!candidates.length) return [];
    if (process.env["NODE_ENV"] !== "production") logCandidateMetrics(candidates);
    const options: JourneyOption[] = [];
    for (const preference of PRIMARY_ORDER) {
      const journey = pickJourney(candidates, preference);
      if (journey) options.push({ preference, journey });
    }
    // Always surface the routes that steer clear of the closed stretch, even when they
    // win no preference — during a disruption they are the only routes worth showing.
    const included = new Set(options.map((option) => option.journey.id));
    const safeExtras = candidates
      .filter((candidate) => !included.has(candidate.id) && !crossesClosedSegment(candidate.legs))
      .sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes)
      .slice(0, 2);
    for (const candidate of safeExtras) {
      const journey = pickJourney([candidate], "speed");
      if (!journey) continue;
      journey.reason = "Avoids the closed Simei–Tanah Merah stretch.";
      options.push({ preference: "disruption", journey });
    }
    return options;
  });
