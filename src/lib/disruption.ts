import type { Journey, JourneyLeg } from "./journey.functions";

/** A disruption we can reason about — either live from LTA or a clearly-labelled demo. */
export type Incident = {
  source: "live" | "demo";
  line: string;
  stations: string[];
  message: string;
  /** Extra minutes the disruption is expected to add to an affected route. */
  addedMinutes: number;
};

export const DEMO_INCIDENT: Incident = {
  source: "demo",
  line: "CC",
  stations: ["Bishan", "Marymount", "Caldecott", "Botanic Gardens", "Holland Village", "Buona Vista"],
  message: "Demo incident — simulated data. No train service between Bishan and Buona Vista (Circle Line).",
  addedMinutes: 20,
};

function norm(value: string): string {
  return value.toLowerCase().replace(/\s*(mrt|lrt)?\s*station$/i, "").trim();
}

export function parseTime(hhmm: string): number | null {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const value = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Does this leg run over the disrupted segment? */
export function legAffected(leg: JourneyLeg, incident: Incident): boolean {
  if (leg.mode !== "mrt" && leg.mode !== "lrt") return false;
  if (leg.badge.toUpperCase() !== incident.line.toUpperCase()) return false;
  if (!incident.stations.length) return true;
  const affected = new Set(incident.stations.map(norm));
  return leg.points.some((point) => affected.has(norm(point.name)));
}

export function journeyAffected(journey: Journey, incident: Incident): boolean {
  return journey.legs.some((leg) => legAffected(leg, incident));
}

export type DisruptionLevel = "none" | "info" | "within" | "exceeds" | "impossible";

export type DisruptionAssessment = {
  incident: Incident | null;
  level: DisruptionLevel;
  affected: boolean;
  delayMinutes: number;
  /** Planned arrival (the reach-by time) and the predicted one with the disruption. */
  reachBy: string;
  latestAcceptable: string;
  originalArrival: string;
  predictedArrival: string;
  overLimitMinutes: number;
  alternative: { journey: Journey; arrival: string; preference?: string } | null;
  headline: string;
  detail: string;
};

type AlternativeInput = { preference?: string; journey: Journey };

export function assessDisruption(params: {
  journey: Journey | null;
  alternatives: AlternativeInput[];
  incident: Incident | null;
  arriveBy: string;
  maxDelayMinutes: number;
  /** Duration of the originally planned route — fixes the departure time so every arrival lines up. */
  baselineMinutes?: number | undefined;
}): DisruptionAssessment | null {
  const { journey, incident, arriveBy, maxDelayMinutes } = params;
  const reachBy = parseTime(arriveBy);
  if (!journey || reachBy === null) return null;

  const baseline = params.baselineMinutes ?? journey.minutes;
  // Departure is fixed by the planned route; every arrival below is measured from it.
  const departure = reachBy - baseline;
  const arrivalOf = (minutes: number) => departure + minutes;
  const plannedArrival = arrivalOf(journey.minutes);

  const latest = reachBy + Math.max(0, maxDelayMinutes);
  const base: Omit<DisruptionAssessment, "level" | "headline" | "detail"> = {
    incident,
    affected: false,
    delayMinutes: 0,
    reachBy: formatMinutes(reachBy),
    latestAcceptable: formatMinutes(latest),
    originalArrival: formatMinutes(plannedArrival),
    predictedArrival: formatMinutes(plannedArrival),
    overLimitMinutes: 0,
    alternative: null,
  };

  if (!incident || !journeyAffected(journey, incident)) {
    return {
      ...base,
      level: "none",
      headline: "No disruption affecting your journey.",
      detail:
        plannedArrival <= reachBy
          ? `On track to arrive by ${formatMinutes(plannedArrival)}.`
          : `Arriving ${formatMinutes(plannedArrival)}, ${plannedArrival - reachBy} min after your ${formatMinutes(reachBy)} target.`,
    };
  }

  const delay = incident.addedMinutes;
  const predicted = plannedArrival + delay;
  const affectedBase = { ...base, affected: true, delayMinutes: delay, predictedArrival: formatMinutes(predicted) };

  if (predicted <= reachBy) {
    return {
      ...affectedBase,
      level: "info",
      headline: "Minor disruption on your line — arrival unchanged.",
      detail: incident.message,
    };
  }

  if (predicted <= latest) {
    return {
      ...affectedBase,
      level: "within",
      headline: `Expected delay: ${predicted - reachBy} min — within your ${maxDelayMinutes} min limit.`,
      detail: `${incident.message} Predicted arrival ${formatMinutes(predicted)}.`,
    };
  }

  // Over the limit: look for a route that avoids the disrupted segment.
  // Safety first — exclude disrupted routes, then late ones, and only then apply the preference.
  const clean = params.alternatives
    .filter((option) => !journeyAffected(option.journey, incident))
    .map((option) => ({ ...option, arrivalMinutes: arrivalOf(option.journey.minutes) }))
    .sort((a, b) => a.arrivalMinutes - b.arrivalMinutes);

  const inTime = clean.filter((option) => option.arrivalMinutes <= latest);
  const byPreference = [...inTime].sort(
    (a, b) => preferenceScore(a.journey, params.preference) - preferenceScore(b.journey, params.preference),
  );
  const fitting = byPreference[0] ?? clean[0] ?? null;

  const overBy = predicted - latest;

  if (!fitting) {
    return {
      ...affectedBase,
      level: "impossible",
      overLimitMinutes: overBy,
      headline: `No available route can arrive before ${formatMinutes(latest)}.`,
      detail: `${incident.message} Your original route may arrive at ${formatMinutes(predicted)}.`,
    };
  }

  const alternative = {
    journey: fitting.journey,
    arrival: formatMinutes(fitting.arrivalMinutes),
    ...(fitting.preference ? { preference: fitting.preference } : {}),
  };

  if (fitting.arrivalMinutes > latest) {
    return {
      ...affectedBase,
      level: "impossible",
      overLimitMinutes: overBy,
      alternative,
      headline: `No available route can arrive before ${formatMinutes(latest)}.`,
      detail: `${incident.message} The earliest option leaves at ${formatMinutes(departure)} and arrives at ${alternative.arrival}.`,
    };
  }

  return {
    ...affectedBase,
    level: "exceeds",
    overLimitMinutes: overBy,
    alternative,
    headline: `Your original route may arrive at ${formatMinutes(predicted)}, exceeding your limit by ${overBy} min.`,
    detail: `Recommended alternative leaves at ${formatMinutes(departure)} and arrives at ${alternative.arrival}.`,
  };
}

