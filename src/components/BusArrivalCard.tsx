import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { getBusArrivals } from "../lib/singapore.functions";
import { searchBusStops, type BusStop } from "../lib/bus-stops.functions";

const LOAD_LABEL: Record<string, string> = { SEA: "Seats", SDA: "Standing", LSD: "Full" };

export function BusArrivalCard({
  defaultStop = "75009",
  compactServices = 6,
  stopCode,
  stopName,
  onStopChange,
}: {
  defaultStop?: string;
  compactServices?: number;
  stopCode?: string | undefined;
  stopName?: string | undefined;
  onStopChange?: ((stop: { code: string; name: string }) => void) | undefined;
}) {
  const [internalStop, setInternalStop] = useState(defaultStop);
  const stop = stopCode ?? internalStop;
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showAll, setShowAll] = useState(false);
  const fetchArrivals = useServerFn(getBusArrivals);
  const findStops = useServerFn(searchBusStops);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: matches } = useQuery({
    queryKey: ["bus-stop-search", debounced],
    queryFn: () => findStops({ data: { query: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60_000,
  });

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["bus-arrivals", stop],
    queryFn: () => fetchArrivals({ data: { busStopCode: stop } }),
    refetchInterval: 30_000,
  });

  const select = (s: BusStop) => {
    setQuery("");
    setDebounced("");
    setShowAll(false);
    setInternalStop(s.code);
    onStopChange?.({ code: s.code, name: s.name });
  };

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bus className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-base font-semibold text-brand-deep">Bus arrivals</h2>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Refresh bus arrivals"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <p className="mt-2 truncate text-sm text-muted-foreground">
        {stopName ? `${stopName} · Stop ${stop}` : `Stop ${stop}`}
      </p>

      <div className="relative mt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search bus stop by name or code"
          placeholder="Search bus stop name or code"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-brand-deep outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        {debounced.length >= 2 && matches?.stops.length ? (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-background shadow-lg">
            {matches.stops.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => select(s)}
                  className="block w-full px-3 py-2 text-left hover:bg-secondary"
                >
                  <span className="block truncate text-sm font-semibold text-brand-deep">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.road} · Stop {s.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {data && !data.configured ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Waiting for the LTA DataMall account key before live bus timings can be shown.
        </p>
      ) : isError ? (
        <p className="mt-4 text-sm text-warning">Couldn’t reach the bus service right now.</p>
      ) : data && data.services.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No buses arriving at stop {data.busStopCode}.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/70">
          {(showAll ? data?.services ?? [] : (data?.services ?? []).slice(0, compactServices)).map((s) => (
            <li key={s.serviceNo} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-3">
              <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-display text-sm font-bold text-primary">
                {s.serviceNo}
              </span>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                {s.arrivals.length === 0 && <span className="text-xs text-muted-foreground">Not in service</span>}
                {s.arrivals.map((a, i) => (
                  <span
                    key={i}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                      i === 0 ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground"
                    }`}
                    title={LOAD_LABEL[a.load] ?? ""}
                  >
                    {a.minutes === null ? "—" : a.minutes <= 0 ? "Arr" : `${a.minutes} min`}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.services.length > compactServices && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 w-full rounded-xl bg-secondary py-2 text-xs font-semibold text-brand-deep"
        >
          {showAll ? "Show fewer services" : `Show all ${data.services.length} services`}
        </button>
      )}
    </section>
  );
}
