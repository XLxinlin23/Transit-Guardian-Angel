import "leaflet/dist/leaflet.css";

import type { LatLngBoundsExpression, LatLngExpression, Map as LeafletMap } from "leaflet";
import type { RefObject } from "react";
import { AttributionControl, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

import { CURRENT, CURRENT_STATION, STATIONS } from "../lib/route-data";

/** Swap this for a keyed provider URL if usage ever grows beyond light demo traffic. */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';

const BRAND = "#1473E6";
const MUTED = "#9DB2C8";
const SUCCESS = "#18A875";
const SURFACE = "#FFFFFF";

const line: LatLngExpression[] = STATIONS.map((s) => [s.lat, s.lng]);
const travelled: LatLngExpression[] = STATIONS.slice(0, CURRENT + 1).map((s) => [s.lat, s.lng]);
const bounds: LatLngBoundsExpression = STATIONS.map((s) => [s.lat, s.lng] as [number, number]);

type RouteLeafletMapProps = {
  mapRef: RefObject<LeafletMap | null>;
};

export default function RouteLeafletMap({ mapRef }: RouteLeafletMapProps) {
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

      <Polyline positions={line} pathOptions={{ color: MUTED, weight: 7, opacity: 0.8, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={travelled} pathOptions={{ color: BRAND, weight: 7, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />

      {STATIONS.map((s, i) => {
        const isEnd = i === 0 || i === STATIONS.length - 1;
        const passed = i <= CURRENT;
        return (
          <CircleMarker
            key={s.code}
            center={[s.lat, s.lng]}
            radius={isEnd ? 6 : 4}
            pathOptions={{
              color: isEnd ? SUCCESS : passed ? BRAND : MUTED,
              weight: isEnd ? 3.5 : 2.5,
              fillColor: SURFACE,
              fillOpacity: 1,
            }}
          >
            {isEnd && (
              <Tooltip direction="right" offset={[8, 0]} permanent className="wayline-tooltip">
                {s.name}
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}

      <CircleMarker
        center={[CURRENT_STATION.lat, CURRENT_STATION.lng]}
        radius={14}
        pathOptions={{ stroke: false, fillColor: BRAND, fillOpacity: 0.18 }}
      />
      <CircleMarker
        center={[CURRENT_STATION.lat, CURRENT_STATION.lng]}
        radius={7}
        pathOptions={{ color: SURFACE, weight: 3, fillColor: BRAND, fillOpacity: 1 }}
      >
        <Tooltip direction="top" offset={[0, -10]} permanent className="wayline-tooltip wayline-tooltip-current">
          {CURRENT_STATION.name}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
