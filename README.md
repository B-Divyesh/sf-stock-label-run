# Stock Label Run

Stock Label Run is an offline-first receiving utility for small shops and makers. It turns a purchase-list CSV into checked barcode label sheets and a printable run receipt, without uploading the stock file or requiring an inventory suite.

Live product: <https://stock-label-run.sociobot.in>

## What it does

- Imports CSV files or pasted CSV text with `name`, `sku`, `barcode`, and optional `quantity` and `symbology` columns.
- Validates EAN-13 and UPC-A checksums, Code 39 characters, Code 128 subset B characters, and quantities before printing.
- Produces deterministic SVG barcodes on A4 30-up sheets. The Run room upgrade is US $12 once and adds A4 24-up and 50 × 30 mm roll layouts, unlimited labels per run, and custom footers.
- Saves the original CSV, active draft, and printable receipt history locally in IndexedDB.
- Exports/imports receipt backups as JSON and works after the network disappears.

## Try the sample safely

Open https://stock-label-run.sociobot.in/demo, or choose **Try it with sample
data** from the first screen. The demo loads a nine-label receiving run in the
separate demo:stock-label-run IndexedDB database. **Reset demo** only resets
that data. **Start for real** discards it before returning to the normal app.

The Run room upgrade checkout is temporarily unavailable while the factory
registers the product with Sociobot billing. Existing license holders can still
restore and verify a license. The free core remains usable.

It does not allocate barcodes, certify marketplace compliance, manage inventory, or control printer drivers. Always scan a test sheet on the intended stock.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No environment variables are needed for the free workflow. License verification uses the documented Sociobot production endpoint and never blocks free features.

## Test and build

```sh
npm test
npm run build
```

npm test runs unit tests plus Playwright flows for desktop, 390 px mobile, accessibility, persistence, demo isolation, and offline reopening. .factory/claims.json lists every public claim and its runnable regression command. The exact deployment command is npm run build; the static artifact is written to dist/ with dist/index.html at its root.

## CSV example

```csv
name,sku,barcode,quantity,symbology
Cedar soap,SOAP-CEDAR,5901234123457,4,EAN-13
Small canvas pouch,POUCH-S,036602301979,3,UPC-A
Repair kit,KIT-REPAIR,REPAIR-042,2,Code 128
```

Column aliases such as `product`, `item code`, `GTIN`, and `qty` are accepted. If `symbology` is omitted, numeric values are inferred as EAN-13/UPC-A and other supported values as Code 39 or Code 128.

## Privacy and design

There are no analytics, remote fonts, or third-party runtime scripts. See [/privacy](https://stock-label-run.sociobot.in/privacy/) for data handling, [/terms](https://stock-label-run.sociobot.in/terms/) for product limits, and [`.factory/design.md`](.factory/design.md) for the visual system and original-image provenance.

MIT licensed; see [`LICENSE`](LICENSE).
