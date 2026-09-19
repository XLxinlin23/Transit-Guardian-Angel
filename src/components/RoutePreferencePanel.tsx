import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Footprints,
  Gauge,
  ShieldCheck,
  TrainFront,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PREFERENCE_LABELS, type RoutePreference } from "@/lib/commute-settings";
import { compareJourneys, type Journey } from "@/lib/journey.functions";
import { getTrainAlerts } from "@/lib/singapore.functions";
import { useTrip } from "@/lib/trip-store";
import {
  arrivalFromDeparture,
  arrivalStatus,
  filterEligible,
  journeyDateTimeLabel,
  primaryMetric,
  STATUS_CLASS,
  toMinutes,
} from "@/lib/journey-time";
import { JourneyTimeline, LegBadge, RouteLegend } from "./JourneySteps";
import { RouteMap } from "./RouteMap";

const OPTIONS: { value: RoutePreference; icon: typeof Gauge; detail: string }[] = [
  { value: "speed", icon: Gauge, detail: "Shortest travel time" },
  { value: "walking", icon: Footprints, detail: "Shortest total walking distance" },
  { value: "transfers", icon: TrainFront, detail: "Fewest line or bus changes" },
  { value: "cost", icon: Banknote, detail: "Lowest estimated fare" },
  { value: "sheltered", icon: ShieldCheck, detail: "Less outdoor walking" },
  { value: "crowd", icon: Users, detail: "Avoid busier services" },
];

type RouteGroup = {
  journey: Journey;
  preferences: RoutePreference[];
};

