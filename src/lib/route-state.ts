import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { PREFERENCE_LABELS, type RoutePreference } from "./commute-settings";
import { DEMO_INCIDENT, journeyAffected, type Incident } from "./disruption";
import { arrivalStatus, filterEligible, toClock, toMinutes, type ArrivalStatus } from "./journey-time";
import { compareJourneys, planJourney, type Journey } from "./journey.functions";
import { getTrainAlerts } from "./singapore.functions";
import { useSimulationOptional } from "./simulation";
import { useTrip } from "./trip-store";

/** Minutes a live rail disruption is assumed to add to an affected route. */
export const LIVE_DELAY_MINUTES = 15;

/** Everything both Home and Preferences need to know about one route option. */
export type RouteState = {
  id: string;
  journey: Journey;
  preferences: RoutePreference[];
  primaryPreference: RoutePreference;
  normalDepartureClock: string;
  normalArrivalClock: string;
  normalDurationMinutes: number;
  incidentDelayMinutes: number;
  predictedArrivalClock: string;
  predictedDurationMinutes: number;
  isAffectedByDisruption: boolean;
  meetsArrivalLimit: boolean;
  overLimitMinutes: number;
  status: ArrivalStatus;
  isPrimaryPreferenceWinner: boolean;
  isDisruptionRecommended: boolean;
  isManuallySelected: boolean;
};

export type RouteStore = {
  routes: RouteState[];
  selected: RouteState | null;
  recommended: RouteState | null;
  disruptionRecommended: RouteState | null;
  incident: Incident | null;
  departureMinutes: number | null;
  departureClock: string;
  reachByClock: string;
  latestAcceptableClock: string;
  preference: RoutePreference;
  loading: boolean;
  planMessage: string | null;
  refetch: () => void;
};

/** Lower is better — mirrors the ranking used by the planner. */
export function preferenceScore(journey: Journey, preference: RoutePreference): number {
  const minutes = journey.totalDurationMinutes ?? journey.minutes ?? 0;
  const walk = journey.totalWalkingDistanceMetres ?? journey.walkMetres ?? 0;
  const transfers = journey.numberOfTransfers ?? journey.transfers ?? 0;
  switch (preference) {
    case "walking":
      return walk * 10 + minutes;
    case "sheltered":
      return walk * 12 + minutes;
    case "transfers":
      return transfers * 1000 + minutes;
    case "cost":
      return (journey.fare ?? 0) * 100 + minutes;
    default:
      return minutes;
  }
}

const durationOf = (journey: Journey) => journey.totalDurationMinutes ?? journey.minutes ?? 0;
const keyOf = (journey: Journey) =>
  journey.id ?? `${journey.minutes}-${journey.walkMetres}-${journey.transfers}`;

/**
 * The single shared route store. Both Home and Preferences call this hook; it reads
 * the same trip state, the same react-query caches and the same incident, so neither
 * page ever keeps its own copy of the route alternatives or their timings.
 */
