import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Crosshair, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { getNearbyBusStops, type NearbyBusStop } from "../lib/bus-stops.functions";

type Coords = { lat: number; lng: number };

export function NearbyBusStopsCard({
  selectedCode,
  onSelect,
}: {
  selectedCode?: string | undefined;
  onSelect: (stop: NearbyBusStop) => void;
}) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const fetchNearby = useServerFn(getNearbyBusStops);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("This device can’t share its location.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("Location is off — turn it on to see stops near you."),
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["nearby-bus-stops", coords?.lat, coords?.lng],
    queryFn: () => fetchNearby({ data: { lat: coords!.lat, lng: coords!.lng, limit: 5 } }),
    enabled: !!coords,
    staleTime: 5 * 60_000,
  });

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-base font-semibold text-brand-deep">Bus stops near you</h2>
        </div>
        <button
          type="button"
          onClick={locate}
          aria-label="Use my location"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <Crosshair className={`size-4 ${isFetching ? "animate-pulse" : ""}`} />
        </button>
      </div>

      {geoError && <p className="mt-3 text-sm text-muted-foreground">{geoError}</p>}
      {!geoError && !coords && <p className="mt-3 text-sm text-muted-foreground">Finding your location…</p>}
      {data && !data.configured && (
        <p className="mt-3 text-sm text-muted-foreground">Waiting for the LTA DataMall account key.</p>
      )}
      {isError && <p className="mt-3 text-sm text-warning">Couldn’t load nearby stops right now.</p>}

      {data?.stops.length ? (
        <ul className="mt-4 space-y-2">
          {data.stops.map((stop) => {
            const active = stop.code === selectedCode;
            return (
              <li key={stop.code}>
                <button
                  type="button"
                  onClick={() => onSelect(stop)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                    active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-deep">{stop.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {stop.road} · Stop {stop.code}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-brand-deep">
                    {stop.distanceMetres < 1000
                      ? `${stop.distanceMetres} m`
                      : `${(stop.distanceMetres / 1000).toFixed(1)} km`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
