# Before this site goes live

Everything below is placeholder content. Some of it is only cosmetic; two items
carry real legal or reputational risk. Work top-down.

## 1. Claims that must be true — do these first

### Contractor licence

The previous version of this page displayed `Lic. CCX-4417` in the footer.
That number was not real. **A licence number on a contractor's site is a
regulatory claim**, and publishing a fabricated one exposes the business in
every state that regulates the trade.

It has been removed rather than replaced with another invented value. Put the
genuine licence number back in the footer of `index.html`, alongside the
copyright line, once you have it:

```html
<span>&copy; <span id="year">2026</span> ConstructX Builders LLC · Lic. YOUR-REAL-NUMBER</span>
```

If ConstructX holds licences in several states, list them or link to a licensing
page. If it is not yet licensed, leave the line out entirely.

### Leadership

The page previously named four people — Dana Whitfield, Marcus Reyes, Priya
Anand, and Sam Okafor — with photographs implied by initials blocks. None of
them exist. Invented staff are trivially disproved by a search and undermine
the credibility the rest of the page is working to build.

They have been replaced with four **role** cards in the `#team` section:
Principal, Preconstruction lead, VDC & coordination, and Superintendent. That
is honest, and it still tells an owner how the job is staffed.

When you have real people who have agreed to appear publicly, swap the role
cards for named cards with genuine headshots. Until then, leave the roles.

### Testimonial

The quote attributed to a "Private client · Project North Star" in the
`.quote-sec` section has no known source. Either:

- replace it with a real quote you have written permission to publish, or
- delete the whole `<section class="sec quote-sec sec-lazy">` block.

Do not ship an invented testimonial.

### Project case studies

The three portfolio entries — North Star, Cascade, Aster — describe materials,
scopes, and handover years. Confirm these correspond to real completed work
before publishing. The anonymised framing is good practice and worth keeping;
the underlying facts still need to be true.

## 2. Domain and metadata

`constructx.example.com` is a placeholder. Replace it everywhere:

| File | What to change |
| --- | --- |
| `index.html` | `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image`, and the `url` and `image` fields in the JSON-LD block |
| `robots.txt` | the `Sitemap:` line |
| `sitemap.xml` | the `<loc>` value |

Quick check after editing:

```bash
grep -rn "constructx.example.com" . --exclude-dir=node_modules --exclude-dir=.git
```

That command should return nothing when you are done.

## 3. Contact details

The page currently offers only the enquiry form. Most visitors evaluating a
high-end builder will want a phone number and a physical service address, and
both also strengthen local search.

- Add a phone number and business address to the footer.
- Add matching `telephone`, `address`, and `openingHours` fields to the JSON-LD
  `GeneralContractor` block in `index.html`.
- The contact form's failure message tells visitors to "email the team
  directly" but gives no address. Put a real `mailto:` link there —
  `initContactForm()` in `frontend/src/app.ts`, in the `catch` branch.

## 4. Deployment configuration

- Set `CONSTRUCTX_TEAM_EMAIL` and the `SMTP_*` variables, or enquiries will only
  ever be written to disk and nobody will be notified. See the README.
- Decide where `data/enquiries.jsonl` lives in production and make sure it is
  backed up. It contains client contact details and is the only copy.
- If a reverse proxy sits in front of the server, confirm it forwards
  `X-Forwarded-For` — the rate limiter keys on it, and without it every visitor
  shares one bucket.
- Confirm the proxy is not also emitting security headers. Two conflicting
  `Content-Security-Policy` headers resolve to the intersection of both, which
  usually breaks something quietly.

## 5. Content review

- The `#ownership` section presents a client portal with progress bars, a
  document vault, and pending approvals. If that product does not exist yet, the
  section is describing a promise rather than a feature. Either build it, label
  it as coming soon, or cut it.
- `og:image` currently points at the hero photograph. A purpose-made share card
  with the wordmark on it will perform better in link previews.
- The favicon is a single SVG. Add PNG fallbacks at 180px and 512px for older
  iOS and Android launchers, and reference them from `site.webmanifest`.
