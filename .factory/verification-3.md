# Stock Label Run — independent verification 3

**Result: FAIL** — candidate `1f9f0ecccb9322d96074875ae3f83a4e381350b7`
was independently tested on 2026-08-28 against
<https://stock-label-run.sociobot.in>. The earlier production-only rate-limit
failure is no longer reproducible. This candidate is nevertheless not ready
under the supplied mobile accessibility acceptance contract because several
interactive targets at 390 px are smaller than 44 CSS px.

## Scope and environment

- Clean detached checkout at the candidate SHA in `/tmp/stock-label-run-qa`.
- Clean dependency install with `npm ci`: 60 packages audited, 0
  vulnerabilities.
- Candidate production build served locally with `vite preview`; live checks
  used Chromium/Playwright over HTTPS.
- No product source or production asset was changed during verification.

## Automated quality gates

| Check | Result | Evidence |
| --- | --- | --- |
| Unit tests | PASS | `vitest run`: 6/6 passed. |
| Browser integration tests | PASS | `playwright test`: 9 passed, 1 intentionally skipped duplicate mobile Axe test. |
| Type check and exact production build | PASS | `npm run build` ran `tsc --noEmit` then Vite successfully and produced `dist/`. No separate lint script/configuration exists. |
| Dependency audit | PASS | `npm ci` reported 0 vulnerabilities. |
| Bundle budget | PASS | initial JS 30,183 B (10,940 B gzip); CSS 19,255 B (5,190 B gzip); WebP 126,560 B. Initial JS/CSS and image are within the stated 200 KB/50 KB/300 KB budgets. `dist/` totals 316 KB including a 67,128 B source map. |
| Desktop Axe serious/critical | PASS | Candidate suite checked empty and populated states: none. |
| 390 px Axe serious/critical | PASS | Independent populated-state scan: `[]`. |

## Product flow evidence

The core receiving workflow works in both desktop Chromium and the supplied
390 x 844 mobile profile:

1. Imported the checked sample and independently pasted a 50-row, Code 128
   CSV. The app reported **Print 50 labels**, created the printable run
   receipt, and showed it in local receipt history as 50 labels / 50 SKUs.
2. Exercised invalid input: a quantity of `1000` was rejected with “Quantity
   must be a whole number from 1 to 999”; an invalid EAN-13 checksum was
   rejected. Correcting to quantity `999` and `5901234123457` respectively
   changed both rows to Ready and the heading to “Every row is printable.”
3. Confirmed receipt-print action calls the browser print path, then refreshed
   and observed the imported 50-row draft persisted in IndexedDB.
4. The 390 px working view had no page-level horizontal overflow
   (`scrollWidth === innerWidth === 390`) and its responsive card table did
   not overflow (`358/358` client/scroll width).
5. Keyboard-only smoke test reached the skip link, home link, unlock button,
   each run-step link, and file actions in order. Each had the designed,
   visible solid 3 px focus outline.
6. Under `prefers-reduced-motion: reduce`, row animation duration was reduced
   to 0.01 ms and transitions to 0.01 ms (effectively instantaneous).

## PWA, offline, privacy, and network

- Live HTTPS manifest has no Chromium installability errors. The live page is
  controlled by `https://stock-label-run.sociobot.in/sw.js`, with the
  `slr-v1.0.0-shell` cache present.
- After service-worker control, forcing the browser offline and reloading
  retained the app and showed “Offline · still ready.” The persisted draft
  also remained available. `registration.update()` completed with no waiting
  or installing worker, as expected for an unchanged live deployment. The
  source contains versioned cache names, `skipWaiting`, `clientsClaim`, and
  the update-notice message path; a genuine version transition could not be
  observed without changing the candidate or live deployment.
- Normal free-workflow browser requests went only to
  `https://stock-label-run.sociobot.in`; there were no console errors or page
  errors. Source inspection found no analytics, remote fonts, or third-party
  runtime scripts. CSV/draft/run data use IndexedDB. The only external
  endpoint is the documented opt-in Sociobot billing/verification flow.
- No sign-in flow exists, so Entra tenant validation is not applicable.
- The live verification API now rate limits correctly: an 80-request
  sequential burst to
  `GET https://api.sociobot.in/api/v1/products/stock-label-run/verify?license=qa-invalid-rate-limit-probe`
  produced 30 HTTP 200 responses followed by 50 HTTP 429 responses. The
  observed threshold was request 31; a subsequent throttled response carried
  `Retry-After: 0` (also `X-RateLimit-After: 0`). This resolves the previous
  report's API blocker.

## Deployment identity and response policy

Every file emitted by this candidate's `dist/` matched the live byte content:
root HTML, service worker, manifest, offline page, privacy and terms pages,
legal CSS, JS, CSS, source map, illustration, and all three icons. Thus the
live URL is serving this candidate's build, not the earlier verification
commit.

Live responses correctly include HTTPS/HSTS, `Referrer-Policy:
strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`.
They do not include Content-Security-Policy, Permissions-Policy, or a frame
ancestors/X-Frame-Options policy. `manifest.webmanifest` is served as
`application/octet-stream`; Chromium still reports it installable. HTML,
service-worker, and content-hashed JS/CSS/image assets all use only
`Cache-Control: public, must-revalidate, max-age=30` rather than long-lived
immutable caching for hashed assets.

## Defects

### M2 — 390 px touch targets violate the required 44 x 44 CSS px minimum

At the required 390 px mobile viewport:

- **Unlock run room** measures 32 px high.
- The footer **Privacy** and **Terms** links measure 20 px high.
- The home/brand link measures 40 px high.

These controls are keyboard accessible and Axe does not flag them, but they
do not meet the explicit mobile/touch target requirement in the acceptance
contract. This is a release blocker for an accessibility-complete mobile PWA.

### M3 — deployed hashed assets are not immutably cached

`/assets/index-CXqn6cXr.js`, `/assets/index-ubS1rJdj.css`, and the WebP all
return `Cache-Control: public, must-revalidate, max-age=30`. This misses the
PWA performance policy requiring long-lived immutable caching for hashed
assets and makes repeat opens unnecessarily revalidate.

### M3 — missing browser hardening policies

The live root response lacks CSP, Permissions-Policy, and a frame-embedding
restriction. These are deployment configuration issues, not a source-build
mismatch, but should be added before release.

## Reproduction

```sh
git worktree add --detach /tmp/stock-label-run-qa 1f9f0ecccb9322d96074875ae3f83a4e381350b7
cd /tmp/stock-label-run-qa
npm ci
npm test
npm run build
npm run preview -- --port 4174
```

Use Playwright at a 390 x 844 viewport after importing the sample, then
inspect `getBoundingClientRect().height` for the controls named above. Check
live headers with `curl -sSI https://stock-label-run.sociobot.in/assets/index-CXqn6cXr.js`.
