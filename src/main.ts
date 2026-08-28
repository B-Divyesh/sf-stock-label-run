import './style.css';
import { barcodeSvg, validateBarcode } from './barcode';
import { importCsv, inferSymbology, SAMPLE_CSV } from './csv';
import { deleteRun, importRuns, loadDraft, loadRuns, saveDraft, saveRun } from './db';
import type { Draft, SavedRun, StockItem, Symbology } from './types';

const SLUG = 'stock-label-run';
const LICENSE_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `${LICENSE_KEY}:verdict`;
const BUY_URL = `https://api.sociobot.in/api/v1/products/${SLUG}/checkout`;
const VERIFY_URL = `https://api.sociobot.in/api/v1/products/${SLUG}/verify`;
const FREE_LABEL_LIMIT = 150;

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root is missing');

let draft: Draft = emptyDraft();
let runs: SavedRun[] = [];
let importError = '';
let notice = '';
let showPaste = false;
let showHistory = false;
let showLicense = false;
let unlocked = cachedLicenseIsValid();
let online = navigator.onLine;
let printRun: SavedRun | null = null;
let deferredInstall: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function emptyDraft(): Draft {
  return {
    runName: `Receiving ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date())}`,
    fileName: '',
    rawCsv: '',
    importedAt: '',
    items: [],
    preset: 'a4-30',
    footer: '',
  };
}

