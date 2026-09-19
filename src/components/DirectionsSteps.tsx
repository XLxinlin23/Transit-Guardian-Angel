import { Bus, Footprints, TrainFront } from "lucide-react";

import type { DirectionsStep } from "@/lib/directions.functions";
import { legColor, legLabel } from "@/lib/travel-modes";

export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

function StepIcon({ mode }: { mode: DirectionsStep["mode"] }) {
  if (mode === "walk") return <Footprints className="size-4" />;
  if (mode === "bus") return <Bus className="size-4" />;
  return <TrainFront className="size-4" />;
}

/** Google-accurate step-by-step directions, colour-coded by transport mode. */
export function DirectionsStepList({ steps }: { steps: DirectionsStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const color = legColor(step.mode, step.badge);
        return (
          <li key={`${step.instruction}-${index}`} className="flex gap-3">
            <span
              className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-white"
              style={{ backgroundColor: color }}
              aria-hidden
            >
              <StepIcon mode={step.mode} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-deep">
                <span style={{ color }}>{legLabel(step.mode, step.badge)}</span>
                {step.mode !== "walk" && step.from && step.to ? ` · ${step.from} → ${step.to}` : ""}
              </p>
              <p className="whitespace-pre-line text-xs text-muted-foreground">
                {step.mode === "walk" ? step.instruction : step.lineName ?? step.instruction}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {step.minutes} min · {formatDistance(step.distanceMetres)}
                {step.stops ? ` · ${step.stops} stop${step.stops === 1 ? "" : "s"}` : ""}
                {step.headsign ? ` · towards ${step.headsign}` : ""}
                {step.departureText ? ` · departs ${step.departureText}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
