const LTA_BASE = "https://datamall2.mytransport.sg/ltaodataservice";
const WEATHER_URL = "https://api.data.gov.sg/v1/environment/2-hour-weather-forecast";

/** Our internal two-letter line codes mapped to LTA line codes. */
export const LTA_LINE_CODE: Record<string, string> = {
  EW: "EWL",
  NS: "NSL",
  NE: "NEL",
  CC: "CCL",
  CG: "CGL",
};

export const LINE_FROM_LTA: Record<string, string> = Object.fromEntries(
  Object.entries(LTA_LINE_CODE).map(([internal, lta]) => [lta, internal]),
);

function ltaKey() {
  return process.env["LTA_ACCOUNT_KEY"] ?? "";
}

async function ltaFetch(path: string) {
  const key = ltaKey();
  if (!key) return null;
  const res = await fetch(`${LTA_BASE}/${path}`, { headers: { AccountKey: key, accept: "application/json" } });
  if (!res.ok) throw new Error(`LTA request failed (${res.status})`);
  return (await res.json()) as any;
}

export type DisruptionInfo = {
  configured: boolean;
  disrupted: boolean;
  lines: string[];
  stations?: string;
  message?: string;
};

export async function fetchDisruption(): Promise<DisruptionInfo> {
  const data = await ltaFetch("TrainServiceAlerts");
  if (!data) return { configured: false, disrupted: false, lines: [] };
  const value = data?.value ?? {};
  const affected: any[] = Array.isArray(value.AffectedSegments) ? value.AffectedSegments : [];
  const messages: any[] = Array.isArray(value.Message) ? value.Message : [];
  if (value.Status === 1 || affected.length === 0) {
    return { configured: true, disrupted: false, lines: [], message: messages[0]?.Content };
  }
  const lines = affected
    .map((segment) => LINE_FROM_LTA[String(segment.Line ?? "").toUpperCase()])
    .filter((line): line is string => Boolean(line));
  return {
    configured: true,
    disrupted: true,
    lines: [...new Set(lines)],
    stations: affected[0]?.Stations,
    message: messages[0]?.Content ?? "Train service disruption reported.",
  };
}

/** Real-time platform crowd density per station for one line ("l" | "m" | "h"). */
export async function fetchCrowd(internalLine: string): Promise<Record<string, string>> {
  const code = LTA_LINE_CODE[internalLine];
  if (!code) return {};
  const data = await ltaFetch(`PCDRealTime?TrainLine=${code}`);
  const out: Record<string, string> = {};
  for (const row of data?.value ?? []) {
    if (row?.Station) out[String(row.Station).toUpperCase()] = String(row.CrowdLevel ?? "").toLowerCase();
  }
  return out;
}

export async function fetchWeatherNear(lat: number, lng: number) {
  const res = await fetch(WEATHER_URL, { headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const item = json?.items?.[0];
  const meta: any[] = json?.area_metadata ?? [];
  let best: { name: string; forecast: string } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const forecast of item?.forecasts ?? []) {
    const area = meta.find((entry) => entry.name === forecast.area);
    const location = area?.label_location;
    if (!location) continue;
    const distance = (location.latitude - lat) ** 2 + (location.longitude - lng) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { name: forecast.area, forecast: forecast.forecast };
    }
  }
  return best;
}

export async function fetchNextBus(busStopCode: string) {
  const data = await ltaFetch(`v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`);
  const service = data?.Services?.[0];
  const eta = service?.NextBus?.EstimatedArrival;
  if (!service || !eta) return null;
  return {
    serviceNo: String(service.ServiceNo),
    minutes: Math.max(0, Math.round((new Date(eta).getTime() - Date.now()) / 60000)),
  };
}
