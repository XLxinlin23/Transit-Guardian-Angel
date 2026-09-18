import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bus, RefreshCw } from "lucide-react";
import { useState } from "react";

import { getBusArrivals } from "../lib/singapore.functions";

const LOAD_LABEL: Record<string, string> = { SEA: "Seats", SDA: "Standing", LSD: "Full" };

export function BusArrivalCard({ defaultStop = "75009", compactServices = 6 }: { defaultStop?: string; compactServices?: number }) {
  const [stop, setStop] = useState(defaultStop);
  const [input, setInput] = useState(defaultStop);
  const [showAll, setShowAll] = useState(false);
  const fetchArrivals = useServerFn(getBusArrivals);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["bus-arrivals", stop],
    queryFn: () => fetchArrivals({ data: { busStopCode: stop } }),
    refetchInterval: 30_000,
  });

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

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim().length >= 3) setStop(input.trim());
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="numeric"
          aria-label="Bus stop code"
          placeholder="Bus stop code"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-brand-deep outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Check
        </button>
      </form>

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
