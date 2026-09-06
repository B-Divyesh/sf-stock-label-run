# Stock Label Run — repair 2 handoff

## Result

The repaired implementation is deployed and cold-checked.

- Implementation commit: 9738963abfaa72f28ade7202d5d902930c8305c9
- Product: an offline, local-first tool for small shops and makers to turn a
  receiving CSV into checked barcode labels and a saved print receipt.
- First action: Try it with sample data opens a populated nine-label demo.
- Static deployment: 466d4896-5820-4481-a8ea-a41789eb31c4 on 6 September
  2026 UTC.

## What changed

1. Demo isolation: /demo now has the title Demo — Stock Label Run, immediately
   seeds the realistic sample, shows the persistent demo banner, and uses only
   the demo:stock-label-run IndexedDB namespace. Reset demo reseeds that
   namespace. Start for real deletes it and preserves normal stock-label-run
   data.
2. Landing and mobile: the first screen names the job and audience, exposes
   the sample action plus private/offline/free facts, and fits them into fresh
   desktop and 390 px phone views. All populated editable controls and legal
   links meet the 44 px touch target rule.
3. Recovery and records: restored receipt backups open Run receipts from the
   empty state. Printed receipt, JSON backup, delete, invalid data, boundary,
   and offline paths have browser regressions.
4. Site structure: added the demo multi-page entry, designed 404, robots,
   sitemap, canonical/Open Graph/Twitter/Apple metadata, social image, route
   titles, shared navigation/footer details, and an CSP-safe offline page.
5. Proof: added 14 sandboxed public claims in .factory/claims.json, each with
   one tagged Playwright outcome test. Added .factory/demo.md and the required
   copy audit.
6. Paid upgrade: preserved the US $12 one-time Run room upgrade and the
   restore/verify path. The broken checkout link is no longer shown. The app
   now says checkout is unavailable pending external billing registration.

## Verification

From a clean dependency install:

    npm ci
    npm audit --omit=dev
    npm test
    npm run build

Results on 6 September 2026 UTC:

- npm audit --omit=dev: 0 vulnerabilities.
- npm test: 6 Vitest tests passed; 35 Playwright tests passed; one desktop-only
  duplicate mobile regression was intentionally skipped.
- npm run build: passed and emitted dist/index.html plus the /demo entry.
- Every one of the 14 commands declared in .factory/claims.json passed from
  the documented setup.
- Playwright Axe scans passed with no serious or critical issues on root,
  populated demo, and Terms. The separate axe CLI attempt could not locate a
  compatible Selenium ChromeDriver for the worker’s Chromium 145; the shipped
  Playwright Axe integration is the equivalent required check.
- verify-url.sh against the production build preview passed: title, lang, one
  h1, main, image alt text, labels, and zero browser console errors.
- verify-url.sh against https://stock-label-run.sociobot.in/ passed in 686 ms.
  Fresh live desktop and 390 px phone contexts showed the job, audience,
  sample action, and facts before scrolling; root and /demo had no console
  errors or serious/critical Axe findings. Live /privacy/, /terms/, and
  /offline.html returned their intended pages, and an unknown URL returned the
  designed 404 with HTTP 404.
- Fresh 1440 × 900 and 390 × 844 browser screenshots were reviewed. The job,
  audience, sample action, and all three facts are visible before scrolling.
- Final initial assets: JavaScript 34.11 KB (12.15 KB gzip), CSS 22.40 KB
  (5.72 KB gzip), hero 126.56 KB, social image 111.41 KB.
- Lighthouse 11 was attempted against the same local preview using the bundled
  Chromium. It did not complete because that browser’s DevTools trace shape is
  newer than the installed Lighthouse collector. No final Lighthouse score is
  claimed; the asset budgets, verify-url, and Playwright accessibility checks
  above passed.

## Previous verification disposition

| Verification 4 finding | Current disposition |
| --- | --- |
| Demo wrote sample data into normal IndexedDB | Resolved with the dedicated demo namespace, banner, reset, exit, and regression. |
| Checkout returned 404 | External billing registration remains unavailable; no broken checkout link is advertised. Offer metadata is supplied for the billing operator. |
| Claims registry missing | Resolved with 14 runnable tagged sandbox claims. |
| Populated mobile controls were 40 px | Resolved; full populated phone control scan passes. |
| First-screen/site order incomplete | Resolved with plain first-screen copy, facts, shared navigation/footer, copy audit, and paid section. |
| Routes, metadata, and 404 incomplete | Resolved in the static build and confirmed live, including the designed HTTP 404. |
| Restored receipts inaccessible from empty state | Resolved; restore opens the receipt archive and the empty import view retains a Run receipts control. |

Earlier immutable cache, CSP, Permissions-Policy, frame protection, manifest
MIME type, and billing verification rate-limit fixes remain present in
staticwebapp.config.json or the external verification service respectively.

## Billing dependency

The billing-registration operator must register the existing one-time offer
before a hosted checkout can be active. The exact public metadata is in
.factory/billing-offer.json and was copied to /work/.evidence/billing-offer.json.
It records the product origin, US $12 minor-unit price, one-time price type,
paid features, return URL, and license validation URL. No payment credentials
are stored in this repository.

## Deployment and next steps

The static deployment used implementation commit 9738963 and preserved the
single static product configuration. Its live route and fresh-browser checks
are recorded above. Later documentation-only commits do not require a new
product image.

The only known functional dependency is billing registration. Free CSV import,
checking, A4 30-up labels, receipt history, backup, demo, and offline use do
not depend on it.
