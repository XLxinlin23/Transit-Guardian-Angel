import { Bus, Footprints, TrainFront } from "lucide-react";

import { legColor, legLabel, MODE_LABELS, type TravelModeKey } from "@/lib/travel-modes";

export type JourneyStep = {
  mode: TravelModeKey;
  badge: string;
  from: string;
  to: string;
  detail: string;
  minutes: number;
};

function ModeIcon({ mode, className }: { mode: TravelModeKey; className?: string }) {
  const Icon = mode === "walk" ? Footprints : mode === "bus" ? Bus : TrainFront;
  return <Icon className={className ?? "size-3.5"} aria-hidden />;
}

/** Colour + icon + text badge for one leg; never colour alone. */
export function LegBadge({ mode, badge, size = "md" }: { mode: TravelModeKey; badge: string; size?: "sm" | "md" }) {
  const color = legColor(mode, badge);
  const label = legLabel(mode, badge);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold text-white ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"
      }`}
      style={{ backgroundColor: color }}
      title={`${MODE_LABELS[mode]} — ${label}`}
    >
      <ModeIcon mode={mode} className={size === "sm" ? "size-3" : "size-3.5"} />
      {label}
    </span>
  );
}

/** Legend showing only the modes and rail lines used by this route. */
export function RouteLegend({ legs }: { legs: JourneyStep[] }) {
  const seen = new Set<string>();
  const items = legs.filter((leg) => {
    const key = leg.mode === "walk" ? "walk" : `${leg.mode}:${leg.badge}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((leg, index) => (
        <LegBadge key={`${leg.mode}-${leg.badge}-${index}`} mode={leg.mode} badge={leg.badge} size="sm" />
      ))}
    </div>
  );
}

/** Distance text out of a leg detail such as "121 m on foot". */
function distanceText(detail: string): string | null {
  const match = /(\d[\d.,]*)\s*(m|km)\b/i.exec(detail || "");
  return match ? `${match[1]} ${match[2]!.toLowerCase()}` : null;
}

function sameStation(a: string, b: string): boolean {
  const clean = (value: string) => value.toLowerCase().replace(/\b(mrt|lrt|station|interchange)\b/g, "").trim();
  return Boolean(a && b && clean(a) === clean(b));
}

/** Full instruction for a step — walking legs get start, end, distance and time. */
function stepText(legs: JourneyStep[], index: number): { title: string; detail: string } {
  const leg = legs[index]!;
  const previous = legs[index - 1];
  const next = legs[index + 1];
  const distance = distanceText(leg.detail);
  const time = `${leg.minutes} min`;

  if (leg.mode !== "walk") {
    return {
      title: `${leg.from || "Board"} → ${leg.to || "Alight"}`,
      detail: [leg.detail, time].filter(Boolean).join(" · "),
    };
  }

  const start = leg.from || previous?.to || "your starting point";
  const end = leg.to || next?.from || "your destination";
  const transferInside = previous && next && sameStation(previous.to, next.from);
  const title = transferInside
    ? `Walk within ${previous!.to} to the ${next!.badge} ${next!.mode === "bus" ? "bus stop" : "platform"}`
    : `Walk from ${start} to ${end}`;

  return { title, detail: [distance, time].filter(Boolean).join(" · ") };
}

/** Vertical timeline of journey steps, colour-matched to the map. */
export function JourneyTimeline({ legs }: { legs: JourneyStep[] }) {
  return (
    <ol className="rounded-xl border border-border bg-card p-4">
      {legs.map((leg, index) => {
        const color = legColor(leg.mode, leg.badge);
        const last = index === legs.length - 1;
        const { title, detail } = stepText(legs, index);
        return (
          <li key={`${leg.badge}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className="absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5 rounded-full"
                style={{ backgroundColor: color, opacity: 0.35 }}
              />
            )}
            <span
              className="relative z-[1] mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              <ModeIcon mode={leg.mode} className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <LegBadge mode={leg.mode} badge={leg.badge} size="sm" />
                <span className="font-bold text-brand-deep">{title}</span>
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">{detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