function shiftTime(hhmm: string, minusMinutes: number): string {
  const [h = NaN, m = NaN] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "--:--";
  let total = h * 60 + m - minusMinutes;
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function RoutePreferencePanel({
  onBackToPlan,
  focusCompareRequest = 0,
}: {
  onBackToPlan?: () => void;
  focusCompareRequest?: number;
}) {
  const { preferences, setPreferences, fromPlace, toPlace, alarm, manualJourney, setManualJourney } = useTrip();
  const applied = preferences[0] ?? "speed";
  const [pending, setPending] = useState<RoutePreference>(applied);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingJourney, setPendingJourney] = useState<Journey | null>(null);
  const compareRef = useRef<HTMLElement | null>(null);

  useEffect(() => setPending(applied), [applied]);
  useEffect(() => {
    if (!focusCompareRequest) return;
    const frame = window.requestAnimationFrame(() => compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusCompareRequest]);

  const compare = useServerFn(compareJourneys);
  const fetchTrainAlerts = useServerFn(getTrainAlerts);
  const alertsQuery = useQuery({
    queryKey: ["train-alerts"],
    queryFn: () => fetchTrainAlerts(),
    refetchInterval: 60_000,
  });
  const routesQuery = useQuery({
    queryKey: ["journey-options", fromPlace?.lat, fromPlace?.lng, toPlace?.lat, toPlace?.lng],
    enabled: Boolean(fromPlace && toPlace),
    staleTime: 5 * 60_000,
    queryFn: () => {
      if (!fromPlace || !toPlace) return Promise.resolve([]);
      return compare({
        data: {
          from: { lat: fromPlace.lat, lng: fromPlace.lng, label: fromPlace.name },
          to: { lat: toPlace.lat, lng: toPlace.lng, label: toPlace.name },
        },
      });
    },
  });

  const affectedLines = useMemo(
    () => (alertsQuery.data?.line ?? "").split(/[\s,;/]+/).filter(Boolean).map((line) => line.toUpperCase()),
    [alertsQuery.data?.line],
  );
  const isDisrupted = useMemo(
    () => (journey: Journey) => {
      if (alertsQuery.data?.status !== "disrupted") return false;
      const lines = new Set(
        journey.legs.filter((leg) => leg.mode === "mrt" || leg.mode === "lrt").map((leg) => leg.badge.toUpperCase()),
      );
      return !affectedLines.length || affectedLines.some((line) => lines.has(line));
    },
    [affectedLines, alertsQuery.data?.status],
  );

  const routes = useMemo<RouteGroup[]>(() => {
    const grouped = new Map<string, RouteGroup>();
    for (const option of routesQuery.data ?? []) {
      const preference = option.preference as RoutePreference;
      const current = grouped.get(option.journey.id);
      if (current) current.preferences.push(preference);
      else grouped.set(option.journey.id, { journey: option.journey, preferences: [preference] });
    }
    const all = [...grouped.values()];
    const applied0 = all.find((group) => group.preferences.includes(applied))?.journey;
    const reach = toMinutes(alarm.arriveBy);
    const baseDuration = applied0?.totalDurationMinutes ?? applied0?.minutes ?? 0;
    const departureMinutes = reach === null ? null : reach - baseDuration;
    return filterEligible(all, {
      arriveBy: alarm.arriveBy,
      maxDelay: alarm.maxDelay,
      departureMinutes,
      isDisrupted,
    });
  }, [alarm.arriveBy, alarm.maxDelay, applied, isDisrupted, routesQuery.data]);

  const fixedDepartureMinutes = useMemo(() => {
    const reach = toMinutes(alarm.arriveBy);
    const base = routes.find((group) => group.preferences.includes(applied))?.journey ?? routes[0]?.journey;
    if (reach === null || !base) return null;
    return reach - (base.totalDurationMinutes ?? base.minutes ?? 0);
  }, [alarm.arriveBy, applied, routes]);

  const applyPreference = () => {
    setPreferences([pending]);
    setManualJourney(null);
    const label = PREFERENCE_LABELS[pending].toLowerCase();
    setConfirmation(`Preference updated. Your Home recommendation now prioritises ${label}.`);
  };

  const useRoute = () => {
    if (!pendingJourney) return;
    setManualJourney(pendingJourney);
    setPendingJourney(null);
    setConfirmation("Route updated. This option is now marked Chosen by you on Home.");
  };

  return (
    <div className="pb-4 pt-7">
      <p className="text-xs font-semibold uppercase text-primary">Route preference</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">What matters most?</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Choose one priority for your recommended route.</p>

      {fromPlace && toPlace && (
        <p className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-semibold text-brand-deep">
          {fromPlace.name} → {toPlace.name}
        </p>
      )}

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Primary route preference">
        {OPTIONS.map(({ value, icon: Icon, detail }) => {
          const selected = pending === value;
          return (
            <Button
              key={value}
              type="button"
              variant="outline"
              onClick={() => { setPending(value); setConfirmation(null); }}
              aria-pressed={selected}
              className={`h-auto min-h-28 flex-col items-start whitespace-normal rounded-2xl p-4 text-left ${selected ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : "glass-panel text-brand-deep"}`}
            >
              <span className={`grid size-9 place-items-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}><Icon /></span>
              <span className="mt-2 flex w-full items-center gap-1.5 text-sm font-semibold">{PREFERENCE_LABELS[value]}{selected && <Check className="ml-auto size-4" />}</span>
              <span className="text-xs font-normal leading-snug text-muted-foreground">{detail}</span>
            </Button>
          );
        })}
      </section>

      <Button className="mt-5 h-11 w-full rounded-xl" onClick={applyPreference}>
        <ShieldCheck /> Apply preference
      </Button>
      {confirmation && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-success/25 bg-success-soft p-3 text-sm font-semibold text-brand-deep" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {confirmation}
        </p>
      )}

      <section ref={compareRef} className="mt-9 scroll-mt-5 border-t border-border pt-7">
        <p className="text-xs font-semibold uppercase text-success">Route comparison</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-brand-deep">Compare all routes</h2>
        <p className="mt-2 text-sm text-muted-foreground">Compare travel time, walking, transfers, fare and route details.</p>

        {!fromPlace || !toPlace ? (
          <div className="glass-panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">Plan and confirm a trip on Home to compare its routes.</div>
        ) : routesQuery.isFetching && !routes.length ? (
          <div className="glass-panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">Comparing routes…</div>
        ) : !routes.length ? (
          <div className="glass-panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">No routes are available for this trip yet.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {routes.map(({ journey, preferences: routePreferences }) => {
              const open = expandedId === journey.id;
              const modes = journey.legs.filter((leg) => leg.mode !== "walk");
              const segments = journey.legs.map((leg) => ({ mode: leg.mode, badge: leg.badge, points: leg.points }));
              const labels = routePreferences.map((value) => PREFERENCE_LABELS[value]);
              const leaveAt = shiftTime(alarm.arriveBy, journey.totalDurationMinutes ?? journey.minutes);
              const routeLines = new Set(journey.legs.filter((leg) => leg.mode === "mrt" || leg.mode === "lrt").map((leg) => leg.badge.toUpperCase()));
              const affectedLines = (alertsQuery.data?.line ?? "").split(/[\s,;/]+/).filter(Boolean).map((line) => line.toUpperCase());
              const disrupted = alertsQuery.data?.status === "disrupted" && (!affectedLines.length || affectedLines.some((line) => routeLines.has(line)));
              return (
                <article key={journey.id} className={`glass-panel rounded-2xl p-4 ${routePreferences.includes(applied) ? "border-primary/50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-brand-deep">{labels.join(" · ")}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{leaveAt} → {alarm.arriveBy || "--:--"}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">{journey.totalDurationMinutes ?? journey.minutes} min</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Metric icon={Footprints} label="Walking" value={`${journey.totalWalkingDistanceMetres ?? journey.walkMetres} m · ${journey.totalWalkingTimeMinutes ?? journey.walkMinutes} min`} />
                    <Metric icon={TrainFront} label="Transfers" value={String(journey.numberOfTransfers ?? journey.transfers)} />
                    <Metric icon={Banknote} label="Fare" value={typeof journey.fare === "number" ? `$${journey.fare.toFixed(2)}` : "—"} />
                    <Metric icon={Clock3} label="Disruption" value={disrupted ? "Current disruption" : alertsQuery.data?.configured ? "None reported" : "Checking…"} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {modes.map((leg, index) => <LegBadge key={`${leg.mode}-${leg.badge}-${index}`} mode={leg.mode} badge={leg.badge} size="sm" />)}
                    {!modes.length && <LegBadge mode="walk" badge="Walk" size="sm" />}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 h-10 w-full rounded-xl border-primary text-primary"
                    onClick={() => setExpandedId(open ? null : journey.id)}
                    aria-expanded={open}
                  >
                    {open ? "Hide route details" : "View route details"}
                    <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
                  </Button>

                  {open && (
                    <div className="mt-4 border-t border-border pt-4">
                      <RouteMap stations={[]} segments={segments} embedded compact title={`${labels[0]} route map`} />
                      <div className="mt-3"><RouteLegend legs={journey.legs} /></div>
                      <div className="mt-3"><JourneyTimeline legs={journey.legs} /></div>
                      <Button className="mt-4 h-11 w-full rounded-xl" onClick={() => setPendingJourney(journey)}>Use this route</Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {onBackToPlan && (
        <Button variant="outline" className="mt-6 h-11 w-full rounded-xl border-primary text-sm font-bold text-primary" onClick={onBackToPlan}>
          <ArrowLeft /> Back to plan your trip
        </Button>
      )}

      <AlertDialog open={Boolean(pendingJourney)} onOpenChange={(open) => { if (!open) setPendingJourney(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Use this route instead?</AlertDialogTitle>
            <AlertDialogDescription>Use this route instead of the recommended route? Your primary preference will stay {PREFERENCE_LABELS[applied].toLowerCase()}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={useRoute}>Use this route</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/65 p-2.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground"><Icon className="size-3" /> {label}</p>
      <p className="mt-1 font-bold text-brand-deep">{value}</p>
    </div>
  );
}