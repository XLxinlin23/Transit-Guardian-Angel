import { Banknote, Footprints, Gauge, ShieldCheck, TrainFront, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PREFERENCE_LABELS, type RoutePreference } from "@/lib/commute-settings";
import { useTrip } from "@/lib/trip-store";

const OPTIONS: { value: RoutePreference; icon: typeof Gauge; detail: string }[] = [
  { value: "speed", icon: Gauge, detail: "Shortest travel time" },
  { value: "cost", icon: Banknote, detail: "Lowest total fare" },
  { value: "walking", icon: Footprints, detail: "Shorter walking segments" },
  { value: "sheltered", icon: ShieldCheck, detail: "More covered connections" },
  { value: "transfers", icon: TrainFront, detail: "Fewer line or bus changes" },
  { value: "crowd", icon: Users, detail: "Avoid busier services" },
];

export function RoutePreferencePanel() {
  const { preferences, setPreferences, fromPlace, toPlace } = useTrip();
  const selected = preferences;
  const [saved, setSaved] = useState(false);

  // Changing a priority re-ranks the saved trip immediately — nothing to re-enter.
  const toggle = (value: RoutePreference) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    setPreferences(next.length ? next : [value]);
    setSaved(false);
  };

  const save = () => {
    setPreferences(selected);
    setSaved(true);
  };

  return (
    <div className="pt-7">
      <p className="text-xs font-semibold uppercase text-primary">Route preference</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">What matters most?</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Choose one or more priorities. Wayline balances them when recommending each trip.</p>

      {fromPlace && toPlace && (
        <p className="mt-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-semibold text-brand-deep">
          Applied to {fromPlace.name} → {toPlace.name}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
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
    </div>
  );
}
