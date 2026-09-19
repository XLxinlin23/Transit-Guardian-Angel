import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { assessDisruption, DEMO_INCIDENT, type DisruptionAssessment, type Incident } from "@/lib/disruption";
import type { Journey } from "@/lib/journey.functions";
import { getTrainAlerts } from "@/lib/singapore.functions";

/** Minutes a live rail disruption is assumed to add to an affected route. */
export const LIVE_DELAY_MINUTES = 15;

export type DisruptionWatch = {
  assessment: DisruptionAssessment | null;
  incident: Incident | null;
  demo: boolean;
  setDemo: (value: boolean) => void;
  demoAvailable: boolean;
  disrupted: boolean;
};

/** Watches live rail alerts (or a demo incident) against the journey the user is looking at. */
export function useDisruptionWatch(params: {
  journey: Journey | null;
  baselineJourney?: Journey | null | undefined;
  alternatives: Array<{ preference?: string; journey: Journey }>;
  arriveBy: string;
  maxDelay: string;
}): DisruptionWatch {
  const [demo, setDemo] = useState(false);

  const alertsFn = useServerFn(getTrainAlerts);
  const alertsQuery = useQuery({
    queryKey: ["train-alerts", "journey-status"],
    queryFn: () => alertsFn(),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const incident: Incident | null = useMemo(() => {
    if (demo) return DEMO_INCIDENT;
    const data = alertsQuery.data;
    if (!data || data.status !== "disrupted") return null;
    return {
      source: "live",
      line: (data.line ?? "").trim(),
      stations: (data.stations ?? "")
        .split(/[,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      message: data.message ?? "Train service disruption reported.",
      addedMinutes: LIVE_DELAY_MINUTES,
    };
  }, [alertsQuery.data, demo]);

  const assessment = useMemo(
    () =>
      assessDisruption({
        journey: params.journey,
        alternatives: params.alternatives,
        incident,
        arriveBy: params.arriveBy,
        maxDelayMinutes: Number(params.maxDelay) || 0,
        baselineMinutes: (params.baselineJourney ?? params.journey)?.minutes,
      }),
    [incident, params.alternatives, params.arriveBy, params.baselineJourney, params.journey, params.maxDelay],
  );

  return {
    assessment,
    incident,
    demo,
    setDemo,
    demoAvailable: import.meta.env.DEV,
    disrupted: Boolean(assessment && assessment.level !== "none"),
  };
}
