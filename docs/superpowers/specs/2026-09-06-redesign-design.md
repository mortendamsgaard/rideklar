# rideklar redesign — design

Date: 2026-09-06
Status: approved design, ready for implementation planning

## Why

Two problems with the current interface.

**It looks generic.** The muted sage palette (`#f4f6f5` background, `#176d5e` primary) reads as
a default template. It also sits close in hue to the skridt route colour (`#25813b`), so the
interface faintly competes with the thing it is meant to frame.

**It does not work on a phone.** At `max-width: 700px` the workspace stacks vertically, putting
the exercise text below a 400 px arena. A rider at the stable has to scroll between the drawing
and the instruction describing it — exactly the two things they need at once.

## Goal

On an iPhone, the arena and the current exercise's essential text are readable **in one screen
with no scrolling**, and the interface looks like it was designed for young pony riders rather
than assembled from a component library.

## Audience

Children and teenagers riding pony programs, often with a parent or instructor nearby, typically
on a phone at the stable. The tone should be warm and confident, and clear enough for a
ten-year-old to follow alone. Not childish — a twelve-year-old should not find it babyish.

## Non-goals

Explicitly out of scope. This is a presentation change only.

- The program JSON schema and all 34 data files
- `lib/program.ts` — types, validation, loading
- `lib/animation.ts` — segment timing
- SVG route rendering, gait colours, movement notation, the animation loop
- Any of the 37 tests (they must continue to pass unmodified)
- Adding new features: no search, no favourites, no progress persistence, no dark mode toggle

## Target device and the space budget

The design target is **iPhone 14 and newer**: 390 × 844 CSS px. Safari's visible viewport there
is approximately **390 × 664** — the address bar consumes the rest. All "no scrolling" claims in
this document are measured against 664 px, not 844.

Vertical budget for the first screen:

| Element | Height |
| --- | --- |
| Header | 50 |
| Arena (200 × 400) | 400 |
| Text block (eyebrow, title + location, 2-line instruction) | 88 |
| Primary control row | 44 |
| Secondary control row | 44 |
| Gaps and padding | ~32 |
| **Total** | **~658** |

That leaves roughly 6 px of headroom. The budget is tight by design; any element added to the
first screen must displace another.

## Information architecture

**Above the fold on mobile**

1. Header — wordmark, program picker
2. Arena
3. Eyebrow — `ØVELSE 03 / 23 · TRAV`
4. Exercise title and location — `Volte 8 m · ved B`
5. Instruction — two lines
6. Primary control — `▶ Afspil hele programmet`, with the progress bar rendered inside it
7. Secondary controls — `←` / `▶ Øvelsen` / `→`

**Below the fold**

Tip block, size note, schematic note, next-up preview, route legend, full program list, footer.

Two consequences of the budget:

- The current `<h1>` and badges row (program title, audience, arena dimensions, verified mark)
  **collapses into the header**. It costs about 90 px and largely repeats what the program picker
  already says.
- Whole-program playback is the **most important control** and therefore takes the full-width
  primary row. Single-exercise playback is demoted to the secondary row.

## Layout

### Mobile (< 900 px)

Arena centred, all text full width beneath it, two stacked control rows. Single column.

### Desktop (≥ 900 px)

Two columns:

- **Left** — arena, then the two control rows beneath it
- **Right** — eyebrow, title, location, instruction, tip block, then the full program list

The existing 1000 / 1340 / 1440 px breakpoints collapse into this single 900 px breakpoint.
The 700 px breakpoint is removed; the mobile layout becomes the default and desktop is the
override.

### Arena sizing — the substantive technical change

Today `.arena` is `height: 460px; width: 100%`. Because the SVG uses the default
`preserveAspectRatio`, it letterboxes: a 20 × 60 m arena (aspect 1:3) in a wide container scales
to fit the height and renders as a narrow strip with dead space either side.

The arena becomes **height-driven with `width: auto`**, so the SVG occupies exactly the width its
aspect ratio requires:

- Bane B (20 × 40, aspect 1:2) at 400 px tall → 200 px wide
- Bane A (20 × 60, aspect 1:3) at 400 px tall → 133 px wide

Both fill the same vertical slot, which is the dimension the layout is short of. The arena stays
**portrait with A at the bottom** — the orientation riders expect. Rotating to landscape was
considered and rejected: on a portrait screen it yields *less* arena area, not more
(390 × 195 = 76 000 px² rotated, versus 200 × 400 = 80 000 px² upright).

## Visual identity

### Palette — "stable warmth"

| Token | Value | Use |
| --- | --- | --- |
| sand | `#faf4e9` | page background |
| arena | `#f2e4cc` | riding surface |
| gold | `#c98a2e` | wordmark dot, eyebrows, accents |
| leather | `#b5722a` | primary buttons, current list row |
| ink | `#3a2c1d` | body text |
| surface | `#fffdf8` | cards, secondary buttons |
| border | `#e8dcc6` / `#e2d0b0` | rules and button borders |
| muted | `#6b5741` | secondary text |

Cream, saddle leather and gold — the colours of the barn. The arena reads as a real riding
surface rather than a diagram.

**Constraint driving this choice:** the route colours are semantic and fixed — skridt `#25813b`,
trav `#2365c7`, galop `#c63838`, parade `#62717c`. They occupy green, blue and red. The interface
palette therefore claims no primary hue at all, so it can never compete with the route being
drawn on top of it.

