# ConstructX

Marketing site for ConstructX — luxury residential, commercial, interior,
remodel, lake, and mountain construction.

A TypeScript frontend compiled to plain browser scripts, served by a Python
standard-library HTTP server. No frameworks, no bundler, and no runtime
third-party dependencies: everything the browser loads comes from this origin
except Google Fonts.

> The GitHub repository is named `ConctructX`; the brand is `ConstructX`.

## Quick start

```bash
npm install        # one time — installs TypeScript only
npm run dev        # compiles the frontend, then serves on http://127.0.0.1:8000
```

To run the server without recompiling:

```bash
npm start          # or: python3 app.py
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Build the frontend, then start the Python server |
| `npm run build` | Compile `frontend/src/*.ts` into `assets/js/` |
| `npm run watch` | Recompile on change |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run the Python test suite |
| `npm run check` | Type-check **and** test — run this before committing |
| `npm run images` | Regenerate responsive image variants from `assets/images/source/` |
| `npm start` | Start the server only |

## Architecture

```
Browser
  ├── boot.js          render-blocking, ~0.3 KB gz — sets .js, promotes fonts
  ├── styles.css       one stylesheet, token-driven
  ├── app.js           ~5.5 KB gz — nav, reveals, project fit, contact form
  └── hero-3d.js       ~3.1 KB gz — capability gate + render lifecycle
        └── (on demand, only if the device qualifies)
            ├── three.min.js     vendored, 146 KB gz
            └── hero-scene.js    ~5.9 KB gz — procedural residence geometry

Python server
  ├── static files     gzipped, long-cached under /assets/, security headers
  └── POST /api/enquiries   validated, rate limited, honeypotted, appended to JSONL
```

### Why the hero is split into two files

The interactive residence is the most expensive thing on the page. `hero-3d.js`
is a small gate that decides whether a real-time scene is appropriate before
anything heavy is fetched. It declines on reduced-motion preferences, screens
under 680px, `Save-Data`, 2G connections, missing WebGL, and low
memory/core counts. Only after passing does it download Three.js and the
geometry in parallel.

When it does run, the render loop stops whenever the hero leaves the viewport
or the tab is hidden, and it stops scheduling frames entirely once the model
settles. Visitors who never qualify still see the hero: the photograph sits
underneath the canvas and is the element that gets preloaded.

### Frontend conventions

- Source is `frontend/src/*.ts`, compiled with `strict: true`. Do not hand-edit
  `assets/js/*.js` — it is generated.
- Files compile as **classic scripts**, not ES modules. Anything declared at the
  top level of a `.ts` file is global, so keep declarations inside the IIFE
  unless they are meant to be shared.
- `app.ts` is a set of independent `init*` functions, each a no-op when its
  markup is missing. One missing element should never take down the page.
- Every scroll-driven effect registers through `onScrollFrame()`, which batches
  them into a single rAF-throttled listener.

### Styling conventions

- All design decisions live as custom properties at the top of `styles.css` —
  colour, type scale, spacing scale, radii, motion. Change a token, not a rule.
- **`--bronze` is a graphic accent only.** Bronze text on the cream background
  measures 2.88:1 and fails WCAG AA. Use `--bronze-text` (#826945, 4.55:1) for
  anything a person has to read.
- Entrance animations and scroll reveals are scoped to `.js`, which `boot.js`
  sets before first paint. Without scripting, the page renders fully visible
  rather than as a column of `opacity: 0` sections.

### Images

Source photography lives in `assets/images/source/`. `npm run images` generates
WebP and JPEG variants at the widths each slot actually uses, plus a
`manifest.json` recording intrinsic sizes and a dominant colour used as the CSS
placeholder. The generated files are committed so static hosts can serve the
repo directly.

## Private enquiries

The contact form posts JSON to `POST /api/enquiries`. Submissions are appended
to `data/enquiries.jsonl`, which is git-ignored so client details never reach
the repository.

Protections on that endpoint:

- 5 submissions per client per 15 minutes (sliding window)
- a hidden `company` honeypot field, and a minimum two-second fill time
- 12 KB request cap, field-level validation, and length limits
- whitespace collapsing on all input, which is what keeps newlines out of the
  outgoing email headers
- a process-wide write lock plus `fsync`, so concurrent submissions cannot
  interleave mid-line

### Email delivery

Without SMTP configured, enquiries are still accepted and stored locally. To
also email the team, set these in the hosting environment:

```bash
export CONSTRUCTX_TEAM_EMAIL="team@example.com"
export SMTP_HOST="smtp.example.com"
export SMTP_PORT="587"
export SMTP_USERNAME="smtp-user"
export SMTP_PASSWORD="smtp-password"
export SMTP_FROM_EMAIL="website@example.com"
```

### Other environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8000` | Listening port |
| `HOST` | `127.0.0.1` | Set to `0.0.0.0` to expose the dev server |
| `CONSTRUCTX_DATA_DIR` | `./data` | Where enquiries are written |
| `CONSTRUCTX_QUIET` | unset | Suppress request logging |

## Deployment

**With the Python server** (full functionality): run `python3 app.py` behind a
reverse proxy with TLS. Set `HOST=0.0.0.0` and a `PORT`. The server sets its own
security headers; if your proxy also sets them, remove one of the two so they do
not conflict.

**Static hosting** (GitHub Pages and similar): the repository is directly
servable — `.nojekyll` is present and all generated assets are committed. The
site renders completely, but there is no enquiry API, so the contact form
reports that the service is unreachable and asks the visitor to email instead.
Security headers and caching become the host's responsibility.

## Before going live

`docs/PRELAUNCH.md` lists the placeholder content that must be replaced with
real values — the canonical domain, the testimonial, and the contractor licence
line. Work through it before the site is public.

## Testing

```bash
npm run check
```

39 tests cover input validation, email-header-injection resistance, spam
detection, rate limiting, concurrent write safety, security headers,
compression, cache policy, path traversal, and the enquiry endpoint end to end.
