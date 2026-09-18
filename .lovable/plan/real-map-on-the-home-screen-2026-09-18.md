# Real map on the Home screen

Replace the drawn line diagram with a real Singapore map showing the Tampines to Raffles Place route and Rachel's position on it.

## What you'll see

- The Home screen shows a real map of Singapore, styled quietly in the app's white/blue/green look, with the East-West Line route drawn from Tampines to Raffles Place.
- Station dots along the route: passed stations in blue, upcoming ones in grey, with Tampines and Raffles Place labelled.
- A pulsing blue dot for the current train position, with the "Near Bedok · 4 stops to Raffles Place" line kept underneath.
- The map is not draggable by default, so it stays a calm status picture rather than something to fiddle with. A small "expand" control opens the full interactive view.
- "© OpenStreetMap contributors" shown in small print on the map, as the licence requires.

## Do you need to do anything?

Short answer: not right now. Here is what that text means in plain language.

- OpenStreetMap is a free, openly licensed map of the world. The brief says it must be the base map, and it is — it includes footpaths, crossings, stairs, lifts and covered walkways that a plain road map leaves out.
- Condition 1: credit. Anywhere the map is shown, the words "© OpenStreetMap contributors" must appear. I'll put that on the map, so this is handled.
- Condition 2: don't overload the free servers. The free community map-picture servers aren't meant for heavy app traffic. For a demo or coursework, our usage is tiny and fine. If this ever goes to real users, you'd sign up for a free account with a map provider (MapTiler, for example) and paste me the key — a two-minute job, and the only thing I'd need from you.
- The other names in that text (Overpass, OSRM, GraphHopper, Valhalla, Geofabrik) are tools for downloading map data and calculating routes. We don't need them for showing the route and position, so I'll leave them out unless you want live path-finding later.
- LTA DataMall and OneMap are Singapore government data (covered walkways, station exits, cycling paths, local routing). Those need a free government API key. I'd add them as a later step if you want walkway-level detail; say the word and I'll plan it separately.

## Technical notes

- Add `leaflet` and `react-leaflet`. Leaflet touches `window` at import time, so the map component loads lazily (`React.lazy`) behind `<ClientOnly>` with a skeleton fallback; station coordinates and types move into a separate browser-safe module so the route file never pulls Leaflet into the SSR graph.
- Tiles: keyless free OSM-based raster tiles, low zoom range, with `attribution: '&copy; OpenStreetMap contributors'` on the tile layer. Provider URL kept in one constant so swapping to a keyed provider later is a one-line change.
- Route drawn as a `Polyline` over real station lat/lng (EW2 Tampines → EW14 Raffles Place), split into travelled and remaining segments; stations as `CircleMarker`s; current position as a `CircleMarker` with a CSS pulse.
- Map options: `dragging`, `scrollWheelZoom`, `doubleClickZoom`, `zoomControl` off for the inline view; bounds fitted to the route. Expanded view enables interaction.
- Leaflet's CSS imported inside the lazy component. `RouteMap.tsx` keeps its glass panel wrapper and footer line.
