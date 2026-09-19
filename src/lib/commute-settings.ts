export type RepeatOption = "once" | "daily" | "weekdays" | "weekends" | "custom" | "date";

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
  /** Door-to-door duration of the route saved with this alarm, in minutes. */
  durationMinutes?: number | null;
};

export const ALARMS_STORAGE_KEY = "wayline-route-alarms";

export function newAlarmId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Which day the trip is for: today, tomorrow, or a chosen calendar date. */
export type JourneyDateMode = "today" | "tomorrow" | "date";

export type RouteAlarm = {
  from: string;
  to: string;
  arriveBy: string;
  /** Journey date mode — today, tomorrow or a specific date. */
  dateMode: JourneyDateMode;
  /** ISO yyyy-mm-dd, used only when dateMode is "date". */
  date: string;
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

export function journeyDate(alarm: Pick<RouteAlarm, "dateMode" | "date">): Date {
  const now = new Date();
  if (alarm.dateMode === "tomorrow") return new Date(now.getTime() + 86_400_000);
  if (alarm.dateMode === "date" && alarm.date) {
    const parsed = new Date(`${alarm.date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return now;
}

export function journeyDateLabel(alarm: Pick<RouteAlarm, "dateMode" | "date">): string {
  const date = journeyDate(alarm);
  const formatted = date.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
  if (alarm.dateMode === "today") return `Today, ${formatted}`;
  if (alarm.dateMode === "tomorrow") return `Tomorrow, ${formatted}`;
  return formatted;
}

export type RoutePreference = "speed" | "cost" | "walking" | "sheltered" | "transfers" | "crowd" | "disruption";


export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DEFAULT_ALARM: RouteAlarm = {
  from: "Tampines",
  to: "Raffles Place",
  arriveBy: "08:45",
  dateMode: "today",
  date: "",

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
  daily: "Every day",
  weekdays: "Every weekday",
  weekends: "Every weekend",
  custom: "Custom days",
  date: "Select date",
};

export const PREFERENCE_LABELS: Record<RoutePreference, string> = {
  speed: "Fastest",
  cost: "Lowest cost",
  walking: "Least walking",
  sheltered: "Most sheltered",
  transfers: "Fewest transfers",
  crowd: "Lower crowding",
  disruption: "Disruption-safe",
};
