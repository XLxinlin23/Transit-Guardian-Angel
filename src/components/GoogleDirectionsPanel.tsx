import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bus, Footprints, Loader2, MapPin, Navigation, TrainFront } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteMap } from "@/components/RouteMap";
import { getGoogleDirections, type DirectionsStep } from "@/lib/directions.functions";
import { legColor, legLabel } from "@/lib/travel-modes";

type Mode = "WALK" | "TRANSIT";

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

function StepIcon({ step }: { step: DirectionsStep }) {
  if (step.mode === "walk") return <Footprints className="size-4" />;
  if (step.mode === "bus") return <Bus className="size-4" />;
  return <TrainFront className="size-4" />;
}

export function GoogleDirectionsPanel() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState<Mode>("TRANSIT");
  const findRoute = useServerFn(getGoogleDirections);

  const mutation = useMutation({
    mutationFn: (input: { origin: string; destination: string; mode: Mode }) => findRoute({ data: input }),
  });

  const result = mutation.data;
  const ready = origin.trim().length > 1 && destination.trim().length > 1;

  return (
    <div className="pt-6">
      <p className="text-xs font-semibold uppercase text-primary">Google Maps</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Directions</h1>
      <p className="mt-2 text-sm text-muted-foreground">Walking or public transport directions anywhere in Singapore.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <label className="text-xs font-semibold text-brand-deep" htmlFor="gd-origin">
            Start location
          </label>
          <Input
            id="gd-origin"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            placeholder="Where are you departing from"
            className="mt-1.5"
          />

          <label className="mt-4 block text-xs font-semibold text-brand-deep" htmlFor="gd-destination">
            Destination
          </label>
          <Input
            id="gd-destination"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            placeholder="Where are you going?"
            className="mt-1.5"
          />

          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Travel mode">
            {(
              [
                { key: "WALK", label: "Walking", icon: Footprints },
                { key: "TRANSIT", label: "Transit (Bus/MRT)", icon: Bus },
              ] as const
            ).map((option) => (
              <Button
                key={option.key}
                type="button"
                variant={mode === option.key ? "default" : "outline"}
                onClick={() => setMode(option.key)}
                aria-pressed={mode === option.key}
                className="h-11 gap-2 rounded-xl text-xs font-semibold"
              >
                <option.icon className="size-4" /> {option.label}
              </Button>
            ))}
          </div>

          <Button
            type="button"
            disabled={!ready || mutation.isPending}
            onClick={() => mutation.mutate({ origin: origin.trim(), destination: destination.trim(), mode })}
            className="mt-4 h-12 w-full gap-2 rounded-xl text-sm font-semibold"
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
            Find Route
          </Button>

          {mutation.isError && (
            <p className="mt-3 text-xs text-route-red">Could not reach Google Maps. Please try again.</p>
          )}
          {result?.message && <p className="mt-3 text-xs text-route-red">{result.message}</p>}
        </div>

        <div className="grid gap-4">
          {result && result.segments.length > 0 ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p className="font-display text-2xl font-bold text-brand-deep">{result.minutes} min</p>
                  <p className="text-sm font-semibold text-muted-foreground">{formatDistance(result.distanceMetres)}</p>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {result.mode === "WALK" ? "Walking" : "Transit"}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" /> {origin} → {destination}
                </p>

                <RouteMap
                  embedded
                  title="Route map"
                  stations={[result.origin, result.destination].filter(Boolean) as { name: string; lat: number; lng: number }[]}
                  segments={result.segments}
                  footer="Directions © Google · Base map © OpenStreetMap contributors"
                />
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <h2 className="font-display text-base font-semibold text-brand-deep">Step-by-step directions</h2>
                <ol className="mt-3 space-y-3">
                  {result.steps.map((step, index) => {
                    const color = legColor(step.mode, step.badge);
                    return (
                      <li key={`${step.instruction}-${index}`} className="flex gap-3">
                        <span
                          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-white"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        >
                          <StepIcon step={step} />
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
              </div>
            </>
          ) : (
            <div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Enter a start and destination, then tap Find Route to see the path on the map.
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-muted-foreground">Directions © Google</p>
    </div>
  );
}
