import type { JourneyLeg, TravelMode } from "./journey.functions";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.travelAdvisory.transitFare",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.polyline.encodedPolyline",
  "routes.legs.steps.transitDetails",
].join(",");

export type GoogleRoutePlan = { legs: JourneyLeg[]; fare: number | null };

type Point = { lat: number; lng: number; name: string };

/** Decode a Google encoded polyline into lat/lng pairs. */
function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

function seconds(value: unknown): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseFloat(value.replace("s", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function vehicleMode(type: string | undefined, name: string): TravelMode {
  const upper = (type ?? "").toUpperCase();
  if (upper === "BUS" || upper === "INTERCITY_BUS" || upper === "TROLLEYBUS") return "bus";
  if (upper === "TRAM" || upper === "LIGHT_RAIL" || upper === "MONORAIL") return "lrt";
  if (/LRT/i.test(name)) return "lrt";
  return "mrt";
}

/** Map a Google transit line name to the local rail line code, e.g. "East West Line" -> "EW". */
function railBadge(name: string, short: string): string {
  const table: Array<[RegExp, string]> = [
    [/north[\s-]?south/i, "NS"],
    [/east[\s-]?west/i, "EW"],
    [/north[\s-]?east/i, "NE"],
    [/circle/i, "CC"],
    [/downtown/i, "DT"],
    [/thomson/i, "TE"],
    [/bukit panjang/i, "BP"],
    [/sengkang/i, "SK"],
    [/punggol/i, "PG"],
  ];
  for (const [pattern, code] of table) {
    if (pattern.test(name) || pattern.test(short)) return code;
  }
  return (short || name).slice(0, 4).toUpperCase();
}

type Step = Record<string, any>;

function toLegs(route: Record<string, any>, from: Point, to: Point): JourneyLeg[] {
  const legs: JourneyLeg[] = [];

  for (const googleLeg of (route["legs"] ?? []) as Array<{ steps?: Step[] }>) {
    for (const step of googleLeg.steps ?? []) {
      const encoded: string | undefined = step["polyline"]?.encodedPolyline;
      const decoded = encoded ? decodePolyline(encoded) : [];
      if (decoded.length < 2) continue;

      const transit = step["transitDetails"];
      const isTransit = step["travelMode"] === "TRANSIT" && transit;
      const line = transit?.transitLine;
      const lineName = String(line?.name ?? "");
      const lineShort = String(line?.nameShort ?? "");
      const mode: TravelMode = isTransit ? vehicleMode(line?.vehicle?.type, lineName) : "walk";
      const badge = isTransit ? (mode === "bus" ? lineShort || lineName : railBadge(lineName, lineShort)) : "Walk";
      const stopFrom: string | undefined = transit?.stopDetails?.departureStop?.name;
      const stopTo: string | undefined = transit?.stopDetails?.arrivalStop?.name;
      const metres = Number(step["distanceMeters"] ?? 0);
      const minutes = Math.max(1, Math.round(seconds(step["staticDuration"]) / 60));
      const stops = Number(transit?.stopCount ?? 0);

      const points = decoded.map(([lat, lng], index) => ({
        lat,
        lng,
        name: index === 0 ? stopFrom ?? "" : index === decoded.length - 1 ? stopTo ?? "" : "",
      }));

      if (!isTransit) {
        // Merge back-to-back walking steps so the map and timeline stay readable.
        const previous = legs[legs.length - 1];
        if (previous && previous.mode === "walk") {
          previous.points.push(...points);
          previous.minutes += minutes;
          previous.metres = (previous.metres ?? 0) + metres;
          previous.detail = `${Math.round(previous.metres)} m on foot`;
          continue;
        }
        legs.push({
          mode: "walk",
          badge: "Walk",
          from: "",
          to: "",
          detail: `${Math.round(metres)} m on foot`,
          minutes,
          metres: Math.round(metres),
          points,
        });
        continue;
      }

      legs.push({
        mode,
        badge,
        from: stopFrom ?? "",
        to: stopTo ?? "",
        detail: stops ? `${stops} stop${stops > 1 ? "s" : ""}` : lineName,
        minutes,
        points,
      });
    }
  }

  // Name the very first and very last point after the user's own places.
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (first?.points[0]) {
    first.points[0].name = from.name;
    if (first.mode === "walk") first.from = from.name;
  }
  if (last) {
    const point = last.points[last.points.length - 1];
    if (point) point.name = to.name;
    if (last.mode === "walk") last.to = to.name;
  }
  for (const leg of legs) {
    if (leg.mode !== "walk") continue;
    if (!leg.from) leg.from = "Walk";
    if (!leg.to) leg.to = "";
  }

  return legs;
}

async function computeRoutes(body: unknown): Promise<Array<Record<string, any>>> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) return [];

  const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`Google Routes failed [${response.status}]: ${await response.text()}`);
    return [];
  }

  const payload = (await response.json()) as { routes?: Array<Record<string, any>> };
  return payload.routes ?? [];
}

function fareOf(route: Record<string, any>): number | null {
  const fare = route["travelAdvisory"]?.transitFare;
  if (!fare) return null;
  const units = Number(fare.units ?? 0);
  const nanos = Number(fare.nanos ?? 0);
  const value = units + nanos / 1e9;
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

/** Real Google Maps routes (transit alternatives plus walking) turned into Wayline journey legs. */
export async function googleRoutePlans(from: Point, to: Point): Promise<GoogleRoutePlan[]> {
  const origin = { location: { latLng: { latitude: from.lat, longitude: from.lng } } };
  const destination = { location: { latLng: { latitude: to.lat, longitude: to.lng } } };
  const common = { origin, destination, regionCode: "SG", languageCode: "en-SG" };

  const transitBody = (routingPreference?: string) => ({
    ...common,
    travelMode: "TRANSIT",
    computeAlternativeRoutes: true,
    transitPreferences: {
      allowedTravelModes: ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"],
      ...(routingPreference ? { routingPreference } : {}),
    },
  });

  const results = await Promise.all([
    computeRoutes(transitBody()).catch(() => []),
    computeRoutes(transitBody("LESS_WALKING")).catch(() => []),
    computeRoutes(transitBody("FEWER_TRANSFERS")).catch(() => []),
    computeRoutes({ ...common, travelMode: "WALK" }).catch(() => []),
  ]);

  const routes = results.flat();


  const plans: GoogleRoutePlan[] = [];
  for (const route of [...transit, ...walking]) {
    const legs = toLegs(route, from, to);
    if (legs.length) plans.push({ legs, fare: fareOf(route) });
  }
  return plans;
}
