import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Crosshair, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getNearbyBusStops, type NearbyBusStop } from "../lib/bus-stops.functions";

type Coords = { lat: number; lng: number };

export function NearbyBusStopsCard({
  selectedCode,
  onSelect,
  origin,
}: {
  selectedCode?: string | undefined;
  onSelect: (stop: NearbyBusStop) => void;
  /** Start of the active trip — stops are shown around it instead of the device location. */
  origin?: { lat: number; lng: number; label: string } | null | undefined;
}) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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

  const anchor: Coords | null = origin ? { lat: origin.lat, lng: origin.lng } : coords;
  const anchorNote = origin ? `Stops near your trip start: ${origin.label}` : coords ? "Stops near your current location" : null;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["nearby-bus-stops", anchor?.lat, anchor?.lng],
    queryFn: () => fetchNearby({ data: { lat: anchor!.lat, lng: anchor!.lng, limit: 5 } }),
    enabled: !!anchor,
    staleTime: 5 * 60_000,
  });


  return (
    <section className="glass-panel overflow-hidden rounded-2xl border-t-2 border-t-success p-5">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-1 hover:bg-transparent"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success-soft text-success"><MapPin className="size-4" /></span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate font-display text-base font-semibold text-brand-deep">Bus stops near you</span>
            {!open && <span className="block truncate text-[11px] font-medium text-muted-foreground">{data?.stops.length ? `${data.stops.length} nearby stops` : "Tap to view nearby stops"}</span>}
          </span>
          <ChevronDown className={`size-4 shrink-0 text-success transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
        {open && <Button type="button" variant="ghost" size="icon" onClick={locate} aria-label="Use my location" className="size-8 shrink-0 text-success"><Crosshair className={`size-4 ${isFetching ? "animate-pulse" : ""}`} /></Button>}
      </div>

      {open && geoError && <p className="mt-3 text-sm text-muted-foreground">{geoError}</p>}
      {open && !geoError && !coords && <p className="mt-3 text-sm text-muted-foreground">Finding your location…</p>}
      {open && data && !data.configured && (
        <p className="mt-3 text-sm text-muted-foreground">Waiting for the LTA DataMall account key.</p>
      )}
      {open && isError && <p className="mt-3 text-sm text-warning">Couldn’t load nearby stops right now.</p>}

      {open && data?.stops.length ? (
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
