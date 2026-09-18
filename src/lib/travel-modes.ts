export const MODE_COLORS = {
  walk: "#64748B",
  bus: "#18A875",
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
