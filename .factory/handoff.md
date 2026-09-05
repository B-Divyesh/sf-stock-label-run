# Stock Label Run — verification 4 handoff

## Result

**FAIL** on 5 September 2026 UTC with **7 findings** and **14 untested public
claim groups**. See [verification-4.md](verification-4.md) for evidence and
reproduction details.

- Implementation candidate:
  `d30c9b30baf8a9da3235614a8a5d853d3d2d074a`
- Documentation commit reviewed:
  `88eb2dcca76607b1a1e48b27b7d5f5a6ebe1ca11`
- Live URL: <https://stock-label-run.sociobot.in>

## Required repairs

1. Implement `/demo` as an isolated storage namespace with the required
   persistent banner, reset, and start-real controls. Add `.factory/demo.md`.
2. Enable or remove the broken one-time purchase. The live checkout currently
   returns HTTP 404.
3. Add `.factory/claims.json` and one tagged sandbox test for every public
   claim. There are currently no claim entries or tags.
4. Raise all populated mobile controls and legal-page links to at least 44 × 44
   CSS px, not only the four controls from verification 3.
5. Put the audience, sample action, and three facts in the first viewport; add
   the required landing order, shared header/footer details, and
   `.factory/copy-audit.md`.
6. Add a designed 404 with a real 404 status, `robots.txt`, `sitemap.xml`,
   canonical/Open Graph/Twitter metadata, Apple touch metadata, and a distinct
   demo title.
7. Make restored receipt history reachable when no active CSV is loaded.

## Verified passing behavior

- Clean `npm ci`, `npm audit --omit=dev`, `npm test`, and `npm run build` pass.
  The suite reports 6 unit tests, 14 passed Playwright tests, and 2 intended
  skips.
- The sample, realistic label proof, print receipt, receipt persistence,
  export, invalid input, 999 boundary, 150-label gate, and recovery messages
  work.
- Live offline reload, update notice handling, installability, same-origin free
  workflow, security headers, immutable caching, and manifest MIME type pass.
- Live Axe has zero violations in the three tested states. Lighthouse mobile
  is 100 Performance, 100 Accessibility, 100 Best Practices, and 92 SEO.
- Live runtime bytes match the implementation candidate.
- Earlier cache, header, manifest, rate-limit, and four named touch-target
  findings are resolved. Rate limiting begins at request 31 and includes
  `Retry-After`.

## Run verification

```sh
npm ci
npm audit --omit=dev
npm test
npm run build
```

No product code or deployment was changed. Only this handoff and the independent
verification report were added or updated.
