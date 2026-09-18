import { useServerFn } from "@tanstack/react-start";
import { AlarmClock, BellRing, Bus, CalendarDays, Check, CloudRain, MapPin, Navigation, ShieldAlert, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getCommuteSchedule, saveCommuteSchedule } from "@/lib/commute.functions";
import {
  ALARM_STORAGE_KEY,
  DEFAULT_ALARM,
  REPEAT_LABELS,
  WEEKDAYS,
  type RepeatOption,
  DEFAULT_PREFERENCES,
  PREFERENCE_LABELS,
  PREFERENCE_STORAGE_KEY,
  type RoutePreference,
  type RouteAlarm,
} from "@/lib/commute-settings";
import { getDeviceId } from "@/lib/device-id";
import { LINE_NAMES, findStation, nearestStation, planRoute } from "@/lib/mrt-network";
import { resolvePlace } from "@/lib/places.functions";
import { CommuteAlertCard } from "./CommuteAlertCard";
import { RouteMap } from "./RouteMap";

export function RouteAlarmForm() {
  const [alarm, setAlarm] = useState<RouteAlarm>(DEFAULT_ALARM);
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState<RoutePreference[]>(DEFAULT_PREFERENCES);
  const [syncing, setSyncing] = useState(false);
  const saveRemote = useServerFn(saveCommuteSchedule);
  const loadRemote = useServerFn(getCommuteSchedule);

  useEffect(() => {
    const stored = window.localStorage.getItem(ALARM_STORAGE_KEY);
    if (stored) {
      try {
        setAlarm({ ...DEFAULT_ALARM, ...(JSON.parse(stored) as RouteAlarm) });
        setSaved(true);
      } catch {
        window.localStorage.removeItem(ALARM_STORAGE_KEY);
      }
    }
    loadRemote({ data: { deviceId: getDeviceId() } })
      .then((row) => {
        if (!row) return;
        setAlarm({
          from: row.origin,
          to: row.destination,
          arriveBy: row.arriveBy,
          maxDelay: String(row.maxDelay),
          repeat: row.repeatOption as RepeatOption,
          days: row.travelDays,
          active: row.active,
          notifyLeadMinutes: String(row.notifyLeadMinutes),
          notifyWeather: row.notifyWeather,
          notifyCrowd: row.notifyCrowd,
          notifyBus: row.notifyBus,
          busStopCode: row.busStopCode ?? "",
        });
        setSaved(true);
      })
      .catch(() => undefined);
  }, [loadRemote]);

  useEffect(() => {
    const load = () => {
      const stored = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as RoutePreference[];
        if (Array.isArray(parsed) && parsed.length) setPreferences(parsed);
      } catch {
        /* ignore malformed preferences */
      }
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const resolve = useServerFn(resolvePlace);
  const fromPoint = useEndpoint(alarm.from, resolve);
  const toPoint = useEndpoint(alarm.to, resolve);

  const preview = useMemo(
    () => (fromPoint.station && toPoint.station ? planRoute(fromPoint.station, toPoint.station, preferences) : null),
    [fromPoint.station, toPoint.station, preferences],
  );
  const typedBoth = Boolean(alarm.from.trim() && alarm.to.trim());
  const looking = fromPoint.loading || toPoint.loading;
  const preferenceSummary = (preferences.length ? preferences : DEFAULT_PREFERENCES).map((value) => PREFERENCE_LABELS[value]).join(" · ");

  const update = <Key extends keyof RouteAlarm>(key: Key, value: RouteAlarm[Key]) => {
    setAlarm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const toggleDay = (day: string, checked: boolean) => {
    const days = checked ? [...alarm.days, day] : alarm.days.filter((item) => item !== day);
    update("days", days);
  };

  const saveAlarm = async () => {
    const next = { ...alarm, active: true };
    window.localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(next));
    setAlarm(next);
    setSaved(true);
    setSyncing(true);
    try {
      await saveRemote({
        data: {
          deviceId: getDeviceId(),
          origin: next.from,
          destination: next.to,
          travelDays: next.repeat === "custom" ? next.days : defaultDays(next.repeat),
          repeatOption: next.repeat,
          arriveBy: next.arriveBy,
          maxDelay: Number(next.maxDelay) || 0,
          preferences,
          active: true,
          notifyLeadMinutes: Number(next.notifyLeadMinutes) || 0,
          notifyWeather: next.notifyWeather,
          notifyCrowd: next.notifyCrowd,
          notifyBus: next.notifyBus,
          busStopCode: next.busStopCode.trim() ? next.busStopCode.trim() : null,
        },
      });
    } catch {
      /* saved on device; sync retries on next save */
    } finally {
      setSyncing(false);
    }
  };

  const canSave = alarm.from.trim() && alarm.to.trim() && alarm.arriveBy && (alarm.repeat !== "custom" || alarm.days.length > 0);
  const repeatSummary = alarm.repeat === "custom" ? alarm.days.join(", ") : REPEAT_LABELS[alarm.repeat];

  return (
    <div className="pt-7">
      <p className="text-xs font-semibold uppercase text-primary">Route alarm</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Arrive on time</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Set the destination and deadline. Wayline watches disruptions and tells you when to leave.</p>

      {saved && alarm.active && (
        <section className="mt-5 rounded-2xl border border-success/20 bg-success-soft/70 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-success text-primary-foreground"><Check /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-deep">Alarm active · arrive by {alarm.arriveBy}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{alarm.from} → {alarm.to} · {repeatSummary}</p>
            </div>
          </div>
        </section>
      )}

      <section className="glass-panel mt-5 rounded-3xl p-5">
        <div className="space-y-5">
          <Field icon={Navigation} label="From">
            <Input value={alarm.from} onChange={(event) => update("from", event.target.value)} placeholder="Starting point" aria-label="From" className="h-11 bg-background/70" />
          </Field>
          <Field icon={MapPin} label="To">
            <Input value={alarm.to} onChange={(event) => update("to", event.target.value)} placeholder="Destination" aria-label="To" className="h-11 bg-background/70" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field icon={AlarmClock} label="Reach by">
              <Input type="time" value={alarm.arriveBy} onChange={(event) => update("arriveBy", event.target.value)} aria-label="Reach by" className="h-11 bg-background/70" />
            </Field>
            <Field icon={ShieldAlert} label="Maximum delay">
              <Select value={alarm.maxDelay} onValueChange={(value) => update("maxDelay", value)}>
                <SelectTrigger aria-label="Maximum delay" className="h-11 bg-background/70"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 5, 10, 15, 20, 30].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} min</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field icon={CalendarDays} label="How often">
            <Select value={alarm.repeat} onValueChange={(value) => update("repeat", value as RepeatOption)}>
              <SelectTrigger aria-label="How often" className="h-11 bg-background/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPEAT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {alarm.repeat === "custom" && (
            <fieldset>
              <legend className="text-xs font-semibold text-muted-foreground">Active days</legend>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {WEEKDAYS.map((day) => {
                  const checked = alarm.days.includes(day);
                  return (
                    <Label key={day} className={`flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 text-xs font-semibold ${checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/60 text-muted-foreground"}`}>
                      <Checkbox checked={checked} onCheckedChange={(value) => toggleDay(day, value === true)} className="sr-only" />
                      {day}
                    </Label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>

        <div className="mt-6 border-t border-border/70 pt-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Alert settings</p>
          <div className="mt-3 space-y-3">
            <Field icon={BellRing} label="Remind me before departure">
              <Select value={alarm.notifyLeadMinutes} onValueChange={(value) => update("notifyLeadMinutes", value)}>
                <SelectTrigger aria-label="Remind me before departure" className="h-11 bg-background/70"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30, 45].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} min before</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Toggle icon={CloudRain} label="Weather impact" checked={alarm.notifyWeather} onChange={(value) => update("notifyWeather", value)} />
            <Toggle icon={Users} label="MRT crowd levels" checked={alarm.notifyCrowd} onChange={(value) => update("notifyCrowd", value)} />
            <Toggle icon={Bus} label="Bus arrivals" checked={alarm.notifyBus} onChange={(value) => update("notifyBus", value)} />
            {alarm.notifyBus && (
              <Input
                value={alarm.busStopCode}
                onChange={(event) => update("busStopCode", event.target.value)}
                placeholder="Bus stop code, e.g. 75009"
                aria-label="Bus stop code"
                className="h-11 bg-background/70"
              />
            )}
          </div>
        </div>

        <Button className="mt-6 h-11 w-full rounded-xl" disabled={!canSave || syncing} onClick={saveAlarm}>
          <BellRing /> {syncing ? "Saving…" : saved ? "Update route alarm" : "Save route alarm"}
        </Button>
      </section>

      {saved && alarm.active && preview && <CommuteAlertCard alarm={alarm} preferences={preferences} />}

      {preview && (
        <section className="mt-4 space-y-3">
          <RouteMap
            stations={preview.stations}
            title="Route preview"
            badge={preferenceSummary}
            transferNames={preview.legs.slice(1).map((leg) => leg.stations[0]!.name)}
            footer={`About ${preview.minutes} min · ${preview.stops} stops · ${preview.transfers === 0 ? "no change" : `${preview.transfers} change${preview.transfers > 1 ? "s" : ""}`} · currently no disruption`}
          />
          <ol className="glass-panel space-y-2 rounded-2xl p-4">
            {preview.legs.map((leg, index) => (
              <li key={`${leg.line}-${index}`} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{leg.line}</span>
                <span className="min-w-0 text-muted-foreground">
                  <span className="font-semibold text-brand-deep">{leg.stations[0]!.name} → {leg.stations[leg.stations.length - 1]!.name}</span>
                  <br />
                  {LINE_NAMES[leg.line]} · {leg.stations.length - 1} stops
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {typedBoth && !preview && (
        <p className="mt-4 rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
          We could not match those to MRT stations yet. Try a station name such as Tampines or Raffles Place.
        </p>
      )}

      <section className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-brand-deep">Adapts before every trip</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">If disruption changes the best route, Wayline recalculates using your preferences and alerts you earlier.</p>
      </section>
    </div>
  );
}

function defaultDays(repeat: RepeatOption): string[] {
  if (repeat === "weekdays") return ["Mon", "Tue", "Wed", "Thu", "Fri"];
  if (repeat === "weekends") return ["Sat", "Sun"];
  return [];
}

function Toggle({ icon: Icon, label, checked, onChange }: { icon: typeof MapPin; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3">
      <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="size-4 text-primary" />{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </Label>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="size-4 text-primary" />{label}</Label>
      {children}
    </div>
  );
}
