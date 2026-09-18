import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { RoutePreference } from "@/lib/commute-settings";
import { findStation, LINE_NAMES, nearestStation, planRoute, type NetworkStation } from "@/lib/mrt-network";

const scheduleSchema = z.object({
  deviceId: z.string().min(8).max(64),
  alarmId: z.string().min(1).max(64),
  label: z.string().max(60).nullable().optional(),
  origin: z.string().min(1).max(120),
  destination: z.string().min(1).max(120),
  fromLat: z.number().nullable().optional(),
  fromLng: z.number().nullable().optional(),
  toLat: z.number().nullable().optional(),
  toLng: z.number().nullable().optional(),
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
        alarm_id: data.alarmId,
        label: data.label ?? null,
        origin: data.origin,
        destination: data.destination,
        from_lat: data.fromLat ?? null,
        from_lng: data.fromLng ?? null,
        to_lat: data.toLat ?? null,
        to_lng: data.toLng ?? null,
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
      { onConflict: "device_id,alarm_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCommuteSchedule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ deviceId: z.string().min(8).max(64), alarmId: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("commute_schedules")
      .delete()
      .eq("device_id", data.deviceId)
      .eq("alarm_id", data.alarmId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCommuteSchedules = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ deviceId: z.string().min(8).max(64) }).parse(data))
  .handler(async ({ data }): Promise<SavedSchedule[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("commute_schedules")
      .select("*")
      .eq("device_id", data.deviceId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row: any) => ({
      deviceId: row.device_id,
      alarmId: row.alarm_id ?? "primary",
      label: row.label ?? null,
      origin: row.origin,
      destination: row.destination,
      fromLat: row.from_lat ?? null,
      fromLng: row.from_lng ?? null,
      toLat: row.to_lat ?? null,
      toLng: row.to_lng ?? null,
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
    }));
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

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const getCommuteBriefing = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        from: z.string().min(1).max(120),
        to: z.string().min(1).max(120),
        fromLat: z.number().nullable().optional(),
        fromLng: z.number().nullable().optional(),
        toLat: z.number().nullable().optional(),
        toLng: z.number().nullable().optional(),
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

    // Resolve each end to the nearest MRT station: the typed text may be any
    // place (mall, campus, postal code), so fall back to the confirmed coordinates.
    const hasFromCoords = typeof data.fromLat === "number" && typeof data.fromLng === "number";
    const hasToCoords = typeof data.toLat === "number" && typeof data.toLng === "number";
    const originStation: NetworkStation | null =
      findStation(data.from) ?? (hasFromCoords ? nearestStation(data.fromLat!, data.fromLng!) : null);
    const destStation: NetworkStation | null =
      findStation(data.to) ?? (hasToCoords ? nearestStation(data.toLat!, data.toLng!) : null);

    const base =
      originStation && destStation && originStation.name !== destStation.name
        ? planRoute(originStation.name, destStation.name, preferences)
        : null;

    // Walking/short-hop estimate when the trip does not use the rail network.
    const straightMinutes =
      hasFromCoords && hasToCoords
        ? Math.max(
            5,
            Math.round(
              (distanceKm({ lat: data.fromLat!, lng: data.fromLng! }, { lat: data.toLat!, lng: data.toLng! }) * 1000 * 1.3) /
                75,
            ),
          )
        : null;

    if (!base && straightMinutes === null) {
      return {
        configured: true,
        severity: "calm",
        headline: "Confirm both locations to build this alert.",
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

    const routeLines = base ? [...new Set(base.legs.map((leg) => leg.line))] : [];
    const baselineMinutes = base
      ? base.minutes + (originStation && hasFromCoords ? 4 : 0)
      : straightMinutes!;
    const weatherPoint = hasFromCoords
      ? { lat: data.fromLat!, lng: data.fromLng! }
      : originStation
        ? { lat: originStation.lat, lng: originStation.lng }
        : null;

    const [disruption, weather, crowdMap, bus] = await Promise.all([
      transit
        .fetchDisruption()
        .catch((): import("@/lib/transit.server").DisruptionInfo => ({ configured: false, disrupted: false, lines: [] })),
      data.notifyWeather && weatherPoint ? transit.fetchWeatherNear(weatherPoint.lat, weatherPoint.lng).catch(() => null) : null,
      data.notifyCrowd && routeLines[0] ? transit.fetchCrowd(routeLines[0]).catch(() => ({})) : {},
      data.notifyBus && data.busStopCode ? transit.fetchNextBus(data.busStopCode).catch(() => null) : null,
    ]);

    const hitLines = disruption.lines.filter((line) => routeLines.includes(line));
    let travelMinutes = baselineMinutes;
    let delayMinutes = 0;
    let alternative: string | null = null;
    let routeSummary = base
      ? `${base.legs.map((leg) => leg.line).join(" → ")} · ${base.stops} stops · about ${baselineMinutes} min`
      : `${data.from} → ${data.to} · about ${baselineMinutes} min on foot or by bus`;

    if (base && hitLines.length && originStation && destStation) {
      const detour = planRoute(originStation.name, destStation.name, preferences, hitLines);
      delayMinutes = 12;
      if (detour && detour.minutes < base.minutes + delayMinutes) {
        travelMinutes = detour.minutes;
        delayMinutes = Math.max(0, detour.minutes - base.minutes);
        alternative = `Take ${detour.legs.map((leg) => LINE_NAMES[leg.line] ?? leg.line).join(" → ")} instead · about ${detour.minutes} min`;
        routeSummary = `${detour.legs.map((leg) => leg.line).join(" → ")} · ${detour.stops} stops · about ${detour.minutes} min`;
      } else {
        travelMinutes = baselineMinutes + delayMinutes;
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
      baselineMinutes,
      delayMinutes,
      weather: weather ? `${weather.forecast} near ${weather.name}${wet ? " · allow 5 min extra" : ""}` : null,
      disruption: disruption.disrupted
        ? `${disruption.lines.join(", ") || "Network"}: ${disruption.message ?? "Service disruption reported."}`
        : disruption.configured
          ? "All train lines running normally."
          : null,
      crowd: crowdedHere
        ? `Heavy platform crowding at ${crowdedStations.slice(0, 3).join(", ")}`
        : data.notifyCrowd
          ? "Platform crowding normal on your line."
          : null,
      bus: bus ? `Bus ${bus.serviceNo} in ${bus.minutes} min at stop ${data.busStopCode}` : null,
      alternative,
      routeSummary,
      checkedAt,
    };
  });
