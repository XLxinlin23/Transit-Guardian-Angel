import type { RoutePreference } from "@/lib/commute-settings";

export type NetworkStation = {
  name: string;
  lat: number;
  lng: number;
  lines: string[];
};

type RawStation = [name: string, lat: number, lng: number];

const LINES: Record<string, RawStation[]> = {
  EW: [
    ["Pasir Ris", 1.3729, 103.9493],
    ["Tampines", 1.3536, 103.9451],
    ["Simei", 1.3432, 103.9532],
    ["Tanah Merah", 1.3272, 103.9463],
    ["Bedok", 1.324, 103.93],
    ["Kembangan", 1.321, 103.9128],
    ["Eunos", 1.3196, 103.9032],
    ["Paya Lebar", 1.3177, 103.8925],
    ["Aljunied", 1.3164, 103.8827],
    ["Kallang", 1.3115, 103.8714],
    ["Lavender", 1.3071, 103.863],
    ["Bugis", 1.3005, 103.8559],
    ["City Hall", 1.2931, 103.852],
    ["Raffles Place", 1.2841, 103.8515],
    ["Tanjong Pagar", 1.2765, 103.8458],
    ["Outram Park", 1.2804, 103.8397],
    ["Tiong Bahru", 1.2861, 103.827],
    ["Redhill", 1.2897, 103.8168],
    ["Queenstown", 1.2945, 103.8058],
    ["Commonwealth", 1.3025, 103.7982],
    ["Buona Vista", 1.3071, 103.7902],
    ["Dover", 1.3113, 103.7786],
    ["Clementi", 1.3151, 103.7653],
    ["Jurong East", 1.3334, 103.7422],
    ["Chinese Garden", 1.3425, 103.7325],
    ["Lakeside", 1.3444, 103.7208],
    ["Boon Lay", 1.3385, 103.706],
    ["Pioneer", 1.3376, 103.6972],
    ["Joo Koon", 1.3277, 103.6785],
    ["Gul Circle", 1.3196, 103.6607],
    ["Tuas Crescent", 1.321, 103.6491],
    ["Tuas West Road", 1.3299, 103.6397],
    ["Tuas Link", 1.3403, 103.6367],
  ],
  CG: [
    ["Tanah Merah", 1.3272, 103.9463],
    ["Expo", 1.3354, 103.9616],
    ["Changi Airport", 1.3573, 103.9884],
  ],
  NS: [
    ["Jurong East", 1.3334, 103.7422],
    ["Bukit Batok", 1.349, 103.7496],
    ["Bukit Gombak", 1.3588, 103.7518],
    ["Choa Chu Kang", 1.3854, 103.7443],
    ["Yew Tee", 1.3971, 103.7473],
    ["Kranji", 1.4251, 103.762],
    ["Marsiling", 1.4327, 103.774],
    ["Woodlands", 1.437, 103.7865],
    ["Admiralty", 1.4406, 103.801],
    ["Sembawang", 1.4491, 103.82],
    ["Canberra", 1.4432, 103.8298],
    ["Yishun", 1.4294, 103.835],
    ["Khatib", 1.4172, 103.8329],
    ["Yio Chu Kang", 1.3817, 103.8449],
    ["Ang Mo Kio", 1.37, 103.8496],
    ["Bishan", 1.351, 103.8485],
    ["Braddell", 1.3404, 103.8467],
    ["Toa Payoh", 1.3327, 103.8474],
    ["Novena", 1.3204, 103.8438],
    ["Newton", 1.3128, 103.8385],
    ["Orchard", 1.304, 103.832],
    ["Somerset", 1.3005, 103.839],
    ["Dhoby Ghaut", 1.2993, 103.8455],
    ["City Hall", 1.2931, 103.852],
    ["Raffles Place", 1.2841, 103.8515],
    ["Marina Bay", 1.2761, 103.8546],
    ["Marina South Pier", 1.2711, 103.8632],
  ],
  NE: [
    ["HarbourFront", 1.2653, 103.822],
    ["Outram Park", 1.2804, 103.8397],
    ["Chinatown", 1.2846, 103.8442],
    ["Clarke Quay", 1.2886, 103.8465],
    ["Dhoby Ghaut", 1.2993, 103.8455],
    ["Little India", 1.3067, 103.8492],
    ["Farrer Park", 1.3124, 103.8543],
    ["Boon Keng", 1.3195, 103.8618],
    ["Potong Pasir", 1.3313, 103.8693],
    ["Woodleigh", 1.3392, 103.8708],
    ["Serangoon", 1.3497, 103.8734],
    ["Kovan", 1.3601, 103.885],
    ["Hougang", 1.3712, 103.8925],
    ["Buangkok", 1.3828, 103.8931],
    ["Sengkang", 1.3916, 103.8953],
    ["Punggol", 1.4053, 103.9024],
  ],
  DT: [
    ["Tampines East", 1.3563, 103.9549],
    ["Tampines", 1.3536, 103.9451],
    ["Tampines West", 1.3455, 103.9385],
    ["Bedok Reservoir", 1.3364, 103.9331],
    ["Kaki Bukit", 1.335, 103.9088],
    ["Ubi", 1.33, 103.9004],
    ["MacPherson", 1.3266, 103.89],
    ["Mattar", 1.3269, 103.8832],
    ["Geylang Bahru", 1.3214, 103.8714],
    ["Bendemeer", 1.3137, 103.863],
    ["Jalan Besar", 1.3054, 103.8554],
    ["Rochor", 1.3037, 103.8524],
    ["Bugis", 1.3005, 103.8559],
    ["Promenade", 1.293, 103.8613],
    ["Bayfront", 1.2819, 103.8592],
    ["Downtown", 1.2794, 103.8529],
    ["Telok Ayer", 1.2822, 103.8484],
    ["Chinatown", 1.2846, 103.8442],
  ],
  CC: [
    ["Dhoby Ghaut", 1.2993, 103.8455],
    ["Bras Basah", 1.2968, 103.8508],
    ["Esplanade", 1.2933, 103.8556],
    ["Promenade", 1.293, 103.8613],
    ["Nicoll Highway", 1.2996, 103.8637],
    ["Stadium", 1.3028, 103.8753],
    ["Mountbatten", 1.3062, 103.8827],
    ["Dakota", 1.3082, 103.8885],
    ["Paya Lebar", 1.3177, 103.8925],
    ["MacPherson", 1.3266, 103.89],
    ["Tai Seng", 1.3358, 103.888],
    ["Bartley", 1.3423, 103.8797],
    ["Serangoon", 1.3497, 103.8734],
    ["Lorong Chuan", 1.3517, 103.8642],
    ["Bishan", 1.351, 103.8485],
    ["Marymount", 1.3491, 103.8395],
    ["Caldecott", 1.3378, 103.8395],
    ["Botanic Gardens", 1.3223, 103.8153],
    ["Farrer Road", 1.3174, 103.8074],
    ["Holland Village", 1.312, 103.7962],
    ["Buona Vista", 1.3071, 103.7902],
    ["one-north", 1.2995, 103.7873],
    ["Kent Ridge", 1.2934, 103.7845],
    ["Haw Par Villa", 1.2827, 103.7818],
    ["Pasir Panjang", 1.2761, 103.7914],
    ["Labrador Park", 1.2723, 103.8027],
    ["Telok Blangah", 1.2707, 103.8097],
    ["HarbourFront", 1.2653, 103.822],
  ],
};

