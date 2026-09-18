import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LTA_BASE = "https://datamall2.mytransport.sg/ltaodataservice";
const WEATHER_URL = "https://api.data.gov.sg/v1/environment/2-hour-weather-forecast";

export type TrainAlert = {
  status: "normal" | "disrupted" | "unknown";
  line?: string;
  direction?: string;
  stations?: string;
  message?: string;
  updatedAt: string;
  configured: boolean;
};

export type BusService = {
  serviceNo: string;
  operator: string;
  arrivals: { minutes: number | null; load: string; type: string; feature: string }[];
};

export type BusArrivals = {
  busStopCode: string;
  services: BusService[];
  updatedAt: string;
  configured: boolean;
};

export type WeatherForecast = {
  updatedAt: string;
  areas: { name: string; forecast: string; lat: number; lng: number }[];
};

function ltaKey() {
  return process.env["LTA_ACCOUNT_KEY"] ?? "";
}

async function ltaFetch(path: string, key: string) {
  const res = await fetch(`${LTA_BASE}/${path}`, {
    headers: { AccountKey: key, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`LTA request failed (${res.status})`);
  return (await res.json()) as any;
}

export const getTrainAlerts = createServerFn({ method: "GET" }).handler(async (): Promise<TrainAlert> => {
  const key = ltaKey();
  const updatedAt = new Date().toISOString();
  if (!key) return { status: "unknown", updatedAt, configured: false };

  const data = await ltaFetch("TrainServiceAlerts", key);
  const value = data?.value ?? {};
  const affected = Array.isArray(value.AffectedSegments) ? value.AffectedSegments : [];
  const messages = Array.isArray(value.Message) ? value.Message : [];

  if (value.Status === 1 || affected.length === 0) {
    return {
      status: "normal",
      message: messages[0]?.Content,
      updatedAt,
      configured: true,
    };
  }

  const first = affected[0] ?? {};
  return {
    status: "disrupted",
    line: first.Line,
    direction: first.Direction,
    stations: first.Stations,
    message: messages[0]?.Content ?? "Train service disruption reported.",
    updatedAt,
    configured: true,
  };
});

export const getBusArrivals = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ busStopCode: z.string().min(3).max(10) }).parse(data))
  .handler(async ({ data }): Promise<BusArrivals> => {
    const key = ltaKey();
    const updatedAt = new Date().toISOString();
    if (!key) return { busStopCode: data.busStopCode, services: [], updatedAt, configured: false };

    const res = await ltaFetch(`v3/BusArrival?BusStopCode=${encodeURIComponent(data.busStopCode)}`, key);
    const services: BusService[] = (res?.Services ?? []).map((s: any) => ({
      serviceNo: s.ServiceNo,
      operator: s.Operator,
      arrivals: ["NextBus", "NextBus2", "NextBus3"]
        .map((k) => s[k])
        .filter((b: any) => b && b.EstimatedArrival)
        .map((b: any) => ({
          minutes: Math.max(0, Math.round((new Date(b.EstimatedArrival).getTime() - Date.now()) / 60000)),
          load: b.Load ?? "",
          type: b.Type ?? "",
          feature: b.Feature ?? "",
        })),
    }));

    services.sort((a, b) => a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true }));
    return { busStopCode: data.busStopCode, services, updatedAt, configured: true };
  });

export const getWeather = createServerFn({ method: "GET" }).handler(async (): Promise<WeatherForecast> => {
  const res = await fetch(WEATHER_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const json = (await res.json()) as any;
  const item = json?.items?.[0];
  const meta: any[] = json?.area_metadata ?? [];
  const coords = new Map(meta.map((m) => [m.name, m.label_location]));

  return {
    updatedAt: item?.update_timestamp ?? new Date().toISOString(),
    areas: (item?.forecasts ?? []).map((f: any) => ({
      name: f.area,
      forecast: f.forecast,
      lat: coords.get(f.area)?.latitude ?? 1.3521,
      lng: coords.get(f.area)?.longitude ?? 103.8198,
    })),
  };
});
