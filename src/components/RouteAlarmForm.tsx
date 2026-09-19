import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  BellRing,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  CloudRain,
  MapPin,
  Navigation,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deleteCommuteSchedule, listCommuteSchedules, saveCommuteSchedule } from "@/lib/commute.functions";
import {
  ALARMS_STORAGE_KEY,
  REPEAT_LABELS,
  WEEKDAYS,
  type RepeatOption,
  DEFAULT_PREFERENCES,
  PREFERENCE_LABELS,
  type RouteAlarm,
  type SavedRouteAlarm,
} from "@/lib/commute-settings";
import { useTrip } from "@/lib/trip-store";
import { getDeviceId } from "@/lib/device-id";
import { planJourney, type Journey } from "@/lib/journey.functions";
import { PlacePicker, placeLine, type ConfirmedPlace } from "./PlacePicker";
import { CommuteAlertCard } from "./CommuteAlertCard";
import { RouteMap } from "./RouteMap";
import { MODE_COLORS, MODE_LABELS } from "@/lib/travel-modes";

export function RouteAlarmForm({ onSeeMoreRoutes }: { onSeeMoreRoutes?: () => void }) {
  const {
    editingId,
    alarm,
    fromPlace,
    toPlace,
    preferences,
    setAlarmField,
    setPlace,
    loadDraft,
    startNewTrip,
    clearTrip,
  } = useTrip();
  const [alarms, setAlarms] = useState<SavedRouteAlarm[]>([]);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const saveRemote = useServerFn(saveCommuteSchedule);
  const listRemote = useServerFn(listCommuteSchedules);
  const deleteRemote = useServerFn(deleteCommuteSchedule);

  const persistAlarms = (next: SavedRouteAlarm[]) => {
    setAlarms(next);
    window.localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(next));
  };

  // Load the saved list from this device, then top it up from the backend.
  useEffect(() => {
    let local: SavedRouteAlarm[] = [];
    const stored = window.localStorage.getItem(ALARMS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SavedRouteAlarm[];
        if (Array.isArray(parsed)) local = parsed;
      } catch {
        window.localStorage.removeItem(ALARMS_STORAGE_KEY);
      }
    }
    if (local.length) setAlarms(local);

    listRemote({ data: { deviceId: getDeviceId() } })
      .then((rows) => {
        if (!rows?.length) return;
        const remote: SavedRouteAlarm[] = rows.map((row) => ({
          id: row.alarmId,
          alarm: {
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
          },
          fromPlace:
            typeof row.fromLat === "number" && typeof row.fromLng === "number"
              ? { name: row.origin, address: row.origin, postal: null, lat: row.fromLat, lng: row.fromLng }
              : null,
          toPlace:
            typeof row.toLat === "number" && typeof row.toLng === "number"
              ? { name: row.destination, address: row.destination, postal: null, lat: row.toLat, lng: row.toLng }
              : null,
        }));
        const byId = new Map(remote.map((item) => [item.id, item]));
        for (const item of local) byId.set(item.id, item);
        const merged = [...byId.values()];
        setAlarms(merged);
        window.localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(merged));
      })
      .catch(() => undefined);
  }, [listRemote]);


  const planJourneyFn = useServerFn(planJourney);
  const journeyQuery = useQuery({
    queryKey: ["journey", fromPlace?.lat, fromPlace?.lng, toPlace?.lat, toPlace?.lng, preferences.join(",")],
    enabled: Boolean(fromPlace && toPlace),
    staleTime: 5 * 60_000,
    queryFn: () =>
      planJourneyFn({
        data: {
          from: { lat: fromPlace!.lat, lng: fromPlace!.lng, label: fromPlace!.name },
          to: { lat: toPlace!.lat, lng: toPlace!.lng, label: toPlace!.name },
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
  const bothConfirmed = Boolean(fromPlace && toPlace);
  const looking = journeyQuery.isFetching;
  const preferenceSummary = (preferences.length ? preferences : DEFAULT_PREFERENCES)
    .map((value) => PREFERENCE_LABELS[value])
    .join(" · ");

  const update = <Key extends keyof RouteAlarm>(key: Key, value: RouteAlarm[Key]) => {
    setAlarmField(key, value);
    setSaved(false);
  };

  const confirmPlace = (field: "from" | "to", place: ConfirmedPlace | null) => {
    setPlace(field, place);
    setSaved(false);
  };

  const toggleDay = (day: string, checked: boolean) => {
    const days = checked ? [...alarm.days, day] : alarm.days.filter((item) => item !== day);
    update("days", days);
  };

  const editAlarm = (entry: SavedRouteAlarm) => {
    loadDraft({ editingId: entry.id, alarm: entry.alarm, fromPlace: entry.fromPlace, toPlace: entry.toPlace });
    setSaved(true);
    setSettingsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startNewAlarm = () => {
    startNewTrip();
    setSaved(false);
    setSettingsOpen(false);
  };

  const clearCurrentTrip = () => {
    clearTrip();
    setSaved(false);
    setSettingsOpen(false);
  };

  const removeAlarm = async (id: string) => {
    persistAlarms(alarms.filter((item) => item.id !== id));
    if (id === editingId) startNewAlarm();
    try {
      await deleteRemote({ data: { deviceId: getDeviceId(), alarmId: id } });
    } catch {
      /* removed on device; backend clears on next sync */
    }
  };

  const saveAlarm = async () => {
    const next = { ...alarm, active: true };
    const entry: SavedRouteAlarm = { id: editingId, alarm: next, fromPlace, toPlace };
    const exists = alarms.some((item) => item.id === editingId);
    persistAlarms(exists ? alarms.map((item) => (item.id === editingId ? entry : item)) : [...alarms, entry]);
    setAlarmField("active", true);
    setSaved(true);
    setSyncing(true);
    try {
      await saveRemote({
        data: {
          deviceId: getDeviceId(),
          alarmId: editingId,
          label: `${next.from} → ${next.to}`.slice(0, 60),
          origin: next.from,
          destination: next.to,
          fromLat: fromPlace?.lat ?? null,
          fromLng: fromPlace?.lng ?? null,
          toLat: toPlace?.lat ?? null,
          toLng: toPlace?.lng ?? null,
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
  const editingExisting = alarms.some((item) => item.id === editingId);
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
      <p className="bg-gradient-to-r from-primary via-success to-primary bg-clip-text text-xs font-semibold uppercase text-transparent">Route alarms</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Arrive on time</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Save as many trips as you like. Wayline watches disruptions and tells you when to leave.
      </p>

      {alarms.length > 0 && (
        <section className="glass-panel mt-5 rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-brand-deep">Saved alarms</h2>
            <button
              type="button"
              onClick={startNewAlarm}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Plus className="size-4" /> New
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {alarms.map((entry) => {
              const active = entry.id === editingId;
              return (
                <li
                  key={entry.id}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 ${
                    active ? "border-primary bg-primary/10" : "border-border bg-background/60"
                  }`}
                >
                  <button type="button" onClick={() => editAlarm(entry)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-brand-deep">
                      {entry.alarm.from} → {entry.alarm.to}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Arrive by {entry.alarm.arriveBy} ·{" "}
                      {entry.alarm.repeat === "custom" ? entry.alarm.days.join(", ") : REPEAT_LABELS[entry.alarm.repeat]}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAlarm(entry.id)}
                    aria-label={`Delete alarm ${entry.alarm.from} to ${entry.alarm.to}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-brand-deep">
            {editingExisting ? "Edit alarm" : "New alarm"}
          </h2>
          {editingExisting && (
            <button
              type="button"
              onClick={startNewAlarm}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Plus className="size-4" /> Add another
            </button>
          )}
        </div>

        <div className="space-y-5">
          <Field icon={Navigation} label="From">
            <PlacePicker
              value={alarm.from}
              onValueChange={(value) => update("from", value)}
              confirmed={fromPlace}
              onConfirm={(place) => confirmPlace("from", place)}
              placeholder="Where are you departing from?"
              ariaLabel="From"
            />
          </Field>
          <Field icon={MapPin} label="To">
            <PlacePicker
              value={alarm.to}
              onValueChange={(value) => update("to", value)}
              confirmed={toPlace}
              onConfirm={(place) => confirmPlace("to", place)}
              placeholder="Where are you going?"
              ariaLabel="To"
            />
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
            {toPlace && (
              <p className="rounded-xl border border-success/25 bg-success-soft/60 px-3 py-2 text-xs font-semibold text-brand-deep">
                Destination confirmed: {placeLine(toPlace)}
              </p>
            )}
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
              <p className="text-xs font-semibold text-brand-deep">
                Recommended route · {preview.reason}
                {preview.alternatives > 1 && (
                  <span className="font-medium text-muted-foreground"> · best of {preview.alternatives} options</span>
                )}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] font-semibold text-muted-foreground">
                <span>{preview.minutes} min total</span>
                <span>Walk {preview.walkMinutes} min</span>
                <span>{preview.transfers} transfer{preview.transfers === 1 ? "" : "s"}</span>
                <span>Fare ${preview.fare.toFixed(2)}</span>
              </p>
            </div>

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

        {typedBoth && !bothConfirmed && (
          <p className="mt-6 border-t border-border/70 pt-5 text-sm text-muted-foreground">
            Pick a suggestion for both locations to confirm them, then the route appears here.
          </p>
        )}

        {bothConfirmed && !preview && (
          <p className="mt-6 border-t border-border/70 pt-5 text-sm text-muted-foreground">
            {looking ? "Working out the best way door to door…" : "We could not build a route between those two points yet."}
          </p>
        )}

        <Button className="mt-6 h-11 w-full rounded-xl" disabled={!canSave || syncing} onClick={saveAlarm}>
          <Check /> {syncing ? "Saving…" : "Save route"}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Saves this trip to your Saved alarms list above.
        </p>
        <button
          type="button"
          onClick={clearCurrentTrip}
          className="mt-3 w-full rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
        >
          Clear trip
        </button>
      </section>

      <section className="glass-panel mt-4 rounded-3xl p-5">
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
          <div className="mt-4 space-y-3">
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

        <Button
          variant="outline"
          className="mt-5 h-11 w-full rounded-xl border-primary/30 text-primary"
          disabled={!canSave || syncing}
          onClick={saveAlarm}
        >
          <BellRing /> {syncing ? "Saving…" : "Update alarm settings"}
        </Button>
      </section>

      {saved && alarm.active && (
        <CommuteAlertCard alarm={alarm} preferences={preferences} fromPlace={fromPlace} toPlace={toPlace} />
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
