import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BellRing, Check, ChevronRight, Home, RouteIcon, Settings2, SlidersHorizontal, TrainFront } from "lucide-react";
import { useState } from "react";
import rachelAvatar from "../assets/rachel-avatar.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Morning commute — Wayline" },
      { name: "description", content: "Rachel's quiet EWL commute monitor from Tampines to Raffles Place." },
      { property: "og:title", content: "Morning commute — Wayline" },
      { property: "og:description", content: "Actionable disruption alerts for Rachel's fixed weekday commute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Tab = "home" | "preference" | "alerts";

function Index() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -right-40 top-1/3 size-96 rounded-full bg-success/10 blur-3xl" />
      </div>

      <main className="relative mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand font-display text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20">WL</div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-base font-semibold text-brand-deep">Wayline</p>
              <p className="truncate text-xs text-muted-foreground">EWL · Weekday · 07:40</p>
            </div>
          </div>
          <img src={rachelAvatar} alt="Rachel" width={512} height={512} className="size-11 shrink-0 rounded-xl object-cover ring-2 ring-surface-strong shadow-sm" />
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
  return (
    <div>
      <section className="glass-panel mt-5 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">On time</p>
          <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            <span className="status-pulse size-2 rounded-full bg-success" /> Live
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <p className="font-display text-4xl font-bold text-brand-deep">08:41</p>
            <p className="mt-1 text-sm text-muted-foreground">At your desk, Raffles Place</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold text-success">4 min</p>
            <p className="text-xs text-muted-foreground">to spare</p>
          </div>
        </div>
        <div className="mt-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs font-medium text-muted-foreground">
            <span className="truncate">Tampines · 07:40</span><span>Desk · 08:45</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-[58%] rounded-full bg-primary" />
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs text-muted-foreground">
            <span className="truncate">Now · Bedok</span><span>Next · Kembangan</span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-success/20 bg-success-soft/70 p-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-success text-primary-foreground"><Check className="size-4" /></div>
          <p className="min-w-0 text-sm font-semibold text-brand-deep">No action needed — your commute is within 5 minutes.</p>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-base font-semibold text-brand-deep">Live journey</h2>
          <span className="text-xs text-muted-foreground">East–West Line</span>
        </div>
        <div className="glass-panel mt-3 rounded-2xl p-4">
          <JourneyItem icon={Check} title="Tampines" detail="Boarded · Platform 2" time="07:40" state="done" />
          <JourneyItem icon={TrainFront} title="Bedok" detail="Running normally" time="Now" state="now" />
          <JourneyItem icon={RouteIcon} title="Raffles Place" detail="Exit B · 8 min walk" time="08:33" state="next" last />
        </div>
      </section>

      <section className="glass-panel mt-4 rounded-2xl p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-deep">Quiet monitoring</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">We alert only when your desk arrival slips by 15 minutes.</p>
          </div>
          <div className="rounded-xl bg-primary/10 px-3 py-2 font-display text-sm font-semibold text-primary">15m</div>
        </div>
      </section>
    </div>
  );
}

function PreferenceView() {
  return (
    <div className="pt-8">
      <p className="text-xs font-semibold uppercase text-primary">Fixed schedule</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Your commute</h1>
      <p className="mt-2 text-sm text-muted-foreground">The same weekday trip, protected without daily check-ins.</p>
      <section className="glass-panel mt-6 rounded-3xl p-5">
        <PreferenceRow label="Origin" value="Tampines" />
        <PreferenceRow label="Destination" value="Raffles Place" />
        <PreferenceRow label="Line" value="East–West Line" />
        <PreferenceRow label="Leave by" value="07:40" />
        <PreferenceRow label="At desk by" value="08:45" last />
      </section>
      <section className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div><p className="text-sm font-semibold text-brand-deep">Alert threshold</p><p className="mt-1 text-sm text-muted-foreground">Interrupt me at 15 minutes. Ignore normal variation.</p></div>
        </div>
      </section>
    </div>
  );
}

function AlertsView() {
  return (
    <div className="pt-8">
      <p className="text-xs font-semibold uppercase text-success">Monitoring active</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-deep">Disruption alert</h1>
      <p className="mt-2 text-sm text-muted-foreground">One line, only when the morning plan is at risk.</p>
      <section className="glass-panel mt-6 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-semibold text-success"><span className="status-pulse size-2 rounded-full bg-success" />Clear</span><span className="text-xs text-muted-foreground">Checked now</span></div>
        <p className="mt-5 font-display text-xl font-semibold leading-snug text-brand-deep">No disruption will affect your 08:45 arrival.</p>
      </section>
      <section className="mt-4 rounded-2xl border border-warning/20 bg-warning-soft p-4">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" /><div><p className="text-sm font-semibold text-brand-deep">When it matters</p><p className="mt-1 text-sm text-muted-foreground">“Leave now via DTL — EWL delay puts arrival at 09:02.”</p></div></div>
      </section>
      <div className="mt-6 space-y-3">
        <p className="px-1 text-xs font-semibold uppercase text-muted-foreground">Recent checks</p>
        {['Today · 07:25','Yesterday · 07:25','Monday · 07:25'].map((time) => <div key={time} className="glass-control flex items-center justify-between rounded-2xl px-4 py-3"><span className="text-sm text-brand-deep">{time}</span><span className="text-xs font-semibold text-success">No impact</span></div>)}
      </div>
    </div>
  );
}

function JourneyItem({ icon: Icon, title, detail, time, state, last = false }: { icon: typeof Check; title: string; detail: string; time: string; state: "done" | "now" | "next"; last?: boolean }) {
  const active = state === "now";
  return <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3"><div className="flex flex-col items-center"><div className={`grid size-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-primary text-primary-foreground' : state === 'done' ? 'bg-success-soft text-success' : 'bg-secondary text-muted-foreground'}`}><Icon className="size-4" /></div>{!last && <div className="my-1 min-h-5 w-px flex-1 bg-border" />}</div><div className="min-w-0 pb-5"><p className="truncate text-sm font-semibold text-brand-deep">{title}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div><span className={`pt-2 text-xs font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>{time}</span></div>;
}

function PreferenceRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 ${last ? '' : 'border-b border-border/70'}`}><span className="text-sm text-muted-foreground">{label}</span><span className="flex items-center gap-1 text-right text-sm font-semibold text-brand-deep">{value}<ChevronRight className="size-4 text-muted-foreground" /></span></div>;
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Home; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}><Icon className="size-5 shrink-0" /><span className="max-w-full truncate text-[11px] font-semibold">{label}</span></button>;
}
