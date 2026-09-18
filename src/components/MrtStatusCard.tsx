import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, RefreshCw, TrainFront } from "lucide-react";

import { getTrainAlerts } from "../lib/singapore.functions";

export function MrtStatusCard() {
  const fetchAlerts = useServerFn(getTrainAlerts);
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["train-alerts"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 60_000,
  });

  const status = data?.status ?? "unknown";
  const disrupted = status === "disrupted";

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <TrainFront className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-base font-semibold text-brand-deep">MRT status</h2>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Refresh MRT status"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data && !data.configured ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Waiting for the LTA DataMall account key before live train alerts can be shown.
        </p>
      ) : isError ? (
        <p className="mt-4 text-sm text-warning">Couldn’t reach the train service right now.</p>
      ) : (
        <div className="mt-4">
          <div
            className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl p-3 ${
              disrupted ? "bg-warning-soft" : "bg-success-soft"
            }`}
          >
            <div
              className={`grid size-9 place-items-center rounded-xl text-primary-foreground ${
                disrupted ? "bg-warning" : "bg-success"
              }`}
            >
              {disrupted ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
            </div>
            <p className="min-w-0 text-sm font-semibold text-brand-deep">
              {disrupted
                ? `Disruption on ${data?.line ?? "the network"}${data?.stations ? ` · ${data.stations}` : ""}`
                : "All lines running normally."}
            </p>
          </div>
          {data?.message && (
            <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{data.message}</p>
          )}
        </div>
      )}
    </section>
  );
}
