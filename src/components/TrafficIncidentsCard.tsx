import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CarFront, CheckCircle2, ChevronDown, RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getTrafficIncidents } from "@/lib/traffic.functions";

export function TrafficIncidentsCard({
  origin,
}: {
  /** Start of the active trip — incidents are ranked around it instead of the device location. */
  origin?: { lat: number; lng: number; label: string } | null | undefined;
} = {}) {
  const fetchIncidents = useServerFn(getTrafficIncidents);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setHere({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  const anchor = origin ? { lat: origin.lat, lng: origin.lng } : here;
  const anchorNote = origin
    ? `Incidents near your trip start: ${origin.label}`
    : here
      ? "Incidents near your current location"
      : "Island-wide incidents — no trip or location set";

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["traffic-incidents", anchor?.lat ?? null, anchor?.lng ?? null],
    queryFn: () => fetchIncidents({ data: { lat: anchor?.lat ?? null, lng: anchor?.lng ?? null, radiusKm: 10 } }),
    refetchInterval: 120_000,
  });

  const incidents = data?.incidents ?? [];


  return (
    <section className="glass-panel overflow-hidden rounded-2xl border-t-2 border-t-warning p-5">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-1 hover:bg-transparent"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
            <CarFront className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate font-display text-base font-semibold text-brand-deep">Traffic incidents</span>
            {!open && (
              <span className="block truncate text-[11px] font-medium text-muted-foreground">
                {incidents.length ? `${incidents.length} nearby incident${incidents.length === 1 ? "" : "s"}` : "Tap to view road conditions"}
              </span>
            )}
          </span>
          <ChevronDown className={`size-4 shrink-0 text-warning transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
        {open && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            aria-label="Refresh traffic incidents"
            className="size-8 shrink-0 text-muted-foreground"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {open && <p className="mt-3 text-xs font-semibold text-muted-foreground">{anchorNote}</p>}



      {open && data && !data.configured ? (
        <p className="mt-4 text-sm text-muted-foreground">Waiting for live road incident data.</p>
      ) : open && isError ? (
        <p className="mt-4 text-sm text-warning">Couldn’t reach the road incident service right now.</p>
      ) : open && incidents.length === 0 ? (
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-success-soft p-3">
          <div className="grid size-9 place-items-center rounded-xl bg-success text-primary-foreground">
            <CheckCircle2 className="size-4" />
          </div>
          <p className="min-w-0 text-sm font-semibold text-brand-deep">
            No road incidents {here ? "within 10 km of you" : "reported"}.
          </p>
        </div>
      ) : open ? (
        <ul className="mt-4 space-y-2">
          {incidents.map((incident, index) => (
            <li
              key={`${incident.lat}-${incident.lng}-${index}`}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl bg-warning-soft p-3"
            >
              <div className="grid size-9 place-items-center rounded-xl bg-warning text-primary-foreground">
                <TriangleAlert className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="flex items-baseline gap-2 text-sm font-semibold text-brand-deep">
                  <span className="truncate">{incident.type}</span>
                  {typeof incident.distanceKm === "number" && (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {incident.distanceKm < 1
                        ? `${Math.round(incident.distanceKm * 1000)} m`
                        : `${incident.distanceKm.toFixed(1)} km`}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{incident.message}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
