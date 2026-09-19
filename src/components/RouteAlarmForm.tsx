import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  BellRing,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,

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
import { compareJourneys, planJourney, type Journey } from "@/lib/journey.functions";
import { PlacePicker, placeLine, type ConfirmedPlace } from "./PlacePicker";
import { CommuteAlertCard } from "./CommuteAlertCard";
import { RouteMap } from "./RouteMap";
import { JourneyTimeline, RouteLegend } from "./JourneySteps";

export function RouteAlarmForm({ onSeeMoreRoutes }: { onSeeMoreRoutes?: () => void }) {
  const {
    editingId,
    alarm,
    fromPlace,
    toPlace,
    preferences,
    manualJourney,
    setManualJourney,
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
  const recommendedJourney: Journey | null = journeyQuery.data ?? null;
  const preview: Journey | null = manualJourney ?? recommendedJourney;

  const compareFn = useServerFn(compareJourneys);
  const optionsQuery = useQuery({
    queryKey: ["journey-options", fromPlace?.lat, fromPlace?.lng, toPlace?.lat, toPlace?.lng],
    enabled: Boolean(fromPlace && toPlace && recommendedJourney),
    staleTime: 5 * 60_000,
    queryFn: () =>
      compareFn({
        data: {
          from: { lat: fromPlace!.lat, lng: fromPlace!.lng, label: fromPlace!.name },
          to: { lat: toPlace!.lat, lng: toPlace!.lng, label: toPlace!.name },
        },
      }),
  });
  // Show only options that differ from the recommended one, one card per shape.
  const alternatives = useMemo(() => {
    const rows = optionsQuery.data ?? [];
    const previewKey = preview?.id ?? (preview ? `${preview.minutes}-${preview.walkMetres}-${preview.transfers}` : null);
    const recommendedKey = recommendedJourney?.id ?? (recommendedJourney ? `${recommendedJourney.minutes}-${recommendedJourney.walkMetres}-${recommendedJourney.transfers}` : null);
    const unique = new Map<string, { preference: string; journey: Journey; recommended: boolean }>();

    if (manualJourney && recommendedJourney && recommendedKey !== previewKey) {
      unique.set(recommendedKey ?? recommendedJourney.id, {
        preference: preferences[0] ?? "speed",
        journey: recommendedJourney,
        recommended: true,
      });
    }

    for (const { preference, journey } of rows) {
      const key = journey.id ?? `${journey.minutes}-${journey.walkMetres}-${journey.transfers}`;
      if (key === previewKey || unique.has(key)) continue;
      unique.set(key, { preference, journey, recommended: key === recommendedKey });
    }

    const options = [...unique.values()];
    if ((preferences[0] ?? "speed") === "walking") {
      options.sort((a, b) => (a.journey.totalWalkingDistanceMetres ?? a.journey.walkMetres ?? 0) - (b.journey.totalWalkingDistanceMetres ?? b.journey.walkMetres ?? 0));
    }
    return options.slice(0, 4);
  }, [manualJourney, optionsQuery.data, preferences, preview, recommendedJourney]);

  const segments = useMemo(
    () => (preview ? preview.legs.map((leg) => ({ mode: leg.mode, badge: leg.badge, points: leg.points })) : []),
    [preview],
  );

  const typedBoth = Boolean(alarm.from.trim() && alarm.to.trim());
  const bothConfirmed = Boolean(fromPlace && toPlace);
  const looking = journeyQuery.isFetching;
  const preferenceSummary = PREFERENCE_LABELS[preferences[0] ?? "speed"];

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

  const arrivalTime = alarm.arriveBy || "--:--";
  const departureTime = preview ? shiftTime(alarm.arriveBy, preview.minutes) : "--:--";

  return (
    <div className="pt-7">
      <h1 className="font-display text-3xl font-bold tracking-tight text-brand-deep">Plan your trip</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Enter where you are going, compare routes, and Wayline tells you when to leave.
      </p>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
        {/* Left column — the trip form */}
        <div className="space-y-4">
          {alarms.length > 0 && (
            <section className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold text-brand-deep">Saved route alarms</h2>
                <button
                  type="button"
                  onClick={startNewAlarm}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-secondary"
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
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                        active ? "border-primary bg-primary/5" : "border-border bg-card"
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
            <section className="rounded-2xl border border-success/30 bg-success-soft p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-success text-primary-foreground"><Check /></div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-brand-deep">Alarm active · arrive by {alarm.arriveBy}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground">{alarm.from} → {alarm.to} · {repeatSummary}</p>
                </div>
              </div>
            </section>
          )}

          <section className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-brand-deep">
                {editingExisting ? "Edit trip" : "Plan your trip"}
              </h2>
              {editingExisting && (
                <button
                  type="button"
                  onClick={startNewAlarm}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-secondary"
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
                  <Input type="time" value={alarm.arriveBy} onChange={(event) => update("arriveBy", event.target.value)} aria-label="Reach by" className="h-11 bg-card" />
                </Field>
                <Field icon={ShieldAlert} label="Maximum delay">
                  <Select value={alarm.maxDelay} onValueChange={(value) => update("maxDelay", value)}>
                    <SelectTrigger aria-label="Maximum delay" className="h-11 bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 5, 10, 15, 20, 30].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                    Latest acceptable arrival: {latestAcceptableArrival}
                  </p>
                </Field>
              </div>
              <Field icon={CalendarDays} label="How often">
                <Select value={alarm.repeat} onValueChange={(value) => update("repeat", value as RepeatOption)}>
                  <SelectTrigger aria-label="How often" className="h-11 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPEAT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              {alarm.repeat === "custom" && (
                <fieldset>
                  <legend className="text-xs font-bold text-foreground">Active days</legend>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {WEEKDAYS.map((day) => {
                      const checked = alarm.days.includes(day);
                      return (
                        <Label key={day} className={`flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 text-xs font-bold ${checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleDay(day, value === true)} className="sr-only" />
                          {day}
                        </Label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>

            <Button
              className="mt-6 h-11 w-full rounded-xl text-sm font-bold"
              disabled={!bothConfirmed || looking}
              onClick={() => journeyQuery.refetch()}
            >
              <Navigation /> {looking ? "Finding best route…" : "Find best route"}
            </Button>

            {typedBoth && !bothConfirmed && (
              <p className="mt-3 text-sm text-muted-foreground">
                Pick a suggestion for both locations to confirm them, then we can find your route.
              </p>
            )}

            <button
              type="button"
              onClick={clearCurrentTrip}
              className="mt-3 w-full rounded-lg py-2 text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear trip
            </button>
          </section>
        </div>

        {/* Right column — route result, map and alerts */}
        <div className="space-y-4">
          {preview && segments.length > 0 && (
            <section className="glass-panel rounded-2xl p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-base font-bold text-brand-deep">Your route</h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${manualJourney ? "bg-success-soft text-success" : "bg-primary/10 text-primary"}`}>
                  {manualJourney ? "Chosen by you" : `Recommended for: ${preferenceSummary}`}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <p className="font-display text-2xl font-bold text-primary">{departureTime}</p>
                <span className="text-sm text-muted-foreground">→</span>
                <p className="font-display text-2xl font-bold text-brand-deep">{arrivalTime}</p>
                <p className="ml-auto text-sm font-bold text-brand-deep">{preview.minutes} min</p>
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Leave at {departureTime} to reach by {arrivalTime}</p>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Walking" value={`${preview.totalWalkingDistanceMetres ?? preview.walkMetres ?? 0} m · ${preview.totalWalkingTimeMinutes ?? preview.walkMinutes ?? 0} min`} />
                <Stat label="Transfers" value={String(preview.transfers ?? 0)} />
                <Stat label="Fare" value={typeof preview.fare === "number" ? `$${preview.fare.toFixed(2)}` : "—"} />
              </dl>

              <p className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground">
                {manualJourney
                  ? "Chosen by you. Your saved primary preference is unchanged."
                  : preview.reason ?? ((preview.alternatives ?? 0) > 1 ? `Recommended from ${preview.alternatives} routes.` : "Only one route is currently available.")}
              </p>

              {manualJourney && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 h-9 w-full text-sm font-bold text-primary"
                  onClick={() => setManualJourney(null)}
                >
                  Return to recommended route
                </Button>
              )}

              {toPlace && (
                <p className="mt-2 text-xs text-muted-foreground">Destination confirmed: {placeLine(toPlace)}</p>
              )}

              <div className="mt-4 border-t border-border pt-4">
                <RouteMap
                  stations={[]}
                  segments={segments}
                  embedded
                  title="Route map"
                  badge={manualJourney ? "Chosen by you" : preferenceSummary}
                  footer={`About ${preview.minutes} min door to door · ${preview.legs.length} leg${preview.legs.length > 1 ? "s" : ""} · route when no disruptions`}
                />
                <div className="mt-3 px-1">
                  <RouteLegend legs={preview.legs} />
                </div>
                <div className="mt-3">
                  <JourneyTimeline legs={preview.legs} />
                </div>
              </div>

              {alternatives.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Other routes</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {alternatives.map(({ preference, journey, recommended }) => (
                      <Button
                        key={journey.id ?? `${preference}-${journey.minutes}`}
                        type="button"
                        variant="outline"
                        aria-label={`Use ${PREFERENCE_LABELS[preference as keyof typeof PREFERENCE_LABELS] ?? preference} route`}
                        onClick={() => setManualJourney(journey)}
                        className="h-auto min-h-20 w-full items-start justify-start whitespace-normal rounded-xl border-success/25 bg-success-soft/35 p-3 text-left shadow-none hover:border-primary/40 hover:bg-primary/5"
                      >
                        <span className="min-w-0">
                          <span className="block text-xs font-bold uppercase tracking-wide text-primary">
                            {PREFERENCE_LABELS[preference as keyof typeof PREFERENCE_LABELS] ?? preference}{recommended ? " (Recommended)" : ""}
                          </span>
                          <span className="mt-1 block text-sm font-bold text-brand-deep">{journey.minutes} min</span>
                          <span className="block text-[11px] font-semibold text-muted-foreground">
                            Walk {journey.totalWalkingDistanceMetres ?? journey.walkMetres ?? 0} m · {journey.totalWalkingTimeMinutes ?? journey.walkMinutes ?? 0} min · {journey.numberOfTransfers ?? journey.transfers ?? 0} transfer{(journey.numberOfTransfers ?? journey.transfers ?? 0) === 1 ? "" : "s"}
                            {typeof journey.fare === "number" ? ` · $${journey.fare.toFixed(2)}` : ""}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {onSeeMoreRoutes && (
                <button
                  type="button"
                  onClick={onSeeMoreRoutes}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-primary py-2.5 text-sm font-bold text-primary hover:bg-primary/5"
                >
                  Compare all routes <ChevronRight className="size-4" />
                </button>
              )}

              <Button
                variant="outline"
                className="mt-3 h-11 w-full rounded-xl border-primary text-sm font-bold text-primary"
                disabled={!canSave || syncing}
                onClick={saveAlarm}
              >
                <BellRing /> {syncing ? "Saving…" : "Save route alarm"}
              </Button>
            </section>
          )}

          {bothConfirmed && !preview && (
            <section className="glass-panel rounded-2xl p-5 text-sm text-muted-foreground">
              {looking ? "Working out the best way door to door…" : "Tap “Find best route” to see your route."}
            </section>
          )}

          <section className="glass-panel rounded-2xl p-5">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-expanded={settingsOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-brand-deep">
                <BellRing className="size-4 text-primary" /> Alert settings
              </span>
              <span className="flex items-center gap-2">
                {!settingsOpen && (
                  <span className="max-w-[13rem] truncate text-[11px] font-semibold text-muted-foreground">
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
                    <SelectTrigger aria-label="Remind me before departure" className="h-11 bg-card"><SelectValue /></SelectTrigger>
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
                    className="h-11 bg-card"
                  />
                )}
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl border-primary text-sm font-bold text-primary"
                  disabled={!canSave || syncing}
                  onClick={saveAlarm}
                >
                  {syncing ? "Saving…" : "Update alert settings"}
                </Button>
              </div>
            )}
          </section>

          {saved && alarm.active && (
            <CommuteAlertCard alarm={alarm} preferences={preferences} fromPlace={fromPlace} toPlace={toPlace} />
          )}

          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Adapts before every trip — if disruption changes the best route, Wayline recalculates using your preferences and alerts you earlier.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
            <div className="rounded-xl border border-primary/15 bg-primary/5 px-2 py-2">
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-sm font-bold text-brand-deep">{value}</dd>
    </div>
  );
}

function shiftTime(hhmm: string, minusMinutes: number): string {
  const [h = NaN, m = NaN] = (hhmm || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "--:--";
  let total = h * 60 + m - (minusMinutes || 0);
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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
