import { ClientOnly } from "@tanstack/react-router";
import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";
import { Focus, Maximize2, Minimize2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CURRENT_STATION, STOPS_REMAINING } from "../lib/route-data";
import { STATIONS } from "../lib/route-data";

const RouteLeafletMap = lazy(() => import("./RouteLeafletMap"));
const routeBounds: LatLngBoundsExpression = STATIONS.map((station) => [station.lat, station.lng] as [number, number]);

function MapSkeleton() {
  return <div className="size-full animate-pulse bg-secondary/60" />;
}

export function RouteMap() {
  const [expanded, setExpanded] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const fitRoute = () => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(routeBounds, { padding: [26, 26] });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(routeBounds, { padding: [26, 26] });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand-deep">Route map</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <span className="status-pulse size-2 rounded-full bg-primary" /> You are here
        </span>
      </div>

      {expanded && (
        <button
          type="button"
          aria-label="Close route map"
          className="fixed inset-0 z-40 cursor-default bg-brand-deep/40 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={`wayline-map overflow-hidden bg-secondary/50 ${
          expanded
            ? "fixed left-1/2 top-1/2 z-50 h-[85vh] w-screen -translate-x-1/2 -translate-y-1/2 rounded-none md:h-[80vh] md:w-[90vw] md:rounded-3xl"
            : "relative mt-3 h-56 rounded-2xl"
        }`}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded ? "true" : undefined}
        aria-label={expanded ? "Expanded route map" : undefined}
      >
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <RouteLeafletMap mapRef={mapRef} />
          </Suspense>
        </ClientOnly>

        {expanded && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setExpanded(false)}
            aria-label="Close route map"
            title="Close"
            className="glass-control absolute right-3 top-3 z-[500] size-10 rounded-xl text-brand-deep"
          >
            <X />
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setExpanded((current) => !current)}
          aria-label={expanded ? "Exit fullscreen map" : "Expand route map"}
          title={expanded ? "Exit fullscreen" : "Fullscreen"}
          className={`glass-control absolute right-3 z-[500] rounded-xl text-brand-deep ${expanded ? "top-16 size-10" : "top-3 size-9"}`}
        >
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fitRoute}
          className="glass-control absolute bottom-7 left-3 z-[500] h-9 gap-1.5 rounded-lg px-3 text-xs text-brand-deep"
          title="Show full route"
        >
          <Focus /> Fit route
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Near {CURRENT_STATION.name} · {STOPS_REMAINING} stops to Raffles Place
      </p>

    </div>
  );
}
