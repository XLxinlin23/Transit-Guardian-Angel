# Refine route and arrivals layout

## Goal
Make the route easier to scan, compact the nearby MRT and bus sections, and add more colour without changing any trip, arrival, alert, or map behaviour.

## Changes
- Place the route map and journey steps inside the “Your route” section, immediately after the main route details and before “Other routes”.
- Keep comparison and save actions in their current order beneath the alternatives.
- Make “MRT stations near you” and “Bus stops near you” independently expandable, with compact closed summaries and clear chevrons.
- Enrich existing surfaces and key information with semantic blue, green, orange, and restrained red accents while keeping text contrast strong in light and dark modes.
- Preserve all current data loading, selection, navigation, route calculation, persistence, and OpenStreetMap attribution.

## Verification
- Check the route content order on mobile and desktop.
- Confirm both nearby sections open and close without losing selected data.
- Confirm light and dark themes remain readable and no controls overlap.
- Confirm the preview builds cleanly and has no runtime errors.
