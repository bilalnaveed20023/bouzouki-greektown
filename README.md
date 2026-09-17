# Bouzouki Greektown — bouzoukidetroit.com

A static, eight-page site for Bouzouki Greektown, the gentlemen's club at
**432 E Lafayette Blvd, Detroit, MI 48226**. No framework, no build dependencies,
no runtime services — plain HTML, one stylesheet, one script.

## Build & run

```bash
node build.mjs          # assembles src/ -> dist/
python3 -m http.server 4620 --directory dist
```

`build.mjs` merges `src/layout.html` (nav, footer, SVG sprite, meta, schema) with
each fragment in `src/pages/`, marks the active nav item, and emits `sitemap.xml`
and `robots.txt`. **Edit `src/`, never `dist/`** — `dist/` is wiped on every build.

## Deploy

`dist/` is the whole site. Drop it on any static host — Netlify, Cloudflare Pages,
Vercel, S3, or plain nginx. The domain `bouzoukidetroit.com` is already registered
and sitting behind Cloudflare returning a 404, so pointing Pages at it is the
shortest path. Nothing needs Node at runtime.

## Structure

```
src/layout.html        shell: meta, OG tags, JSON-LD, nav, menu, footer, icons
src/pages/*.html       page bodies, each opening with a JSON front-matter comment
assets/css/site.css    design system — tokens, components, motion
assets/js/site.js      interaction layer, no dependencies
assets/img/            the club's logo
```

Pages: `index` · `club` · `nights` · `vip` · `menu` · `gallery` · `careers` · `visit`

`preview.html` at the project root is a review harness, not part of the site — it
frames all eight pages in phone bezels at a true 390px viewport. It deliberately
lives outside `dist/`, so it can never ship. Copy it into `dist/` when you want it.

## Design

Art direction is derived from the club's own mark — the fluted Greek column, the
two silhouettes, the arched wordmark, the signature script. The exterior
photograph confirms this was the right read: the building itself has fluted
Greek columns across the frontage with dancer murals set in the arches between
them, under red neon. The site is echoing the actual building, not just a logo. Bodoni Moda for
display, Jost for UI, Yellowtail for the script.

The palette runs marble white and brass over ink black, lit by a **warm ramp**
(`--wine`, `--wine-lit`, `--rose`, `--flesh`). The warm tokens are the light in
the room, not a decorative accent — every ambient wash, plate, card bloom and
feature band takes its colour from them, which is what stops the site reading
cold and corporate. An earlier version used a violet ambient light; it fought
the brass and made the place look like an office at night.

**Neon** (`.t-neon`) is one hot colour spent in exactly one place per page: the
club's name. It is built as a near-white core with layered coloured haloes at
widening radii, which is what makes a glass tube read as a glass tube rather
than as a blurred drop-shadow. `.t-neon--live` adds the stutter a real tube
makes while it warms up, once, then holds steady.

**Velvet** (`.band--velvet`) is the deep-wine fabric ground used for a page's
closing moment — a raking sheen plus a faint vertical pile, masked so it fades
before it reaches the type.

The logo is the real one, lifted from the club's Instagram at its native 150px. It
is white-on-black with no alpha channel, so `.mark` composites it with
`mix-blend-mode: screen`, which drops the black cleanly onto any dark surface. It
is only ever used at or below its native size — the hero instead uses a
typographic lockup that extends the mark rather than upscaling it.

### Motion

Preloader (once per session), 21+ age gate, cursor-tracked spotlight washes,
scroll-driven horizontal rail, masked per-line type reveals, curtain wipes,
marquee ribbons, magnetic buttons, and a curtain page transition that makes real
multi-page navigation feel like an SPA.

Everything degrades. With JavaScript disabled you still get a complete, readable,
navigable site. `prefers-reduced-motion` is honoured throughout. Each init step is
isolated, so one broken feature cannot blank the page, and every overlay has a
timer failsafe so it can never strand a visitor behind it.

## Things that are genuinely live

- **Open / closed pill** in the nav and the status lines on each page are computed
  against `America/Detroit` from the hours table in `site.js`, and refresh every
  minute. Tonight's row is highlighted automatically in every hours table.
- **Forms** (VIP reservation, job application, contact, mailing list) compose a
  pre-filled email to `markbouzouki@gmail.com` and open the visitor's mail client.
  This works from day one with no backend. To move to a real endpoint, give the
  `<form>` an `action` and delete its `data-mailto` attribute — `forms()` in
  `site.js` only intercepts forms that carry `data-mailto`.
