import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CloudRain, Crosshair, RefreshCw, Sun, Umbrella } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getWeather } from "../lib/singapore.functions";

const WET = /rain|shower|thunder/i;

export function WeatherCard({
  defaultArea = "Tampines",
  origin,
}: {
  defaultArea?: string;
  /** Start of the active trip — weather follows it instead of the device location. */
  origin?: { lat: number; lng: number; label: string } | null | undefined;
}) {
  const [area, setArea] = useState(defaultArea);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const userPicked = useRef(false);
  const fetchWeather = useServerFn(getWeather);


  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["weather-2h"],
    queryFn: () => fetchWeather(),
    refetchInterval: 10 * 60_000,
  });

  function locate(manual = false) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (manual) setLocationNote("Location isn’t available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPicked.current = false;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationNote("Location off — showing " + area + ". You can type another area.");
      },
      { timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefer the active trip's start; otherwise the nearest forecast area to the device.
  useEffect(() => {
    const point = origin ? { lat: origin.lat, lng: origin.lng } : coords;
    if (!point || !data?.areas.length || userPicked.current) return;
    let best = data.areas[0]!;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const a of data.areas) {
      const d = (a.lat - point.lat) ** 2 + (a.lng - point.lng) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    setArea(best.name);
    setLocationNote(origin ? `Nearest area to your trip start (${origin.label}): ${best.name}` : "Nearest area to you: " + best.name);
  }, [coords, data, origin]);


  const match = data?.areas.find((a) => a.name.toLowerCase() === area.trim().toLowerCase());
  const selected = match ?? data?.areas[0];
  const wet = selected ? WET.test(selected.forecast) : false;

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Umbrella className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-base font-semibold text-brand-deep">Weather · next 2 hours</h2>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Refresh weather"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isError ? (
        <p className="mt-4 text-sm text-warning">Couldn’t reach the weather service right now.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2">
            <input
              value={area}
              onChange={(e) => {
                userPicked.current = true;
                setArea(e.target.value);
                setLocationNote(null);
              }}
              list="weather-areas"
              placeholder="Type an area, e.g. Tampines"
              aria-label="Weather area"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-brand-deep outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <datalist id="weather-areas">
              {(data?.areas ?? []).map((a) => (
                <option key={a.name} value={a.name} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => locate(true)}
              aria-label="Use my location"
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-border text-primary hover:bg-secondary"
            >
              <Crosshair className={`size-4 ${locating ? "animate-pulse" : ""}`} />
            </button>
          </div>

          {locationNote ? <p className="mt-2 text-xs text-muted-foreground">{locationNote}</p> : null}
          {area.trim() && !match && data?.areas.length ? (
            <p className="mt-2 text-xs text-warning">
              No forecast area matches “{area}” — showing {selected?.name}.
            </p>
          ) : null}


          <div
            className={`mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl p-3 ${
              wet ? "bg-primary/10" : "bg-success-soft"
            }`}
          >
            <div
              className={`grid size-9 place-items-center rounded-xl text-primary-foreground ${
                wet ? "bg-primary" : "bg-success"
              }`}
            >
              {wet ? <CloudRain className="size-4" /> : <Sun className="size-4" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-deep">{selected?.forecast ?? "Loading…"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {wet ? "Take an umbrella for the walk." : "Dry for the walk to the station."}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
