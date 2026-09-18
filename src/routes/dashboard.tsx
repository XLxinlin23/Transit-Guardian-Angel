import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BusArrivalCard } from "../components/BusArrivalCard";
import { MrtStatusCard } from "../components/MrtStatusCard";
import { RouteMap } from "../components/RouteMap";
import { WeatherCard } from "../components/WeatherCard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Smart Commuter Dashboard — Wayline" },
      {
        name: "description",
        content: "Live Singapore MRT alerts, bus arrivals, 2-hour weather and route map in one place.",
      },
      { property: "og:title", content: "Smart Commuter Dashboard — Wayline" },
      {
        property: "og:description",
        content: "Live Singapore MRT alerts, bus arrivals, 2-hour weather and route map in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -right-40 top-1/3 size-96 rounded-full bg-success/10 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-6">
        <header className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="glass-control grid size-10 shrink-0 place-items-center rounded-xl text-brand-deep"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-lg font-semibold text-brand-deep">Commuter dashboard</p>
            <p className="truncate text-xs text-muted-foreground">Singapore · live MRT, bus and weather</p>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <MrtStatusCard />
          <WeatherCard />
          <BusArrivalCard />
          <div className="md:row-span-1">
            <RouteMap />
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Train and bus data © LTA DataMall · Weather © data.gov.sg · Map © OpenStreetMap contributors
        </p>
      </main>
    </div>
  );
}
