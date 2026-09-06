# Verify CSV-to-barcode label runs — independent verification 5

**Verdict: FAIL**

- Finding count: **3**
- Untested public claim count: **7**
- Implementation candidate: `9738963abfaa72f28ade7202d5d902930c8305c9`
- Documentation baseline: `9f0e3a8fb663ca59af0ad244f0af7a75a3734254`
- Live URL: <https://stock-label-run.sociobot.in>
- Verified: 6 September 2026 UTC

The implementation and live product work through the core receiving job. The
verdict is FAIL because six declared claim tests do not prove their complete
public claims, one paid-workflow claim group is absent from the claim registry,
and the offline and 404 routes do not meet the required site structure.

## First screen before scrolling

Fresh Chromium contexts were used at 1440 × 900 and 390 × 844.

| Question | Live answer | Result |
| --- | --- | --- |
| Job | “Create barcode labels from a stock CSV” | PASS |
| Audience | “For small shops and makers receiving stock…” | PASS |
| First action | “Try it with sample data” | PASS |
| Three facts | CSV stays in this browser; opens after the first visit; A4 labels, receipts, and backups are free. | PASS |

All four parts were fully visible without scrolling on desktop and phone.

## Findings

### High — six declared claim tests do not prove their complete claims

All declared commands exit successfully, but the following tagged tests would
still pass if part of the public claim were broken:

| Claim | Missing assertion |
| --- | --- |
| `csv-file-guards` | Rejects a non-CSV and 2 MB plus one byte, but never accepts a CSV at the stated 2 MB boundary. A build that rejected every file could pass. |
| `gtin-validation` | Rejects one bad EAN-13 and accepts one valid UPC-A, but never rejects a bad UPC-A checksum. |
| `code-validation` | Rejects lower-case Code 39 and accepts one Code 128 value, but never rejects a value outside Code 128 subset B. |
| `a4-label-sheet` | Asserts A4-like width and nine sample labels, but not 297 mm height or the claimed 30-up capacity. A 24-up grid could pass. |
| `backup-round-trip` | Restores JSON and checks the export filename, but never reads the downloaded file. Empty or corrupt export content could pass. |
| `free-label-limit` | Checks that 151 labels open the upgrade panel, but never proves that 150 labels print. A lower limit could pass. |

Independent live checks found the current 2 MB boundary, 150-label boundary,
and exported backup content working. That does not replace the required tagged
regression on every build. These six claims remain incompletely tested.

### Medium — the paid license workflow is an unlisted public claim

The landing page, license panel, Terms, and README say that an existing license
can be restored and that it enables unlimited labels, A4 24-up stock,
50 × 30 mm stock, and custom footers. No entry in `.factory/claims.json` covers
a valid pasted license or any paid feature becoming usable. The existing
`license-daily-check` test uses an invalid license and only checks request
frequency and continued free access.

A fresh live browser with a fixture valid verification response successfully
restored a license, enabled A4 24-up, enabled the footer, and printed a
151-label receipt. The implementation works in that sandbox, but the public
claim is not registered or run by the declared claim suite. This is one
untested public claim group.

### Medium — offline and 404 pages do not meet the route structure contract

`/offline.html` has the correct title, `lang`, one h1, one main landmark, and a
working return link. It has no shared header or footer, canonical link, Open
Graph metadata, Twitter metadata, favicon, or Apple touch icon.

`/404.html` is a useful designed page and unknown URLs correctly return HTTP
404. It still lacks Open Graph and Twitter metadata. The 404 status is expected
and is not the defect; the missing required route structure is.

This means the earlier routes-and-metadata finding is only partly resolved.

## Declared claim commands

Every command below was run separately from a detached clean checkout after
`npm ci`.

| Claim ID | Command result | Coverage result |
| --- | --- | --- |
| `demo-sandbox` | PASS, 2 browser projects | PASS |
| `private-free-workflow` | PASS, 2 browser projects | PASS |
| `csv-import` | PASS, 2 browser projects | PASS |
| `csv-file-guards` | PASS, 2 browser projects | INCOMPLETE |
| `gtin-validation` | PASS, 2 browser projects | INCOMPLETE |
| `code-validation` | PASS, 2 browser projects | INCOMPLETE |
| `a4-label-sheet` | PASS, 2 browser projects | INCOMPLETE |
| `receipt-history` | PASS, 2 browser projects | PASS |
| `backup-round-trip` | PASS, 2 browser projects | INCOMPLETE |
| `free-label-limit` | PASS, 2 browser projects | INCOMPLETE |
| `receipt-delete` | PASS, 2 browser projects | PASS |
| `license-daily-check` | PASS, 2 browser projects | PASS |
| `offline-reload` | PASS, 2 browser projects | PASS |
| `pwa-shell-precache` | PASS, 2 browser projects | PASS |

Each command was the exact `test` string declared in `.factory/claims.json`.
The coverage result applies the supplied rule that a test must assert the
promised outcome, not only a nearby state.

## Checks that passed

### Clean checkout and build

The detached checkout was exactly the implementation candidate.

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 59 packages installed; 0 vulnerabilities. |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities. |
| `npm test` | PASS — 6 unit tests and 35 browser tests; 1 intended project-specific skip. |
| `npm run build` | PASS — type check and Vite build produced `dist/index.html`. |
| URL verifier | PASS — title, `lang=en`, one h1, main, image alt text, labels, and no unexpected console errors. |