export const LINE_NAMES: Record<string, string> = {
  EW: "East West Line",
  CG: "Changi Airport Branch",
  NS: "North South Line",
  NE: "North East Line",
  DT: "Downtown Line",
  CC: "Circle Line",
};

/** Lines that are busiest at peak, used when the commuter prefers lower crowding. */
const CROWDED_LINES = new Set(["EW", "NS"]);
/** Lines with more open-air or long walking transfers. */
const LESS_SHELTERED_LINES = new Set(["EW", "NS"]);

export const STATION_INDEX: Map<string, NetworkStation> = (() => {
  const map = new Map<string, NetworkStation>();
  for (const [line, stations] of Object.entries(LINES)) {
    for (const [name, lat, lng] of stations) {
      const existing = map.get(name);
      if (existing) {
        if (!existing.lines.includes(line)) existing.lines.push(line);
      } else {
        map.set(name, { name, lat, lng, lines: [line] });
      }
    }
  }
  return map;
})();

export const STATION_NAMES = [...STATION_INDEX.keys()].sort((a, b) => a.localeCompare(b));

const normalise = (value: string) => value.toLowerCase().replace(/\bmrt\b|\bstation\b|[^a-z0-9]/g, "");

export function findStation(query: string): NetworkStation | null {
  const target = normalise(query);
  if (!target) return null;
  let partial: NetworkStation | null = null;
  for (const station of STATION_INDEX.values()) {
    const key = normalise(station.name);
    if (key === target) return station;
    if (!partial && (key.startsWith(target) || key.includes(target)) && target.length >= 3) partial = station;
  }
  return partial;
}

