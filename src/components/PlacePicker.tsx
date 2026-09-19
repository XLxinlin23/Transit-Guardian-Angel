import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { findStation, STATION_INDEX } from "@/lib/mrt-network";
import { isInSingapore, searchPlaces, type PlaceSuggestion } from "@/lib/place-search.functions";

export type ConfirmedPlace = {
  name: string;
  address: string;
  postal: string | null;
  lat: number;
  lng: number;
};

export function placeLine(place: ConfirmedPlace): string {
  // OneMap addresses repeat the building name — drop the duplicate so the line reads cleanly.
  const address = place.address
    .replace(new RegExp(place.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\bSINGAPORE (\d{6})\b/i, "Singapore $1")
    .trim();
  return [place.name, address && address.toLowerCase() !== place.name.toLowerCase() ? address : null]
    .filter(Boolean)
    .join(", ");
}

function stationSuggestions(query: string): PlaceSuggestion[] {
  const target = query.trim().toLowerCase().replace(/\bmrt\b|\bstation\b/g, "").trim();
  if (target.length < 2) return [];
  const out: PlaceSuggestion[] = [];
  for (const station of STATION_INDEX.values()) {
    if (!station.name.toLowerCase().includes(target)) continue;
    out.push({
      id: `station-${station.name}`,
      name: `${station.name} MRT station`,
      address: station.lines.join(" · "),
      postal: null,
      lat: station.lat,
      lng: station.lng,
      kind: "address",
    });
    if (out.length >= 3) break;
  }
  return out;
}

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  confirmed: ConfirmedPlace | null;
  onConfirm: (place: ConfirmedPlace | null) => void;
  placeholder: string;
  ariaLabel: string;
};

/** Text box plus a suggestion list. Nothing is routed until the user picks a result. */
export function PlacePicker({ value, onValueChange, confirmed, onConfirm, placeholder, ariaLabel }: Props) {
  const search = useServerFn(searchPlaces);
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = value.trim();
  const matchesConfirmed = confirmed ? placeLine(confirmed).toLowerCase().startsWith(query.toLowerCase()) || confirmed.name.toLowerCase() === query.toLowerCase() : false;

  useEffect(() => {
    if (query.length < 2 || matchesConfirmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      search({ data: { query } })
        .then((remote) => {
          if (cancelled) return;
          const local = stationSuggestions(query);
          const exact = findStation(query);
          const merged = [...(exact ? local.slice(0, 1) : []), ...remote, ...(exact ? local.slice(1) : local)];
          const seen = new Set<string>();
          setResults(merged.filter((item) => (seen.has(item.id) ? false : seen.add(item.id))).slice(0, 8));
          setLoading(false);
          setOpen(true);
        })
        .catch(() => {
          if (cancelled) return;
          setResults(stationSuggestions(query));
          setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, matchesConfirmed, search]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const choose = (item: PlaceSuggestion) => {
    if (!isInSingapore(item.lat, item.lng)) return;
    const place: ConfirmedPlace = {
      name: item.name,
      address: item.postal && !item.address.includes(item.postal) ? `${item.address} Singapore ${item.postal}` : item.address,
      postal: item.postal,
      lat: item.lat,
      lng: item.lng,
    };
    onConfirm(place);
    setOpen(false);
    setResults([]);
  };

  const showList = open && results.length > 0 && !matchesConfirmed;
  const hint = useMemo(() => {
    if (confirmed && matchesConfirmed) return placeLine(confirmed);
    if (query.length >= 2 && !loading && results.length === 0) return "No Singapore match — try the full name or a 6-digit postal code.";
    if (query.length >= 2) return "Pick a result to confirm this location.";
    return null;
  }, [confirmed, matchesConfirmed, query, loading, results.length]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            onConfirm(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          className="h-11 bg-background/70 pr-16"
        />
        <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : confirmed && matchesConfirmed ? (
            <Check className="size-4 text-success" />
          ) : null}
        </span>
        {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Clear ${ariaLabel}`}
              title={`Clear ${ariaLabel}`}
              className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onValueChange("");
                onConfirm(null);
                setOpen(false);
                setResults([]);
              }}
            >
              <X className="size-4 text-muted-foreground" />
            </Button>
        )}
      </div>

      {hint && (
        <p className={`mt-1.5 text-xs ${confirmed && matchesConfirmed ? "text-success" : "text-muted-foreground"}`}>{hint}</p>
      )}

      {showList && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-background p-1 shadow-lg">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => choose(item)}
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-primary/10"
              >
                <span className="block text-sm font-semibold text-brand-deep">{item.name}</span>
                {item.address && <span className="block text-xs text-muted-foreground">{item.address}</span>}
                {item.postal && <span className="block text-xs text-muted-foreground">Singapore {item.postal}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
