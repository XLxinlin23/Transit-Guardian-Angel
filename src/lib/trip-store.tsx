import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_PREFERENCES,
  DEFAULT_ALARM,
  DRAFT_STORAGE_KEY,
  PREFERENCE_STORAGE_KEY,
  newAlarmId,
  type PlacePoint,
  type RouteAlarm,
  type RoutePreference,
} from "./commute-settings";
import type { Journey } from "./journey.functions";

const MANUAL_ROUTE_STORAGE_KEY = "wayline-manual-route";
const DEFAULT_PRIMARY_PREFERENCE: RoutePreference = "speed";

export const BLANK_ALARM: RouteAlarm = { ...DEFAULT_ALARM, from: "", to: "", active: false };

export type TripDraft = {
  editingId: string;
  alarm: RouteAlarm;
  fromPlace: PlacePoint | null;
  toPlace: PlacePoint | null;
};

type TripContextValue = TripDraft & {
  preferences: RoutePreference[];
  manualJourney: Journey | null;
  hydrated: boolean;
  setAlarmField: <Key extends keyof RouteAlarm>(key: Key, value: RouteAlarm[Key]) => void;
  setPlace: (field: "from" | "to", place: PlacePoint | null) => void;
  setPreferences: (values: RoutePreference[]) => void;
  setManualJourney: (journey: Journey | null) => void;
  loadDraft: (draft: TripDraft) => void;
  startNewTrip: () => void;
  clearTrip: () => void;
};

const TripContext = createContext<TripContextValue | null>(null);

function emptyDraft(): TripDraft {
  return { editingId: newAlarmId(), alarm: BLANK_ALARM, fromPlace: null, toPlace: null };
}

function readDraft(): TripDraft | null {
  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as TripDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.alarm) return null;
    return {
      editingId: typeof parsed.editingId === "string" ? parsed.editingId : newAlarmId(),
      alarm: { ...BLANK_ALARM, ...parsed.alarm },
      fromPlace: parsed.fromPlace ?? null,
      toPlace: parsed.toPlace ?? null,
    };
  } catch {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

function readPreferences(): RoutePreference[] | null {
  try {
    const stored = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as RoutePreference[];
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    window.localStorage.removeItem(PREFERENCE_STORAGE_KEY);
    return null;
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TripDraft>(emptyDraft);
  const [preferences, setPreferencesState] = useState<RoutePreference[]>(DEFAULT_PREFERENCES);
  const [manualJourney, setManualJourneyState] = useState<Journey | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore everything once, on the client only.
  useEffect(() => {
    const stored = readDraft();
    if (stored) setDraft(stored);
    const prefs = readPreferences();
    if (prefs) setPreferencesState([prefs[0] ?? DEFAULT_PRIMARY_PREFERENCE]);
    try {
      const manual = window.localStorage.getItem(MANUAL_ROUTE_STORAGE_KEY);
      if (manual) setManualJourneyState(JSON.parse(manual) as Journey);
    } catch {
      window.localStorage.removeItem(MANUAL_ROUTE_STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: TripDraft) => {
    setDraft(next);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setAlarmField = useCallback<TripContextValue["setAlarmField"]>(
    (key, value) => {
      if (key === "from" || key === "to") {
        setManualJourneyState(null);
        window.localStorage.removeItem(MANUAL_ROUTE_STORAGE_KEY);
      }
      setDraft((current) => {
        const next: TripDraft = {
          ...current,
          alarm: { ...current.alarm, [key]: value },
          // Typing over a location invalidates its saved coordinates.
          fromPlace: key === "from" ? null : current.fromPlace,
          toPlace: key === "to" ? null : current.toPlace,
        };
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const setPlace = useCallback<TripContextValue["setPlace"]>((field, place) => {
    setManualJourneyState(null);
    window.localStorage.removeItem(MANUAL_ROUTE_STORAGE_KEY);
    setDraft((current) => {
      const next: TripDraft = {
        ...current,
        alarm: place ? { ...current.alarm, [field]: place.name } : current.alarm,
        fromPlace: field === "from" ? place : current.fromPlace,
        toPlace: field === "to" ? place : current.toPlace,
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setPreferences = useCallback((values: RoutePreference[]) => {
    const primary = values[0] ?? DEFAULT_PRIMARY_PREFERENCE;
    setPreferencesState([primary]);
    window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify([primary]));
  }, []);

  const setManualJourney = useCallback((journey: Journey | null) => {
    setManualJourneyState(journey);
    if (journey) window.localStorage.setItem(MANUAL_ROUTE_STORAGE_KEY, JSON.stringify(journey));
    else window.localStorage.removeItem(MANUAL_ROUTE_STORAGE_KEY);
  }, []);

  const loadDraft = useCallback((next: TripDraft) => {
    setManualJourneyState(null);
    window.localStorage.removeItem(MANUAL_ROUTE_STORAGE_KEY);
    persist(next);
  }, [persist]);
  const startNewTrip = useCallback(() => {
    setManualJourneyState(null);
    window.localStorage.removeItem(MANUAL_ROUTE_STORAGE_KEY);
    persist(emptyDraft());
  }, [persist]);
  const clearTrip = useCallback(() => {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(MANUAL_ROUTE_STORAGE_KEY);
    setManualJourneyState(null);
    setDraft(emptyDraft());
  }, []);

  const value = useMemo<TripContextValue>(
    () => ({
      ...draft,
      preferences,
      manualJourney,
      hydrated,
      setAlarmField,
      setPlace,
      setPreferences,
      setManualJourney,
      loadDraft,
      startNewTrip,
      clearTrip,
    }),
    [draft, preferences, manualJourney, hydrated, setAlarmField, setPlace, setPreferences, setManualJourney, loadDraft, startNewTrip, clearTrip],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const context = useContext(TripContext);
  if (!context) throw new Error("useTrip must be used inside TripProvider");
  return context;
}
