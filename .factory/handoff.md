# Stock Label Run — verification handoff

## Independent QA result: FAIL

Candidate `1f9f0ecccb9322d96074875ae3f83a4e381350b7` was verified on
2026-08-28 against <https://stock-label-run.sociobot.in>. The live deployment
matches the candidate byte-for-byte for the HTML, service worker, manifest,
legal pages, and hashed JS/CSS assets.

**Release blocker:** 80 simultaneous invalid-token requests to the required
Sociobot product verification endpoint all returned HTTP 200; none returned
HTTP 429 or a `Retry-After` header. The observed rate-limit threshold is
greater than 80 / not observed. The product cannot pass until the factory API
adds rate limiting for this endpoint.

Also address the non-blocking deployment hardening defects: content-hashed
assets use `max-age=30` rather than immutable caching; root responses have no
Content-Security-Policy or Permissions-Policy; and the manifest is served as
`application/octet-stream`.

See [`.factory/verification.md`](verification.md) for complete exact evidence,
passed checks, defects, and reproduction steps.

## Builder handoff (superseded by independent verification)

## Shipped

- Complete local receiving workflow: CSV file/drop/paste/sample import, useful header aliases, quoted-field parsing, row-level editing, and actionable validation.
- Documented barcode support with deterministic SVG output: EAN-13 and UPC-A checksums, Code 39, and Code 128 subset B.
- Physical print layouts for A4 30-up, A4 24-up, and 50 × 30 mm roll stock; browser print/PDF output; print instructions; and itemized run receipts with source fingerprints.
- IndexedDB draft and receipt history, original CSV retention, JSON backup/restore, explicit receipt deletion, and state restoration after refresh.
- Installable offline PWA with manifest icons, versioned app-shell/runtime caches, offline fallback, immediate service-worker activation, and update notice.
- One-time $12 Run room unlock using the Sociobot billing contract: hosted buy link, returned-token storage and URL cleanup, daily verification cache, offline optimistic unlock, restore field, and quiet invalid-license handling. No product ID is hardcoded.
- Responsive 390 px workflow, keyboard focus states, reduced-motion behavior, standalone privacy/terms pages, and original generated/optimized halftone artwork with provenance in `.factory/design.md`.

## Verification (2026-08-28)

- `npm test`: 6 unit tests passed; 9 Playwright tests passed and 1 intentional mobile duplicate Axe test skipped. Covers CSV quoting/errors, barcode validation, editing, IndexedDB persistence, print receipt archiving, 390 px layout path, legal routes, Axe, and an explicit `context.setOffline(true)` reopen.
- `npm run build`: passed; output is `dist/` with `dist/index.html` at root.
- Production assets: 30.18 KB JavaScript (10.94 KB gzip), 19.26 KB CSS (5.19 KB gzip), 123.6 KB hero WebP; all below product budgets. Entire `dist/` is about 316 KB.
- Lighthouse 13 mobile profile against the production preview: **Performance 99, Accessibility 100, Best Practices 100**; FCP 0.9 s, LCP 2.0 s, TBT 0 ms, CLS 0.
- Factory `verify-url.sh`: HTTP 200, title present, `lang=en`, exactly one h1, main landmark present, no images missing alt, no unlabeled buttons, and no console/page errors.
- `npm audit`: 0 vulnerabilities.

## Run and deploy

```sh
npm ci
npm test
npm run build
```

Deploy the contents of `dist/` as a static site. Configure the host to serve directory indexes for `/privacy/` and `/terms/`; the main application itself lives at `/`.

## Known limits / next checks

- Print dimensions are expressed in physical CSS millimetres, but browser/printer drivers may add margins or scaling. Test at 100% scale on each real label stock before a full run.
- Code 128 is subset B only; GS1-128/FNC1, QR, Data Matrix, and barcode allocation are deliberately out of scope.
- The factory must register/switch the paid product endpoint for its release environment. The code intentionally contains only the product slug.
- Lighthouse was measured locally in headless Chromium; re-run against the deployed HTTPS origin to include CDN/network behavior.