- **SEO**: per-page titles, descriptions, canonicals, Open Graph and Twitter
  cards, plus `NightClub` JSON-LD with address, geo, phone and opening hours. This
  is the part that will earn its keep fastest, since the club has never had a site.

## The dancers

The two figures flanking the hero, standing in every section divider and inside
the plates are **true vector** — the `#i-fig-l` / `#i-fig-r` symbols in the
sprite in `src/layout.html`.

They were retraced from the **gold watermark on `stage-floor.jpg`**, which is
463px wide against the 150px Instagram avatar the first attempt used. Two things
made that source much better: the extra resolution, and the fact that a flat
gold overlay isolates on a *colour* test rather than luminance, which is far
cleaner than thresholding a JPEG of white-on-black.

Pipeline (`scratchpad/fig2/trace2.html`):

1. gold threshold — `r > 130 && r - b > 55 && g - b > 25 && g < r`
2. largest connected component inside each region
3. Moore-neighbour boundary walk for the outer contour
4. flood-fill from the border to find enclosed holes, traced the same way
5. Douglas-Peucker simplify, then Catmull-Rom through the survivors as cubic
   beziers — outer contour and hole in one path, `fill-rule: evenodd`

Two measurements worth keeping if they are ever retraced:

- **Each dancer is fused to her own side's column bar** in the artwork, so a
  flood fill swallows the column. The coverage profile puts the two fluted bars
  at x 171–195 and 200–222 at full coverage, with the mark's centre seam at
  196–199, so the regions are cut at x=170 and x=223. That flat inner edge is
  exactly where figure meets column, which is why the divider's
  figure-column-figure lockup butts together correctly.
- **Each symbol carries its own viewBox ratio**, mirrored by `.fig--l` /
  `.fig--r` `aspect-ratio` (237.44 and 229.82 per 100 wide). An `<svg>` given
  only a height resolves `width: auto` to 100% of its container, and the art
  ends up letterboxed in an over-wide box with every offset landing short.

Earlier attempts, for the record: two hand-drawn SVG versions (outline paths,
then ellipses-and-tapered-strokes) were abandoned — neither reached a standard
worth shipping. The traced avatar version that followed was correct but soft.

## Photography

The club supplied eight photographs. Every slot on the site is already wired to
them by filename — see `assets/img/photos/PUT-PHOTOS-HERE.txt` for the manifest.
Drop the files in with those exact names and 19 slots light up at once.

**The fallback is the important part.** `.plate__img` is the *last* background
layer in each plate, so a photo simply covers the bokeh-and-silhouette
composition when it loads. If a file is missing or misnamed you get the vector
plate, not an empty box — so a typo degrades instead of breaking. The homepage
and Visit hero backdrops work the same way. Never "optimise" this by hiding the
fallback behind a `.plate--photo` class.

Slots still on vector because no photograph covers them:

| Slot | What would fill it |
|---|---|
| The Kitchen (club page) | Flaming saganaki — the dish the room is named around |
| "Saganaki, Lit" (gallery 08) | same |
| Booth Nine | A curtained VIP booth, occupied, curtain half drawn |

### Two better source files hiding in the supplied photos

- **`signs-night.jpg`** — the "LIVE EXOTIC ENTERTAINMENT" blade sign carries a
  large, clean, high-contrast dancer-and-column silhouette. That is a far better
  trace source than the 150px logo the current `#i-fig-*` symbols came from.
  Worth re-running the tracer against it.
- **`stage-pole.jpg`** — carries the gold logo watermark, a cleaner rendition of
  the mark than the Instagram avatar.

### Rights

These are the club's own marketing photographs, used on the club's own site,
which is the intended use. Before launch confirm the photographer's rights are
settled and that anyone identifiable in them is still content to appear — people
leave, and a website is more permanent than an Instagram post.

## The hero wordmark is solid on purpose

"BOUZOUKI" used a metallic gradient via `background-clip: text` on each of its
eight animated letters. On a real iPhone in Low Power Mode it rendered as "BOU"
with the rest blank: WebKit intermittently fails to repaint clipped text on an
element being composited mid-animation, and throttled frames widen the race.
It could not be forced on a fast iOS simulator — which is what a race looks
like — so the fragile combination was removed rather than tuned:

