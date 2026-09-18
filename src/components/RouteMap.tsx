import { ClientOnly } from "@tanstack/react-router";
import { Maximize2, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { CURRENT_STATION, STOPS_REMAINING } from "../lib/route-data";

const RouteLeafletMap = lazy(() => import("./RouteLeafletMap"));

function MapSkeleton() {
  return <div className="size-full animate-pulse bg-secondary/60" />;
}

export function RouteMap() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-panel relative overflow-hidden rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand-deep">Route map</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <span className="status-pulse size-2 rounded-full bg-primary" /> You are here
        </span>
      </div>

      <div className="wayline-map relative mt-3 h-56 overflow-hidden rounded-2xl bg-secondary/50">
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <RouteLeafletMap />
          </Suspense>
        </ClientOnly>

        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand route map"
          className="glass-control absolute right-2 top-2 z-[500] grid size-9 place-items-center rounded-xl text-brand-deep"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Near {CURRENT_STATION.name} · {STOPS_REMAINING} stops to Raffles Place
      </p>

      {expanded && (
        <div className="fixed inset-0 z-50 bg-brand-deep/40 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Route map">
          <div className="wayline-map relative size-full overflow-hidden rounded-3xl bg-background">
            <ClientOnly fallback={<MapSkeleton />}>
              <Suspense fallback={<MapSkeleton />}>
                <RouteLeafletMap interactive />
              </Suspense>
            </ClientOnly>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close route map"
              className="glass-control absolute right-3 top-3 z-[500] grid size-10 place-items-center rounded-xl text-brand-deep"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
