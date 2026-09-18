import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Crosshair, DoorOpen, TrainFront, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getStationDetail } from "../lib/mrt-nearby.functions";
import { LINE_NAMES, STATION_INDEX, type NetworkStation } from "../lib/mrt-network";

type Coords = { lat: number; lng: number };

const CROWD_LABEL: Record<string, string> = { l: "Not crowded", m: "Moderate", h: "Crowded" };

function metres(a: Coords, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function distanceLabel(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function NearbyMrtStationsCard() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NetworkStation | null>(null);
  const fetchDetail = useServerFn(getStationDetail);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("This device can’t share its location.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("Location is off — turn it on to see stations near you."),
      { timeout: 8000, maximumAge: 300_000 },
    );
  };

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearest = useMemo(() => {
    if (!coords) return [] as Array<NetworkStation & { distanceMetres: number }>;
    return [...STATION_INDEX.values()]
      .map((station) => ({ ...station, distanceMetres: metres(coords, station) }))
      .sort((a, b) => a.distanceMetres - b.distanceMetres)
      .slice(0, 5);
  }, [coords]);

  const { data: detail, isFetching: detailLoading } = useQuery({
    queryKey: ["station-detail", selected?.name],
    queryFn: () =>
      fetchDetail({
        data: { name: selected!.name, lat: selected!.lat, lng: selected!.lng, lines: selected!.lines },
      }),
    enabled: !!selected,
    refetchInterval: 60_000,
  });

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TrainFront className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-base font-semibold text-brand-deep">MRT stations near you</h2>
        </div>
        <button
          type="button"
          onClick={locate}
          aria-label="Use my location"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <Crosshair className="size-4" />
        </button>
      </div>

      {geoError && <p className="mt-3 text-sm text-muted-foreground">{geoError}</p>}
      {!geoError && !coords && <p className="mt-3 text-sm text-muted-foreground">Finding your location…</p>}

      {nearest.length ? (
        <ul className="mt-4 space-y-2">
          {nearest.map((station) => {
            const active = selected?.name === station.name;
            return (
              <li key={station.name}>
                <button
                  type="button"
                  onClick={() => setSelected(active ? null : station)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                    active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-deep">{station.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {station.lines.map((line) => LINE_NAMES[line] ?? line).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-brand-deep">
                    {distanceLabel(station.distanceMetres)}
                  </span>
                </button>

                {active && (
                  <div className="mt-2 space-y-2.5 rounded-2xl bg-secondary/60 p-3">
                    {detailLoading && !detail ? (
                      <p className="text-xs text-muted-foreground">Checking this station…</p>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          {detail?.affectsStation ? (
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                          ) : (
                            <Check className="mt-0.5 size-4 shrink-0 text-success" />
                          )}
                          <p className="text-xs leading-relaxed text-brand-deep">
                            {!detail?.configured
                              ? "Waiting for the LTA DataMall account key."
                              : detail.affectsStation
                                ? (detail.message ?? "Service disruption affecting this station.")
                                : "Trains running normally here."}
                          </p>
                        </div>

                        <div className="flex items-start gap-2">
                          <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                          <p className="text-xs leading-relaxed text-brand-deep">
                            {detail && Object.keys(detail.crowd).length
                              ? Object.entries(detail.crowd)
                                  .map(([line, level]) => `${LINE_NAMES[line] ?? line}: ${CROWD_LABEL[level] ?? level}`)
                                  .join(" · ")
                              : "Crowd level not available."}
                          </p>
                        </div>

                        <div className="flex items-start gap-2">
                          <DoorOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                          <p className="text-xs leading-relaxed text-brand-deep">
                            {detail?.exits.length
                              ? detail.exits
                                  .map((exit) => `${exit.name} (${distanceLabel(exit.distanceMetres)})`)
                                  .join(" · ")
                              : "No exit information for this station."}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
