import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { RoutePreference } from "@/lib/commute-settings";
import { findStation, LINE_NAMES, planRoute } from "@/lib/mrt-network";

const scheduleSchema = z.object({
  deviceId: z.string().min(8).max(64),
  origin: z.string().min(1).max(80),
  destination: z.string().min(1).max(80),
  travelDays: z.array(z.string().max(4)).max(7),
  repeatOption: z.string().max(16),
  arriveBy: z.string().max(8),
  maxDelay: z.number().int().min(0).max(120),
  preferences: z.array(z.string().max(16)).max(6),
  active: z.boolean(),
  notifyLeadMinutes: z.number().int().min(0).max(120),
  notifyWeather: z.boolean(),
  notifyCrowd: z.boolean(),
  notifyBus: z.boolean(),
  busStopCode: z.string().max(10).nullable(),
});

export type SavedSchedule = z.infer<typeof scheduleSchema>;

export const saveCommuteSchedule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => scheduleSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("commute_schedules").upsert(
      {
        device_id: data.deviceId,
        origin: data.origin,
        destination: data.destination,
        travel_days: data.travelDays,
        repeat_option: data.repeatOption,
        arrive_by: data.arriveBy,
        max_delay: data.maxDelay,
        preferences: data.preferences,
        active: data.active,
        notify_lead_minutes: data.notifyLeadMinutes,
        notify_weather: data.notifyWeather,
        notify_crowd: data.notifyCrowd,
        notify_bus: data.notifyBus,
        bus_stop_code: data.busStopCode,
      },
      { onConflict: "device_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCommuteSchedule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ deviceId: z.string().min(8).max(64) }).parse(data))
  .handler(async ({ data }): Promise<SavedSchedule | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("commute_schedules")
      .select("*")
      .eq("device_id", data.deviceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      deviceId: row.device_id,
      origin: row.origin,
      destination: row.destination,
      travelDays: row.travel_days ?? [],
      repeatOption: row.repeat_option,
      arriveBy: row.arrive_by,
      maxDelay: row.max_delay,
      preferences: row.preferences ?? [],
      active: row.active,
      notifyLeadMinutes: row.notify_lead_minutes,
      notifyWeather: row.notify_weather,
      notifyCrowd: row.notify_crowd,
      notifyBus: row.notify_bus,
      busStopCode: row.bus_stop_code,
    };
  });

export type CommuteBriefing = {
  configured: boolean;
  severity: "calm" | "watch" | "act";
  headline: string;
  leaveAt: string | null;
  arriveBy: string;
  travelMinutes: number;
  baselineMinutes: number;
  delayMinutes: number;
  weather: string | null;
  disruption: string | null;
  crowd: string | null;
  bus: string | null;
  alternative: string | null;
  routeSummary: string | null;
  checkedAt: string;
};

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map((part) => Number(part));
  return (h ?? 0) * 60 + (m ?? 0);
};

const toClock = (minutes: number) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
};