function h(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function totalLabels(): number {
  return validItems().reduce((sum, item) => sum + item.quantity, 0);
}

function validItems(): StockItem[] {
  return draft.items.filter((item) => item.issues.length === 0);
}

function invalidCount(): number {
  return draft.items.filter((item) => item.issues.length > 0).length;
}

function fingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function labelCapacity(): number {
  return draft.preset === 'a4-24' ? 24 : draft.preset === 'roll-50x30' ? 1 : 30;
}

function expandedLabels(): StockItem[] {
  return validItems().flatMap((item) => Array.from({ length: item.quantity }, () => item));
}

function render(): void {
  const hasItems = draft.items.length > 0;
  const total = totalLabels();
  const invalid = invalidCount();
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" aria-label="Stock Label Run home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>Stock Label Run</span>
      </a>
      <div class="top-actions">
        <span class="connection ${online ? '' : 'is-offline'}"><span aria-hidden="true"></span>${online ? 'Local & ready' : 'Offline · still ready'}</span>
        <button class="quiet-button install-button" type="button" ${deferredInstall ? '' : 'hidden'}>Install app</button>
        <button class="quiet-button license-button" type="button">${unlocked ? 'Run room unlocked' : 'Unlock run room'}</button>
      </div>
    </header>
    <main id="main">
      <section class="intro ${hasItems ? 'intro-compact' : ''}" aria-labelledby="page-title">
        <div>
          <p class="eyebrow">Receiving desk utility · stays on this device</p>
          <h1 id="page-title">From stock list<br>to label run.</h1>
          <p class="lede">Import once, catch barcode mistakes, print the sheet, and keep a receipt of exactly what left the printer.</p>
        </div>
        ${hasItems ? '' : `<figure class="hero-print"><img src="/assets/receiving-run.webp" width="1200" height="800" alt="A halftone purchase list flowing through a label printer into a strip of barcode labels" fetchpriority="high" decoding="async"><figcaption>One local path. No retyping.</figcaption></figure>`}
      </section>

      <nav class="run-steps" aria-label="Label run progress">
        <a href="#import" class="${hasItems ? 'done' : 'active'}"><span>1</span><b>Import</b><small>${hasItems ? h(draft.fileName) : 'CSV purchase list'}</small></a>
        <a href="#check" class="${hasItems ? invalid ? 'active' : 'done' : ''}"><span>2</span><b>Check</b><small>${hasItems ? `${draft.items.length} rows · ${invalid} to fix` : 'Barcode & quantity'}</small></a>
        <a href="#print" class="${hasItems && !invalid ? 'active' : ''}"><span>3</span><b>Print</b><small>${hasItems ? `${total} labels` : 'Sheet & receipt'}</small></a>
      </nav>

      ${notice ? `<div class="notice" role="status"><span>${h(notice)}</span><button class="notice-close" aria-label="Dismiss notice">×</button></div>` : ''}
      ${renderImport(hasItems)}
      ${hasItems ? renderWorkspace() : ''}
      ${showHistory ? renderHistory() : ''}
      ${showLicense ? renderLicense() : ''}
    </main>
    ${hasItems ? renderPrintSheets() : ''}
    ${printRun ? renderReceipt(printRun) : ''}
    <footer>
      <p><b>Stock Label Run</b> · your stock files stay in this browser.</p>
      <nav aria-label="Legal and product links"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><button class="export-runs" type="button">Export backup</button><label class="text-link">Import backup<input class="import-backup" type="file" accept="application/json" hidden></label></nav>
      <p class="provenance">Original illustration generated for this product. No marketplace compliance claimed.</p>
    </footer>
    <div class="toast" role="status" aria-live="polite"></div>`;
  bindEvents();
}

function renderImport(hasItems: boolean): string {
  return `<section id="import" class="import-section ${hasItems ? 'with-data' : ''}" aria-labelledby="import-title">
    <div class="section-heading">
      <p class="section-number">01 / Bring the list</p>
      <h2 id="import-title">${hasItems ? 'Source file' : 'Drop your receiving CSV'}</h2>
      <p>${hasItems ? `Stored locally · fingerprint ${fingerprint(draft.rawCsv)}` : 'Required columns: name, SKU, barcode. Quantity is optional and defaults to one.'}</p>
    </div>
    ${hasItems ? `<div class="source-summary"><span class="file-stamp" aria-hidden="true">CSV</span><div><b>${h(draft.fileName)}</b><small>Imported ${h(formatDate(draft.importedAt))} · ${draft.items.length} product rows</small></div><button class="replace-file secondary-button" type="button">Replace CSV</button><button class="clear-run text-button danger-text" type="button">Clear run</button></div>` : `
      <div class="drop-zone ${importError ? 'has-error' : ''}" tabindex="0" role="button" aria-describedby="file-help file-error">
        <input id="csv-file" type="file" accept=".csv,text/csv" hidden>
        <span class="drop-icon" aria-hidden="true">↓</span>
        <strong>Choose a CSV <span>or drop it here</span></strong>
        <small id="file-help">Nothing is uploaded. Maximum 2 MB.</small>
      </div>
      <p id="file-error" class="field-error" role="alert">${h(importError)}</p>
      <div class="import-alternatives"><button class="paste-toggle secondary-button" type="button">Paste CSV text</button><button class="sample-button text-button" type="button">Try a checked sample</button><button class="template-button text-button" type="button">Download template</button></div>
      ${showPaste ? `<form class="paste-form"><label for="paste-csv">CSV text</label><textarea id="paste-csv" rows="7" spellcheck="false" required>${h(SAMPLE_CSV)}</textarea><button class="primary-button" type="submit">Check pasted rows</button></form>` : ''}
    `}
  </section>`;
}

function renderWorkspace(): string {
  const invalid = invalidCount();
  const total = totalLabels();
  const labels = expandedLabels().slice(0, labelCapacity());
  return `<div class="workspace">
    <div class="work-column">
      <section id="check" class="check-section" aria-labelledby="check-title">
        <div class="section-heading inline-heading">
          <div><p class="section-number">02 / Check the run</p><h2 id="check-title">${invalid ? `${invalid} row${invalid === 1 ? ' needs' : 's need'} attention` : 'Every row is printable'}</h2></div>
          <span class="status-lozenge ${invalid ? 'warning' : 'success'}">${invalid ? 'Fix before printing' : 'Checks passed'}</span>
        </div>
        <p class="check-note">Checks cover supported characters and GTIN checksums. They do not allocate barcodes or certify retailer compliance.</p>
        <div class="table-wrap"><table>
          <thead><tr><th scope="col">Product / SKU</th><th scope="col">Barcode</th><th scope="col">Type</th><th scope="col">Qty</th><th scope="col">Check</th></tr></thead>
          <tbody>${draft.items.map(renderItemRow).join('')}</tbody>
        </table></div>
      </section>

      <section id="print" class="print-settings" aria-labelledby="print-title">
        <div class="section-heading"><p class="section-number">03 / Set the sheet</p><h2 id="print-title">Print ${total} labels</h2><p>${Math.ceil(total / labelCapacity())} ${draft.preset === 'roll-50x30' ? 'individual label page' : 'sheet page'}${Math.ceil(total / labelCapacity()) === 1 ? '' : 's'} plus a run receipt.</p></div>
        <div class="settings-grid">
          <label>Run name<input id="run-name" value="${h(draft.runName)}" maxlength="60"></label>
          <label>Label stock<select id="preset">
            <option value="a4-30" ${draft.preset === 'a4-30' ? 'selected' : ''}>A4 · 30-up · 70 × 29.7 mm</option>
            <option value="a4-24" ${draft.preset === 'a4-24' ? 'selected' : ''}>A4 · 24-up · 70 × 35 mm ${unlocked ? '' : '— unlock'}</option>
            <option value="roll-50x30" ${draft.preset === 'roll-50x30' ? 'selected' : ''}>Roll · 50 × 30 mm ${unlocked ? '' : '— unlock'}</option>
          </select></label>
          <label class="footer-field">Custom footer <span>${unlocked ? 'optional' : 'run room feature'}</span><input id="label-footer" value="${h(draft.footer)}" maxlength="36" ${unlocked ? '' : 'disabled'} placeholder="e.g. Batch 28 Aug"></label>
        </div>
        ${total > FREE_LABEL_LIMIT && !unlocked ? `<div class="limit-note"><b>This run has ${total} labels.</b> Free runs print up to ${FREE_LABEL_LIMIT}; unlock the run room for larger receiving days.</div>` : ''}
        <div class="print-actions"><button class="primary-button print-labels" type="button" ${invalid || total === 0 ? 'disabled' : ''}>Print label run</button><button class="secondary-button print-receipt" type="button" ${invalid || total === 0 ? 'disabled' : ''}>Print receipt only</button><button class="history-button text-button" type="button">Run receipts <span>${runs.length}</span></button></div>
        <p class="print-tip">In the browser print dialog, choose “Save as PDF” for a PDF copy. Set scale to 100% and turn off headers and footers.</p>
      </section>
    </div>
    <aside class="proof-column" aria-labelledby="proof-title">
      <div class="proof-heading"><div><p class="eyebrow">Live print proof</p><h2 id="proof-title">Page 1</h2></div><span>${labels.length} / ${labelCapacity()}</span></div>
      <div class="sheet-proof preset-${draft.preset}">${labels.map(renderLabel).join('')}${Array.from({ length: Math.max(0, Math.min(labelCapacity() - labels.length, labelCapacity())) }, () => '<div class="blank-label" aria-hidden="true"></div>').join('')}</div>
      <p class="proof-note">Dashed lines are cut guides and do not print.</p>
    </aside>
  </div>`;
}

function renderItemRow(item: StockItem, index: number): string {
  const issue = item.issues.join('. ');
  return `<tr class="${issue ? 'invalid-row' : ''}">
    <td data-label="Product / SKU"><input aria-label="Product name, row ${index + 1}" data-index="${index}" data-field="name" value="${h(item.name)}"><input class="sku-input" aria-label="SKU, row ${index + 1}" data-index="${index}" data-field="sku" value="${h(item.sku)}"></td>
    <td data-label="Barcode"><input class="barcode-input" aria-label="Barcode, row ${index + 1}" data-index="${index}" data-field="barcode" value="${h(item.barcode)}" aria-invalid="${issue ? 'true' : 'false'}" ${issue ? `aria-describedby="issue-${index}"` : ''}></td>
    <td data-label="Type"><select aria-label="Symbology, row ${index + 1}" data-index="${index}" data-field="symbology">${(['EAN-13','UPC-A','Code 128','Code 39'] as Symbology[]).map((type) => `<option ${type === item.symbology ? 'selected' : ''}>${type}</option>`).join('')}</select></td>
    <td data-label="Quantity"><input class="qty-input" aria-label="Quantity, row ${index + 1}" data-index="${index}" data-field="quantity" type="number" min="1" max="999" value="${item.quantity}"></td>
    <td data-label="Check"><span id="issue-${index}" class="row-status ${issue ? 'bad' : 'good'}"><i aria-hidden="true">${issue ? '!' : '✓'}</i>${h(issue || 'Ready')}</span></td>
  </tr>`;
}

function renderLabel(item: StockItem): string {
  return `<article class="stock-label"><strong>${h(item.name)}</strong>${barcodeSvg(item.barcode, item.symbology)}<span class="human-code">${h(item.barcode)}</span><div><b>${h(item.sku)}</b><small>${h(draft.footer || item.symbology)}</small></div></article>`;
}

function renderPrintSheets(): string {
  const capacity = labelCapacity();
  const labels = expandedLabels();
  const pages: StockItem[][] = [];
  for (let index = 0; index < labels.length; index += capacity) pages.push(labels.slice(index, index + capacity));
  return `<div class="print-label-pages" aria-hidden="true">${pages.map((page, pageIndex) => `<section class="print-sheet preset-${draft.preset}"><div class="print-sheet-labels">${page.map(renderLabel).join('')}</div><span class="print-page-number">${h(draft.runName)} · ${pageIndex + 1}/${pages.length}</span></section>`).join('')}</div>`;
}

function renderHistory(): string {
  return `<section class="history-section" aria-labelledby="history-title"><div class="section-heading inline-heading"><div><p class="section-number">Local archive</p><h2 id="history-title">Run receipts</h2></div><button class="close-history quiet-button" type="button">Close</button></div>
  ${runs.length ? `<ul class="run-list">${runs.map((run) => `<li><div><b>${h(run.runName)}</b><span>${h(formatDate(run.printedAt))} · ${run.labelCount} labels · ${run.items.length} SKUs</span><small>${h(run.fileName)} · ${fingerprint(run.rawCsv)}</small></div><button class="reprint-run secondary-button" data-run-id="${run.id}" type="button">Open receipt</button><button class="delete-run text-button danger-text" data-run-id="${run.id}" type="button">Delete</button></li>`).join('')}</ul>` : '<div class="empty-history"><b>No printed runs yet.</b><p>Receipts appear here after you choose Print label run or Print receipt only.</p></div>'}</section>`;
}

function renderLicense(): string {
  return `<section class="license-panel" aria-labelledby="license-title"><button class="close-license" type="button" aria-label="Close unlock panel">×</button><p class="section-number">One-time purchase</p><h2 id="license-title">${unlocked ? 'Your run room is unlocked' : 'Make room for the bigger runs'}</h2><p>For <b>$12 once</b>, unlock unlimited labels per run, two more stock sizes, and custom label footers. Core CSV checking, A4 sheets, receipt history, and data export stay free.</p>
  ${unlocked ? '<p class="license-good"><span aria-hidden="true">✓</span> License active on this device.</p>' : `<a class="primary-button buy-link" href="${BUY_URL}">Buy the one-time unlock</a><form class="restore-form"><label for="license-token">Have a license? Paste it here</label><div><input id="license-token" autocomplete="off" spellcheck="false" required><button class="secondary-button" type="submit">Verify license</button></div><p class="license-message" role="status"></p></form>`}
  <small>Sociobot/Dodo is the merchant of record. Refunds are handled there and revoke the license. <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></small></section>`;
}

function renderReceipt(run: SavedRun): string {
  return `<section class="run-receipt" aria-labelledby="receipt-title"><header><div><p>Stock Label Run · print receipt</p><h2 id="receipt-title">${h(run.runName)}</h2></div><div class="receipt-mark">RUN<br><b>${run.id.slice(0, 8).toUpperCase()}</b></div></header>
  <dl><div><dt>Printed</dt><dd>${h(formatDate(run.printedAt))}</dd></div><div><dt>Source</dt><dd>${h(run.fileName)}</dd></div><div><dt>File fingerprint</dt><dd>${fingerprint(run.rawCsv)}</dd></div><div><dt>Label stock</dt><dd>${h(run.preset)}</dd></div><div><dt>Products</dt><dd>${run.items.length}</dd></div><div><dt>Labels</dt><dd>${run.labelCount}</dd></div></dl>
  <table><thead><tr><th>SKU</th><th>Product</th><th>Barcode</th><th>Type</th><th>Labels</th></tr></thead><tbody>${run.items.map((item) => `<tr><td>${h(item.sku)}</td><td>${h(item.name)}</td><td>${h(item.barcode)}</td><td>${item.symbology}</td><td>${item.quantity}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="4">Total labels</th><td>${run.labelCount}</td></tr></tfoot></table>
  <footer><p>Reconciled by: __________________________</p><p>Source CSV and this receipt are stored only in this browser.</p></footer></section>`;
}

function bindEvents(): void {
  document.querySelector('.notice-close')?.addEventListener('click', () => { notice = ''; render(); });
  document.querySelector('.license-button')?.addEventListener('click', () => { showLicense = !showLicense; render(); scrollToPanel('.license-panel'); });
  document.querySelector('.close-license')?.addEventListener('click', () => { showLicense = false; render(); });
  document.querySelector('.install-button')?.addEventListener('click', async () => { await deferredInstall?.prompt(); deferredInstall = null; render(); });
  const drop = document.querySelector<HTMLElement>('.drop-zone');
  const file = document.querySelector<HTMLInputElement>('#csv-file');
  drop?.addEventListener('click', () => file?.click());
  drop?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); file?.click(); } });
  drop?.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop?.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('dragging'); const dropped = event.dataTransfer?.files[0]; if (dropped) void readFile(dropped); });
  file?.addEventListener('change', () => { if (file.files?.[0]) void readFile(file.files[0]); });
  document.querySelector('.paste-toggle')?.addEventListener('click', () => { showPaste = !showPaste; render(); });
  document.querySelector('.paste-form')?.addEventListener('submit', (event) => { event.preventDefault(); const text = (document.querySelector<HTMLTextAreaElement>('#paste-csv')?.value ?? ''); processCsv(text, 'pasted-list.csv'); });
  document.querySelector('.sample-button')?.addEventListener('click', () => processCsv(SAMPLE_CSV, 'sample-receiving.csv'));
  document.querySelector('.template-button')?.addEventListener('click', () => download('stock-label-template.csv', 'name,sku,barcode,quantity,symbology\n', 'text/csv'));
  document.querySelector('.replace-file')?.addEventListener('click', () => { draft = emptyDraft(); importError = ''; render(); });
  document.querySelector('.clear-run')?.addEventListener('click', () => { if (confirm(`Clear ${draft.items.length} imported rows from this device? Printed receipts will remain.`)) { draft = emptyDraft(); void saveDraft(draft); render(); } });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-index][data-field]').forEach((control) => control.addEventListener('change', () => updateItem(control)));
  document.querySelector('#run-name')?.addEventListener('change', (event) => { draft.runName = (event.target as HTMLInputElement).value.trim() || 'Receiving run'; void persist(); });
  document.querySelector('#preset')?.addEventListener('change', (event) => { const value = (event.target as HTMLSelectElement).value as Draft['preset']; if (!unlocked && value !== 'a4-30') { showLicense = true; notice = 'That stock size is included in the one-time run room unlock.'; render(); scrollToPanel('.license-panel'); return; } draft.preset = value; void persist(true); });
  document.querySelector('#label-footer')?.addEventListener('change', (event) => { draft.footer = (event.target as HTMLInputElement).value.trim(); void persist(true); });
  document.querySelector('.print-labels')?.addEventListener('click', () => void beginPrint('labels'));
  document.querySelector('.print-receipt')?.addEventListener('click', () => void beginPrint('receipt'));
  document.querySelector('.history-button')?.addEventListener('click', () => { showHistory = true; render(); scrollToPanel('.history-section'); });
  document.querySelector('.close-history')?.addEventListener('click', () => { showHistory = false; printRun = null; render(); });
  document.querySelectorAll<HTMLElement>('.reprint-run').forEach((button) => button.addEventListener('click', () => { printRun = runs.find((run) => run.id === button.dataset.runId) ?? null; render(); setTimeout(() => { document.body.dataset.print = 'receipt'; window.print(); }, 50); }));
  document.querySelectorAll<HTMLElement>('.delete-run').forEach((button) => button.addEventListener('click', async () => { const run = runs.find((entry) => entry.id === button.dataset.runId); if (run && confirm(`Delete the receipt “${run.runName}”? This cannot be undone.`)) { await deleteRun(run.id); runs = await loadRuns(); render(); } }));
  document.querySelector('.restore-form')?.addEventListener('submit', (event) => { event.preventDefault(); const token = document.querySelector<HTMLInputElement>('#license-token')?.value.trim(); if (token) void verifyLicense(token, true); });
  document.querySelector('.export-runs')?.addEventListener('click', () => exportBackup());
  document.querySelector<HTMLInputElement>('.import-backup')?.addEventListener('change', (event) => void restoreBackup((event.target as HTMLInputElement).files?.[0]));
}

