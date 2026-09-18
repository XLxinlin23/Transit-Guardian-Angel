export type RepeatOption = "once" | "weekdays" | "weekends" | "custom";

/** A location the user confirmed from the suggestion list. */
export type PlacePoint = {
  name: string;
  address: string;
  postal: string | null;
  lat: number;
  lng: number;
};

/** One entry in the user's list of saved route alarms. */
export type SavedRouteAlarm = {
  id: string;
  alarm: RouteAlarm;
  fromPlace: PlacePoint | null;
  toPlace: PlacePoint | null;
};

export const ALARMS_STORAGE_KEY = "wayline-route-alarms";

export function newAlarmId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export type RouteAlarm = {
  from: string;
  to: string;
  arriveBy: string;
  maxDelay: string;
  repeat: RepeatOption;
  days: string[];
  active: boolean;
  notifyLeadMinutes: string;
  notifyWeather: boolean;
  notifyCrowd: boolean;
  notifyBus: boolean;
  busStopCode: string;
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
  notifyLeadMinutes: "20",
  notifyWeather: true,
  notifyCrowd: true,
  notifyBus: false,
  busStopCode: "",
};

export const DEFAULT_PREFERENCES: RoutePreference[] = ["speed"];

export const ALARM_STORAGE_KEY = "wayline-route-alarm";
export const PREFERENCE_STORAGE_KEY = "wayline-route-preferences";
export const DRAFT_STORAGE_KEY = "wayline-route-draft";

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
