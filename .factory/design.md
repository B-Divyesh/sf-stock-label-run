# Stock Label Run — visual system

## Direction and rationale

**Dithered receiving-room print system.** The product should feel like the dependable paper trail beside a stockroom printer: warm paper, dense black ink, registration marks, label perforations, and a restrained signal orange. Halftone is used to explain the transformation from a purchase list into physical labels—not as decorative noise. The working screen stays quiet and exact; the generated sheet and receipt become the hero.

This is intentionally a single light treatment. It represents a proofing desk and keeps the browser preview close to the paper that will be printed. The page background is always explicitly painted; print output becomes pure white and black.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F3EEDC` | page background |
| Stock | `#FFFDF4` | working surfaces and label paper |
| Ink | `#171A17` | primary text and barcode bars |
| Muted ink | `#54584F` | supporting copy (7.1:1 on paper) |
| Signal orange | `#C7471C` | primary controls and active markers |
| Orange dark | `#8F2F10` | links and hover states |
| Registration blue | `#195B73` | secondary state and focus ring |
| Good | `#21643B` | valid rows, with text/icon |
| Warning | `#855A00` | checksum/quantity cautions |
| Danger | `#A52924` | rejected rows and errors |

No gradients. Depth comes from 2 px ink rules, offset shadows, layered paper, and halftone fields.

## Typography and spacing

- Display/utility: **Arial Black**, falling back to `Arial`, system sans. Its blunt weight recalls carton stamps without requiring a font download.
- Reading/data: **IBM Plex Mono-style system mono stack** (`ui-monospace, SFMono-Regular, Consolas, monospace`). It makes SKU, barcode, quantity, and run IDs visually inspectable. No remote fonts.
- Scale: 12 / 14 / 16 / 20 / 28 / clamp(36–64) px; body never below 16 px.
- Rhythm: 4 px base. Primary spacing steps are 8, 12, 16, 24, 32, 48, and 72 px.
- Text measure: 64 characters for explanatory copy; dense tables use tabular figures.

## Layout and interaction grammar

The app is a three-stop run line: **1 Import → 2 Check → 3 Print**. The current stop is indicated with a filled registration circle and text. Controls use crisp rectangular shapes with slightly clipped corners, like guillotine-cut labels. Primary actions gain an offset ink shadow on hover and lose it when pressed. Focus uses a 3 px blue outline plus 3 px paper offset.

Desktop separates the working column from a sticky sheet proof. Mobile stacks proof below controls, hides nonessential table columns, and keeps actions full-width. Every target is at least 44 px. No content is hidden behind fixed navigation.

## Motion policy

Only state changes move: newly accepted rows rise 6 px and fade in over 180 ms; the update notice enters from its screen edge over 220 ms. Buttons depress by the same 3 px as their shadow. No looping motion. Under `prefers-reduced-motion: reduce`, transforms and transitions are removed and state changes are instantaneous.

## Generated asset plan and provenance

One original landscape illustration shows a label run moving from receiving list to printed sheet. It appears in the empty/onboarding state only, where it explains the workflow. The visual uses coarse one-bit halftone, imperfect ink registration, paper grain, and the product palette. There are no people, brands, readable text, logos, or misleading printer hardware claims. Functional icons and barcodes are authored in CSS/SVG/code because they must remain deterministic.

Prompt sheet:

> Use case: stylized-concept. Asset type: onboarding illustration for an offline barcode-label utility. Primary request: an overhead editorial still life showing a purchase-list sheet on the left, a compact generic thermal label printer in the center, and a curling strip of blank barcode-like labels emerging to the right, communicating list-to-label transformation. Scene/backdrop: small maker stockroom proofing desk. Style/medium: two-color risograph and coarse one-bit halftone editorial print, tactile paper grain, imperfect registration, screen-printed shapes. Composition: wide landscape, isolated objects, generous breathing room, clear left-to-right flow. Lighting/mood: flat graphic light, practical and confident. Color palette: warm oatmeal paper, carbon black ink, burnt signal orange, tiny registration-blue accents. Constraints: barcode marks must be abstract and non-scannable; no readable text, no people, no brands, no logos, no watermark, no gradients, no photorealism, no extra objects.

- Generator: Azure AI Foundry `factory-image` via `/opt/fleet/lib/gen-image.sh`
- Date: 2026-08-28
- License/provenance: original AI-generated artwork commissioned for Stock Label Run; retained source prompt and candidate in `assets/src/`.
- Social preview: `public/assets/social-preview.webp` is a 1200 × 630 center crop of the
  same commissioned illustration, made on 2026-09-06 for Open Graph and Twitter cards.

## Print system

Screen proofs include paper edges and perforation guides. `@media print` removes all app chrome and prints either the label sheet or the run receipt at physical millimetre dimensions. Barcode bars are deterministic SVG from documented EAN-13, UPC-A, Code 128 subset B, and Code 39 encoders. The app never claims retailer or marketplace compliance.
