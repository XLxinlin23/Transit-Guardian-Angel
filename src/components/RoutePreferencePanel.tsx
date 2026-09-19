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
import { useEffect, useRef, useState } from "react";

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
import type { Journey } from "@/lib/journey.functions";
import { useRouteStore } from "@/lib/route-state";
import { useTrip } from "@/lib/trip-store";
import { journeyDateTimeLabel, primaryMetric, STATUS_CLASS } from "@/lib/journey-time";
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

  // Same shared store as Home — no separate copy of the route alternatives here.
  const store = useRouteStore();
  const routes = store.routes;

  const applyPreference = () => {
    setPreferences([pending]);
    setManualJourney(null);
    const label = PREFERENCE_LABELS[pending].toLowerCase();
    setConfirmation(`Preference updated. Your Home recommendation now prioritises ${label}.`);
  };

  const useRoute = () => {
    if (!pendingJourney) return;
    setManualJourney(pendingJourney);
    const chosen = routes.find((route) => route.journey === pendingJourney);
    setPendingJourney(null);
    setConfirmation(
      `Route selected. You will leave at ${chosen?.normalDepartureClock ?? store.departureClock} and arrive by ${chosen?.predictedArrivalClock ?? "--:--"}.`,
    );
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

      {manualJourney && (
        <Button
          variant="ghost"
          className="mt-3 h-10 w-full text-sm font-bold text-primary"
          onClick={() => { setManualJourney(null); setConfirmation("Back to your recommended route."); }}
        >
          Return to recommended route
        </Button>
      )}

      <section ref={compareRef} className="mt-9 scroll-mt-5 border-t border-border pt-7">
        <p className="text-xs font-semibold uppercase text-success">Route comparison</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-brand-deep">Compare all routes</h2>
        <p className="mt-2 text-sm text-muted-foreground">Compare travel time, walking, transfers, fare and route details.</p>

        {!fromPlace || !toPlace ? (
          <div className="glass-panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">Plan and confirm a trip on Home to compare its routes.</div>
        ) : store.loading && !routes.length ? (
          <div className="glass-panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">Comparing routes…</div>
        ) : !routes.length ? (
          <div className="glass-panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">No routes are available for this trip yet.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {routes.map((route) => {
              const journey = route.journey;
              const open = expandedId === route.id;
              const modes = journey.legs.filter((leg) => leg.mode !== "walk");
              const segments = journey.legs.map((leg) => ({ mode: leg.mode, badge: leg.badge, points: leg.points }));
              const primaryPreference = route.primaryPreference;
              const otherLabels = route.preferences.filter((value) => value !== primaryPreference).map((value) => PREFERENCE_LABELS[value]);
              const metric = primaryMetric(journey, primaryPreference);
              const status = route.status;
              const chosen = route.isManuallySelected;
              const border = route.isDisruptionRecommended
                ? "border-success"
                : route.isAffectedByDisruption
                  ? "border-route-red/60"
                  : route.isPrimaryPreferenceWinner
                    ? "border-primary/50"
                    : "";
              return (
                <article key={route.id} className={`glass-panel rounded-2xl p-4 ${border}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      {PREFERENCE_LABELS[primaryPreference]}
                    </span>
                    {route.isPrimaryPreferenceWinner && !chosen && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-success">Recommended</span>
                    )}
                    {chosen && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-success">Chosen by you</span>}
                    {route.isDisruptionRecommended && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-success">Recommended during disruption</span>
                    )}
                    {route.isAffectedByDisruption && (
                      <span className="rounded-full bg-route-red/10 px-2 py-0.5 text-[10px] font-bold uppercase text-route-red">Affected by disruption</span>
                    )}
                    {status === "late" && (
                      <span className="rounded-full bg-route-red/10 px-2 py-0.5 text-[10px] font-bold uppercase text-route-red">Unable to meet arrival limit</span>
                    )}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {journey.fareEstimated === false ? "Live" : "Estimated"}
                    </span>
                  </div>

                  <p className="mt-2 font-display text-2xl font-bold text-brand-deep">{metric.primary}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{metric.support}</p>
                  {otherLabels.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Also ranked best for {otherLabels.join(", ").toLowerCase()}.</p>
                  )}

                  {route.isAffectedByDisruption ? (
                    <div className="mt-2 space-y-1 rounded-xl border border-route-red/40 bg-route-red/5 px-3 py-2 text-[11px] font-semibold text-brand-deep">
                      <p>Normal: {route.normalDepartureClock} → {route.normalArrivalClock} · {route.normalDurationMinutes} min</p>
                      <p className="text-route-red">
                        Updated: {route.normalDepartureClock} → {route.predictedArrivalClock} · {route.predictedDurationMinutes} min
                      </p>
                      <p className="text-route-red">
                        {route.overLimitMinutes > 0
                          ? `Arrives ${route.overLimitMinutes} min after your limit (${store.latestAcceptableClock})`
                          : `Still within your limit (${store.latestAcceptableClock})`}
                      </p>
                    </div>
                  ) : (
                    <p className={`mt-2 inline-block rounded-md border px-2 py-1 text-[11px] font-bold ${STATUS_CLASS[status]}`}>
                      {route.normalDepartureClock} → {route.predictedArrivalClock} · {route.predictedDurationMinutes} min
                      {status === "within" ? " · within your delay limit" : status === "late" ? " · past your delay limit" : ""}
                    </p>
                  )}
                  {route.isDisruptionRecommended && store.incident && (
                    <p className="mt-1.5 rounded-md border border-success/40 bg-success-soft px-2 py-1 text-[11px] font-bold text-success">
                      Arrives within your delay limit · avoids the affected {store.incident.line} Line segment
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{journeyDateTimeLabel(alarm)}</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Metric icon={Clock3} label="Duration" value={`${route.predictedDurationMinutes} min`} />
                    <Metric icon={Footprints} label="Walking" value={`${journey.totalWalkingDistanceMetres ?? journey.walkMetres} m · ${journey.totalWalkingTimeMinutes ?? journey.walkMinutes} min`} />
                    <Metric icon={TrainFront} label="Transfers" value={String(journey.numberOfTransfers ?? journey.transfers)} />
                    <Metric icon={Banknote} label="Fare" value={typeof journey.fare === "number" ? `$${journey.fare.toFixed(2)}` : "—"} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {modes.map((leg, index) => <LegBadge key={`${leg.mode}-${leg.badge}-${index}`} mode={leg.mode} badge={leg.badge} size="sm" />)}
                    {!modes.length && <LegBadge mode="walk" badge="Walk" size="sm" />}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 h-10 w-full rounded-xl border-primary text-primary"
                    onClick={() => setExpandedId(open ? null : route.id)}
                    aria-expanded={open}
                  >
                    {open ? "Hide route details" : "View route details"}
                    <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
                  </Button>

                  {open && (
                    <div className="mt-4 border-t border-border pt-4">
                      <RouteMap stations={[]} segments={segments} embedded compact title="Route map" />
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