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

## Surviving a failed boot

The default program is imported into the build rather than fetched, so the
static HTML already contains the arena and the exercise text. This is
deliberate: a rider whose JavaScript never runs — a blocked script, an old
browser, a cached page from a previous deploy asking for chunks that no longer
exist — still gets a readable program instead of a loading message. It also
means the common case makes no network requests at all.

A classic (non-module) inline script in `app/layout.tsx` backs that up. If a
module fails to load or hydration never happens, it reloads once per tab with a
cache-busting query, which fetches fresh HTML naming the chunks that actually
exist. It cannot be a module itself: a module would die with the very graph it
exists to rescue.

`lib/program.ts` gives every request a deadline, because a connection that
hangs rather than fails would otherwise never settle and never report an error.

## Checks

```
npm run lint              # oxlint, clean across the repo
npm test                  # 53 tests
npm run validate:programs # schema + geometry validation of every program
npm run test:browser      # Playwright: the boot path, against a real build
```

`npm run build` runs `validate:programs` first via its `prebuild` hook, so a
malformed program file fails the build instead of shipping, and its `postbuild`
hook asserts the emitted HTML actually carries a programme.

Tests cover catalog and JSON validation, every route join, sampled arena bounds,
lateral-movement placement, pony circle diameters, timing, halts, invalid files
and HTTP failures, plus guardrails for the redesigned interface: the first
screen fitting an iPhone 14 viewport without scrolling, the layout markup and
palette, and that no Tailwind, shadcn or other component-library layer has
crept back in.

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
app router on Vite) and React 19, with hand-written CSS and no component
library. Routes are SVG paths in metres, with the origin at the arena's upper
left. The interface targets iPhone 14 and newer; `app/globals.css` carries the
layout height tokens and `scripts/redesign.test.ts` asserts the first screen
fits a 664 px viewport.

See [PROGRAMS.md](PROGRAMS.md) for the data format and the procedure for
converting a DRF protocol into a program file.

## Deployment

Live at [rideklar.dk](https://rideklar.dk), served by GitHub Pages.

**Nothing that a visitor downloads is committed to this repository.** `dist/` is
gitignored; the repo holds source and program JSON only. The served bytes are
built on every push and handed to Pages as a separate artifact.

### The pipeline

Pushing to `main` triggers `.github/workflows/deploy.yml`:

1. **Build job** on a clean runner: `npm ci` → `npm run lint` → `npm test` →
   `npm run build` → `npm run test:browser`. The `prebuild` hook validates all
   28 program files first, so malformed data fails here instead of shipping, and
   the browser tests run against the build that is about to be uploaded.
2. **`actions/upload-pages-artifact`** tars `dist/client` (~390 KB) and uploads
   it. The artifact expires after a day — it is a hand-off between jobs, not
   where the site lives.
3. **Deploy job** runs `actions/deploy-pages`, which authenticates to the Pages
   API with an OIDC token (hence `id-token: write` in the workflow permissions;
   no secret is stored) and creates a deployment tied to the commit SHA.
4. **Pages unpacks the tarball onto its own hosting.** From this point the
   repository is not involved in serving.

The deploy job declares `needs: build`, so a failing lint, test or program
validation produces no artifact and the live site stays on the previous
deployment.

### How it is served

GitHub Pages runs on Fastly. The four apex addresses
(`185.199.108–111.153`) are anycast — every Pages site shares them, and BGP
routes each visitor to the nearest edge, so Danish traffic terminates in
Copenhagen rather than crossing the Atlantic. Most requests are answered from
the edge cache without reaching GitHub's origin.

HTTPS uses a Let's Encrypt certificate that GitHub provisions and renews
automatically, covering both `rideklar.dk` and `www.rideklar.dk`. `www`
redirects to the apex.

Everything is served with `cache-control: max-age=600`, including the
`_next/static` bundles whose filenames already contain a content hash and are
therefore immutable. Those could safely be cached for a year, but Pages does not
support custom cache headers, so repeat visitors re-validate them every ten
minutes. `ETag` makes that a cheap 304 rather than a re-download.

### Two files in `public/` that must not be removed

- **`.nojekyll`** — without it Pages runs Jekyll, which ignores directories
  beginning with an underscore. That would hide the entire `_next/` bundle and
  silently serve a styled page with no JavaScript.
- **`CNAME`** — contains the custom domain. Note that with the GitHub Actions
  build type this file does *not* configure the domain; that is set in
  Settings → Pages (or via the API) and stored server-side. The file is kept
  because it is required if the build type is ever switched to "deploy from
  branch".

## Source data and rights

The program routes are **authored interpretations** of the written DRF protocols,
not official DRF riding diagrams. Transition positions, half-turn centrelines and
unspecified half-circle dimensions are schematic, and the pony's body is not
modelled. Check uncertain geometry with an instructor. Each program file links
the DRF protocol it derives from.

This project is not affiliated with or endorsed by Dansk Ride Forbund.

## License

[MIT](LICENSE) — Copyright (c) 2026 Morten Damsgaard.

The MIT licence covers the code. The program files under `public/programs/` are
authored interpretations of DRF's published protocols; the wording and route
geometry in them are original work and are covered too, but the underlying
protocols are DRF's and are not licensed here. If you reuse the program data,
check the current DRF protocols yourself rather than treating these files as an
authoritative source.
