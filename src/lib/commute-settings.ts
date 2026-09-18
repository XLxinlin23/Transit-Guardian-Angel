export type RepeatOption = "once" | "weekdays" | "weekends" | "custom";

export type RouteAlarm = {
  from: string;
  to: string;
  arriveBy: string;
  maxDelay: string;
  repeat: RepeatOption;
  days: string[];
  active: boolean;
};

export type RoutePreference = "speed" | "cost" | "walking" | "sheltered" | "transfers" | "crowd";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DEFAULT_ALARM: RouteAlarm = {
  from: "Tampines",
  to: "Raffles Place",
  arriveBy: "08:45",
  maxDelay: "15",
  repeat: "weekdays",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  active: false,
};

export const DEFAULT_PREFERENCES: RoutePreference[] = ["speed"];

export const ALARM_STORAGE_KEY = "wayline-route-alarm";
export const PREFERENCE_STORAGE_KEY = "wayline-route-preferences";

export const REPEAT_LABELS: Record<RepeatOption, string> = {
  once: "Once",
  weekdays: "Every weekday",
  weekends: "Every weekend",
  custom: "Custom days",
};

export const PREFERENCE_LABELS: Record<RoutePreference, string> = {
  speed: "Fastest",
  cost: "Lowest cost",
  walking: "Least walking",
  sheltered: "Most sheltered",
  transfers: "Fewest transfers",
  crowd: "Lower crowding",
};