### Typography

One downloaded display face plus the system stack:

- **Fraunces** (variable soft serif) — wordmark, exercise titles, step numbers
- **system-ui** — body text, controls, list rows

Distinctive where it is seen, native where it must be read; on iOS the body renders in SF.

This is a net *reduction* in font bytes. `app/layout.tsx` currently loads and preloads Geist Sans
and Geist Mono, but `app/globals.css:130` sets `body { font-family: Arial, Helvetica, sans-serif }`,
which overrides the Geist declaration at `globals.css:39`. Both families are downloaded and
neither is rendered.

## Components

**Header** — wordmark left, program picker right, 50 px tall. Absorbs the program title and
arena dimensions that the `<h1>` and badges row carried.

**Program picker** — a native `<select>`, replacing the base-ui `Select`. On a phone this gives
the iOS wheel picker, which is better for one-handed use than a custom popover. It also removes
47.6 KB gzip, 26 % of the JavaScript bundle.

**Arena** — as above. Sand fill, gold-brown letters, unchanged route rendering.

**Controls**

- Primary row: `▶ Afspil hele programmet` — full width, leather, progress bar rendered inside
  the button as a fill. The fill is decorative (`aria-hidden`); the button keeps its own
  accessible label and the existing `role="status"` announcements are unaffected
- Secondary row: `←` (36 px) / `▶ Øvelsen` (flexible) / `→` (36 px)
- The label fits without shortening: roughly 145 px of text in a 374 px button

**Detail text** — eyebrow, title with location, two-line instruction. Tip block below the fold on
mobile, in the right column on desktop, on a `#f6ecd9` panel with the existing lightbulb icon.

**Program list** — compact titled rows, `NN` plus title, one line each. Current row filled in
leather. Its own scroll area on desktop; below the fold on mobile. Deliberately not large
buttons — selecting an exercise is a minor action compared with playback.

## Code changes

**Modified**

- `app/globals.css` — the bulk of the work: new palette tokens, new layout, breakpoints reduced
  to one
- `app/program-player.tsx` — markup restructured for the stacked/two-column split, list rows,
  control rows; no changes to animation or SVG route logic
- `app/page.tsx` — native `<select>` in place of the base-ui component
- `app/layout.tsx` — Fraunces via `next/font/google`, Geist removed

**Deleted**

- `components/` (the last remaining `ui/select.tsx`), `components.json`, `lib/utils.ts`

**Dependencies removed**

Runtime: `@base-ui/react`, `clsx`, `tailwind-merge`, `shadcn`, `tw-animate-css`
Build: `tailwindcss`, `@tailwindcss/postcss`

**Tailwind goes entirely.** Once `components/ui/select.tsx` is deleted, the only Tailwind usage
left in the project is the single `antialiased` class in `app/layout.tsx:28` and three `@apply`
lines in `app/globals.css` (`border-border outline-ring/50`, `bg-background text-foreground`,
`font-sans`). All four are replaceable with two lines of plain CSS. The application's own styling
is already hand-written CSS; Tailwind is currently pure build overhead.

This removes from `app/globals.css`:

- `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`
- the entire `@theme inline` token block
- the shadcn `:root` and `.dark` palettes, and `@custom-variant dark`
- the `@layer base` block

and from `vite.config.ts` the `css: { postcss: { plugins: [tailwindcss()] } }` option, leaving
only the `vinext()` plugin.

`lucide-react` stays — `program-player.tsx` uses nine of its icons and it tree-shakes per icon.

After this the full dependency list is `react`, `react-dom`, `react-server-dom-webpack`,
`vinext`, `lucide-react`.

### Dark mode

The current CSS carries a `.dark` palette that is never activated: no element sets the class and
there is no `prefers-color-scheme` query. It is removed along with the rest of the shadcn layer.
Dark mode is a non-goal; if it is wanted later it should be designed deliberately against the
stable-warmth palette rather than inherited from a template.

## Verification

**Automated** — all must stay green, unmodified:

- `npm run lint`
- `npm test` — 37 tests
- `npm run validate:programs` — 28 programs
- `npm run build`

**Manual** — the actual requirement, and not covered by any automated test:

At 390 × 664, confirm the arena, exercise title, instruction and **both control rows** are
visible without scrolling, on **both** a 20 × 40 program (e.g. `la4-b-pony`) and a 20 × 60
program. The 20 × 60 case is the one at risk, since it is the narrower arena.

Also confirm: contrast of ink on sand and white on leather meets WCAG AA; the reduced-motion
media query still suppresses animation; keyboard focus order remains sensible after the markup
restructure.

## Risks

**The 6 px headroom is not much.** Danish exercise titles vary in length, and a title that wraps
to two lines will push the secondary control row below the fold. The instruction must be clamped
to two lines (`-webkit-line-clamp`) rather than allowed to flow, and the title needs a tested
maximum.

**Removing the base-ui Select changes appearance on desktop**, where a native `<select>` is less
attractive than the custom popover. This is an accepted trade for 26 % of the bundle and better
mobile behaviour.

**Fraunces is a variable font**; the subset must be limited to Latin and the weights actually
used, or the download outweighs the Geist removal it replaces.