export function useRouteStore(): RouteStore {
  const { alarm, fromPlace, toPlace, preferences, manualJourney } = useTrip();
  const preference = (preferences[0] ?? "speed") as RoutePreference;

  const simulation = useSimulationOptional();
  const demo = simulation?.demo ?? false;
  const departedAt = simulation?.departedAt ?? null;

  const planFn = useServerFn(planJourney);
  const compareFn = useServerFn(compareJourneys);
  const alertsFn = useServerFn(getTrainAlerts);

  const planQuery = useQuery({
    queryKey: ["journey", fromPlace?.lat, fromPlace?.lng, toPlace?.lat, toPlace?.lng, preferences.join(",")],
    enabled: Boolean(fromPlace && toPlace),
    staleTime: 5 * 60_000,
    queryFn: () =>
      planFn({
        data: {
          from: { lat: fromPlace!.lat, lng: fromPlace!.lng, label: fromPlace!.name },
          to: { lat: toPlace!.lat, lng: toPlace!.lng, label: toPlace!.name },
          preferences,
        },
      }),
  });

  const optionsQuery = useQuery({
    queryKey: ["journey-options", fromPlace?.lat, fromPlace?.lng, toPlace?.lat, toPlace?.lng],
    enabled: Boolean(fromPlace && toPlace),
    staleTime: 5 * 60_000,
    queryFn: () =>
      compareFn({
        data: {
          from: { lat: fromPlace!.lat, lng: fromPlace!.lng, label: fromPlace!.name },
          to: { lat: toPlace!.lat, lng: toPlace!.lng, label: toPlace!.name },
        },
      }),
  });

  const alertsQuery = useQuery({
    queryKey: ["train-alerts", "journey-status"],
    queryFn: () => alertsFn(),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const incident: Incident | null = useMemo(() => {
    // A demo incident replaces live data entirely — simulated and live are never mixed.
    if (demo) return DEMO_INCIDENT;
    const data = alertsQuery.data;
    if (!data || data.status !== "disrupted") return null;
    return {
      source: "live",
      line: (data.line ?? "").trim(),
      stations: (data.stations ?? "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
      message: data.message ?? "Train service disruption reported.",
      addedMinutes: LIVE_DELAY_MINUTES,
    };
  }, [alertsQuery.data, demo]);

  const planResult = planQuery.data ?? null;
  const recommendedJourney: Journey | null = planResult?.ok ? planResult.journey : null;
  const planMessage = planResult && !planResult.ok ? planResult.message : null;

  const store = useMemo<Omit<RouteStore, "refetch">>(() => {
    const reach = toMinutes(alarm.arriveBy);
    const maxDelay = Number(alarm.maxDelay) || 0;
    const latestMinutes = reach === null ? null : reach + maxDelay;

    // Every arrival on both pages is measured from one departure moment.
    const baseDuration = durationOf(recommendedJourney ?? manualJourney ?? ({ minutes: 0 } as Journey));
    const departureMinutes = departedAt ?? (reach === null ? null : reach - baseDuration);

    const grouped = new Map<string, { journey: Journey; preferences: RoutePreference[] }>();
    const add = (journey: Journey, value?: RoutePreference) => {
      const key = keyOf(journey);
      const current = grouped.get(key);
      if (current) {
        if (value && !current.preferences.includes(value)) current.preferences.push(value);
        return;
      }
      grouped.set(key, { journey, preferences: value ? [value] : [] });
    };
    if (recommendedJourney) add(recommendedJourney, preference);
    if (manualJourney) add(manualJourney);
    for (const option of optionsQuery.data ?? []) add(option.journey, option.preference as RoutePreference);

    const recommendedKey = recommendedJourney ? keyOf(recommendedJourney) : null;
    const manualKey = manualJourney ? keyOf(manualJourney) : null;

    // Never hide the route the user is looking at, even when it becomes unreasonable.
    const keepAlways = new Set([recommendedKey, manualKey].filter(Boolean) as string[]);
    const all = [...grouped.values()];
    const eligible = filterEligible(all, { arriveBy: alarm.arriveBy, maxDelay: alarm.maxDelay, departureMinutes });
    const eligibleKeys = new Set(eligible.map((item) => keyOf(item.journey)));
    const pool = all.filter((item) => eligibleKeys.has(keyOf(item.journey)) || keepAlways.has(keyOf(item.journey)));

    const states: RouteState[] = pool.map((item) => {
      const normal = durationOf(item.journey);
      const affected = incident ? journeyAffected(item.journey, incident) : false;
      const delay = affected && incident ? incident.addedMinutes : 0;
      const predicted = normal + delay;
      const normalArrivalMinutes = departureMinutes === null ? null : departureMinutes + normal;
      const predictedMinutes = departureMinutes === null ? null : departureMinutes + predicted;
      const over =
        predictedMinutes === null || latestMinutes === null ? 0 : Math.max(0, predictedMinutes - latestMinutes);
      const key = keyOf(item.journey);
      const preferenceList = item.preferences.length ? item.preferences : ([] as RoutePreference[]);
      return {
        id: key,
        journey: item.journey,
        preferences: preferenceList,
        primaryPreference: preferenceList.includes(preference) ? preference : (preferenceList[0] ?? "speed"),
        normalDepartureClock: departureMinutes === null ? "--:--" : toClock(departureMinutes),
        normalArrivalClock: normalArrivalMinutes === null ? "--:--" : toClock(normalArrivalMinutes),
        normalDurationMinutes: normal,
        incidentDelayMinutes: delay,
        predictedArrivalClock: predictedMinutes === null ? "--:--" : toClock(predictedMinutes),
        predictedDurationMinutes: predicted,
        isAffectedByDisruption: affected,
        meetsArrivalLimit: over === 0,
        overLimitMinutes: over,
        status:
          predictedMinutes === null
            ? "onTime"
            : arrivalStatus(toClock(predictedMinutes), alarm.arriveBy, alarm.maxDelay),
        isPrimaryPreferenceWinner: key === recommendedKey,
        isDisruptionRecommended: false,
        isManuallySelected: key === manualKey,
      };
    });

    const recommended = states.find((state) => state.isPrimaryPreferenceWinner) ?? null;
    const manual = states.find((state) => state.isManuallySelected) ?? null;
    const selected = manual ?? recommended ?? states[0] ?? null;

    // Only look for a safer route when the route in use is disrupted past the limit.
    let disruptionRecommended: RouteState | null = null;
    if (incident && selected && selected.isAffectedByDisruption && !selected.meetsArrivalLimit) {
      const clean = states.filter((state) => !state.isAffectedByDisruption && state.id !== selected.id);
      const inTime = clean.filter((state) => state.meetsArrivalLimit);
      const ranked = (inTime.length ? inTime : clean).sort((a, b) =>
        inTime.length
          ? preferenceScore(a.journey, preference) - preferenceScore(b.journey, preference)
          : a.predictedDurationMinutes - b.predictedDurationMinutes,
      );
      disruptionRecommended = ranked[0] ?? null;
      if (disruptionRecommended) disruptionRecommended.isDisruptionRecommended = true;
    }

    // During an incident: safer recommendation first, then routes meeting the limit, then the rest.
    const sorted = [...states].sort((a, b) => {
      const rank = (state: RouteState) => {
        if (state.isDisruptionRecommended) return 0;
        if (state.meetsArrivalLimit && !state.isAffectedByDisruption) return 1;
        if (state.meetsArrivalLimit) return 2;
        return 3;
      };
      if (incident && rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.isManuallySelected !== b.isManuallySelected) return a.isManuallySelected ? -1 : 1;
      if (a.isPrimaryPreferenceWinner !== b.isPrimaryPreferenceWinner) return a.isPrimaryPreferenceWinner ? -1 : 1;
      return preferenceScore(a.journey, preference) - preferenceScore(b.journey, preference);
    });

    return {
      routes: sorted,
      selected,
      recommended,
      disruptionRecommended,
      incident,
      departureMinutes,
      departureClock: departureMinutes === null ? "--:--" : toClock(departureMinutes),
      reachByClock: alarm.arriveBy || "--:--",
      latestAcceptableClock: latestMinutes === null ? "--:--" : toClock(latestMinutes),
      preference,
      loading: planQuery.isFetching || optionsQuery.isFetching,
      planMessage,
    };
  }, [
    alarm.arriveBy,
    alarm.maxDelay,
    departedAt,
    incident,
    manualJourney,
    optionsQuery.data,
    optionsQuery.isFetching,
    planMessage,
    planQuery.isFetching,
    preference,
    recommendedJourney,
  ]);

  return { ...store, refetch: () => void planQuery.refetch() };
}

export function preferenceLabel(value: RoutePreference): string {
  return PREFERENCE_LABELS[value] ?? value;
}
