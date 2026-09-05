# Verify CSV-to-barcode label runs — independent verification 4

**Verdict: FAIL**

- Finding count: **7**
- Untested public claim count: **14**
- Implementation candidate: `d30c9b30baf8a9da3235614a8a5d853d3d2d074a`
- Documentation commit reviewed: `88eb2dcca76607b1a1e48b27b7d5f5a6ebe1ca11`
- Live URL: <https://stock-label-run.sociobot.in>
- Verified: 5 September 2026 UTC

The live runtime matches the implementation candidate. Commit `88eb2dc` changes
only `.factory/handoff.md`. Every emitted runtime file that can be requested
directly matches the clean build byte for byte. The deployed headers also match
the policy in `staticwebapp.config.json`.

## First screen before scrolling

Fresh Chromium contexts were used at 1440 × 900 and 390 × 844. No saved site
data was present.

| Question | What the live page shows | Result |
| --- | --- | --- |
| Job | “From stock list to label run.” The next sentence explains checking, printing, and keeping a receipt. | PASS |
| Audience | The page says “receiving desk utility,” but does not name small shops or makers. | FAIL |
| First action | The sample action is below the viewport: top 1,306 px on desktop and 1,487 px on phone. The visible header action is the paid unlock. | FAIL |

The sample action is named “Try a checked sample,” not the required “Try it
with sample data.” The first screen has no three short privacy, offline, and
price facts.

## Findings

### High — `/demo` is not an isolated demo and writes to normal product data

Opening `/demo` returns the normal app with the normal title. It has no
“Demo — sample data, nothing is saved” banner, no **Reset demo**, and no
**Start for real**. Selecting the sample writes it to the regular
`stock-label-run` IndexedDB database. The sample survives reload, and opening
`/` in the same fresh context shows the same saved sample. There is no separate
demo storage namespace.

This fails the required one-click sandbox and the instruction that trying the
sample must not change real data. `.factory/demo.md` is also absent. Testing was
done only in disposable fresh browser contexts, so no existing user data was
changed.

### High — the advertised one-time purchase cannot be opened

The live **Buy the one-time unlock** link points to
`https://api.sociobot.in/api/v1/products/stock-label-run/checkout`. A direct
GET returned HTTP 404 with the billing service’s disabled-product error. The
page and Terms advertise “$12 once,” but a visitor cannot buy the feature.

The separate license verification endpoint is healthy and rate limited: 30
sequential invalid checks returned 200, request 31 returned 429, and throttled
responses included `Retry-After` values of 2–3 seconds.

### High — the required claim registry is absent

`.factory/claims.json` does not exist, `rg '@claim:'` finds no tagged tests,
and there are no declared claim commands to run. Fourteen public claim groups
therefore have no required sandbox test:

1. The free workflow makes no upload or third-party request.
2. CSV files, drafts, and receipts stay in IndexedDB.
3. The app works after the network disappears.
4. CSV headers, aliases, quoted fields, and default quantity are supported.
5. File type and the 2 MB limit are enforced.
6. EAN-13 and UPC-A values are validated and encoded correctly.
7. Code 39 and Code 128 subset B values are validated and encoded correctly.
8. A4 30-up output has the stated physical dimensions and can be saved as PDF.
9. A receipt records exactly what was printed and remains in history.
10. Receipt backups export and import as JSON.
11. Free runs stop at 150 labels while accessibility and export remain free.
12. Individual receipts can be deleted.
13. License verification runs at most once per day and never blocks free use.
14. The service worker caches the stated app shell, illustration, and legal pages.

Independent checks support several of these statements, but the claims
contract requires each public claim to be listed and tied to one tagged test.
The paid checkout claim was tested directly and is reported as false above,
not counted among the 14 untested claims.

### Medium — populated phone controls and legal links remain under 44 px

At 390 px, each product-name, SKU, barcode, symbology, and quantity control in
the three-row sample measures 40 px high. That is 15 undersized editable
controls. On the legal pages, the footer Terms and Privacy links measure 26.39
px high; the inline email links measure 19 px high.

The four targets named in verification 3 are fixed: the home link, unlock
button, and root footer Privacy and Terms links all now meet 44 × 44 px. The
new measurements show that the statement that all 390 px targets were fixed
was incomplete.

### Medium — the landing page does not meet the required first-screen and site order

The audience and primary sample action are not visible before scrolling. The
header has no Demo or Privacy navigation. The landing page does not present the
required three facts or a visible paid-tier section in the standard order; the
price is hidden behind the header unlock control. The root footer omits “Built
by Param Factory” and a version or build ID.

The required `.factory/copy-audit.md` is absent. Legal and offline headings such
as “Privacy stays on the receiving desk,” “Useful labels, honest limits,” and
“The desk is still yours” also fail the instruction to use direct job headings
instead of mood copy.

### Medium — required route and metadata files are missing

