import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { TravelModeKey } from "./travel-modes";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.polyline.encodedPolyline",
  "routes.legs.steps.transitDetails",
].join(",");

export type DirectionsPoint = { name: string; lat: number; lng: number };

export type DirectionsSegment = {
  mode: TravelModeKey;
  badge: string;
  points: DirectionsPoint[];
};

export type DirectionsStep = {
  mode: TravelModeKey;
  badge: string;
  instruction: string;
  distanceMetres: number;
  minutes: number;
  from?: string;
  to?: string;
  stops?: number;
  headsign?: string;
  lineName?: string;
  departureText?: string;
  arrivalText?: string;
};

export type DirectionsResult = {
  configured: boolean;
  mode: "WALK" | "TRANSIT";
  minutes: number;
  distanceMetres: number;
  steps: DirectionsStep[];
  segments: DirectionsSegment[];
  origin: DirectionsPoint | null;
  destination: DirectionsPoint | null;
  message?: string;
};

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

function vehicleMode(type: string | undefined, name: string): TravelModeKey {
  const upper = (type ?? "").toUpperCase();
  if (upper === "BUS" || upper === "INTERCITY_BUS" || upper === "TROLLEYBUS") return "bus";
  if (upper === "TRAM" || upper === "LIGHT_RAIL" || upper === "MONORAIL") return "lrt";
  if (/LRT/i.test(name)) return "lrt";
  return "mrt";
}

const placeSchema = z.object({
  label: z.string().min(1).max(200),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const inputSchema = z.object({
  origin: placeSchema,
  destination: placeSchema,
  mode: z.enum(["WALK", "TRANSIT"]).default("TRANSIT"),
  /** The user's route priority — maps onto Google's transit routing preference. */
  preference: z.enum(["speed", "walking", "transfers", "cost", "sheltered", "crowd"]).default("speed"),
});

type PlaceInput = z.infer<typeof placeSchema>;

function waypoint(place: PlaceInput) {
  if (typeof place.lat === "number" && typeof place.lng === "number") {
    return { location: { latLng: { latitude: place.lat, longitude: place.lng } } };
  }
  return { address: `${place.label}, Singapore` };
}

function transitRoutingPreference(preference: z.infer<typeof inputSchema>["preference"]): string | null {
  if (preference === "walking" || preference === "sheltered") return "LESS_WALKING";
  if (preference === "transfers" || preference === "crowd") return "FEWER_TRANSFERS";
  return null;
}

export const getGoogleDirections = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<DirectionsResult> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];

    const empty: DirectionsResult = {
      configured: Boolean(lovableKey && mapsKey),
      mode: data.mode,
      minutes: 0,
      distanceMetres: 0,
      steps: [],
      segments: [],
      origin: null,
      destination: null,
    };

    if (!lovableKey || !mapsKey) {
      return { ...empty, message: "Google Maps is not connected yet." };
    }

    const routingPreference = transitRoutingPreference(data.preference);

    const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        origin: waypoint(data.origin),
        destination: waypoint(data.destination),
        travelMode: data.mode,
        regionCode: "SG",
        languageCode: "en-SG",
        ...(data.mode === "WALK"
          ? {}
          : {
              transitPreferences: {
                allowedTravelModes: ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"],
                ...(routingPreference ? { routingPreference } : {}),
              },
            }),
      }),
    });


    if (!response.ok) {
      const body = await response.text();
      console.error(`Google Directions failed [${response.status}]: ${body}`);
      if (response.status === 403) {
        return { ...empty, message: "Google Maps refused this request (403). Check the map key's restrictions." };
      }
      return { ...empty, message: `Google Maps could not return a route (${response.status}).` };
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        legs?: Array<{ steps?: Array<Record<string, any>> }>;
      }>;
    };

    const route = payload.routes?.[0];
    if (!route) return { ...empty, message: "No route found between those two places." };

    const steps: DirectionsStep[] = [];
    const segments: DirectionsSegment[] = [];

    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const encoded: string | undefined = step["polyline"]?.encodedPolyline;
        const transit = step["transitDetails"];
        const isTransit = step["travelMode"] === "TRANSIT" && transit;
        const line = transit?.transitLine;
        const mode: TravelModeKey = isTransit ? vehicleMode(line?.vehicle?.type, String(line?.name ?? "")) : "walk";
        const badge: string = isTransit ? String(line?.nameShort ?? line?.name ?? "") : "";
        const from: string | undefined = transit?.stopDetails?.departureStop?.name;
        const to: string | undefined = transit?.stopDetails?.arrivalStop?.name;
        const distanceMetres = Number(step["distanceMeters"] ?? 0);
        const minutes = Math.max(1, Math.round(seconds(step["staticDuration"]) / 60));
        const instruction: string = isTransit
          ? `${mode === "bus" ? `Bus ${badge}` : badge} ${from ?? ""} → ${to ?? ""}`.trim()
          : String(step["navigationInstruction"]?.instructions ?? "Walk");

        // Merge consecutive walking steps into one map segment to keep the map readable.
        if (encoded) {
          const decoded = decodePolyline(encoded);
          if (decoded.length > 1) {
            const points: DirectionsPoint[] = decoded.map(([lat, lng], index) => ({
              name: index === 0 ? from ?? instruction : index === decoded.length - 1 ? to ?? "" : "",
              lat,
              lng,
            }));
            const previous = segments[segments.length - 1];
            if (!isTransit && previous && previous.mode === "walk") previous.points.push(...points);
            else segments.push({ mode, badge, points });
          }
        }

        steps.push({
          mode,
          badge,
          instruction,
          distanceMetres,
          minutes,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(transit?.stopCount ? { stops: Number(transit.stopCount) } : {}),
          ...(line?.name ? { lineName: String(line.name) } : {}),
          ...(transit?.headsign ? { headsign: String(transit.headsign) } : {}),
          ...(transit?.localizedValues?.departureTime?.time?.text
            ? { departureText: String(transit.localizedValues.departureTime.time.text) }
            : {}),
          ...(transit?.localizedValues?.arrivalTime?.time?.text
            ? { arrivalText: String(transit.localizedValues.arrivalTime.time.text) }
            : {}),
        });
      }
    }

    const first = segments[0]?.points[0] ?? null;
    const lastSegment = segments[segments.length - 1];
    const last = lastSegment?.points[lastSegment.points.length - 1] ?? null;

    return {
      configured: true,
      mode: data.mode,
      minutes: Math.max(1, Math.round(seconds(route.duration) / 60)),
      distanceMetres: Number(route.distanceMeters ?? 0),
      steps,
      segments,
      origin: first ? { ...first, name: data.origin } : null,
      destination: last ? { ...last, name: data.destination } : null,
    };
  });
