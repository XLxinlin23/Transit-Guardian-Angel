import "leaflet/dist/leaflet.css";

import L, { type LatLngBoundsExpression, type LatLngExpression, type Map as LeafletMap } from "leaflet";
import { Fragment, type RefObject } from "react";
import { AttributionControl, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";

import { legColor, legLabel, MODE_COLORS, type TravelModeKey } from "@/lib/travel-modes";

/** Swap this for a keyed provider URL if usage ever grows beyond light demo traffic. */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';

const BRAND = "#1473E6";
const MUTED = "#9DB2C8";
const START = "#16A36D";
const END = "#D42E12";
const SURFACE = "#FFFFFF";

export type MapPoint = { name: string; lat: number; lng: number };

export type MapSegment = {
  mode: TravelModeKey;
  badge: string;
  points: MapPoint[];
};

type RouteLeafletMapProps = {
  mapRef: RefObject<LeafletMap | null>;
  stations: MapPoint[];
  /** Colour-coded multimodal segments; when present they replace the plain station line. */
  segments?: MapSegment[] | undefined;
  /** Index of the last station already passed; omit for a plain route preview. */
  currentIndex?: number | undefined;
  /** Stations where the commuter changes line, highlighted on the route. */
  transferNames?: string[] | undefined;
};

/** Keep station labels short so they never overflow the map frame. */
function shortName(name: string): string {
  const head = name.split(",")[0]!.trim();
  return head.length > 22 ? `${head.slice(0, 21)}…` : head;
}

function endpointIcon(label: string, color: string, text: string) {
  return L.divIcon({
    className: "wayline-pin",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<span class="wayline-pin-inner" style="background:${color}"><span class="wayline-pin-letter">${label}</span><span class="wayline-pin-text">${text}</span></span>`,
  });
}

function busIcon(color: string) {
  return L.divIcon({
    className: "wayline-busdot",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<span class="wayline-busdot-inner" style="border-color:${color}"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h16v9H4z"/><path d="M4 11h16"/><path d="M7 19v-2M17 19v-2"/></svg></span>`,
  });
}

export default function RouteLeafletMap({ mapRef, stations, segments, currentIndex, transferNames = [] }: RouteLeafletMapProps) {
  const multimodal = Boolean(segments?.length);
  const allPoints: MapPoint[] = multimodal ? segments!.flatMap((segment) => segment.points) : stations;
  const bounds: LatLngBoundsExpression = allPoints.map((point) => [point.lat, point.lng] as [number, number]);
  const line: LatLngExpression[] = stations.map((s) => [s.lat, s.lng]);
  const travelled: LatLngExpression[] =
    currentIndex === undefined ? [] : stations.slice(0, currentIndex + 1).map((s) => [s.lat, s.lng]);
  const current = currentIndex === undefined ? null : stations[currentIndex] ?? null;
  const transfers = new Set(transferNames);
  const first = allPoints[0];
  const last = allPoints[allPoints.length - 1];

  return (
    <MapContainer
      ref={mapRef}
      bounds={bounds}
      boundsOptions={{ padding: [34, 34], maxZoom: 16 }}
      className="size-full"
      minZoom={10}
      maxZoom={18}
      zoomControl
      dragging
      scrollWheelZoom
      doubleClickZoom
      touchZoom
      keyboard
      attributionControl={false}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <AttributionControl position="bottomright" prefix={false} />

      {multimodal ? (
        segments!.map((segment, index) => {
          const positions = segment.points.map((point) => [point.lat, point.lng] as LatLngExpression);
          const color = legColor(segment.mode, segment.badge);
          const walking = segment.mode === "walk";
          return (
            <Fragment key={`seg-${segment.mode}-${segment.badge}-${index}`}>
              {/* White casing underneath for contrast against the base map */}
              <Polyline
                positions={positions}
                pathOptions={{ color: SURFACE, weight: 10, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
              />
              <Polyline
                positions={positions}
                pathOptions={{
                  color,
                  weight: 6,
                  opacity: 1,
                  lineCap: "round",
                  lineJoin: "round",
                  ...(walking ? { dashArray: "2 10" } : {}),
                }}
              >
                <Tooltip sticky className="wayline-tooltip">
                  {legLabel(segment.mode, segment.badge)}
                </Tooltip>
              </Polyline>
            </Fragment>
          );
        })
      ) : (
        <>
          <Polyline positions={line} pathOptions={{ color: SURFACE, weight: 10, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={line} pathOptions={{ color: currentIndex === undefined ? BRAND : MUTED, weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }} />
          {travelled.length > 1 && (
            <Polyline positions={travelled} pathOptions={{ color: BRAND, weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }} />
          )}
        </>
      )}

      {multimodal
        ? segments!.map((segment, index) => {
            if (index === 0) return null;
            const point = segment.points[0]!;
            const color = legColor(segment.mode, segment.badge);
            if (segment.mode === "bus") {
              return (
                <Marker key={`node-${index}`} position={[point.lat, point.lng]} icon={busIcon(MODE_COLORS.bus)}>
                  <Tooltip direction="top" offset={[0, -8]} className="wayline-tooltip">
                    {shortName(point.name)}
                  </Tooltip>
                  <Popup>{point.name}</Popup>
                </Marker>
              );
            }
            return (
              <CircleMarker
                key={`node-${index}`}
                center={[point.lat, point.lng]}
                radius={6}
                pathOptions={{ color, weight: 3.5, fillColor: SURFACE, fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -8]} className="wayline-tooltip">
                  {shortName(point.name)}
                </Tooltip>
                <Popup>{point.name}</Popup>
              </CircleMarker>
            );
          })
        : stations.map((s, i) => {
            const isEnd = i === 0 || i === stations.length - 1;
            const isTransfer = transfers.has(s.name);
            const passed = currentIndex !== undefined && i <= currentIndex;
            return (
              <CircleMarker
                key={`${s.name}-${i}`}
                center={[s.lat, s.lng]}
                radius={isEnd ? 6 : isTransfer ? 5.5 : 4}
                pathOptions={{
                  color: isEnd ? START : isTransfer || passed || currentIndex === undefined ? BRAND : MUTED,
                  weight: isEnd || isTransfer ? 3.5 : 2.5,
                  fillColor: SURFACE,
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction={i === 0 ? "left" : "right"} offset={[i === 0 ? -8 : 8, 0]} className="wayline-tooltip">
                  {shortName(s.name)}
                </Tooltip>
                <Popup>{s.name}</Popup>
              </CircleMarker>
            );
          })}

      {multimodal && first && last && (
        <>
          <Marker position={[first.lat, first.lng]} icon={endpointIcon("A", START, shortName(first.name))}>
            <Popup>{first.name}</Popup>
          </Marker>
          <Marker position={[last.lat, last.lng]} icon={endpointIcon("B", END, shortName(last.name))}>
            <Popup>{last.name}</Popup>
          </Marker>
        </>
      )}

      {current && (
        <>
          <CircleMarker center={[current.lat, current.lng]} radius={14} pathOptions={{ stroke: false, fillColor: BRAND, fillOpacity: 0.18 }} />
          <CircleMarker center={[current.lat, current.lng]} radius={7} pathOptions={{ color: SURFACE, weight: 3, fillColor: BRAND, fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -10]} permanent className="wayline-tooltip wayline-tooltip-current">
              {shortName(current.name)}
            </Tooltip>
          </CircleMarker>
        </>
      )}
    </MapContainer>
  );
}
