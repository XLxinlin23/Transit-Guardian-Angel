import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CarFront, CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";

import { getTrafficIncidents } from "@/lib/traffic.functions";

export function TrafficIncidentsCard() {
  const fetchIncidents = useServerFn(getTrafficIncidents);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setHere({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["traffic-incidents", here?.lat ?? null, here?.lng ?? null],
    queryFn: () => fetchIncidents({ data: { lat: here?.lat ?? null, lng: here?.lng ?? null, radiusKm: 10 } }),
    refetchInterval: 120_000,
  });

  const incidents = data?.incidents ?? [];

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CarFront className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-base font-semibold text-brand-deep">Traffic incidents</h2>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Refresh traffic incidents"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data && !data.configured ? (
        <p className="mt-4 text-sm text-muted-foreground">Waiting for live road incident data.</p>
      ) : isError ? (
        <p className="mt-4 text-sm text-warning">Couldn’t reach the road incident service right now.</p>
      ) : incidents.length === 0 ? (
        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-success-soft p-3">
          <div className="grid size-9 place-items-center rounded-xl bg-success text-primary-foreground">
            <CheckCircle2 className="size-4" />
          </div>
          <p className="min-w-0 text-sm font-semibold text-brand-deep">
            No road incidents {here ? "within 10 km of you" : "reported"}.
          </p>
        </div>
      ) : (
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
      )}
    </section>
  );
}
