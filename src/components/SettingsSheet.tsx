import { BellRing, Bus, Check, Home, Monitor, Moon, Navigation, SlidersHorizontal, Sun, X } from "lucide-react";
import { useTheme, type ThemeMode } from "../lib/theme";

export type SubsystemKey = "home" | "preference" | "directions" | "arrivals" | "alerts";

const SUBSYSTEMS: { key: SubsystemKey; label: string; hint: string; icon: typeof Home; chip: string; chipActive: string }[] = [
  { key: "home", label: "Route alarms", hint: "Plan and save your trips", icon: Home, chip: "bg-primary/12 text-primary", chipActive: "bg-primary text-primary-foreground" },
  { key: "preference", label: "Route preference", hint: "Fastest, least walking, sheltered", icon: SlidersHorizontal, chip: "bg-success/12 text-success", chipActive: "bg-success text-primary-foreground" },
  { key: "arrivals", label: "MRT & Bus arrival", hint: "Live stations and stops near you", icon: Bus, chip: "bg-brand-deep/10 text-brand-deep", chipActive: "bg-brand-deep text-primary-foreground" },
  { key: "alerts", label: "Disruption alert", hint: "Service status and weather", icon: BellRing, chip: "bg-destructive/12 text-destructive", chipActive: "bg-destructive text-destructive-foreground" },
];

const THEMES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
];

export function SettingsSheet({
  open,
  active,
  onSelect,
  onClose,
}: {
  open: boolean;
  active: SubsystemKey;
  onSelect: (key: SubsystemKey) => void;
  onClose: () => void;
}) {
  const { mode, setMode } = useTheme();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Settings">
      <button type="button" aria-label="Close settings" onClick={onClose} className="absolute inset-0 bg-brand-deep/45 backdrop-blur-sm" />
      <div className="relative m-3 flex h-[calc(100%-1.5rem)] w-full max-w-[340px] flex-col gap-5 overflow-y-auto rounded-3xl bg-popover p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Settings</p>
            <h2 className="font-display text-2xl font-bold text-brand-deep">Control panel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full bg-secondary text-brand-deep transition-colors hover:bg-primary/15"
          >
            <X className="size-4" />
          </button>
        </div>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sub systems</p>
          <div className="mt-2 space-y-2">
            {SUBSYSTEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelect(item.key);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                    isActive ? "border-primary bg-primary/12" : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${isActive ? item.chipActive : item.chip}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-brand-deep">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                  </span>
                  {isActive && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose a light or dark background.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {THEMES.map((option) => {
              const Icon = option.icon;
              const isActive = option.key === mode;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setMode(option.key)}
                  aria-pressed={isActive}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition-colors ${
                    isActive ? "border-primary bg-primary/12 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="size-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
