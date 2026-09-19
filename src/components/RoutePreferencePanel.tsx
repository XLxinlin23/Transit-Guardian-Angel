import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Banknote, Footprints, Gauge, ShieldCheck, TrainFront, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PREFERENCE_LABELS, type RoutePreference } from "@/lib/commute-settings";
import { compareJourneys } from "@/lib/journey.functions";
import { LegBadge } from "./JourneySteps";
import { useTrip } from "@/lib/trip-store";

const OPTIONS: { value: RoutePreference; icon: typeof Gauge; detail: string }[] = [
  { value: "speed", icon: Gauge, detail: "Shortest travel time" },
  { value: "cost", icon: Banknote, detail: "Lowest total fare" },
  { value: "walking", icon: Footprints, detail: "Shorter walking segments" },
  { value: "sheltered", icon: ShieldCheck, detail: "More covered connections" },
  { value: "transfers", icon: TrainFront, detail: "Fewer line or bus changes" },
  { value: "crowd", icon: Users, detail: "Avoid busier services" },
];

export function RoutePreferencePanel({ onBackToPlan }: { onBackToPlan?: () => void }) {
  const { preferences, setPreferences, fromPlace, toPlace } = useTrip();
  const selected = preferences;
  const [saved, setSaved] = useState(false);

  const compare = useServerFn(compareJourneys);
  const routesQuery = useQuery({
    queryKey: ["journey-options", fromPlace?.lat, fromPlace?.lng, toPlace?.lat, toPlace?.lng],
    enabled: Boolean(fromPlace && toPlace),
    staleTime: 5 * 60_000,
    queryFn: () =>
      compare({
        data: {
          from: { lat: fromPlace!.lat, lng: fromPlace!.lng, label: fromPlace!.name },
          to: { lat: toPlace!.lat, lng: toPlace!.lng, label: toPlace!.name },
        },
      }),
  });
  const options = routesQuery.data ?? [];

  // Changing a priority re-ranks the saved trip immediately — nothing to re-enter.
  const toggle = (value: RoutePreference) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    setPreferences(next.length ? next : [value]);
    setSaved(false);
  };

  const choose = (value: RoutePreference) => {
    setPreferences([value]);
    setSaved(false);
  };

  const save = () => {
    setPreferences(selected);
    setSaved(true);
  };

  return (
    <div className="pt-7">
      <p className="text-xs font-semibold uppercase text-primary">Route preference</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Compare your routes</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tap a priority to see the best matching way to get there, with time, walking, transfers and fare.</p>

      {fromPlace && toPlace && (
        <p className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-semibold text-brand-deep">
          {fromPlace.name} → {toPlace.name}
        </p>
      )}

      {fromPlace && toPlace && (
        <section className="mt-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-brand-deep">Route options</h2>
          {routesQuery.isFetching && !options.length && (
            <p className="text-sm text-muted-foreground">Comparing routes…</p>
          )}
          {!routesQuery.isFetching && !options.length && (
            <p className="text-sm text-muted-foreground">No routes available for this trip yet.</p>
          )}
          {options.map(({ preference, journey }) => {
            const key = preference as RoutePreference;
            const active = selected.includes(key);
            const modes = journey.legs.filter((leg) => leg.mode !== "walk");
            return (
              <button
                key={preference}
                type="button"
                onClick={() => choose(key)}
                aria-pressed={active}
                className={`block w-full rounded-2xl border p-4 text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "glass-panel border-transparent"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-brand-deep">{PREFERENCE_LABELS[key]}</span>
                  <span className="text-sm font-bold text-primary">{journey.minutes} min</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{journey.reason}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-muted-foreground">
                  <span>Walk {journey.walkMinutes} min</span>
                  <span>{journey.transfers} transfer{journey.transfers === 1 ? "" : "s"}</span>
                  <span>Fare ${journey.fare.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modes.map((leg, index) => (
                    <LegBadge key={`${leg.badge}-${index}`} mode={leg.mode} badge={leg.badge} size="sm" />
                  ))}
                  {!modes.length && <span className="text-[10px] font-semibold text-muted-foreground">Walk all the way</span>}
                </div>
              </button>
            );
          })}
        </section>
      )}

      <h2 className="mt-7 font-display text-base font-semibold text-brand-deep">What matters most?</h2>
      <section className="mt-3 grid grid-cols-2 gap-3">
        {OPTIONS.map(({ value, icon: Icon, detail }) => {
          const active = selected.includes(value);
          return (
            <Button
              key={value}
              type="button"
              variant="outline"
              onClick={() => toggle(value)}
              aria-pressed={active}
              className={`h-auto min-h-28 flex-col items-start whitespace-normal rounded-2xl p-4 text-left ${active ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : "glass-panel text-brand-deep"}`}
            >
              <span className={`grid size-9 place-items-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}><Icon /></span>
              <span className="mt-2 text-sm font-semibold">{PREFERENCE_LABELS[value]}</span>
              <span className="text-xs font-normal leading-snug text-muted-foreground">{detail}</span>
            </Button>
          );
        })}
      </section>

      <Button className="mt-5 h-11 w-full rounded-xl" disabled={!selected.length} onClick={save}>
        <ShieldCheck /> {saved ? "Preferences saved" : "Save preferences"}
      </Button>

      <section className="mt-4 rounded-2xl border border-success/20 bg-success-soft/70 p-4">
        <p className="text-sm font-semibold text-brand-deep">Disruption-aware recommendations</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Your usual fastest route may change during an MRT delay. Wayline finds the best available match and adjusts your leave alert.</p>
      </section>

      {onBackToPlan && (
        <Button variant="outline" className="mt-5 h-11 w-full rounded-xl border-primary text-sm font-bold text-primary" onClick={onBackToPlan}>
          <ArrowLeft /> Back to plan your trip
        </Button>
      )}
    </div>
  );
}
