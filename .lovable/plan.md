# Home route controls and wording

## Changes
- Rename the route map status phrase from “currently no disruption” to “route when no disruptions.”
- Keep a visible clear control in both From and To fields, including after a location has been confirmed.
- Make each Home “Other routes” option selectable. Selecting one updates the displayed map, summary, and journey steps without changing the saved primary preference.
- Move the preference-ranked route into “Other routes” after a manual selection and label its preference with “(Recommended).”
- Preserve the existing “Return to recommended route” action.

## Verification
- Check the Home flow with a persisted sample trip on desktop and mobile.
- Confirm clear controls remove both text and confirmed coordinates.
- Confirm selecting an alternative swaps all displayed route details and the recommended option remains available and labelled.
- Confirm the app builds without errors.

## Technical details
- Reuse the existing persisted manual-route state; no routing API, disruption API, alert setting, or navigation changes.
- Use the existing route IDs to distinguish the preference-ranked route from the selected route.
