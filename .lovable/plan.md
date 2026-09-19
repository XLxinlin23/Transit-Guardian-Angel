# Verify least-walking route selection

## Goal
Make least-walking selection auditable and ensure every route uses the same distance and time units.

## Changes
- Store explicit route IDs, walking distance, walking time, duration, and transfer count on every evaluated route.
- Rank Least walking strictly by total walking distance, using duration only to break an exact distance tie.
- Sort displayed alternatives by walking distance whenever Least walking is active.
- Show “Walk N m · N min” consistently on the selected route and every alternative card.
- Explain the distance advantage over the next genuine route, or state that comparison is unavailable when only one route exists.
- Report only the actual count of unique generated routes.
- Add a development-only diagnostic table for all route metrics before winner selection.

## Verification
- Test metric calculation and least-walking ordering with multiple synthetic routes.
- Check Home and Preferences displays for consistent units and genuine route counts.
- Confirm the preview builds without errors.
