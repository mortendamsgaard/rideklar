# rideklar: data and renderer

The catalog contains 28 manually curated fixed pony programs (547 numbered protocol points). The original LA1-B and LA4-B files are preserved. Three additional freestyle requirement files are stored under `public/programs/freestyle/`; they intentionally have no routes and are not listed in the fixed-program dropdown.

The UI fetches `/programs/index.json`, then the chosen program JSON. The catalog owns the default selection. There are no LA1/LA4 imports, IDs, fixed exercise counts, or exercise-number branches in the renderer. Only the catalog and JSON assets need changes to add a program; pushing them to `main` deploys the site.

- `public/programs/index.json`: dropdown entries, URLs and default ID.
- `public/programs/*.json`: source, program texts, arena, exercises and animation instructions.
- `public/programs/program.schema.json`: JSON Schema 2020-12 for generating program files.
- `lib/program.ts`: shared types, runtime validation and HTTP loading.
- `lib/animation.ts`: program-independent segment timing.
- `app/program-player.tsx`: arena, notation, navigation and animation.
- `app/page.tsx`: catalog loading, program switching, cancellation and error recovery.

## Converting a DRF protocol

1. Follow the current DRF program overview to the exact protocol. Record its link, edition, PDF date, check date, audience and arena. The two initial programs use the PDFs linked by DRF on 5 September 2026 (edition 2025, PDFs dated 3 May 2026).
2. Produce a JSON object matching `program.schema.json`. Keep one exercise per numbered protocol point, preserving `sourceNumber`. Write independent short descriptions and riding tips. Store every program-dependent visible text in the JSON, including explanatory notes and source information. Generic button labels remain in the UI.
3. Translate the riding instructions into metre-based SVG paths. Coordinates start at the arena's upper left: x runs right, y runs down. Use explicit absolute M/L/Q/C/A commands. Curves represent the pony's centreline; they are authored interpretations, not DRF's subscription diagrams. Check uncertain geometry with an instructor. These JSON files are the canonical manually curated content. Edit the program JSON directly and run the validation checks below. No API key or generation tool is required.
4. Split paths at every gait or movement change. `gait` selects the color; `movement` selects the notation. `versade` creates a zigzag automatically, `schenkelvigning` a dashed line and `travers` a solid line. Animation always follows the smooth centreline.
5. A segment can specify `seconds`, `reverse`, `heading`, `hidden` and an optional spoken-style `label`. Times are illustrative, not official ride times. For a halt use an M-only path, a duration, neutral gait, hidden line and heading. Reverse movement follows the path but rotates the marker 180°. Keep adjacent endpoints identical.
6. A assessment point uses `assessment: true`, `restingPoint` and `assessmentSeconds`. Its displayed path is a recap; playback leaves the marker still. LA4's point 11 is one such assessment.
7. Verify all numbered exercises, gait transitions, pony-specific sizes and source references. Run the commands below, then add the file to the catalog. Do not claim automatic source updates: each changed DRF edition requires a fresh conversion and review.

## Checks

```
npm run validate:programs
npm test
npm run build
```

Tests cover catalog and JSON validation, all route joins, sampled arena bounds, LA1's side steps, LA4's versades and 8-metre circles, timing, halts, invalid files and HTTP failures. The runtime aborts previous loads and resets the player when a new program finishes loading. Invalid files cannot replace the currently valid program.

`npm run lint` passes with no findings across the whole repository. The starter component library has been pruned to `components/ui/select.tsx`, the only component the app imports.

## September 2026 source review

All 31 PDFs were retrieved from the official DRF index on 2026-09-05. Fixed protocols retain their original numbered points, including separate assessment rows; those rows do not replay a route during continuous playback. The sources use different pony diameters: for example LC3 uses 12 m, LB1-B uses 10 m in trot and 12 m in canter, and LA6-B point 24 explicitly uses 10 m despite its other 8 m circles. Arena A is 20 by 60 m and arena B is 20 by 40 m.

The route coordinates are authored interpretations of the written protocols, not official DRF riding diagrams. Approximate transition positions, half-turn centerlines and unspecified half-circle dimensions are schematic. The physical pony body is not modeled. An instructor can refine these paths directly in JSON. File `scripts/fixtures/drf-programs.json` records the source hashes, numbered-point coverage, pony circle sizes, lateral-movement locations and assessment rows used by the regression checks.

Freestyle files use `public/programs/freestyle/freestyle.schema.json`, with technical requirements and artistic assessment criteria instead of `exercises`/`segments`. LA kür has 14 technical criteria; LA6 kür and Pony kür each have 15. Their printed assessment order is not a riding order. The 2022 LA6 kür PDF is inconsistent: the header says 4:30 minimum, the deduction field says 4:40. Both values are preserved with `requiresClarification: true`; resolve this with DRF before using the time limit competitively.
