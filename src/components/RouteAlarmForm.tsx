import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, BellRing, Bus, CalendarDays, Check, ChevronDown, CloudRain, MapPin, Navigation, ShieldAlert, Users } from "lucide-react";
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
  DRAFT_STORAGE_KEY,
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
import { findStation, nearestStation } from "@/lib/mrt-network";
import { planJourney, type Journey, type TravelMode } from "@/lib/journey.functions";
import { resolvePlace } from "@/lib/places.functions";
import { CommuteAlertCard } from "./CommuteAlertCard";
import { RouteMap } from "./RouteMap";
import { MODE_COLORS } from "./RouteLeafletMap";

export function RouteAlarmForm() {
  const [alarm, setAlarm] = useState<RouteAlarm>(DEFAULT_ALARM);
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState<RoutePreference[]>(DEFAULT_PREFERENCES);
  const [syncing, setSyncing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saveRemote = useServerFn(saveCommuteSchedule);
  const loadRemote = useServerFn(getCommuteSchedule);

  useEffect(() => {
    let draftFrom: string | undefined;
    let draftTo: string | undefined;
    const draftRaw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw) as { from?: string; to?: string };
        if (typeof draft.from === "string") draftFrom = draft.from;
        if (typeof draft.to === "string") draftTo = draft.to;
      } catch {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
    if (draftFrom !== undefined || draftTo !== undefined) {
      setAlarm((current) => ({
        ...current,
        from: draftFrom ?? current.from,
        to: draftTo ?? current.to,
      }));
    }
    const stored = window.localStorage.getItem(ALARM_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RouteAlarm;
        setAlarm({
          ...DEFAULT_ALARM,
          ...parsed,
          from: draftFrom ?? parsed.from ?? DEFAULT_ALARM.from,
          to: draftTo ?? parsed.to ?? DEFAULT_ALARM.to,
        });
        setSaved(true);
      } catch {
        window.localStorage.removeItem(ALARM_STORAGE_KEY);
      }
    }
    loadRemote({ data: { deviceId: getDeviceId() } })
      .then((row) => {
        if (!row) return;
        setAlarm({
          from: draftFrom ?? row.origin,
          to: draftTo ?? row.destination,
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

  const planJourneyFn = useServerFn(planJourney);
  const fromCoords = fromPoint.point;
  const toCoords = toPoint.point;
  const journeyQuery = useQuery({
    queryKey: ["journey", fromCoords?.lat, fromCoords?.lng, toCoords?.lat, toCoords?.lng, preferences.join(",")],
    enabled: Boolean(fromCoords && toCoords),
    staleTime: 5 * 60_000,
    queryFn: () =>
      planJourneyFn({
        data: {
          from: { lat: fromCoords!.lat, lng: fromCoords!.lng, label: fromCoords!.label },
          to: { lat: toCoords!.lat, lng: toCoords!.lng, label: toCoords!.label },
          preferences,
        },
      }),
  });
  const preview: Journey | null = journeyQuery.data ?? null;
  const segments = useMemo(
    () => (preview ? preview.legs.map((leg) => ({ mode: leg.mode, badge: leg.badge, points: leg.points })) : []),
    [preview],
  );
  const modesUsed = useMemo(() => [...new Set(preview?.legs.map((leg) => leg.mode) ?? [])], [preview]);
  const typedBoth = Boolean(alarm.from.trim() && alarm.to.trim());
  const looking = fromPoint.loading || toPoint.loading || journeyQuery.isFetching;
  const preferenceSummary = (preferences.length ? preferences : DEFAULT_PREFERENCES).map((value) => PREFERENCE_LABELS[value]).join(" · ");

  const update = <Key extends keyof RouteAlarm>(key: Key, value: RouteAlarm[Key]) => {
    setAlarm((current) => ({ ...current, [key]: value }));
    setSaved(false);
    if (key === "from" || key === "to") {
      const next = { ...alarm, [key]: value };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ from: next.from, to: next.to }));
    }
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
  const settingsSummary = [
    `${alarm.notifyLeadMinutes} min before`,
    alarm.notifyWeather ? "weather" : null,
    alarm.notifyCrowd ? "crowd" : null,
    alarm.notifyBus ? (alarm.busStopCode.trim() ? `bus ${alarm.busStopCode.trim()}` : "bus") : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
            <Input value={alarm.from} onChange={(event) => update("from", event.target.value)} placeholder="Where are you departing from?" aria-label="From" className="h-11 bg-background/70" />
            {fromPoint.note && <p className="mt-1.5 text-xs text-muted-foreground">{fromPoint.note}</p>}
          </Field>
          <Field icon={MapPin} label="To">
            <Input value={alarm.to} onChange={(event) => update("to", event.target.value)} placeholder="Where are you going?" aria-label="To" className="h-11 bg-background/70" />
            {toPoint.note && <p className="mt-1.5 text-xs text-muted-foreground">{toPoint.note}</p>}
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

        {preview && segments.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-border/70 pt-5">
            <RouteMap
              stations={[]}
              segments={segments}
              title="Route preview"
              badge={preferenceSummary}
              footer={`About ${preview.minutes} min door to door · ${preview.legs.length} leg${preview.legs.length > 1 ? "s" : ""} · currently no disruption`}
            />
            <div className="flex flex-wrap gap-3 px-1">
              {modesUsed.map((mode) => (
                <span key={mode} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: MODE_COLORS[mode] }} />
                  {MODE_LABELS[mode]}
                </span>
              ))}
            </div>
            <ol className="space-y-2 rounded-2xl border border-border/70 bg-background/60 p-4">
              {preview.legs.map((leg, index) => (
                <li key={`${leg.badge}-${index}`} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: MODE_COLORS[leg.mode] }}
                  >
                    {leg.badge}
                  </span>
                  <span className="min-w-0 text-muted-foreground">
                    <span className="font-semibold text-brand-deep">{leg.from} → {leg.to}</span>
                    <br />
                    {leg.detail} · {leg.minutes} min
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {typedBoth && !preview && (
          <p className="mt-6 border-t border-border/70 pt-5 text-sm text-muted-foreground">
            {looking ? "Working out the best way door to door…" : "We could not match those yet. Try an MRT station, a bus stop name or code, or a 6-digit postal code."}
          </p>
        )}

        <div className="mt-6 border-t border-border/70 pt-5">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <BellRing className="size-4 text-primary" /> Alert settings
            </span>
            <span className="flex items-center gap-2">
              {!settingsOpen && (
                <span className="max-w-[13rem] truncate text-[11px] font-medium normal-case text-muted-foreground">
                  {settingsSummary}
                </span>
              )}
              <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`} />
            </span>
          </button>
          {settingsOpen && (
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
          )}
        </div>

        <Button className="mt-6 h-11 w-full rounded-xl" disabled={!canSave || syncing} onClick={saveAlarm}>
          <BellRing /> {syncing ? "Saving…" : saved ? "Update route alarm" : "Save route alarm"}
        </Button>
      </section>

      {saved && alarm.active && preview && <CommuteAlertCard alarm={alarm} preferences={preferences} />}


      <section className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-brand-deep">Adapts before every trip</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">If disruption changes the best route, Wayline recalculates using your preferences and alerts you earlier.</p>
      </section>
    </div>
  );
}

const MODE_LABELS: Record<TravelMode, string> = { walk: "Walk", bus: "Bus", mrt: "MRT", lrt: "LRT" };

type EndpointPoint = { lat: number; lng: number; label: string };
type EndpointState = { station: string | null; note: string | null; loading: boolean; point: EndpointPoint | null };

/** Accepts an MRT station name, bus stop name/code or postal code and maps it to the nearest station. */
function useEndpoint(value: string, resolve: (options: { data: { query: string } }) => Promise<{ label: string; lat: number; lng: number } | null>): EndpointState {
  const [state, setState] = useState<EndpointState>({ station: null, note: null, loading: false, point: null });

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setState({ station: null, note: null, loading: false, point: null });
      return;
    }
    const direct = findStation(query);
    if (direct) {
      setState({
        station: direct.name,
        note: null,
        loading: false,
        point: { lat: direct.lat, lng: direct.lng, label: `${direct.name} station` },
      });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true }));
    const timer = window.setTimeout(() => {
      resolve({ data: { query } })
        .then((place) => {
          if (cancelled) return;
          const near = place ? nearestStation(place.lat, place.lng) : null;
          setState(
            place
              ? {
                  station: near?.name ?? null,
                  note: place.label,
                  loading: false,
                  point: { lat: place.lat, lng: place.lng, label: place.label },
                }
              : { station: null, note: null, loading: false, point: null },
          );
        })
        .catch(() => {
          if (!cancelled) setState({ station: null, note: null, loading: false, point: null });
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, resolve]);

  return state;
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
