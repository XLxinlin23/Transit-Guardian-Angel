import type { RepeatOption, RouteAlarm } from "./commute-settings";

/** Everything time-related is judged in Singapore time, whatever the device is set to. */
export const SG_TIMEZONE = "Asia/Singapore";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

type Parts = { iso: string; minutes: number; weekday: string; weekdayIndex: number };

/** Wall-clock pieces of an instant in Singapore. */
export function sgParts(instant: Date = new Date()): Parts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) map[part.type] = part.value;
  const hour = Number(map["hour"] === "24" ? "0" : map["hour"]);
  const minute = Number(map["minute"]);
  const weekday = (map["weekday"] ?? "Mon").slice(0, 3);
  return {
    iso: `${map["year"]}-${map["month"]}-${map["day"]}`,
    minutes: hour * 60 + minute,
    weekday,
    weekdayIndex: Math.max(0, WEEKDAY_SHORT.indexOf(weekday as (typeof WEEKDAY_SHORT)[number])),
  };
}

/** Today's date in Singapore, as yyyy-mm-dd. */
export function sgTodayISO(): string {
  return sgParts().iso;
}

/** Tomorrow's date in Singapore, as yyyy-mm-dd. */
export function sgTomorrowISO(): string {
  return sgParts(new Date(Date.now() + 86_400_000)).iso;
}

/** Minutes past midnight, right now, in Singapore. */
export function sgNowMinutes(): number {
  return sgParts().minutes;
}

/** Which calendar day the trip is planned for. */
export function journeyISO(alarm: Pick<RouteAlarm, "dateMode" | "date">): string {
  if (alarm.dateMode === "date" && alarm.date) return alarm.date;
  if (alarm.dateMode === "tomorrow") return sgTomorrowISO();
  return sgTodayISO();
}

/** Sortable "yyyy-mm-ddTHH:MM" stamp, so date + time compare as one value. */
export function stamp(iso: string, hhmm: string): string {
  return `${iso}T${(hhmm || "00:00").padStart(5, "0")}`;
}

/** True when the chosen journey date + reach-by time is already behind Singapore's clock. */
export function arrivalHasPassed(alarm: Pick<RouteAlarm, "dateMode" | "date" | "arriveBy">): boolean {
  if (!alarm.arriveBy) return false;
  const now = sgParts();
  return stamp(journeyISO(alarm), alarm.arriveBy) < stamp(now.iso, minutesToClock(now.minutes));
}

/** True when a departure clock time on the journey date is already in the past. */
export function departureHasPassed(
  alarm: Pick<RouteAlarm, "dateMode" | "date">,
  departure: string,
): boolean {
  if (!departure || departure === "--:--") return false;
  const now = sgParts();
  return stamp(journeyISO(alarm), departure) < stamp(now.iso, minutesToClock(now.minutes));
}

export function minutesToClock(total: number): string {
  const value = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Long, human date for a yyyy-mm-dd value — "Friday, 19 September". */
export function isoDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" });
}

/** The weekday short names a recurring alarm runs on; empty for one-off trips. */
export function activeDays(alarm: Pick<RouteAlarm, "repeat" | "days">): string[] {
  if (alarm.repeat === "daily") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (alarm.repeat === "weekdays") return ["Mon", "Tue", "Wed", "Thu", "Fri"];
  if (alarm.repeat === "weekends") return ["Sat", "Sun"];
  if (alarm.repeat === "custom") return alarm.days;
  return [];
}

export function isRecurring(repeat: RepeatOption): boolean {
  return repeat !== "once";
}

/** Plain description of when a recurring trip runs. */
export function recurrenceLabel(alarm: Pick<RouteAlarm, "repeat" | "days">): string {
  const days = activeDays(alarm);
  if (!days.length) return "No days selected";
  if (alarm.repeat === "daily") return "Runs every day";
  if (alarm.repeat === "weekdays") return "Runs Monday to Friday";
  if (alarm.repeat === "weekends") return "Runs Saturday and Sunday";
  return `Runs ${days.join(", ")}`;
}

/** Does this trip run today (Singapore time)? One-off trips run only on their journey date. */
export function runsToday(alarm: Pick<RouteAlarm, "repeat" | "days" | "dateMode" | "date">): boolean {
  const now = sgParts();
  if (!isRecurring(alarm.repeat)) return journeyISO(alarm) === now.iso;
  return activeDays(alarm).includes(now.weekday);
}

/** "Monday at 08:45" — the next day this trip runs after today. */
export function nextRunLabel(alarm: Pick<RouteAlarm, "repeat" | "days" | "dateMode" | "date" | "arriveBy">): string {
  const time = alarm.arriveBy || "--:--";
  if (!isRecurring(alarm.repeat)) {
    return `${isoDateLabel(journeyISO(alarm))} at ${time}`;
  }
  const days = activeDays(alarm);
  if (!days.length) return "no days selected";
  const today = sgParts().weekdayIndex;
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const index = (today + ahead) % 7;
    if (days.includes(WEEKDAY_SHORT[index]!)) {
      return `${WEEKDAY_LONG[index]} at ${time}`;
    }
  }
  return `today at ${time}`;
}