The initial build emits 34.11 KB JavaScript (12.10 KB gzip), 22.40 KB CSS
(5.73 KB gzip), and a 126.56 KB hero image. These meet the supplied budgets.

Lighthouse 13 mobile scores were Performance 100, Accessibility 100, Best
Practices 100, and SEO 100. FCP was 0.99 s, LCP 1.66 s, TBT 0 ms, and CLS 0.

### Live receiving workflow

- A one-click demo opened Cedar soap, Small canvas pouch, and Repair kit with
  nine visible labels.
- The demo banner remained after reload. Reset restored a changed sample.
  Start for real deleted `demo:stock-label-run` and preserved the separate
  `stock-label-run` draft.
- A generated 50-row receiving CSV produced 50 labels, 50 SKUs, and a saved
  receipt in 2.1 seconds without retyping.
- Quoted commas, header aliases, default quantity one, valid quantity 999,
  invalid quantities 0 and 1000, malformed quotes, a missing SKU header, wrong
  file type, and a file over 2 MB all produced the expected result or recovery
  message.
- An exact 2,097,152-byte CSV was accepted. A 150-label run printed; a
  151-label free run opened the upgrade state.
- Invalid backup JSON gave a recovery message. A valid backup restored from
  the empty state, opened Run receipts, and exported parseable JSON containing
  the restored receipt.

### Accessibility, mobile, and privacy

- Playwright Axe found no serious or critical issues on the live root, demo,
  or Terms pages. Lighthouse Accessibility scored 100.
- The first Tab reached the visible skip link with a designed focus outline.
  Enter moved the next keyboard stop into main content. No trap was found.
- Every enabled control and link measured at least 44 × 44 CSS px at 390 px on
  root, demo, Privacy, Terms, offline, and 404 pages.
- The populated phone view had no page-level horizontal overflow. Reduced
  motion reduced animation and transition durations to 0.00001 seconds.
- Request capture for the complete free demo flow saw only the product origin.
  No analytics, remote fonts, or third-party scripts loaded.

### PWA, routes, and external product endpoint

- The manifest had no Chromium parsing or installability errors.
- After service-worker control, offline reload retained the populated sample
  and showed “Offline · still ready.” The declared shell, demo, legal pages,
  and illustration were present in Cache Storage. The update message path
  showed its reload notice.
- Root, demo, Privacy, Terms, and offline returned HTTP 200. An unknown URL
  returned the designed page with HTTP 404. Internal links checked from the
  root returned HTTP 200.
- Thirty invalid license verification requests returned 200; request 31 and
  the next four returned 429 with `Retry-After: 3`.
- The hosted checkout still returns 404. The product does not link to it and
  clearly says checkout is temporarily unavailable, so there is no broken
  advertised action. Billing registration remains an external dependency.

## Deployment identity

Every emitted runtime file except the deployment-only
`staticwebapp.config.json` matched the live response byte for byte. This
included both HTML entries, legal and offline pages, the 404 document, app
bundles and maps, service worker, manifest, icons, images, robots, and sitemap.
The live runtime is therefore the implementation candidate; the later
documentation commit does not require a new product image.

Live responses retain the expected CSP, Permissions-Policy, frame protection,
nosniff, and referrer policy. Hashed assets use one-year immutable caching, the
service worker uses `no-cache`, and the manifest is served as
`application/manifest+json`.

## Earlier finding disposition

| Earlier finding | Current disposition |
| --- | --- |
| License verification lacked 429 and `Retry-After` | RESOLVED — request 31 returned 429 with `Retry-After: 3`. |
| Hashed assets lacked immutable caching | RESOLVED — live hashed assets use one-year immutable caching. |
| CSP, permissions, and frame policies were absent | RESOLVED — all are present with no policy console errors. |
| Manifest media type was wrong | RESOLVED — live type is `application/manifest+json`. |
| Root and populated phone targets were below 44 px | RESOLVED — all tested routes and populated controls pass at 390 px. |
| Demo used normal data and lacked controls | RESOLVED — separate database, banner, reset, and exit were verified live. |
| Hosted checkout was a broken advertised action | RESOLVED IN PRODUCT — the dead action is removed and the dependency is stated plainly. Registration is still pending. |
| Claim registry was absent | PARTLY RESOLVED — 14 entries run, but six tests are incomplete and one public paid claim group is unlisted. |
| First screen and site order were incomplete | RESOLVED — job, audience, action, facts, sections, and footer appear in the required order. |
| Routes, metadata, and 404 were incomplete | PARTLY RESOLVED — routes and designed HTTP 404 work; offline and 404 metadata/structure remain incomplete. |
| Restored receipts were inaccessible from empty state | RESOLVED — live restore opened Run receipts without importing a CSV. |
| Worker version transition was not exercised | RESOLVED FOR THE AVAILABLE PATH — the update message and reload action were exercised; no deployment was changed during QA. |

## Evidence

- `/work/.evidence/verify-5/live-qa.json`
- `/work/.evidence/verify-5/lighthouse-live.json`
- `/work/.evidence/verify-5/verify-url/verify.json`
- `/work/.evidence/verify-5/screenshots/desktop-first-screen.png`
- `/work/.evidence/verify-5/screenshots/phone-first-screen.png`
- `/work/.evidence/verify-5/screenshots/desktop-demo-populated.png`
- `/work/.evidence/verify-5/screenshots/phone-demo-populated.png`

No product code, live data, deployment, infrastructure, secrets, or other
services were changed during this verification.
