import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** Shared state for the Simulation tab — a simulated clock, weather and a simulated Circle Line incident. */
export type SimulationContextValue = {
  /** Simulated Circle Line disruption (also driven by the home page demo switch). */
  demo: boolean;
  setDemo: (value: boolean) => void;
  /** Simulated time of day, in minutes past midnight. */
  clockMinutes: number;
  setClockMinutes: (value: number) => void;
  /** Whether the simulated clock drives the rest of the app. */
  clockActive: boolean;
  setClockActive: (value: boolean) => void;
  /** Simulated rain at the trip start. */
  rain: boolean;
  setRain: (value: boolean) => void;
  /** Simulated departure time (minutes past midnight) once "Leave now" is pressed; null when not left. */
  departedAt: number | null;
  setDepartedAt: (value: number | null) => void;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(false);
  const [clockMinutes, setClockMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const [clockActive, setClockActive] = useState(false);
  const [rain, setRain] = useState(false);
  const [departedAt, setDepartedAt] = useState<number | null>(null);

  const value = useMemo<SimulationContextValue>(
    () => ({
      demo,
      setDemo,
      clockMinutes,
      setClockMinutes,
      clockActive,
      setClockActive,
      rain,
      setRain,
      departedAt,
      setDepartedAt,
    }),
    [demo, clockMinutes, clockActive, rain, departedAt],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

/** Null when no provider is mounted, so components stay usable on their own. */
export function useSimulationOptional(): SimulationContextValue | null {
  return useContext(SimulationContext);
}

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) throw new Error("useSimulation must be used inside SimulationProvider");
  return context;
}

/** Fallback used when the simulation provider is absent. */
export function useSimulationOrLocal(): SimulationContextValue {
  const shared = useSimulationOptional();
  const [demo, setDemo] = useState(false);
  const [clockMinutes, setClockMinutes] = useState(0);
  const [clockActive, setClockActive] = useState(false);
  const [rain, setRain] = useState(false);
  const [departedAt, setDepartedAt] = useState<number | null>(null);
  const setClock = useCallback((value: number) => setClockMinutes(value), []);
  const local = useMemo<SimulationContextValue>(
    () => ({
      demo,
      setDemo,
      clockMinutes,
      setClockMinutes: setClock,
      clockActive,
      setClockActive,
      rain,
      setRain,
      departedAt,
      setDepartedAt,
    }),
    [demo, clockMinutes, clockActive, rain, departedAt, setClock],
  );
  return shared ?? local;
}
