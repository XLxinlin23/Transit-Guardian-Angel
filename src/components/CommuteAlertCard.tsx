import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BellRing, Bus, CheckCircle2, CloudRain, RefreshCw, Route, Users } from "lucide-react";

import { getCommuteBriefing } from "@/lib/commute.functions";
import type { PlacePoint, RouteAlarm, RoutePreference } from "@/lib/commute-settings";

export function CommuteAlertCard({
  alarm,
  preferences,
  fromPlace,
  toPlace,
}: {
  alarm: RouteAlarm;
  preferences: RoutePreference[];
  fromPlace?: PlacePoint | null;
  toPlace?: PlacePoint | null;
}) {
  const fetchBriefing = useServerFn(getCommuteBriefing);
  const payload = {
    from: alarm.from,
    to: alarm.to,
    fromLat: fromPlace?.lat ?? null,
    fromLng: fromPlace?.lng ?? null,
    toLat: toPlace?.lat ?? null,
    toLng: toPlace?.lng ?? null,
    arriveBy: alarm.arriveBy,
    maxDelay: Number(alarm.maxDelay) || 0,
    preferences,
    notifyLeadMinutes: Number(alarm.notifyLeadMinutes) || 0,
    notifyWeather: alarm.notifyWeather,
    notifyCrowd: alarm.notifyCrowd,
    notifyBus: alarm.notifyBus,
    busStopCode: alarm.notifyBus && alarm.busStopCode ? alarm.busStopCode : null,
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["commute-briefing", payload],
    queryFn: () => fetchBriefing({ data: payload }),
    refetchInterval: 60_000,
  });

  const severity = data?.severity ?? "calm";
  const tone =
    severity === "act"
      ? "border-warning/30 bg-warning-soft/70"
      : severity === "watch"
        ? "border-primary/25 bg-primary/5"
        : "border-success/25 bg-success-soft/60";
  const Icon = severity === "act" ? AlertTriangle : severity === "watch" ? BellRing : CheckCircle2;

  return (
    <section className={`mt-5 rounded-3xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-deep text-primary-foreground">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today&apos;s commute alert</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-brand-deep">
            {data ? data.headline : "Checking trains, weather and crowding…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="Refresh commute alert"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background/70"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data && (
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <Line icon={Route} text={data.routeSummary} />
          <Line icon={AlertTriangle} text={data.disruption} />
          <Line icon={Route} text={data.alternative} />
          <Line icon={CloudRain} text={data.weather} />
          <Line icon={Users} text={data.crowd} />
          <Line icon={Bus} text={data.bus} />
        </ul>
      )}

      {data && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Travel time now {data.travelMinutes} min (usual {data.baselineMinutes} min) · reminder {alarm.notifyLeadMinutes} min before you leave
        </p>
      )}
    </section>
  );
}

function Line({ icon: Icon, text }: { icon: typeof Route; text: string | null }) {
  if (!text) return null;
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span className="min-w-0">{text}</span>
    </li>
  );
}
