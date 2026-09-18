export type Station = {
  code: string;
  name: string;
  lat: number;
  lng: number;
};

/** East–West Line, Tampines (EW2) to Raffles Place (EW14). */
export const STATIONS: Station[] = [
  { code: "EW2", name: "Tampines", lat: 1.3536, lng: 103.9451 },
  { code: "EW3", name: "Simei", lat: 1.3432, lng: 103.9532 },
  { code: "EW4", name: "Tanah Merah", lat: 1.3272, lng: 103.9463 },
  { code: "EW5", name: "Bedok", lat: 1.3240, lng: 103.9300 },
  { code: "EW6", name: "Kembangan", lat: 1.3210, lng: 103.9128 },
  { code: "EW7", name: "Eunos", lat: 1.3196, lng: 103.9032 },
  { code: "EW8", name: "Paya Lebar", lat: 1.3177, lng: 103.8925 },
  { code: "EW9", name: "Aljunied", lat: 1.3164, lng: 103.8827 },
  { code: "EW10", name: "Kallang", lat: 1.3115, lng: 103.8714 },
  { code: "EW11", name: "Lavender", lat: 1.3071, lng: 103.8630 },
  { code: "EW12", name: "Bugis", lat: 1.3005, lng: 103.8559 },
  { code: "EW13", name: "City Hall", lat: 1.2931, lng: 103.8520 },
  { code: "EW14", name: "Raffles Place", lat: 1.2841, lng: 103.8515 },
];

/** Index of the station the train has most recently passed. */
export const CURRENT = 3;

export const CURRENT_STATION = STATIONS[CURRENT]!;
export const STOPS_REMAINING = STATIONS.length - 1 - CURRENT;
