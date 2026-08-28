# Verification report — Stock Label Run

**Verdict: FAIL**

Verified on 2026-08-28 against candidate commit
`1f9f0ecccb9322d96074875ae3f83a4e381350b7` and
<https://stock-label-run.sociobot.in>. The live root document, service worker,
manifest, privacy page, terms page, and both hashed app bundles were
byte-for-byte identical to a fresh local production build of that commit.

The receiving and local-first product workflow is otherwise functional. This
candidate cannot pass because its product unlock verification API does not
rate-limit rapid requests, a mandatory acceptance check.

## Release blocker

### High — product unlock verification endpoint has no observed rate limit

`GET https://api.sociobot.in/api/v1/products/stock-label-run/verify` returned
HTTP 200 and an expected `{ "valid": false, "reason": "invalid" }` body for a
single invalid token. A fresh burst of **80 simultaneous invalid-token GETs**
returned **80 × HTTP 200**, **0 × HTTP 429**, and no `Retry-After` header.
The observed threshold is therefore **greater than 80 requests in this burst
(not observed)**. This violates the explicit product acceptance requirement
that every server-side endpoint, including the factory product-unlock call,
must begin returning 429 with `Retry-After`.

This is an external factory billing API dependency rather than code in this
repository, but it is in the shipped product path and blocks release until it
is protected.

## Other defects

### Medium — hashed static assets are not immutable-cacheable

Production served both `/assets/index-CXqn6cXr.js` and
`/assets/index-ubS1rJdj.css` with `Cache-Control: public, must-revalidate,
max-age=30`, rather than a long-lived immutable policy. The files are
content-hashed and precached by the service worker, but normal first/repeat
navigations still revalidate them every 30 seconds. Configure immutable caching
for hashed assets.

### Low — production response hardening is incomplete

The production document has HSTS, `X-Content-Type-Options: nosniff`, and
`Referrer-Policy: strict-origin-when-cross-origin`, but no
`Content-Security-Policy` or `Permissions-Policy` header. Add an appropriate
static-app CSP (including the documented `api.sociobot.in` license path) and a
minimal permissions policy. The manifest is also served as
`application/octet-stream`, rather than a web-manifest/JSON media type.

## Evidence that passed

### Clean reproduction and build

- Clean checkout was exactly `1f9f0ecccb9322d96074875ae3f83a4e381350b7`.
- `npm ci` completed with 0 vulnerabilities.
- `npm test` passed: 6 Vitest tests and the Playwright suite (9 passed, 1
  intentional mobile Axe skip).
- `npm run build` passed (`tsc --noEmit && vite build`) and produced `dist/`.
  There is no separate lint script; type checking is part of the build.
- Independent production Lighthouse mobile run: Performance **94**,
  Accessibility **100**, Best Practices **100**; FCP 1.0 s, LCP 1.7 s,
  CLS 0, TBT 280 ms.
- Built initial assets meet the stated budgets: JS 30,183 bytes (10,940 gzip),
  CSS 19,255 bytes (5,190 gzip), and onboarding WebP 126,560 bytes.

### Functional QA

- Desktop and 390 × 844 mobile: imported and checked a normal 50-SKU Code 128
  receiving CSV with no retyping; the UI showed 50 labels and two A4 sheets.
  Receipt printing saved a traceable local run receipt and receipt history.
- Exercised EAN-13 and UPC-A checksum checking, Code 39/Code 128 support,
  default quantity 1, valid max quantity 999, and the paid-limit gate above
  150 labels.
- Invalid checksum, zero/1000 quantity, lower-case Code 39, missing required
  header, and unclosed quoted field each displayed a useful error. Correcting
  an invalid barcode by keyboard recovered the printable state (also covered
  by the project Playwright assertion).
- A saved run exported as JSON with `product: "stock-label-run"`, `version: 1`,
  one receipt, and the correct label count.
- Draft persistence after reload and an offline reload were successful.

### Accessibility and browser behavior

- Empty and populated views had zero Axe **serious/critical** violations both
  locally and against production.
- HTML has `lang=en`, a title, one h1, main landmark, labelled controls and
  image alt text. Keyboard Tab reached the skip link with a visible 3 px blue
  focus outline. At 390 px there was no horizontal overflow.
- `prefers-reduced-motion: reduce` reduced transition/animation duration to
  0.00001 s. No console errors or page errors occurred in desktop or mobile
  production runs.

### Privacy, PWA, deployment, and policies

- On the normal free workflow, browser request capture showed only same-origin
  HTML, JS, CSS, and the local hero image: no analytics, tracking, remote
  font, or third-party runtime request. Source inspection found the only
  external runtime request is the documented `api.sociobot.in` license verify
  call, which is triggered only by a supplied/stored license.
- Privacy and Terms are live and match the candidate. No sign-in flow exists.
- Live service worker activated as `slr-v1.0.0-shell`; offline reload displayed
  “Offline · still ready” and retained the imported CSV. The worker uses
  versioned caches, `skipWaiting`, and `clientsClaim`; the app displayed its
  “A fresh version is ready” notice when given the worker update message.
- HTTPS responses returned HSTS, nosniff, and strict-origin referrer policy.
  The cache/CSP/Permissions-Policy gaps above are recorded as defects.

## Reproduction

```sh
npm ci
npm test
npm run build
npm run preview
```

Then use Chromium/Playwright against the preview or live URL to import a
50-row CSV, print a receipt, reload offline, and run Axe. The rate-limit probe
was 80 concurrent invalid-token GETs to the endpoint listed above; it must
produce a 429 plus `Retry-After` before this candidate can be accepted.

