import type { RouteAlarm } from "./commute-settings";
import type { Journey } from "./journey.functions";
import { journeyISO, minutesToClock, stamp } from "./sg-time";

/**
 * The one object every component reads route timings from — the Home card, the map
 * summary, the journey steps, saved alarms and the commute alert. Nothing recalculates
 * a duration of its own.
 */
export type RouteMetrics = {
  /** Journey time actually expected, including any disruption delay. */
  totalDurationMinutes: number;
  /** Journey time without the disruption. */
  normalDurationMinutes: number;
  /** Extra minutes added by an active disruption (0 when clear). */
  delayMinutes: number;
  departureDateTime: Date;
  arrivalDateTime: Date;
  /** "HH:MM" versions of the two moments above. */
  departureClock: string;
  arrivalClock: string;
  walkingMinutes: number;
  walkingDistanceMetres: number;
  transferCount: number;
  estimatedFare: number | null;
  fareEstimated: boolean;
  /** Target arrival and the latest the user will accept. */
  reachByClock: string;
  latestAcceptableClock: string;
  /** Minutes past the latest acceptable arrival; 0 when on time. */
  overLimitMinutes: number;
};

function minutesOf(hhmm: string): number {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Build the metrics for one route against the alarm's journey date and reach-by time.
 * Departure is fixed by the planned (undisrupted) duration so every route on screen is
 * compared from the same moment; arrival then follows from the real duration.
 */
export function buildRouteMetrics(params: {
  journey: Journey;
  alarm: Pick<RouteAlarm, "dateMode" | "date" | "arriveBy" | "maxDelay">;
  /** Duration of the recommended route — keeps the departure time stable across options. */
  baselineMinutes?: number | null;
  /** Extra minutes from an active disruption affecting this route. */
  delayMinutes?: number;
  /** Fixed departure minute (past midnight); overrides the reach-by derived one. */
  departureMinutes?: number | null;
}): RouteMetrics {
  const { journey, alarm } = params;
  const normal = journey.totalDurationMinutes ?? journey.minutes ?? 0;
  const delay = Math.max(0, params.delayMinutes ?? 0);
  const total = normal + delay;

  const reach = minutesOf(alarm.arriveBy);
  const baseline = params.baselineMinutes ?? normal;
  const departureMinutes = params.departureMinutes ?? reach - baseline;
  const arrivalMinutes = departureMinutes + total;

  const dayISO = journeyISO(alarm);
  const dayStart = new Date(`${dayISO}T00:00:00`).getTime();
  const departureDateTime = new Date(dayStart + departureMinutes * 60_000);
  const arrivalDateTime = new Date(dayStart + arrivalMinutes * 60_000);

  const maxDelay = Number(alarm.maxDelay) || 0;
  const latest = reach + maxDelay;

  const metrics: RouteMetrics = {
    totalDurationMinutes: total,
    normalDurationMinutes: normal,
    delayMinutes: delay,
    departureDateTime,
    arrivalDateTime,
    departureClock: minutesToClock(departureMinutes),
    arrivalClock: minutesToClock(arrivalMinutes),
    walkingMinutes: journey.totalWalkingTimeMinutes ?? journey.walkMinutes ?? 0,
    walkingDistanceMetres: journey.totalWalkingDistanceMetres ?? journey.walkMetres ?? 0,
    transferCount: journey.numberOfTransfers ?? journey.transfers ?? 0,
    estimatedFare: typeof journey.fare === "number" ? journey.fare : null,
    fareEstimated: journey.fareEstimated !== false,
    reachByClock: minutesToClock(reach),
    latestAcceptableClock: minutesToClock(latest),
    overLimitMinutes: Math.max(0, arrivalMinutes - latest),
  };

  validateMetrics(metrics);
  return metrics;
}

/** arrival − departure must equal the total duration; caught during development. */
export function validateMetrics(metrics: RouteMetrics): boolean {
  const spanned = Math.round((metrics.arrivalDateTime.getTime() - metrics.departureDateTime.getTime()) / 60_000);
  const ok = spanned === metrics.totalDurationMinutes;
  if (!ok && typeof process !== "undefined" && process.env["NODE_ENV"] !== "production") {
    console.warn("Route metrics mismatch", { spanned, total: metrics.totalDurationMinutes });
  }
  return ok;
}

/** "07:49 → 08:45 · 56 min" */
export function metricsSummary(metrics: RouteMetrics): string {
  return `${metrics.departureClock} → ${metrics.arrivalClock} · ${metrics.totalDurationMinutes} min`;
}

/** True when this route's departure moment has already passed in Singapore. */
export function departureStamp(metrics: RouteMetrics, alarm: Pick<RouteAlarm, "dateMode" | "date">): string {
  return stamp(journeyISO(alarm), metrics.departureClock);
}