/** Closest MRT station to an arbitrary coordinate (postal code, bus stop, building). */
export function nearestStation(lat: number, lng: number): NetworkStation | null {
  let best: NetworkStation | null = null;
  let bestDistance = Infinity;
  for (const station of STATION_INDEX.values()) {
    const d = (station.lat - lat) ** 2 + (station.lng - lng) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = station;
    }
  }
  return best;
}

function distanceKm(a: NetworkStation, b: NetworkStation) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Edge = { to: string; line: string };

const GRAPH: Map<string, Edge[]> = (() => {
  const graph = new Map<string, Edge[]>();
  const push = (from: string, edge: Edge) => {
    const list = graph.get(from);
    if (list) list.push(edge);
    else graph.set(from, [edge]);
  };
  for (const [line, stations] of Object.entries(LINES)) {
    for (let i = 0; i < stations.length - 1; i += 1) {
      const a = stations[i]![0];
      const b = stations[i + 1]![0];
      push(a, { to: b, line });
      push(b, { to: a, line });
    }
  }
  return graph;
})();

export type RouteLeg = { line: string; stations: NetworkStation[] };

export type PlannedRoute = {
  stations: NetworkStation[];
  legs: RouteLeg[];
  stops: number;
  transfers: number;
  minutes: number;
};

type Weights = { transferPenalty: number; crowdFactor: number; shelterFactor: number; useDistance: boolean };

function weightsFor(preferences: RoutePreference[]): Weights {
  const set = new Set(preferences.length ? preferences : (["speed"] as RoutePreference[]));
  const penalties: number[] = [];
  if (set.has("speed")) penalties.push(5);
  if (set.has("cost")) penalties.push(4);
  if (set.has("walking")) penalties.push(14);
  if (set.has("sheltered")) penalties.push(9);
  if (set.has("transfers")) penalties.push(22);
  if (set.has("crowd")) penalties.push(7);
  const transferPenalty = penalties.reduce((sum, value) => sum + value, 0) / (penalties.length || 1);
  return {
    transferPenalty,
    crowdFactor: set.has("crowd") ? 1.35 : 1,
    shelterFactor: set.has("sheltered") ? 1.15 : 1,
    useDistance: set.has("cost"),
  };
}

/** A closed stretch of track: no trains run between these two adjacent stations on this line. */
export type BlockedSegment = { line: string; a: string; b: string };

const segmentKey = (line: string, a: string, b: string) =>
  `${line.toUpperCase()}|${[a.toLowerCase(), b.toLowerCase()].sort().join("|")}`;

