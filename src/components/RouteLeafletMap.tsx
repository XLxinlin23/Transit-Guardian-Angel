import "leaflet/dist/leaflet.css";

import type { LatLngBoundsExpression, LatLngExpression, Map as LeafletMap } from "leaflet";
import type { RefObject } from "react";
import { AttributionControl, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

/** Swap this for a keyed provider URL if usage ever grows beyond light demo traffic. */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';

const BRAND = "#1473E6";
const MUTED = "#9DB2C8";
const SUCCESS = "#18A875";
const SURFACE = "#FFFFFF";

export const MODE_COLORS = {
  walk: "#64748B",
  bus: "#18A875",
  mrt: "#1473E6",
  lrt: "#0B2A4A",
} as const;

export type MapPoint = { name: string; lat: number; lng: number };

export type MapSegment = {
  mode: keyof typeof MODE_COLORS;
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
      boundsOptions={{ padding: [26, 26] }}
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
        segments!.map((segment, index) => (
          <Polyline
            key={`${segment.mode}-${segment.badge}-${index}`}
            positions={segment.points.map((point) => [point.lat, point.lng] as LatLngExpression)}
            pathOptions={{
              color: MODE_COLORS[segment.mode],
              weight: segment.mode === "walk" ? 5 : 7,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
              ...(segment.mode === "walk" ? { dashArray: "2 9" } : {}),
            }}
          />
        ))
      ) : (
        <>
          <Polyline positions={line} pathOptions={{ color: currentIndex === undefined ? BRAND : MUTED, weight: 7, opacity: 0.85, lineCap: "round", lineJoin: "round" }} />
          {travelled.length > 1 && (
            <Polyline positions={travelled} pathOptions={{ color: BRAND, weight: 7, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
          )}
        </>
      )}

      {multimodal
        ? segments!.map((segment, index) => {
            const point = segment.points[0]!;
            return (
              <CircleMarker
                key={`node-${index}`}
                center={[point.lat, point.lng]}
                radius={index === 0 ? 6 : 5}
                pathOptions={{ color: MODE_COLORS[segment.mode], weight: 3, fillColor: SURFACE, fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -8]} className="wayline-tooltip">
                  {point.name}
                </Tooltip>
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
                  color: isEnd ? SUCCESS : isTransfer || passed || currentIndex === undefined ? BRAND : MUTED,
                  weight: isEnd || isTransfer ? 3.5 : 2.5,
                  fillColor: SURFACE,
                  fillOpacity: 1,
                }}
              >
                {(isEnd || isTransfer) && (
                  <Tooltip direction={i === 0 ? "left" : "right"} offset={[i === 0 ? -8 : 8, 0]} permanent className="wayline-tooltip">
                    {s.name}
                  </Tooltip>
                )}
              </CircleMarker>
            );
          })}

      {multimodal && first && last && (
        <>
          <CircleMarker center={[first.lat, first.lng]} radius={7} pathOptions={{ color: SUCCESS, weight: 3.5, fillColor: SURFACE, fillOpacity: 1 }}>
            <Tooltip direction="left" offset={[-8, 0]} permanent className="wayline-tooltip">
              {first.name}
            </Tooltip>
          </CircleMarker>
          <CircleMarker center={[last.lat, last.lng]} radius={7} pathOptions={{ color: SUCCESS, weight: 3.5, fillColor: SURFACE, fillOpacity: 1 }}>
            <Tooltip direction="right" offset={[8, 0]} permanent className="wayline-tooltip">
              {last.name}
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {current && (
        <>
          <CircleMarker center={[current.lat, current.lng]} radius={14} pathOptions={{ stroke: false, fillColor: BRAND, fillOpacity: 0.18 }} />
          <CircleMarker center={[current.lat, current.lng]} radius={7} pathOptions={{ color: SURFACE, weight: 3, fillColor: BRAND, fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -10]} permanent className="wayline-tooltip wayline-tooltip-current">
              {current.name}
            </Tooltip>
          </CircleMarker>
        </>
      )}
    </MapContainer>
  );
}
