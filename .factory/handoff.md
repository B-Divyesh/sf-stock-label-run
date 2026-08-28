# Stock Label Run — repair handoff

## Release-blocking repair

This repair addresses every finding in independent verification report commit
`0b8839f47fbc4a441cc18f521d54cdd4505d0737` for candidate
`1f9f0ecccb9322d96074875ae3f83a4e381350b7`, while preserving the CSV-to-label
workflow, local IndexedDB storage, print receipts, PWA shell, and optional
Sociobot license flow.

- At the required 390 × 844 viewport, the brand/home link, **Unlock run room**
  control, and footer **Privacy**/**Terms** links now have 44 px minimum height
  and width. A Playwright regression measures the actual rendered controls:
  home `144 × 44`, unlock `128.03 × 44`, Privacy `54.61 × 44`, Terms `44 × 44`.
- `public/staticwebapp.config.json` is emitted at the root of `dist/` for the
  static deployment. It gives content-hashed `/assets/*` a one-year immutable
  cache policy, keeps `sw.js` revalidatable, maps the manifest to
  `application/manifest+json`, and adds CSP, Permissions-Policy,
  `X-Frame-Options: DENY`, nosniff, and strict-origin referrer policy.
- Regression coverage verifies both the reported mobile target dimensions and
  the shipped static-host policy configuration. The earlier external billing
  API rate-limit blocker was already resolved upstream, as documented by the
  verifier; this repository does not own that API.

## Verification (2026-08-28)

- Clean install: `npm ci` passed; `npm audit --omit=dev` reported 0
  vulnerabilities.
- Tests: `npm test` passed: 6 Vitest tests; 14 Playwright tests passed and 2
  intentional project-specific skips (desktop-only/mobile-only checks).
  Coverage includes CSV validation, persistence, printing/receipt archive,
  legal routes, desktop and 390 px flows, offline reload, Axe, the update
  notice path, the repaired targets, and the deployment config.
- Type check and production build: `npm run build` passed and produced
  `dist/index.html`. Current initial assets are 30.18 KB JavaScript (10.94 KB
  gzip), 19.42 KB CSS (5.20 KB gzip), and 123.6 KB WebP hero—within the static
  PWA budgets.
- Browser smoke: `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4174/` returned
  HTTP 200 with the expected title, `lang=en`, exactly one h1, main landmark,
  image alt text, labelled buttons, and no page/console errors.
- Accessibility: Playwright Axe found no serious or critical violations on
  empty, populated desktop, and populated 390 px mobile states. Keyboard
  controls retain the designed 3 px focus ring. The standalone Axe CLI could
  not locate a system Chrome binary in this container; the installed
  Playwright Axe integration is the authoritative passing check.
- Privacy: a request capture through the normal free sample workflow observed
  only same-origin requests; no analytics, remote font, or third-party runtime
  request occurred. The optional license endpoint remains explicitly allowed
  by CSP.
- PWA: after service-worker control, an offline reload showed
  `Offline · still ready`; a worker update message showed `A fresh version is
  ready. Reload to update.`
- Lighthouse mobile against the production preview: Performance **99**,
  Accessibility **100**, Best Practices **100**; FCP 1.0 s, LCP 2.0 s, TBT
  60 ms, CLS 0.
- Live deployment: factory static deployment `ee05c622-f173-4cb5-88e5-4aed082dd712`
  completed successfully to <https://stock-label-run.sociobot.in>. Live root,
  JS, and CSS bytes match the built `dist/` files. The live 390 px check again
  measured `144 × 44`, `128.03 × 44`, `54.61 × 44`, and `44 × 44` for the four
  repaired targets; it also passed Axe, same-origin request capture, offline
  reload, and console/page-error checks. Live responses now expose the CSP,
  Permissions-Policy, `X-Frame-Options: DENY`, immutable asset cache policy,
  and `application/manifest+json` manifest MIME type.

## Run and deploy

```sh
npm ci
npm test
npm run build
```

Deploy the contents of `dist/` as the existing static app. The emitted
`staticwebapp.config.json` is part of the deployment artifact and supplies the
response-policy and caching rules; no infrastructure, DNS, or billing changes
are required from this repository.

## Known limits

- Print dimensions still depend on the selected browser/printer driver; test a
  small sheet at 100% scale on the actual label stock before a full run.
- Code 128 is subset B only. GS1-128/FNC1, QR, Data Matrix, barcode allocation,
  inventory management, and printer-driver control remain intentionally out of
  scope.
- The factory must retain the existing static-host deployment behavior that
  reads `staticwebapp.config.json`; post-deploy header checks should confirm
  the emitted cache, CSP, permissions, frame, and manifest MIME policies.
