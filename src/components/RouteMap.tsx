import { ClientOnly } from "@tanstack/react-router";
import type { LatLngBoundsExpression, Map as LeafletMap } from "leaflet";
import { Focus, Maximize2, Minimize2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MapPoint, MapSegment } from "./RouteLeafletMap";

const RouteLeafletMap = lazy(() => import("./RouteLeafletMap"));

function MapSkeleton() {
  return <div className="size-full animate-pulse bg-secondary/60" />;
}

type RouteMapProps = {
  stations: MapPoint[];
  segments?: MapSegment[] | undefined;
  title?: string | undefined;
  badge?: string | undefined;
  footer?: string | undefined;
  currentIndex?: number | undefined;
  transferNames?: string[] | undefined;
  embedded?: boolean | undefined;
  compact?: boolean | undefined;
};

export function RouteMap({ stations, segments, title = "Route map", badge, footer, currentIndex, transferNames, embedded = false, compact = false }: RouteMapProps) {
  const [expanded, setExpanded] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeBounds = useMemo<LatLngBoundsExpression>(
    () =>
      (segments?.length ? segments.flatMap((segment) => segment.points) : stations).map(
        (point) => [point.lat, point.lng] as [number, number],
      ),
    [segments, stations],
  );

  const fitRoute = () => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(routeBounds, { padding: [34, 34], maxZoom: 16 });
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(routeBounds, { padding: [34, 34], maxZoom: 16 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expanded, routeBounds]);

  if (!segments?.length && stations.length < 2) return null;

  return (
    <div className={expanded ? "relative" : embedded ? "relative" : "glass-panel relative rounded-3xl p-4"}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand-deep">{title}</h2>
        {badge && (
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <span className="status-pulse size-2 rounded-full bg-primary" /> {badge}
          </span>
        )}
      </div>

      {expanded && (
        <Button
          type="button"
          variant="ghost"
          aria-label="Fullscreen map backdrop"
          className="fixed inset-0 z-40 h-auto w-auto cursor-default rounded-none bg-brand-deep/40 p-0 backdrop-blur-sm hover:bg-brand-deep/40"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={`wayline-map overflow-hidden bg-secondary/50 ${
          expanded
            ? "fixed left-1/2 top-1/2 z-50 h-[85vh] w-screen -translate-x-1/2 -translate-y-1/2 rounded-none md:h-[80vh] md:w-[90vw] md:rounded-3xl"
            : compact
              ? "relative z-0 mt-3 h-[220px] rounded-xl md:h-[260px]"
              : "relative z-0 mt-3 h-[320px] rounded-2xl md:h-[420px]"
        }`}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded ? "true" : undefined}
        aria-label={expanded ? "Expanded route map" : undefined}
      >
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <RouteLeafletMap mapRef={mapRef} stations={stations} segments={segments} currentIndex={currentIndex} transferNames={transferNames} />
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

      {footer && <p className="mt-3 text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}
