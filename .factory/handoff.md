# Stock Label Run — verification 5 handoff

## Result

Independent verification 5 is complete with verdict **FAIL**.

- Finding count: 3
- Untested public claim count: 7
- Implementation candidate: `9738963abfaa72f28ade7202d5d902930c8305c9`
- Documentation baseline reviewed: `9f0e3a8fb663ca59af0ad244f0af7a75a3734254`
- Live URL: <https://stock-label-run.sociobot.in>
- Full report: `.factory/verification-5.md`

No product code or deployment was changed.

## What passed

- Fresh desktop and 390 px phone first screens show the CSV-to-label job,
  small-shop and maker audience, sample action, and three facts before scroll.
- The live sample, isolated demo storage, reset, exit to preserved real data,
  nine-label proof, 50-row run, receipts, backups, invalid input recovery,
  2 MB boundary, 150-label boundary, offline reload, and update notice work.
- `npm ci`, `npm audit --omit=dev`, `npm test`, and `npm run build` pass from a
  detached checkout of the implementation candidate.
- All 14 declared claim commands exit successfully in desktop and mobile
  projects.
- Live Axe checks have no serious or critical findings. All tested phone
  targets meet 44 px. Keyboard focus, reduced motion, privacy request capture,
  route status, links, headers, and installability checks pass.
- Lighthouse mobile scores 100 in Performance, Accessibility, Best Practices,
  and SEO. LCP is 1.66 s, TBT is 0 ms, and CLS is 0.
- Every deployed runtime file matches the clean candidate build byte for byte.
- License verification rate limiting starts at request 31 and includes
  `Retry-After`.

## Required follow-up

1. Complete the six tagged claim tests listed in the report: file-size
   acceptance boundary, invalid UPC-A, invalid Code 128 subset B, true 30-up
   layout, exported backup contents, and the 150-label allowed boundary.
2. Add a declared claim and tagged fixture test for restoring a valid license
   and enabling the advertised paid layouts, larger runs, and custom footer.
3. Give `/offline.html` the shared header/footer and required metadata. Add
   Open Graph and Twitter metadata to `/404.html`.
4. Re-run all claim commands, `npm test`, `npm run build`, and live route checks
   after redeployment.

Billing registration remains external. The checkout endpoint returns 404, but
the product does not expose a broken link and clearly labels checkout as
temporarily unavailable.

## Evidence

- `.factory/verification-5.md`
- `/work/.evidence/verify-5/live-qa.json`
- `/work/.evidence/verify-5/lighthouse-live.json`
- `/work/.evidence/verify-5/verify-url/verify.json`
- `/work/.evidence/verify-5/screenshots/`
