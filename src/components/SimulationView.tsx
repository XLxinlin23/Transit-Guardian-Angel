import { AlertTriangle, BellRing, Clock, PlayCircle, ShieldAlert, TrainFront } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  ALARMS_STORAGE_KEY,
  REPEAT_LABELS,
  journeyDateLabel,
  type SavedRouteAlarm,
} from "@/lib/commute-settings";
import { DEMO_INCIDENT, formatMinutes, parseTime } from "@/lib/disruption";
import { useSimulation } from "@/lib/simulation";

type SimNotification = {
  at: number;
  tone: "info" | "warn" | "alert";
  title: string;
  body: string;
};

function readAlarms(): SavedRouteAlarm[] {
  try {
    const stored = window.localStorage.getItem(ALARMS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedRouteAlarm[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function SimulationView() {
  const { demo, setDemo, clockMinutes, setClockMinutes, clockActive, setClockActive } = useSimulation();
  const [alarms, setAlarms] = useState<SavedRouteAlarm[]>([]);

  useEffect(() => {
    setAlarms(readAlarms());
  }, []);

  const events = useMemo<SimNotification[]>(() => {
    const list: SimNotification[] = [];
    for (const entry of alarms) {
      const { alarm } = entry;
      const reach = parseTime(alarm.arriveBy);
      if (reach === null) continue;
      const lead = Number(alarm.notifyLeadMinutes) || 20;
      const maxDelay = Number(alarm.maxDelay) || 0;
      const trip = `${alarm.from || "Start"} → ${alarm.to || "Destination"}`;
      const plannedDeparture = reach - lead;
      const delay = demo ? DEMO_INCIDENT.addedMinutes : 0;
      const departure = plannedDeparture - delay;

      list.push({
        at: plannedDeparture - 15,
        tone: "info",
        title: `Trip ready · ${trip}`,
        body: `Leave at ${formatMinutes(plannedDeparture)} to arrive by ${alarm.arriveBy}.`,
      });

      if (demo) {
        list.push({
          at: Math.max(0, plannedDeparture - 25),
          tone: "warn",
          title: `Circle Line disruption · ${trip}`,
          body: `Demo incident — simulated data. Adds ${DEMO_INCIDENT.addedMinutes} min. Leave by ${formatMinutes(departure)} to still arrive ${alarm.arriveBy}.`,
        });
      }

      list.push({
        at: departure,
        tone: demo ? "warn" : "info",
        title: `Leave now · ${trip}`,
        body: demo
          ? `Leaving now still reaches ${alarm.arriveBy} despite the simulated disruption.`
          : `Leave now to reach ${alarm.to || "your destination"} by ${alarm.arriveBy}.`,
      });

      if (demo) {
        const lateArrival = reach + DEMO_INCIDENT.addedMinutes;
        const latest = reach + maxDelay;
        list.push({
          at: plannedDeparture,
          tone: lateArrival > latest ? "alert" : "warn",
          title: lateArrival > latest ? `Late arrival · ${trip}` : `Still within your limit · ${trip}`,
          body:
            lateArrival > latest
              ? `Leaving now arrives ${formatMinutes(lateArrival)} — ${lateArrival - latest} min past your latest ${formatMinutes(latest)}.`
              : `Leaving now arrives ${formatMinutes(lateArrival)}, within your ${maxDelay} min limit (latest ${formatMinutes(latest)}).`,
        });
      }
    }
    return list.sort((a, b) => a.at - b.at);
  }, [alarms, demo]);

  const fired = events.filter((event) => event.at <= clockMinutes).reverse();

  return (
    <div className="pt-7">
      <p className="text-xs font-semibold uppercase text-route-orange">Demo &amp; testing</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Simulation</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Move the clock and switch on a simulated incident to see exactly what Wayline would send you — the Home tab follows along.
      </p>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="glass-panel rounded-2xl p-5">
            <h2 className="font-display text-base font-bold text-brand-deep">Saved route alarms</h2>
            {alarms.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No saved alarms yet — save one from the Home tab first.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {alarms.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-border bg-card p-3">
                    <p className="truncate text-sm font-bold text-brand-deep">
                      {entry.alarm.from || "Start"} → {entry.alarm.to || "Destination"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Arrive by {entry.alarm.arriveBy} · max delay {entry.alarm.maxDelay} min · alert{" "}
                      {entry.alarm.notifyLeadMinutes} min before
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {journeyDateLabel(entry.alarm)} · {entry.alarm.repeat === "custom" ? entry.alarm.days.join(", ") : REPEAT_LABELS[entry.alarm.repeat]}
                      {entry.alarm.active ? " · active" : " · paused"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-brand-deep">
                <Clock className="size-4 text-primary" /> Simulated time
              </h2>
              <span className="font-display text-2xl font-bold text-primary">{formatMinutes(clockMinutes)}</span>
            </div>
            <Slider
              className="mt-4"
              min={0}
              max={1439}
              step={1}
              value={[clockMinutes]}
              onValueChange={(value) => setClockMinutes(value[0] ?? 0)}
              aria-label="Simulated time of day"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:59</span>
            </div>

            <Label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <PlayCircle className="size-4 text-primary" /> Use this clock on the Home tab
              </span>
              <Switch checked={clockActive} onCheckedChange={setClockActive} aria-label="Use simulated clock" />
            </Label>

            <Label className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-route-orange/50 bg-card px-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <ShieldAlert className="size-4 text-route-orange" /> Demo incident (simulated Circle Line disruption)
              </span>
              <Switch checked={demo} onCheckedChange={setDemo} aria-label="Demo incident" />
            </Label>
            {demo && (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-route-orange/35 bg-warning-soft px-3 py-2 text-xs font-semibold text-brand-deep">
                <TrainFront className="mt-0.5 size-4 shrink-0 text-route-orange" />
                <span>Demo incident — simulated data. {DEMO_INCIDENT.message}</span>
              </p>
            )}
          </section>
        </div>

        <section className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-brand-deep">
              <BellRing className="size-4 text-route-red" /> Notifications
            </h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{fired.length} sent</span>
          </div>
          {fired.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing yet at {formatMinutes(clockMinutes)}. Move the clock towards your alarm time to see alerts arrive.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {fired.map((event, index) => (
                <li
                  key={`${event.at}-${index}`}
                  className={`rounded-xl border p-3 ${
                    event.tone === "alert"
                      ? "border-route-red/35 bg-route-red/10"
                      : event.tone === "warn"
                        ? "border-route-orange/35 bg-warning-soft"
                        : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {event.tone === "info" ? (
                      <BellRing className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-route-red" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-brand-deep">{event.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-foreground">{event.body}</p>
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Sent {formatMinutes(event.at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Simulated notifications, generated from your saved alarms. Live LTA data is never mixed with simulated incidents.
          </p>
        </section>
      </div>
    </div>
  );
}