export const getCommuteBriefing = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        from: z.string().min(1).max(80),
        to: z.string().min(1).max(80),
        arriveBy: z.string().max(8),
        maxDelay: z.number().int().min(0).max(120),
        preferences: z.array(z.string().max(16)).max(6),
        notifyLeadMinutes: z.number().int().min(0).max(120),
        notifyWeather: z.boolean(),
        notifyCrowd: z.boolean(),
        notifyBus: z.boolean(),
        busStopCode: z.string().max(10).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CommuteBriefing> => {
    const transit = await import("@/lib/transit.server");
    const checkedAt = new Date().toISOString();
    const preferences = data.preferences as RoutePreference[];
    const base = planRoute(data.from, data.to, preferences);

    if (!base) {
      return {
        configured: true,
        severity: "calm",
        headline: "We could not match those station names yet.",
        leaveAt: null,
        arriveBy: data.arriveBy,
        travelMinutes: 0,
        baselineMinutes: 0,
        delayMinutes: 0,
        weather: null,
        disruption: null,
        crowd: null,
        bus: null,
        alternative: null,
        routeSummary: null,
        checkedAt,
      };
    }

    const routeLines = [...new Set(base.legs.map((leg) => leg.line))];
    const origin = findStation(data.from);

    const [disruption, weather, crowdMap, bus] = await Promise.all([
      transit.fetchDisruption().catch(() => ({ configured: false, disrupted: false, lines: [] as string[] })),
      data.notifyWeather && origin ? transit.fetchWeatherNear(origin.lat, origin.lng).catch(() => null) : null,
      data.notifyCrowd && routeLines[0] ? transit.fetchCrowd(routeLines[0]).catch(() => ({})) : {},
      data.notifyBus && data.busStopCode ? transit.fetchNextBus(data.busStopCode).catch(() => null) : null,
    ]);

    const hitLines = disruption.lines.filter((line) => routeLines.includes(line));
    let travelMinutes = base.minutes;
    let delayMinutes = 0;
    let alternative: string | null = null;
    let routeSummary = `${base.legs.map((leg) => leg.line).join(" → ")} · ${base.stops} stops · about ${base.minutes} min`;

    if (hitLines.length) {
      const detour = planRoute(data.from, data.to, preferences, hitLines);
      delayMinutes = 12;
      if (detour && detour.minutes < base.minutes + delayMinutes) {
        travelMinutes = detour.minutes;
        delayMinutes = Math.max(0, detour.minutes - base.minutes);
        alternative = `Take ${detour.legs.map((leg) => LINE_NAMES[leg.line] ?? leg.line).join(" → ")} instead · about ${detour.minutes} min`;
        routeSummary = `${detour.legs.map((leg) => leg.line).join(" → ")} · ${detour.stops} stops · about ${detour.minutes} min`;
      } else {
        travelMinutes = base.minutes + delayMinutes;
        alternative = "No faster alternative — allow extra time on your usual route.";
      }
    }

    const wet = weather ? /rain|shower|thunder/i.test(weather.forecast) : false;
    if (wet) {
      travelMinutes += 5;
      delayMinutes += 5;
    }

    const crowdedStations = Object.entries(crowdMap ?? {})
      .filter(([, level]) => level === "h")
      .map(([station]) => station);
    const originCode = origin ? origin.name : "";
    const crowdedHere = crowdedStations.length > 0;
    if (crowdedHere) {
      travelMinutes += 3;
      delayMinutes += 3;
    }

    const leaveAt = toClock(toMinutes(data.arriveBy) - travelMinutes - 3);
    const severity: CommuteBriefing["severity"] =
      delayMinutes >= data.maxDelay && delayMinutes > 0 ? "act" : delayMinutes >= 5 ? "watch" : "calm";

    const headline =
      severity === "act"
        ? `Leave by ${leaveAt} — ${delayMinutes} min longer than usual${hitLines.length ? ` (${hitLines.join(", ")} disruption)` : wet ? " (heavy rain)" : ""}.`
        : severity === "watch"
          ? `Leave by ${leaveAt} — running about ${delayMinutes} min slower than usual.`
          : `Leave by ${leaveAt} — normal run, arrive ${data.arriveBy}.`;

    return {
      configured: disruption.configured,
      severity,
      headline,
      leaveAt,
      arriveBy: data.arriveBy,
      travelMinutes,
      baselineMinutes: base.minutes,
      delayMinutes,
      weather: weather ? `${weather.forecast} near ${weather.name}${wet ? " · allow 5 min extra" : ""}` : null,
      disruption: disruption.disrupted
        ? `${disruption.lines.join(", ") || "Network"}: ${disruption.message ?? "Service disruption reported."}`
        : disruption.configured
          ? "All train lines running normally."
          : null,
      crowd: crowdedHere
        ? `Heavy platform crowding at ${crowdedStations.slice(0, 3).join(", ")}${originCode ? "" : ""}`
        : data.notifyCrowd
          ? "Platform crowding normal on your line."
          : null,
      bus: bus ? `Bus ${bus.serviceNo} in ${bus.minutes} min at stop ${data.busStopCode}` : null,
      alternative,
      routeSummary,
      checkedAt,
    };
  });
