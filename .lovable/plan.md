# Route alarm and preferences

## Goal
Replace the fixed morning commute on Home with a device-saved route alarm, and turn the second tab into route recommendation preferences.

## Home
- Add an alarm form for origin, destination, arrival time, maximum acceptable delay, and repeat schedule.
- Support Once, Every weekday, Every weekend, and Custom days; Custom reveals Monday–Sunday checkboxes.
- Save the alarm on the phone and show a concise active-alarm summary after saving.
- Make the monitoring message clear that Wayline rechecks the best route and can notify earlier when disruption changes it.

## Preference
- Add selectable route priorities for Speed, Cost, Least walking, Sheltered, Least transfers, and Lower crowding.
- Save selections on the phone and use them in the recommendation summary.
- Explain that disruption-aware routing still recalculates the best matching route for that day.

## Existing app
- Keep the map, disruption alert tab, dashboard, visual style, and bottom navigation.
- Update fixed commute labels and page metadata so they no longer imply a single permanent route.

## Verification
- Test saving an alarm, custom weekdays, persistence after reload, preference selection, and phone layout.
- Confirm a clean build and no browser errors.
