# rideklar

Interactive visualizer for Danish dressage programs (DRF pony protocols). Pick a
program, step through it one exercise at a time, and watch the route animate on a
scale dressage arena with gait-colored tracks and lateral-movement notation.

Live at **[rideklar.dk](https://rideklar.dk)**.

## What it does

- 28 fixed pony programs — LD through LA, plus PRI/PRT/PRM — covering 547
  numbered protocol points.
- Animated playback of a single exercise or the whole program, with the marker
  following the authored centreline at gait-appropriate speed.
- Notation for lateral work: dashed for schenkelvigning, zigzag for versade,
  solid for travers. Halts and assessment points hold the marker still.
- Three freestyle (kür) requirement files, which list technical and artistic
  criteria rather than a fixed route.

Interface text is Danish.

## Running it

Requires Node 22.13 or newer.

```
npm install
npm run dev      # development server
npm run build    # static export to dist/client
npm start        # serve the build locally
```

## Checks

```
npm run lint              # oxlint, clean across the repo
npm test                  # 37 tests
npm run validate:programs # schema + geometry validation of every program
```

`npm run build` runs `validate:programs` first via its `prebuild` hook, so a
malformed program file fails the build instead of shipping.

Tests cover catalog and JSON validation, every route join, sampled arena bounds,
lateral-movement placement, pony circle diameters, timing, halts, invalid files
and HTTP failures.

## Architecture

The renderer is deliberately program-agnostic: no program IDs, exercise counts,
or index branches appear in the UI code, and a test enforces that. Adding a
program means adding a JSON file and a catalog entry — no code changes.

| Path | Role |
| --- | --- |
| `public/programs/index.json` | Catalog: dropdown entries and the default program |
| `public/programs/*.json` | Program content, arena, exercises, route segments |
| `lib/program.ts` | Shared types, runtime validation, HTTP loading |
| `lib/animation.ts` | Program-independent segment timing |
| `app/page.tsx` | Catalog loading, program switching, cancellation, retry |
| `app/program-player.tsx` | Arena, notation, navigation, animation |

Built with [vinext](https://www.npmjs.com/package/vinext) (Next.js-compatible
app router on Vite) and React 19. Routes are SVG paths in metres, with the origin
at the arena's upper left.

See [PROGRAMS.md](PROGRAMS.md) for the data format and the procedure for
converting a DRF protocol into a program file.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which lints, tests and
builds, then publishes `dist/client` to GitHub Pages.

Two files in `public/` matter for that and should not be removed:

- `.nojekyll` — without it, GitHub Pages runs Jekyll, which ignores the `_next/`
  directory and silently serves a page with no JavaScript.
- `CNAME` — holds the custom domain. Pages resets the domain on every deploy if
  this file is absent.

## Source data and rights

The program routes are **authored interpretations** of the written DRF protocols,
not official DRF riding diagrams. Transition positions, half-turn centrelines and
unspecified half-circle dimensions are schematic, and the pony's body is not
modelled. Check uncertain geometry with an instructor. Each program file links
the DRF protocol it derives from.

This project is not affiliated with or endorsed by Dansk Ride Forbund.

No license is granted. The source is published for reference; all rights are
reserved.
