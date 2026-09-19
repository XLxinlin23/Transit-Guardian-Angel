import { AlertTriangle, CheckCircle2, ChevronDown, ShieldAlert, TrainFront } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { DisruptionWatch } from "@/lib/use-disruption";
import { PREFERENCE_LABELS, type RoutePreference } from "@/lib/commute-settings";
import type { Journey } from "@/lib/journey.functions";

export function JourneyStatusCard({
  watch,
  maxDelay,
  onUseAlternative,
}: {
  watch: DisruptionWatch;
  maxDelay: string;
  onUseAlternative: (journey: Journey) => void;
}) {
  const [keptCurrent, setKeptCurrent] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { assessment, incident, demo, setDemo, demoAvailable } = watch;
  if (!assessment) return null;


  const good = assessment.level === "none";
  const severe = assessment.level === "exceeds" || assessment.level === "impossible";
  const tone = good
    ? "border-success/30 bg-success-soft"
    : severe
      ? "border-route-red/35 bg-route-red/10"
      : "border-route-orange/35 bg-warning-soft";

  return (
    <section className={`rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-brand-deep">
          {good ? <CheckCircle2 className="size-5 text-success" /> : <AlertTriangle className="size-5 text-route-red" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Journey status</p>
          <p className="mt-1 text-sm font-bold text-brand-deep">{assessment.headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{assessment.detail}</p>
          {incident?.source === "demo" && (
            <p className="mt-2 inline-block rounded-full bg-route-orange/20 px-2 py-0.5 text-[11px] font-bold text-route-orange">
              Demo incident — simulated data
            </p>
          )}
        </div>
      </div>

      {assessment.affected && (
        <>
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-brand-deep"
          >
            View disruption details
            <ChevronDown className={`size-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
          {detailsOpen && incident && (
            <dl className="mt-2 grid gap-1.5 rounded-xl border border-border bg-card p-3 text-xs">
              <Row label="Affected line" value={incident.line || "—"} icon />
              <Row label="Affected stations" value={incident.stations.join(", ") || "Line-wide"} />
              <Row label="Original arrival" value={assessment.originalArrival} />
              <Row label="New predicted arrival" value={assessment.predictedArrival} />
              <Row label="Maximum delay limit" value={`${Number(maxDelay) || 0} min (latest ${assessment.latestAcceptable})`} />
              <Row
                label="Recommended action"
                value={
                  assessment.level === "exceeds"
                    ? `Switch to the alternative arriving ${assessment.alternative?.arrival}`
                    : assessment.level === "impossible"
                      ? "Leave earlier — no route meets your limit"
                      : "Keep your current route"
                }
              />
            </dl>
          )}
        </>
      )}

      {severe && assessment.alternative && !keptCurrent && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            className="h-11 rounded-xl text-sm font-bold"
            onClick={() => onUseAlternative(assessment.alternative!.journey)}
          >
            Use alternative route
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-xl border-primary text-sm font-bold text-primary"
            onClick={() => setKeptCurrent(true)}
          >
            Keep current route
          </Button>
        </div>
      )}
      {severe && assessment.alternative && keptCurrent && (
        <p className="mt-3 text-xs font-semibold text-foreground">
          Keeping your current route. Alternative arriving {assessment.alternative.arrival} is still available.{" "}
          <button type="button" className="underline" onClick={() => setKeptCurrent(false)}>
            Show options
          </button>
        </p>
      )}
      {assessment.alternative?.preference && severe && (
        <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
          Alternative avoids the disrupted segment · {PREFERENCE_LABELS[assessment.alternative.preference as RoutePreference] ?? assessment.alternative.preference}
        </p>
      )}

      {demoAvailable && (
        <Label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-route-orange/50 bg-card px-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldAlert className="size-4 text-route-orange" /> Demo incident (simulated Circle Line disruption)
          </span>
          <Switch checked={demo} onCheckedChange={setDemo} aria-label="Demo incident" />
        </Label>
      )}
    </section>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon && <TrainFront className="size-3.5" />}
        {label}
      </dt>
      <dd className="text-right font-semibold text-brand-deep">{value}</dd>
    </div>
  );
}