function scrollToPanel(selector: string): void {
  requestAnimationFrame(() => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

async function readFile(file: File): Promise<void> {
  if (file.size > 2 * 1024 * 1024) { importError = 'That file is over 2 MB. Split the receiving list and try again.'; render(); return; }
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') { importError = 'Choose a .csv file. Spreadsheet workbooks should be exported as CSV first.'; render(); return; }
  processCsv(await file.text(), file.name);
}

function processCsv(text: string, fileName: string): void {
  try {
    const items = importCsv(text);
    draft = { ...emptyDraft(), items, rawCsv: text, fileName, importedAt: new Date().toISOString() };
    importError = '';
    showPaste = false;
    notice = items.some((item) => item.issues.length) ? 'CSV imported. Fix the marked rows before printing.' : `${items.length} product rows imported and checked.`;
    void saveDraft(draft);
    render();
    document.querySelector('#check')?.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    importError = error instanceof Error ? error.message : 'The CSV could not be read.';
    render();
  }
}

function updateItem(control: HTMLInputElement | HTMLSelectElement): void {
  const index = Number(control.dataset.index);
  const field = control.dataset.field as keyof StockItem;
  const item = draft.items[index];
  if (!item) return;
  if (field === 'quantity') item.quantity = Number(control.value);
  else if (field === 'symbology') item.symbology = control.value as Symbology;
  else if (field === 'barcode') { item.barcode = control.value.replace(/\s/g, ''); if (!control.closest('tr')?.querySelector('select:focus')) item.symbology = inferSymbology(item.barcode, item.symbology); }
  else if (field === 'name' || field === 'sku') item[field] = control.value.trim();
  item.issues = [];
  if (!item.name) item.issues.push('Product name is empty');
  if (!item.sku) item.issues.push('SKU is empty');
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) item.issues.push('Quantity must be a whole number from 1 to 999');
  const barcodeIssue = validateBarcode(item.barcode, item.symbology);
  if (barcodeIssue) item.issues.push(barcodeIssue);
  void persist(true);
}

async function persist(rerender = false): Promise<void> {
  await saveDraft(draft);
  if (rerender) render();
}

async function beginPrint(mode: 'labels' | 'receipt'): Promise<void> {
  const count = totalLabels();
  if (invalidCount() || !count) return;
  if (!unlocked && count > FREE_LABEL_LIMIT) { showLicense = true; notice = `Free runs include up to ${FREE_LABEL_LIMIT} labels.`; render(); scrollToPanel('.license-panel'); return; }
  const run: SavedRun = { ...structuredClone(draft), id: crypto.randomUUID(), printedAt: new Date().toISOString(), labelCount: count };
  await saveRun(run);
  runs = await loadRuns();
  printRun = run;
  render();
  requestAnimationFrame(() => { document.body.dataset.print = mode; window.print(); });
}

function formatDate(value: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

function exportBackup(): void {
  download(`stock-label-runs-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ product: SLUG, version: 1, exportedAt: new Date().toISOString(), runs }, null, 2), 'application/json');
}

async function restoreBackup(file?: File): Promise<void> {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()) as { product?: string; runs?: SavedRun[] };
    if (data.product !== SLUG || !Array.isArray(data.runs)) throw new Error('Not a Stock Label Run backup');
    await importRuns(data.runs);
    runs = await loadRuns();
    notice = `${data.runs.length} receipt${data.runs.length === 1 ? '' : 's'} restored.`;
  } catch { notice = 'That backup could not be read. Choose a Stock Label Run JSON export.'; }
  render();
}

function cachedLicenseIsValid(): boolean {
  try { const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as { valid?: boolean } | null; return Boolean(localStorage.getItem(LICENSE_KEY) && cached?.valid); } catch { return false; }
}

async function verifyLicense(token: string, userInitiated = false): Promise<void> {
  const message = document.querySelector<HTMLElement>('.license-message');
  if (message) message.textContent = 'Verifying…';
  try {
    const response = await fetch(`${VERIFY_URL}?license=${encodeURIComponent(token)}`);
    const result = await response.json() as { valid: boolean; reason?: string };
    localStorage.setItem(LICENSE_KEY, token);
    localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: result.valid, checkedAt: Date.now() }));
    unlocked = result.valid;
    notice = result.valid ? 'Run room unlocked on this device.' : `License no longer active${result.reason ? ` (${result.reason.replace('_', ' ')})` : ''}.`;
    if (result.valid || userInitiated) render();
  } catch {
    if (message) message.textContent = 'Could not verify while offline. Your free tools still work; try again when connected.';
  }
}

async function initLicense(): Promise<void> {
  const url = new URL(location.href);
  const returnedToken = url.searchParams.get('license');
  if (returnedToken) {
    localStorage.setItem(LICENSE_KEY, returnedToken);
    url.searchParams.delete('license');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    showLicense = true;
    await verifyLicense(returnedToken);
    return;
  }
  const token = localStorage.getItem(LICENSE_KEY);
  if (!token || !online) return;
  try {
    const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as { checkedAt?: number } | null;
    if (!cached?.checkedAt || Date.now() - cached.checkedAt > 86_400_000) void verifyLicense(token);
  } catch { void verifyLicense(token); }
}

window.addEventListener('online', () => { online = true; render(); });
window.addEventListener('offline', () => { online = false; render(); });
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstall = event as BeforeInstallPromptEvent; render(); });
window.addEventListener('afterprint', () => { delete document.body.dataset.print; });

async function init(): Promise<void> {
  const stored = await loadDraft().catch(() => null);
  if (stored?.items?.length) draft = stored;
  runs = await loadRuns().catch(() => []);
  render();
  await initLicense();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') { notice = 'A fresh version is ready. Reload to update.'; render(); }
    });
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
}

void init();
