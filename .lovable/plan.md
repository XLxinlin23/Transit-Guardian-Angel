# Fix the Leaflet route map

## Goal
Keep the existing route, markers, colours, cards, and pages while making the single map fully interactive and reliable in expanded view.

## Changes
- Keep one Leaflet map mounted and expand that same map container instead of rendering a second map.
- Enable dragging, keyboard navigation, mouse-wheel, touch, double-click, and the standard zoom control at every size.
- Set zoom limits to 10–18 and ensure both zoom buttons remain visible at the top-left.
- Add a separate “Fit route” control that restores the full Tampines-to-Raffles Place view.
- Move the expanded close and fullscreen controls into a non-overlapping top-right stack.
- Size expanded mode to about 90vw × 80vh on desktop and 100vw × 85vh on mobile.
- On expansion, invalidate the Leaflet layout and fit the full route bounds.
- Keep one attribution control and render exactly “© OpenStreetMap contributors”.

## Verification
- Check normal and expanded states at phone and desktop widths.
- Confirm one map instance, both zoom buttons, control spacing, full-route fitting, wheel zoom, and clean attribution.
- Confirm the app still builds without errors.
