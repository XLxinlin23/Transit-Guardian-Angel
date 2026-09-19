# Separate Preferences and Route Comparison

## Goal
Make the Preferences page clearly control one saved recommendation priority, while route comparison remains an independent browsing and manual-selection experience.

## Changes
- Replace multi-select preference behavior with one pending choice and an explicit **Apply preference** action.
- Keep the applied preference in shared state and local storage; applying it will re-rank the existing trip without clearing or re-geocoding locations.
- Show a confirmation that the Home recommendation now prioritises the selected preference.
- Put the six preference cards first, followed by a distinct **Compare all routes** section.
- Make Home’s **Compare all routes** action open Preferences and scroll directly to comparison.
- Expand each comparison card in place with its actual route map, full journey timeline, transport icons, and MRT line colours.
- Show departure, arrival, duration, walking distance/time, transfers, fare, lines used, and disruption status from existing route data.
- Add a confirmed **Use this route** action that creates a persistent manual choice without changing the primary preference.
- Label manual choices **Chosen by you** on Home and provide **Return to recommended route**.
- Keep sufficient bottom spacing so navigation does not cover cards or expanded details.

## Technical details
- Extend the shared trip context with a persisted manual route override and actions to set/clear it.
- Continue using existing route alternatives and map/journey components; no routing API or geocoding changes.
- Use the current arrive-by time and route duration to derive departure times consistently.
- Deduplicate identical journeys so comparison cards represent genuine route alternatives, while retaining the preference labels each route satisfies.
- Preserve all existing route alarm, location, OSM attribution, and alert-setting state.

## Verification
- Confirm one preference can be applied and persists across tab changes/refresh.
- Confirm Home changes after applying a preference but locations remain intact.
- Confirm comparison opens at the correct section and expanding cards does not change Home.
- Confirm manual route replacement requires confirmation, persists, and can be reverted.
- Check mobile and desktop layouts, bottom navigation clearance, maps, and build/runtime health.
