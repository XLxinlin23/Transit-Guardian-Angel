import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Home, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { BusArrivalCard } from "../components/BusArrivalCard";
import { MrtStatusCard } from "../components/MrtStatusCard";
import { RouteAlarmForm } from "../components/RouteAlarmForm";
import { RoutePreferencePanel } from "../components/RoutePreferencePanel";
import { WeatherCard } from "../components/WeatherCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Route alarms — Wayline" },
      { name: "description", content: "Set disruption-aware arrival alarms and personalised Singapore route preferences." },
      { property: "og:title", content: "Route alarms — Wayline" },
      { property: "og:description", content: "Set disruption-aware arrival alarms and personalised Singapore route preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Tab = "home" | "preference" | "alerts";

function Index() {
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -right-40 top-1/3 size-96 rounded-full bg-success/10 blur-3xl" />
      </div>

      <main className="relative mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
        <header className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand font-display text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">WL</div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-base font-semibold text-brand-deep">Wayline</p>
            <p className="truncate text-xs text-muted-foreground">Smart commute alarms</p>
          </div>
        </header>

        {tab === "home" && <HomeView />}
        {tab === "preference" && <PreferenceView />}
        {tab === "alerts" && <AlertsView />}
      </main>

      <nav className="glass-control fixed inset-x-4 bottom-4 z-20 mx-auto grid max-w-[408px] grid-cols-3 rounded-2xl p-1.5" aria-label="Primary navigation">
        <NavButton active={tab === "home"} icon={Home} label="Home" onClick={() => setTab("home")} />
        <NavButton active={tab === "preference"} icon={SlidersHorizontal} label="Preference" onClick={() => setTab("preference")} />
        <NavButton active={tab === "alerts"} icon={BellRing} label="Disruption Alert" onClick={() => setTab("alerts")} />
      </nav>
    </div>
  );
}

function HomeView() {
  return <RouteAlarmForm />;
}

function PreferenceView() {
  return <RoutePreferencePanel />;
}

function AlertsView() {
  return (
    <div className="pt-6">
      <p className="text-xs font-semibold uppercase text-success">Monitoring active</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Disruption alert</h1>
      <p className="mt-2 text-sm text-muted-foreground">Live checks for your route alarm — one line, only when it matters.</p>

      <div className="mt-5 space-y-3.5">
        <MrtStatusCard />
        <WeatherCard />
        <BusArrivalCard />
      </div>

      <p className="mt-5 text-center text-[11px] text-muted-foreground">
        Train and bus data © LTA DataMall · Weather © data.gov.sg
      </p>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Home; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}><Icon className="size-5 shrink-0" /><span className="max-w-full truncate text-[11px] font-semibold">{label}</span></button>;
}