/** Every station between two stations on a line, inclusive, in travel order. */
export function stationsBetween(line: string, a: string, b: string): string[] {
  const stations = LINES[line.toUpperCase()];
  if (!stations) return [];
  const names = stations.map(([name]) => name);
  const start = names.findIndex((name) => name.toLowerCase() === a.toLowerCase());
  const end = names.findIndex((name) => name.toLowerCase() === b.toLowerCase());
  if (start < 0 || end < 0) return [];
  return start <= end ? names.slice(start, end + 1) : names.slice(end, start + 1).reverse();
}

/**
 * Shortest path weighted by the commuter's route preferences.
 * Lines in `avoidLines` are heavily penalised; `blockedSegments` are removed outright,
 * so only the closed stretch of track is avoided rather than the whole line.
 */
export function planRoute(
  fromName: string,
  toName: string,
  preferences: RoutePreference[],
  avoidLines: string[] = [],
  blockedSegments: BlockedSegment[] = [],
): PlannedRoute | null {
  const from = findStation(fromName);
  const to = findStation(toName);
  if (!from || !to || from.name === to.name) return null;

  const avoid = new Set(avoidLines);
  const blocked = new Set(blockedSegments.map((segment) => segmentKey(segment.line, segment.a, segment.b)));
  const weights = weightsFor(preferences);
  type NodeKey = string; // `${station}|${line}`
  const cost = new Map<NodeKey, number>();
  const prev = new Map<NodeKey, NodeKey | null>();
  const queue: Array<{ key: NodeKey; station: string; line: string; cost: number }> = [];

  for (const line of from.lines) {
    const key = `${from.name}|${line}`;
    cost.set(key, 0);
    prev.set(key, null);
    queue.push({ key, station: from.name, line, cost: 0 });
  }

  let bestGoal: NodeKey | null = null;
  const visited = new Set<NodeKey>();

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const node = queue.shift()!;
    if (visited.has(node.key)) continue;
    visited.add(node.key);
    if (node.station === to.name) {
      bestGoal = node.key;
      break;
    }
    for (const edge of GRAPH.get(node.station) ?? []) {
      if (blocked.has(segmentKey(edge.line, node.station, edge.to))) continue;
      const a = STATION_INDEX.get(node.station)!;
      const b = STATION_INDEX.get(edge.to)!;
      let hop = weights.useDistance ? distanceKm(a, b) * 2.2 : 2.2;
      if (weights.crowdFactor > 1 && CROWDED_LINES.has(edge.line)) hop *= weights.crowdFactor;
      if (weights.shelterFactor > 1 && LESS_SHELTERED_LINES.has(edge.line)) hop *= weights.shelterFactor;
      if (avoid.has(edge.line)) hop *= 8;
      const transfer = edge.line === node.line ? 0 : weights.transferPenalty;
      const next = node.cost + hop + transfer;
      const key = `${edge.to}|${edge.line}`;
      if (next < (cost.get(key) ?? Number.POSITIVE_INFINITY)) {
        cost.set(key, next);
        prev.set(key, node.key);
        queue.push({ key, station: edge.to, line: edge.line, cost: next });
      }
    }
  }

  if (!bestGoal) return null;

  const path: Array<{ station: NetworkStation; line: string }> = [];
  let cursor: NodeKey | null = bestGoal;
  while (cursor) {
    const [stationName, line] = cursor.split("|") as [string, string];
    path.unshift({ station: STATION_INDEX.get(stationName)!, line });
    cursor = prev.get(cursor) ?? null;
  }

  const stations = path.map((item) => item.station);
  const legs: RouteLeg[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const step = path[i]!;
    const last = legs[legs.length - 1];
    if (last && last.line === step.line) last.stations.push(step.station);
    else legs.push({ line: step.line, stations: [path[i - 1]!.station, step.station] });
  }

  const stops = stations.length - 1;
  const transfers = Math.max(0, legs.length - 1);
  const minutes = Math.round(stops * 2.4 + transfers * 5 + 4);

  return { stations, legs, stops, transfers, minutes };
}