- the letters are a solid fill; no `background-clip: text` on anything animated
- once the reveal finishes, `lockup()` collapses the eight spans back into one
  plain text node, so the resting state has no transforms and nothing the
  `overflow: hidden` reveal clip could hide, whatever a throttled browser did
  with the individual transitions
- `font-kerning: none` on the word keeps that swap from shifting any letters

`.gate__age` ("21+") still uses gradient text; it is static and has never
shown the problem, but it is the same technique if it ever does.

## Marquees — pace them by width, never by a fixed duration

`@keyframes slide` translates by `-100%` of the **track**, so with a fixed
`animation-duration` a wider track simply moves faster. `marquees()` therefore
measures the assembled track and derives the duration from a target px/sec
(58, or 95 for `.marquee__track--fast`). Do not put a fixed duration back.

This was a real bug: `marquees()` runs at `DOMContentLoaded`, before the web
fonts arrive, so it measured fallback metrics, over-duplicated the content and
built a track far wider than needed — which on a fixed duration read as the
rails racing. A refresh "fixed" it only because the fonts were then cached and
the measurement was right. It now rebuilds on `document.fonts.ready` and on
resize, reseeding from the authored markup each time (`marqueeSeed`) so repeat
builds cannot compound clones.

## The reel

`#reel` on the homepage, sitting between section 01 (The House) and 02 (The
Week), directly after the figure-column-figure divider: an auto-advancing band
of eight dancer photographs, 3.9s per frame.

Notes for whoever touches it next:

- The photographs are portrait and square; the band is wide. `cover` threw away
  more than half of every frame, so the sharp copy is **contained** and the
  gutters are filled with a blown-up, blurred copy of the same image
  (`.shot__blur`). Nothing is cropped out.
- Only the current frame and its two neighbours get a `background-image`, set
  from `data-shot` in JS. Eight full-bleed photographs do not all download on
  first paint.
- **Hover-pause is scoped to `.showcase__ui`, not the whole band.** The band is
  full-bleed and ~700px tall, so simply scrolling past leaves the cursor inside
  it. Bound to the section, `pointerenter` fired and the reel sat frozen until
  you moved the mouse out or clicked — which read as "it won't start on its
  own". Do not move those listeners back onto the section.
- It also pauses on keyboard focus, while the tab is hidden, and while scrolled
  off-screen. Under `prefers-reduced-motion` it does not auto-advance at all —
  arrows and ticks still work.
- Note when testing in a headless or hidden browser pane: `document.hidden` is
  `true` there, so the background-tab guard in `start()` correctly prevents any
  advance and the reel will look broken. It is not.
- Swipe on touch, arrow keys when hovered or focused, and the ticks along the
  bottom are both progress bar and jump-to control.

## Trademark warning — Tigers and Lions photographs

`tigers.jpg` and `lions.jpg` are in the reel at the client's instruction. Both
carry **MLB and NFL trademarks** — team wordmarks, the Lions logo, the mascots.
Pairing those marks with an adult venue invites a cease-and-desist on
implied-endorsement grounds, and both leagues police it. Instagram is a softer
target than a commercial website on the club's own domain.

To pull them, delete their two `<figure class="shot">` blocks and their two
`<button class="tick">` entries from `src/pages/index.html`, and rebuild — the
component reads its length from the DOM, so nothing else needs touching.

`lions.jpg` also appears to be AI-generated, which the client specifically did
not want elsewhere on the site.

## Before this goes live — confirm with the club

Hours, address, phone, email and the socials are taken from the club's own
Instagram and Facebook. The following were **modelled on comparable Detroit venues
and need the owner's sign-off**:

- VIP package names, prices and inclusions (`src/pages/vip.html`, and the teaser on `index.html`)
- Every price on the bar and kitchen menu (`src/pages/menu.html` — flagged in a comment)
- The named weekly nights (Industry Tuesday, Downtown Thursday, and the rest)
- Cover `$6`, coat check `$3` — reported by third-party Detroit club guides, not the club
- Dress code, house rules, audition nights and the deposit / cancellation terms
- "1978 Greektown roots" on the homepage — the Greek-restaurant era is well
  documented, the specific year is not

## Socials

Instagram [@bouzoukilounge](https://www.instagram.com/bouzoukilounge/) (primary) ·
[@bouzoukigreektown](https://www.instagram.com/bouzoukigreektown/) ·
X [@bouzoukilounge](https://x.com/bouzoukilounge) ·
[Facebook](https://www.facebook.com/bouzoukidetroit/)
