import { useServerFn } from "@tanstack/react-start";
import {
  AlarmClock,
  AlertTriangle,

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
  journeyDateLabel,
  type JourneyDateMode,
  type RepeatOption,
  DEFAULT_PREFERENCES,
  PREFERENCE_LABELS,
  type RouteAlarm,
  type SavedRouteAlarm,
} from "@/lib/commute-settings";

import { useTrip } from "@/lib/trip-store";
import { getDeviceId } from "@/lib/device-id";
import { type Journey } from "@/lib/journey.functions";
import { useRouteStore } from "@/lib/route-state";
import { PlacePicker, placeLine, type ConfirmedPlace } from "./PlacePicker";
import { CommuteAlertCard } from "./CommuteAlertCard";
import { JourneyStatusCard } from "./JourneyStatusCard";
import { useDisruptionWatch } from "@/lib/use-disruption";
import { useSimulationOptional } from "@/lib/simulation";

import { formatMinutes, parseTime } from "@/lib/disruption";
import {
  arrivalFromDeparture,
  arrivalStatus,
  filterEligible,
  journeyDateTimeLabel,
  primaryMetric,
  reachByHasPassed,
  STATUS_CLASS,
  toMinutes,
} from "@/lib/journey-time";
import { buildRouteMetrics } from "@/lib/route-metrics";
import { departureHasPassed, isRecurring, nextRunLabel, recurrenceLabel, sgTomorrowISO } from "@/lib/sg-time";
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
            dateMode: "today",
            date: "",

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


  // One shared route store — Preferences reads exactly the same values.
  const store = useRouteStore();
  const recommendedJourney: Journey | null = store.recommended?.journey ?? null;
  const planMessage = store.planMessage;
  const preview: Journey | null = store.selected?.journey ?? null;

  // Everything except the route currently shown, newest ranking from the shared store.
  const alternatives = useMemo(
    () => store.routes.filter((route) => route.id !== store.selected?.id).slice(0, 4),
    [store.routes, store.selected?.id],
  );

  const segments = useMemo(
    () => (preview ? preview.legs.map((leg) => ({ mode: leg.mode, badge: leg.badge, points: leg.points })) : []),
    [preview],
  );

  const typedBoth = Boolean(alarm.from.trim() && alarm.to.trim());
  const bothConfirmed = Boolean(fromPlace && toPlace);
  const looking = store.loading;
  const preferenceSummary = PREFERENCE_LABELS[preferences[0] ?? "speed"];

  const update = <Key extends keyof RouteAlarm>(key: Key, value: RouteAlarm[Key]) => {
    setAlarmField(key, value);
    setSaved(false);
  };

  const confirmPlace = (field: "from" | "to", place: ConfirmedPlace | null) => {
    setPlace(field, place);
    setSaved(false);
  };

  const [customDraft, setCustomDraft] = useState<string[]>(alarm.days);

  const toggleDraftDay = (day: string, checked: boolean) => {
    setCustomDraft((current) => (checked ? [...current, day] : current.filter((item) => item !== day)));
  };

  const confirmCustomDays = () => {
    const picked = new Set(customDraft);
    const isAll = WEEKDAYS.every((day) => picked.has(day));
    const workdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const isWeekdays = workdays.every((day) => picked.has(day)) && !picked.has("Sat") && !picked.has("Sun");
    const isWeekends = picked.has("Sat") && picked.has("Sun") && !workdays.some((day) => picked.has(day));
    const days = WEEKDAYS.filter((day) => picked.has(day));
    setAlarmField("days", days);
    setSaved(false);
    if (isAll) setAlarmField("repeat", "daily");
    else if (isWeekdays) setAlarmField("repeat", "weekdays");
    else if (isWeekends) setAlarmField("repeat", "weekends");
  };

  const changeRepeat = (value: RepeatOption) => {
    update("repeat", value);
    if (value === "custom") setCustomDraft(alarm.days);
    if (value === "date") setAlarmField("dateMode", "date");
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
    const entry: SavedRouteAlarm = {
      id: editingId,
      alarm: next,
      fromPlace,
      toPlace,
      durationMinutes: preview?.totalDurationMinutes ?? preview?.minutes ?? null,
    };
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

  const latestAcceptableArrival = (() => {
    const reach = parseTime(alarm.arriveBy);
    if (reach === null) return "--:--";
    return formatMinutes(reach + (Number(alarm.maxDelay) || 0));
  })();

  const simulation = useSimulationOptional();
  const simClock = simulation?.clockActive ? simulation.clockMinutes : null;
  const departedAt = simulation?.departedAt ?? null;
  const rainDelay = simulation?.rain ? 5 : 0;

  const disruption = useDisruptionWatch({
    journey: preview,
    baselineJourney: recommendedJourney,
    alternatives,
    arriveBy: alarm.arriveBy,
    maxDelay: alarm.maxDelay,
    preference: preferences[0] ?? "speed",
    // Once the user has left, every predicted arrival is measured from that exact moment.
    departureMinutes: departedAt,
  });
  const assessment = disruption.assessment;

  const previewMinutes = preview?.totalDurationMinutes ?? preview?.minutes ?? null;
  const setRouteMinutes = simulation?.setRouteMinutes;
  useEffect(() => {
    setRouteMinutes?.(previewMinutes);
  }, [previewMinutes, setRouteMinutes]);

  const pastReachBy = reachByHasPassed(alarm);
  const baselineMinutes = recommendedJourney?.totalDurationMinutes ?? recommendedJourney?.minutes ?? null;

  // One metrics object per route — every figure on this page reads from it.
  const disruptionDelay = disruption.disrupted ? (assessment?.delayMinutes ?? 0) : 0;
  const metrics = preview
    ? buildRouteMetrics({
        journey: preview,
        alarm,
        baselineMinutes,
        delayMinutes: disruptionDelay + rainDelay,
        // Once the user has actually left, that moment replaces the planned departure.
        departureMinutes: departedAt,
      })
    : null;

  const departureTime = metrics?.departureClock ?? "--:--";
  const fixedDepartureMinutes = metrics ? toMinutes(metrics.departureClock) : null;
  const arrivalTime = metrics?.arrivalClock ?? (alarm.arriveBy || "--:--");
  const latestAcceptableArrivalClock = metrics?.latestAcceptableClock ?? latestAcceptableArrival;
  const lateBy = metrics?.overLimitMinutes ?? 0;
  const routeLate = lateBy > 0;
  const departurePassed = Boolean(metrics && departedAt === null && departureHasPassed(alarm, metrics.departureClock));

  // The departure shown once the user has left is always the exact simulated moment they left.
  const departedClock = departedAt !== null ? formatMinutes(departedAt) : null;
  const departedLine = (() => {
    if (!departedClock || !metrics) return null;
    const late = (toMinutes(metrics.arrivalClock) ?? 0) > (toMinutes(metrics.reachByClock) ?? 0);
    const tail = late ? `(after your ${metrics.reachByClock})` : `— before your ${metrics.reachByClock}`;
    return `Left at ${departedClock} · ${metrics.totalDurationMinutes} min journey · arriving about ${metrics.arrivalClock} ${tail}`;
  })();
  const statusLine = disruption.disrupted && assessment
    ? `${assessment.headline}${disruption.incident?.source === "demo" ? " (simulated)" : ""}`
    : routeLate
      ? `Arrives ${arrivalTime} — ${lateBy} min past your latest ${latestAcceptableArrivalClock}. Leave earlier or pick another route.`
      : null;

  const departureMin = fixedDepartureMinutes;
  const minutesToLeave = simClock !== null && departureMin !== null ? departureMin - simClock : null;



  return (
    <div className="pt-7">
      <h1 className="font-display text-3xl font-bold tracking-tight text-brand-deep">Plan your trip</h1>
      {simClock !== null && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-route-orange/35 bg-warning-soft px-3 py-2 text-xs font-bold text-brand-deep">
          <span>Simulated time {formatMinutes(simClock)}</span>
          {departedClock ? (
            <span className="font-semibold text-muted-foreground">· left at {departedClock}</span>
          ) : (
            minutesToLeave !== null && (
              <span className="font-semibold text-muted-foreground">
                {minutesToLeave > 0
                  ? `· leave in ${minutesToLeave} min (${departureTime})`
                  : `· departure time ${departureTime} has passed`}
              </span>
            )
          )}
        </p>
      )}
      {departedLine && (
        <p
          className={`mt-2 rounded-xl border px-3 py-2 text-xs font-bold ${
            routeLate ? "border-route-red/35 bg-route-red/10 text-route-red" : "border-success/35 bg-success-soft text-brand-deep"
          }`}
        >
          {departedLine}
        </p>
      )}
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
              {isRecurring(alarm.repeat) ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs font-bold text-brand-deep">{recurrenceLabel(alarm)}</p>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    Repeating trip · next journey {nextRunLabel(alarm)}
                  </p>
                </div>
              ) : alarm.repeat === "date" ? (
                <Field icon={CalendarDays} label="Journey date">
                  <Input
                    type="date"
                    value={alarm.date}
                    onChange={(event) => update("date", event.target.value)}
                    aria-label="Journey date"
                    className="h-11 bg-card"
                  />
                </Field>
              ) : (
                <Field icon={CalendarDays} label="Journey date">
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["today", "Today"],
                      ["date", "Select date"],
                    ] as Array<[JourneyDateMode, string]>).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => update("dateMode", mode)}
                        aria-pressed={alarm.dateMode === mode}
                        className={`min-h-10 rounded-lg border px-2 text-xs font-bold ${
                          alarm.dateMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {alarm.dateMode === "date" && (
                    <Input
                      type="date"
                      value={alarm.date}
                      onChange={(event) => update("date", event.target.value)}
                      aria-label="Journey date"
                      className="mt-2 h-11 bg-card"
                    />
                  )}
                </Field>
              )}
              {pastReachBy && (
                <div className="rounded-xl border border-route-orange/40 bg-warning-soft px-3 py-2.5">
                  <p className="text-xs font-bold text-brand-deep">This arrival time has already passed.</p>
                  <button
                    type="button"
                    onClick={() => {
                      update("date", sgTomorrowISO());
                      update("dateMode", "date");
                    }}
                    className="mt-1.5 text-xs font-bold text-primary underline underline-offset-4"
                  >
                    Use tomorrow instead
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
                <Field icon={AlarmClock} label="Reach by">
                  <Input type="time" value={alarm.arriveBy} onChange={(event) => update("arriveBy", event.target.value)} aria-label="Reach by" className="h-11 bg-card" />
                  <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                    {isRecurring(alarm.repeat) ? recurrenceLabel(alarm) : journeyDateLabel(alarm)} · {alarm.arriveBy || "--:--"}
                  </p>
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
                <Select value={alarm.repeat} onValueChange={(value) => changeRepeat(value as RepeatOption)}>
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
                      const checked = customDraft.includes(day);
                      return (
                        <Label key={day} className={`flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 text-xs font-bold ${checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleDraftDay(day, value === true)} className="sr-only" />
                          {day}
                        </Label>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-10 w-full rounded-xl text-xs font-bold"
                    disabled={customDraft.length === 0}
                    onClick={confirmCustomDays}
                  >
                    Confirm days
                  </Button>
                  <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                    Tap Confirm days to apply. Picking all seven days switches to Every day; Mon–Fri switches to Every weekday; Sat–Sun switches to Every weekend.
                  </p>
                </fieldset>
              )}
            </div>

            <Button
              className="mt-6 h-11 w-full rounded-xl text-sm font-bold"
              disabled={!bothConfirmed || looking || pastReachBy}
              onClick={() => store.refetch()}
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
          {preview && (
            <JourneyStatusCard
              watch={disruption}
              maxDelay={alarm.maxDelay}
              onUseAlternative={(journey) => setManualJourney(journey)}
            />
          )}

          {preview && segments.length > 0 && (
            <section className="glass-panel rounded-2xl p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-base font-bold text-brand-deep">Your route</h2>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${manualJourney ? "bg-success-soft text-success" : "bg-primary/10 text-primary"}`}>
                  {manualJourney ? "Chosen by you" : `Recommended for: ${preferenceSummary}`}
                </span>
              </div>

              {statusLine && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-route-red/35 bg-route-red/10 px-3 py-2 text-xs font-bold text-brand-deep">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-route-red" />
                  <span>Current status: {statusLine}</span>
                </p>
              )}

              <p className="mt-3 text-xs font-bold text-brand-deep">
                {isRecurring(alarm.repeat) ? `${recurrenceLabel(alarm)} · Arrive by ${alarm.arriveBy}` : journeyDateTimeLabel(alarm)}
              </p>

              <div className="mt-2 flex items-baseline gap-2">
                <p className="font-display text-2xl font-bold text-primary">{departureTime}</p>
                <span className="text-sm text-muted-foreground">→</span>
                <p className={`font-display text-2xl font-bold ${disruption.disrupted || routeLate ? "text-route-red" : "text-brand-deep"}`}>{arrivalTime}</p>
                <p className="ml-auto text-sm font-bold text-brand-deep">{metrics?.totalDurationMinutes ?? 0} min</p>
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {(() => {
                  const lead = departedClock ? `Left at ${departedClock}` : `Leave at ${departureTime}`;
                  if (routeLate) return `${lead} · arrives ${arrivalTime} (${lateBy} min after latest ${latestAcceptableArrivalClock})`;
                  if (disruption.disrupted) return `${lead} · expected arrival ${arrivalTime} (planned ${alarm.arriveBy})`;
                  return departedClock ? `${lead} · arriving ${arrivalTime}` : `${lead} to reach by ${arrivalTime}`;
                })()}
              </p>
              {departurePassed && (
                <p className="mt-1.5 rounded-lg border border-route-orange/40 bg-warning-soft px-2.5 py-1.5 text-[11px] font-bold text-brand-deep">
                  That departure time has already passed — leaving now arrives later than shown.
                </p>
              )}

              {disruption.disrupted && metrics && assessment && (
                <dl className="mt-3 space-y-1 rounded-xl border border-route-red/30 bg-route-red/5 px-3 py-2.5 text-xs font-semibold text-brand-deep">
                  <div className="flex justify-between gap-2"><dt>Normal duration</dt><dd>{metrics.normalDurationMinutes} min</dd></div>
                  <div className="flex justify-between gap-2"><dt>Disrupted duration</dt><dd className="text-route-red">{metrics.totalDurationMinutes} min</dd></div>
                  <div className="flex justify-between gap-2"><dt>Delay</dt><dd className="text-route-red">+{metrics.delayMinutes} min</dd></div>
                  <div className="flex justify-between gap-2"><dt>Original arrival</dt><dd>{assessment.originalArrival}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Updated arrival</dt><dd className="text-route-red">{metrics.arrivalClock}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Latest acceptable arrival</dt><dd>{metrics.latestAcceptableClock}</dd></div>
                  {lateBy > 0 && <p className="pt-1 text-route-red">This route exceeds your delay limit by {lateBy} min.</p>}
                </dl>
              )}



              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Walking" value={`${metrics?.walkingDistanceMetres ?? 0} m · ${metrics?.walkingMinutes ?? 0} min`} />
                <Stat label="Transfers" value={String(metrics?.transferCount ?? 0)} />
                <Stat
                  label={metrics?.fareEstimated === false ? "Fare" : "Estimated fare"}
                  value={typeof metrics?.estimatedFare === "number" ? `$${metrics.estimatedFare.toFixed(2)}` : "—"}
                />
              </dl>

              <p className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground">
                {manualJourney
                  ? "Chosen by you. Your saved primary preference is unchanged."
                  : preview.reason ?? ((preview.alternatives ?? 0) > 1 ? `Recommended from ${preview.alternatives} routes.` : "Only one route is currently available.")}
              </p>

              <p className="mt-2 text-[11px] text-muted-foreground">
                Source: {preview.dataSource ?? "LTA DataMall"}
                {preview.crowdLevel && preview.crowdLevel !== "unknown" ? ` · crowding from LTA PCDRealTime (${preview.crowdLevel})` : ""}
                {preview.updatedAt ? ` · last updated ${new Date(preview.updatedAt).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}` : ""}
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
                  badge={disruption.disrupted ? "Disruption on this route" : manualJourney ? "Chosen by you" : preferenceSummary}
                  footer={
                    disruption.disrupted && assessment
                      ? `${disruption.incident?.line ? `${disruption.incident.line} line disruption` : "Disruption"} · about ${metrics?.totalDurationMinutes ?? 0} min door to door · arrive ${metrics?.arrivalClock ?? assessment.predictedArrival}`
                      : `About ${metrics?.totalDurationMinutes ?? 0} min door to door · ${preview.legs.length} leg${preview.legs.length > 1 ? "s" : ""} · route when no disruptions`
                  }
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
                    {alternatives.map(({ preference, journey, recommended }) => {
                      const label = PREFERENCE_LABELS[preference as keyof typeof PREFERENCE_LABELS] ?? preference;
                      const metric = primaryMetric(journey, preference as never);
                      const arrival = arrivalFromDeparture(journey, fixedDepartureMinutes);
                      const status = arrivalStatus(arrival, alarm.arriveBy, alarm.maxDelay);
                      return (
                        <Button
                          key={journey.id ?? `${preference}-${journey.minutes}`}
                          type="button"
                          variant="outline"
                          aria-label={`Use ${label} route`}
                          onClick={() => setManualJourney(journey)}
                          className="h-auto min-h-24 w-full items-start justify-start whitespace-normal rounded-xl border-border bg-card p-3 text-left shadow-none hover:border-primary/40 hover:bg-primary/5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                {label}
                              </span>
                              {recommended && (
                                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-success">Recommended</span>
                              )}
                              {journey.fareEstimated !== false && (
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Estimated</span>
                              )}
                            </span>
                            <span className="mt-1.5 block font-display text-xl font-bold text-brand-deep">{metric.primary}</span>
                            <span className="block text-[11px] font-semibold text-muted-foreground">{metric.support}</span>
                            <span className={`mt-1.5 inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[status]}`}>
                              {departureTime} → {arrival}
                              {status === "within" ? " · within your delay limit" : status === "late" ? " · unable to meet arrival limit" : ""}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
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
            <section className={`glass-panel rounded-2xl p-5 text-sm ${planMessage ? "border border-route-red/35 text-foreground" : "text-muted-foreground"}`}>
              {looking
                ? "Working out the best way door to door…"
                : planMessage
                  ? planMessage
                  : "Tap “Find best route” to see your route."}
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
                <p className="text-[11px] font-semibold text-muted-foreground">
                  These settings are saved when you tap Save route alarm.
                </p>
              </div>
            )}
          </section>

          {saved && alarm.active && (
            <CommuteAlertCard alarm={alarm} preferences={preferences} fromPlace={fromPlace} toPlace={toPlace} metrics={metrics} />
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
  if (repeat === "daily") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
