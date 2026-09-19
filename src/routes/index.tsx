import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Bus, Home, Settings, SlidersHorizontal } from "lucide-react";
import { SettingsSheet } from "../components/SettingsSheet";
import { ThemeProvider } from "../lib/theme";
import { useEffect, useState } from "react";
import { BusArrivalCard } from "../components/BusArrivalCard";
import { MrtStatusCard } from "../components/MrtStatusCard";
import { NearbyMrtStationsCard } from "../components/NearbyMrtStationsCard";
import { RouteAlarmForm } from "../components/RouteAlarmForm";
import { RoutePreferencePanel } from "../components/RoutePreferencePanel";
import { NearbyBusStopsCard } from "../components/NearbyBusStopsCard";
import { WeatherCard } from "../components/WeatherCard";
import { TripProvider } from "../lib/trip-store";

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

type Tab = "home" | "preference" | "arrivals" | "alerts";

function Index() {
  return (
    <ThemeProvider>
      <TripProvider>
        <IndexShell />
      </TripProvider>
    </ThemeProvider>
  );
}

function IndexShell() {
  const [tab, setTab] = useState<Tab>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <main className="relative mx-auto min-h-screen w-full max-w-[1050px] px-4 pb-[120px] pt-5">
        <header className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">WL</div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-base font-bold text-brand-deep">Wayline</p>
            <p className="truncate text-xs text-muted-foreground">Plan your trip, compare routes, and get disruption alerts.</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className="ml-auto grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary transition-colors hover:bg-secondary"
          >
            <Settings className="size-5" />
          </button>
        </header>

        <SettingsSheet
          open={settingsOpen}
          active={tab}
          onSelect={(key) => setTab(key)}
          onClose={() => setSettingsOpen(false)}
        />

        {tab === "home" && <RouteAlarmForm onSeeMoreRoutes={() => setTab("preference")} />}
        {tab === "preference" && <RoutePreferencePanel />}
        {tab === "arrivals" && <ArrivalsView />}
        {tab === "alerts" && <AlertsView />}
      </main>

      <nav className="glass-control fixed inset-x-4 bottom-4 z-20 mx-auto grid max-w-[440px] grid-cols-4 rounded-2xl p-1.5" aria-label="Primary navigation">
        <NavButton active={tab === "home"} icon={Home} label="Home" onClick={() => setTab("home")} />
        <NavButton active={tab === "preference"} icon={SlidersHorizontal} label="Preferences" onClick={() => setTab("preference")} />
        <NavButton active={tab === "arrivals"} icon={Bus} label="Arrivals" onClick={() => setTab("arrivals")} />
        <NavButton active={tab === "alerts"} icon={BellRing} label="Alerts" onClick={() => setTab("alerts")} />
      </nav>
    </div>
  );
}




function AlertsView() {
  return (
    <div className="pt-6">
      <p className="text-xs font-semibold uppercase text-success">Monitoring active</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Disruption alert</h1>
      <p className="mt-2 text-sm text-muted-foreground">Live checks for your route alarm — one line, only when it matters.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:items-start">
        <MrtStatusCard />
        <WeatherCard />
      </div>


      <p className="mt-5 text-center text-[11px] text-muted-foreground">
        Train and bus data © LTA DataMall · Weather © data.gov.sg
      </p>
    </div>
  );
}

function ArrivalsView() {
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);

  return (
    <div className="pt-6">
      <p className="text-xs font-semibold uppercase text-primary">Live timings</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">MRT &amp; Bus arrival</h1>
      <p className="mt-2 text-sm text-muted-foreground">Stations and stops near you, tapped once for live details.</p>

      <div className="mt-5 space-y-3.5">
        <NearbyMrtStationsCard />
        <NearbyBusStopsCard
          selectedCode={selected?.code}
          onSelect={(stop) => setSelected({ code: stop.code, name: stop.name })}
        />
        <BusArrivalCard
          stopCode={selected?.code}
          stopName={selected?.name}
          onStopChange={(stop) => setSelected(stop)}
        />
      </div>

      <p className="mt-5 text-center text-[11px] text-muted-foreground">Train and bus data © LTA DataMall</p>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Home; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><Icon className="size-5 shrink-0" /><span className="max-w-full truncate text-[11px] font-semibold">{label}</span></button>;
}
