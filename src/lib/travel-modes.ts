export const MODE_COLORS = {
  walk: "#64748B",
  bus: "#16A36D",
  mrt: "#1473E6",
  lrt: "#0B2A4A",
} as const;

export const MODE_LABELS = {
  walk: "Walk",
  bus: "Bus",
  mrt: "MRT",
  lrt: "LRT",
} as const;

export type TravelModeKey = keyof typeof MODE_COLORS;

/** Official Singapore rail line colours, keyed by line code. */
export const LINE_COLORS: Record<string, string> = {
  NS: "#D42E12",
  EW: "#009645",
  CG: "#009645",
  NE: "#9900AA",
  CC: "#FA9E0D",
  CE: "#FA9E0D",
  DT: "#005EC4",
  TE: "#9D5B25",
  BP: "#748477",
  SK: "#748477",
  PG: "#748477",
};

/** Colour for one journey leg: rail uses its official line colour, others the mode colour. */
export function legColor(mode: TravelModeKey, badge?: string): string {
  if (mode === "mrt" || mode === "lrt") {
    const code = (badge ?? "").trim().toUpperCase().slice(0, 2);
    return LINE_COLORS[code] ?? MODE_COLORS[mode];
  }
  return MODE_COLORS[mode];
}

/** Short text label for a leg badge, always paired with an icon. */
export function legLabel(mode: TravelModeKey, badge?: string): string {
  if (mode === "walk") return "Walk";
  if (mode === "bus") return `Bus ${badge ?? ""}`.trim();
  return (badge ?? MODE_LABELS[mode]).toUpperCase();
}