`/demo` keeps the root title rather than “Demo — Stock Label Run.” An unknown
path, `/not-a-real-route`, returns HTTP 200 and the main app instead of a
designed 404 response. `/404.html`, `/robots.txt`, and `/sitemap.xml` also fall
through to the root HTML with status 200.

The root has no canonical link, Open Graph metadata, Twitter card metadata, or
Apple touch icon link. Privacy and Terms have correct route titles, one h1,
`lang=en`, and a main landmark, but they also lack the required shared header
and metadata set.

### Medium — a restored receipt is unreachable from the empty state

Importing a valid receipt backup into a clean browser shows “1 receipt
restored,” but the empty page has no **Run receipts** control. The restored
receipt becomes reachable only after importing an unrelated CSV or loading the
sample. Invalid backup JSON produces the documented recovery message. Backup
restore is therefore incomplete in the normal clean recovery path.

## Checks that passed

### Clean checkout and commands

A detached worktree at the implementation candidate was used.

| Command | Result |
| --- | --- |
| `npm ci` | PASS — 59 packages installed; 0 vulnerabilities. |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities. |
| `npm test` | PASS — 6 unit tests; 14 Playwright tests passed; 2 intended project-specific skips. |
| `npm run build` | PASS — type check and Vite build produced `dist/index.html`. |
| `/opt/fleet/lib/verify-url.sh <live> <evidence>` | PASS — HTTP 200, title, `lang=en`, one h1, main, alt text, labels, and no console errors. |

No claim command could be run because the required claim registry is missing.

### Free receiving workflow

- The sample produced nine labels for Cedar soap, Small canvas pouch, and
  Repair kit, with a printable nine-label receipt and a matching saved history
  entry.
- A receipt export contained `product: "stock-label-run"`, version 1, one run,
  and label count 9.
- Quantity 1000 and a bad EAN-13 checksum produced both expected errors.
  Correcting them to 999 and `5901234123457` recovered “Every row is
  printable,” showed “Print 999 labels,” and persisted after reload. The free
  150-label gate then opened the unlock panel.
- Wrong file type, a file one byte over 2 MB, a missing SKU column, and an
  unclosed quoted field each produced a specific recovery instruction.
- A print-receipt action called the browser print path and archived the run.

### Accessibility, mobile, and motion

- Live Axe scans found zero violations in desktop empty, desktop populated,
  and 390 px populated states.
- Keyboard Tab first reached the skip link with a visible 3 px blue focus
  outline. Enter moved to main content. There was no keyboard trap in the
  exercised workflow.
- The populated 390 px page had no horizontal overflow. The table wrapper was
  358 px wide and had a 358 px scroll width.
- Reduced motion changed row animation and transition duration to 0.00001 s.
- The undersized targets are recorded as a finding rather than hidden by the
  passing Axe result.

### Privacy, PWA, performance, and live deployment

- Request capture through the free sample flow saw only
  `https://stock-label-run.sociobot.in`. There were no console or page errors.
- After service-worker control, offline reload showed “Offline · still ready.”
  The update message path showed “A fresh version is ready. Reload to update.”
  Chromium reported no installability or manifest errors.
- Live headers include CSP, Permissions-Policy, `X-Frame-Options: DENY`,
  nosniff, and strict-origin referrer policy. Hashed JS, CSS, and image assets
  use one-year immutable caching. The service worker uses `no-cache`, and the
  manifest is `application/manifest+json`.
- Lighthouse mobile: Performance **100**, Accessibility **100**, Best
  Practices **100**, SEO **92**; FCP 0.91 s, LCP 1.59 s, TBT 0 ms, CLS 0.
- Initial build assets are 30,183 B JavaScript (10,890 B gzip), 19,418 B CSS
  (5,212 B gzip), and a 126,560 B WebP image. They meet the supplied budgets.
- This is a static PWA with browser-local IndexedDB. Backend tenant isolation,
  server restart persistence, and product health endpoints are not applicable.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| Billing verification did not rate limit | RESOLVED — 429 begins at request 31 with `Retry-After`. |
| Hashed assets lacked immutable caching | RESOLVED — live assets use one-year immutable caching. |
| CSP, Permissions-Policy, and frame protection were absent | RESOLVED — all are live with no console errors. |
| Manifest used the wrong media type | RESOLVED — live type is `application/manifest+json`. |
| Home, unlock, and root legal links were below 44 px | RESOLVED for those four controls; broader phone controls still fail as recorded above. |
| A real worker-version transition was not exercised | PARTLY RESOLVED — the regression and live message path pass; no deployment was changed during independent QA. |

## Evidence

- `/work/.evidence/live-qa.json`
- `/work/.evidence/lighthouse-live.json`
- `/work/.evidence/verify-url/verify.json`
- `/work/.evidence/screenshots/desktop-first-screen.png`
- `/work/.evidence/screenshots/phone-first-screen.png`
- `/work/.evidence/screenshots/phone-demo-populated.png`

No product code, live data, deployment, infrastructure, secrets, or other
services were changed during this verification.
