import { journeyDate, type RouteAlarm, type RoutePreference } from "./commute-settings";
import type { Journey } from "./journey.functions";

/** Minutes past midnight for "HH:MM", or null. */
export function toMinutes(hhmm: string): number | null {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** "HH:MM" from minutes past midnight, wrapping across midnight. */
export function toClock(total: number): string {
  const wrapped = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** Departure clock time for a route of the given duration, handling midnight. */
export function departureClock(arriveBy: string, durationMinutes: number): string {
  const reach = toMinutes(arriveBy);
  if (reach === null) return "--:--";
  return toClock(reach - (durationMinutes || 0));
}

/** The full Date of the reach-by moment on the chosen journey date. */
export function reachByDate(alarm: Pick<RouteAlarm, "dateMode" | "date" | "arriveBy">): Date | null {
  const minutes = toMinutes(alarm.arriveBy);
  if (minutes === null) return null;
  const base = journeyDate(alarm);
  base.setHours(0, 0, 0, 0);
  return new Date(base.getTime() + minutes * 60_000);
}

/** reach-by + maximum delay, as a full Date. */
export function latestAcceptableDate(
  alarm: Pick<RouteAlarm, "dateMode" | "date" | "arriveBy" | "maxDelay">,
): Date | null {
  const reach = reachByDate(alarm);
  if (!reach) return null;
  return new Date(reach.getTime() + (Number(alarm.maxDelay) || 0) * 60_000);
}

/** True when "Today" is selected but the reach-by time is already behind us. */
export function reachByHasPassed(alarm: Pick<RouteAlarm, "dateMode" | "date" | "arriveBy">): boolean {
  if (alarm.dateMode !== "today") return false;
  const reach = reachByDate(alarm);
  return Boolean(reach && reach.getTime() < Date.now());
}

/** "Friday, 19 September · Arrive by 08:45" */
export function journeyDateTimeLabel(alarm: Pick<RouteAlarm, "dateMode" | "date" | "arriveBy">): string {
  const date = journeyDate(alarm);
  const formatted = date.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" });
  return `${formatted} · Arrive by ${alarm.arriveBy || "--:--"}`;
}

export type ArrivalStatus = "onTime" | "within" | "late";

/** Green when it beats the target, amber inside the delay limit, red beyond it. */
export function arrivalStatus(arrival: string, arriveBy: string, maxDelay: string | number): ArrivalStatus {
  const arrivalMin = toMinutes(arrival);
  const reach = toMinutes(arriveBy);
  if (arrivalMin === null || reach === null) return "onTime";
  const latest = reach + (Number(maxDelay) || 0);
  if (arrivalMin <= reach) return "onTime";
  if (arrivalMin <= latest) return "within";
  return "late";
}

export const STATUS_CLASS: Record<ArrivalStatus, string> = {
  onTime: "border-success/35 bg-success-soft text-success",
  within: "border-route-orange/40 bg-warning-soft text-brand-deep",
  late: "border-route-red/40 bg-route-red/10 text-route-red",
};

const walkMetres = (journey: Journey) => journey.totalWalkingDistanceMetres ?? journey.walkMetres ?? 0;
const walkMins = (journey: Journey) => journey.totalWalkingTimeMinutes ?? journey.walkMinutes ?? 0;
const transfers = (journey: Journey) => journey.numberOfTransfers ?? journey.transfers ?? 0;
const duration = (journey: Journey) => journey.totalDurationMinutes ?? journey.minutes ?? 0;

const fareText = (journey: Journey) =>
  typeof journey.fare === "number"
    ? `$${journey.fare.toFixed(2)}${journey.fareEstimated === false ? "" : " estimated"}`
    : "Fare unavailable";

/** One headline figure for the card, plus the supporting figures. */
export function primaryMetric(
  journey: Journey,
  preference: RoutePreference,
): { primary: string; support: string } {
  const time = `${duration(journey)} min`;
  const walk = `${walkMetres(journey)} m walking`;
  const change = `${transfers(journey)} transfer${transfers(journey) === 1 ? "" : "s"}`;
  const fare = fareText(journey);
  const shortWalk = `${walkMetres(journey)} m walking · ${walkMins(journey)} min`;

  if (preference === "walking") return { primary: walk, support: [time, change, fare].join(" · ") };
  if (preference === "transfers") return { primary: change, support: [time, shortWalk, fare].join(" · ") };
  if (preference === "cost") return { primary: fare, support: [time, shortWalk, change].join(" · ") };
  return { primary: time, support: [shortWalk, change, fare].join(" · ") };
}

/** True when the route is only walking. */
export function isWalkOnly(journey: Journey): boolean {
  return journey.legs.every((leg) => leg.mode === "walk");
}

/** Arrival clock for a route leaving at a fixed departure minute. */
export function arrivalFromDeparture(journey: Journey, departureMinutes: number | null): string {
  if (departureMinutes === null) return "--:--";
  return toClock(departureMinutes + duration(journey));
}

/**
 * Drop options the user should never be offered: long all-walking routes, routes
 * with excessive walking, routes that miss the delay limit, and disrupted routes —
 * each only when an acceptable alternative survives the filter.
 */
export function filterEligible<T extends { journey: Journey }>(
  options: T[],
  opts: {
    arriveBy: string;
    maxDelay: string | number;
    departureMinutes: number | null;
    isDisrupted?: (journey: Journey) => boolean;
  },
): T[] {
  if (options.length <= 1) return options;
  const transit = options.filter((option) => !isWalkOnly(option.journey));
  let pool = transit.length ? transit : options;

  const reasonableWalk = pool.filter((option) => walkMetres(option.journey) <= 2000);
  if (reasonableWalk.length) pool = reasonableWalk;

  const inTime = pool.filter(
    (option) =>
      arrivalStatus(arrivalFromDeparture(option.journey, opts.departureMinutes), opts.arriveBy, opts.maxDelay) !==
      "late",
  );
  if (inTime.length) pool = inTime;

  if (opts.isDisrupted) {
    const clear = pool.filter((option) => !opts.isDisrupted!(option.journey));
    if (clear.length) pool = clear;
  }
  return pool;
}
