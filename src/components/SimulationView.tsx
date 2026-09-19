import { AlertTriangle, BellRing, CheckCircle2, Clock, CloudRain, Footprints, PlayCircle, RotateCcw, ShieldAlert, TrainFront } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
  tone: "info" | "warn" | "alert" | "rain" | "arrived";
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
  const { demo, setDemo, clockMinutes, setClockMinutes, clockActive, setClockActive, rain, setRain, departedAt, setDepartedAt } = useSimulation();
  const [alarms, setAlarms] = useState<SavedRouteAlarm[]>([]);

  useEffect(() => {
    setAlarms(readAlarms());
  }, []);

  const { routeMinutes } = useSimulation();

  const events = useMemo<SimNotification[]>(() => {
    const list: SimNotification[] = [];
    for (const entry of alarms) {
      const { alarm } = entry;
      const reach = parseTime(alarm.arriveBy);
      if (reach === null) continue;
      const lead = Number(alarm.notifyLeadMinutes) || 20;
      const maxDelay = Number(alarm.maxDelay) || 0;
      const latest = reach + maxDelay;
      const trip = `${alarm.from || "Start"} → ${alarm.to || "Destination"}`;

      // Journey length actually planned for this trip — never the notification lead time.
      const duration = entry.durationMinutes ?? routeMinutes ?? 30;
      const delay = demo ? DEMO_INCIDENT.addedMinutes : 0;
      const rainDelay = rain && alarm.notifyWeather ? 5 : 0;
      // Leave early enough to absorb the disruption and the wet-weather allowance.
      const departure = reach - duration - delay - rainDelay;

      // Leave-early nudges are pointless once the user has already left.
      if (departedAt === null || departedAt > departure) {
        list.push({
          at: Math.max(0, departure - lead),
          tone: "info",
          title: `Leave in ${lead} min · ${trip}`,
          body: `${duration + delay + rainDelay} min journey. Leave at ${formatMinutes(departure)} to arrive by ${alarm.arriveBy}.${rain && alarm.notifyWeather ? " Rain near your start — 5 min added." : ""}`,
        });
      }

      if (rain && alarm.notifyWeather) {
        list.push({
          at: Math.max(0, departure - lead - 5),
          tone: "rain",
          title: `Rain near your start · ${trip}`,
          body: "Simulated weather. Walking legs take about 5 min longer — leave a little earlier.",
        });
      }

      if (demo) {
        const detectedAt = Math.max(0, departure - lead - 10);
        if (departedAt === null || departedAt > detectedAt) {
          list.push({
            at: detectedAt,
            tone: "warn",
            title: `Disruption on your route · ${trip}`,
            body: `Demo incident — simulated data. Adds ${DEMO_INCIDENT.addedMinutes} min. Leave by ${formatMinutes(departure)} to still arrive ${alarm.arriveBy}.`,
          });
        } else {
          list.push({
            at: departedAt + 5,
            tone: "alert",
            title: `Sudden disruption en route · ${trip}`,
            body: `Demo incident — simulated data. ${DEMO_INCIDENT.message} Expect about ${DEMO_INCIDENT.addedMinutes} min extra.`,
          });
        }
      }

      // The exact leave-now nudge is pointless once the user has already left.
      if (departedAt === null || departedAt > departure) {
        list.push({
          at: Math.max(0, departure),
          tone: demo ? "warn" : "info",
          title: `Leave now · ${trip}`,
          body: `Leave now to reach ${alarm.to || "your destination"} by ${alarm.arriveBy}.`,
        });
      }

      if (departedAt !== null) {
        const arrival = departedAt + duration + delay + rainDelay;
        const late = arrival > latest;
        list.push({
          at: departedAt,
          tone: late ? "alert" : arrival > reach ? "warn" : "info",
          title: `You left · ${trip}`,
          body: `Departed ${formatMinutes(departedAt)} · ${duration + delay + rainDelay} min journey — arriving about ${formatMinutes(arrival)}${
            late
              ? ` (${arrival - latest} min past your latest ${formatMinutes(latest)}).`
              : arrival > reach
                ? ` (${arrival - reach} min after ${alarm.arriveBy}, still within your ${maxDelay} min limit).`
                : `, before your ${alarm.arriveBy}.`
          }`,
        });
        list.push({
          at: arrival,
          tone: late ? "alert" : arrival > reach ? "warn" : "arrived",
          title: `Destination reached · ${trip}`,
          body: `You have arrived at ${alarm.to || "your destination"} at ${formatMinutes(arrival)}.${
            late
              ? ` That is ${arrival - latest} min past your latest ${formatMinutes(latest)}.`
              : arrival > reach
                ? ` ${arrival - reach} min after ${alarm.arriveBy}, within your ${maxDelay} min limit.`
                : ` You made it by ${alarm.arriveBy}.`
          }`,
        });
      }
    }
    return list.sort((a, b) => a.at - b.at);
  }, [alarms, demo, rain, departedAt, routeMinutes]);

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

            <Label className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-card px-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <CloudRain className="size-4 text-primary" /> Simulated rain at your start
              </span>
              <Switch checked={rain} onCheckedChange={setRain} aria-label="Simulated rain" />
            </Label>

            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                className="min-h-11 flex-1 gap-2 rounded-xl"
                disabled={departedAt !== null}
                onClick={() => setDepartedAt(clockMinutes)}
              >
                <Footprints className="size-4" />
                {departedAt === null ? "Leave now" : `Left at ${formatMinutes(departedAt)}`}
              </Button>
              {departedAt !== null && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-1.5 rounded-xl"
                  onClick={() => setDepartedAt(null)}
                >
                  <RotateCcw className="size-4" /> Reset
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {departedAt === null
                ? "Press Leave now to record your simulated departure time — a notification confirms you have left."
                : "Departure recorded. Move the clock to see your journey progress."}
            </p>

            <Label className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-route-orange/50 bg-card px-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <ShieldAlert className="size-4 text-route-orange" /> Demo incident (no train service between Simei and Tanah Merah, East–West Line)
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
                      : event.tone === "arrived"
                        ? "border-success/35 bg-success-soft"
                        : event.tone === "rain"
                          ? "border-primary/35 bg-primary/10"
                          : event.tone === "warn"
                            ? "border-route-orange/35 bg-warning-soft"
                            : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {event.tone === "arrived" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : event.tone === "rain" ? (
                      <CloudRain className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : event.tone === "info" ? (
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
