import './style.css';
import { barcodeSvg, validateBarcode } from './barcode';
import { importCsv, inferSymbology, SAMPLE_CSV } from './csv';
import { clearScope, deleteRun, importRuns, loadDraft, loadRuns, saveDraft, saveRun, type StorageScope } from './db';
import type { Draft, SavedRun, StockItem, Symbology } from './types';

const SLUG = 'stock-label-run';
const VERSION = '1.1.0';
const LICENSE_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `${LICENSE_KEY}:verdict`;
const VERIFY_URL = `https://api.sociobot.in/api/v1/products/${SLUG}/verify`;
const FREE_LABEL_LIMIT = 150;
const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
const demoMode = normalizedPath === '/demo' || new URL(location.href).searchParams.get('demo') === '1';
const storageScope: StorageScope = demoMode ? 'demo' : 'real';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root is missing');
const app = appRoot;

if (demoMode) setDemoMetadata();

let draft: Draft = emptyDraft();
let runs: SavedRun[] = [];
let importError = '';
let notice = '';
let showPaste = false;
let showHistory = false;
let showLicense = false;
let unlocked = demoMode ? false : cachedLicenseIsValid();
let online = navigator.onLine;
let printRun: SavedRun | null = null;
let deferredInstall: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function setDemoMetadata(): void {
  document.title = 'Demo — Stock Label Run';
  const set = (selector: string, value: string) => {
    const element = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
    if (element instanceof HTMLLinkElement) element.href = value;
    else if (element) element.content = value;
  };
  set('link[rel="canonical"]', 'https://stock-label-run.sociobot.in/demo');
  set('meta[name="description"]', 'Try Stock Label Run with a sandboxed receiving CSV. Demo data never changes your real browser data.');
  set('meta[property="og:title"]', 'Demo — Stock Label Run');
  set('meta[property="og:description"]', 'Try a sandboxed CSV-to-barcode-label receiving run.');
  set('meta[name="twitter:title"]', 'Demo — Stock Label Run');
  set('meta[name="twitter:description"]', 'Try a sandboxed CSV-to-barcode-label receiving run.');
}

function emptyDraft(): Draft {
  return {
    runName: `Receiving ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date())}`,
    fileName: '', rawCsv: '', importedAt: '', items: [], preset: 'a4-30', footer: '',
  };
}

function h(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function totalLabels(): number { return validItems().reduce((sum, item) => sum + item.quantity, 0); }
function validItems(): StockItem[] { return draft.items.filter((item) => item.issues.length === 0); }
function invalidCount(): number { return draft.items.filter((item) => item.issues.length > 0).length; }

function fingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function labelCapacity(): number { return draft.preset === 'a4-24' ? 24 : draft.preset === 'roll-50x30' ? 1 : 30; }
function expandedLabels(): StockItem[] { return validItems().flatMap((item) => Array.from({ length: item.quantity }, () => item)); }

function render(): void {
  const hasItems = draft.items.length > 0;
  app.innerHTML = `
    ${renderHeader()}
    ${demoMode ? renderDemoBanner() : ''}
    <main id="main">
      ${renderIntro(hasItems)}
      ${notice ? `<div class="notice" role="status"><span>${h(notice)}</span><button class="notice-close" aria-label="Dismiss notice">×</button></div>` : ''}
      ${renderImport(hasItems)}
      ${hasItems ? renderWorkspace() : ''}
      ${showHistory ? renderHistory() : ''}
      ${showLicense && !demoMode ? renderLicense() : ''}
      ${renderHowItWorks()}
      ${renderLimitsAndPrivacy()}
      ${!demoMode ? renderPaidTier() : ''}
    </main>
    ${hasItems ? renderPrintSheets() : ''}
    ${printRun ? renderReceipt(printRun) : ''}
    ${renderFooter()}
    <div class="toast" role="status" aria-live="polite"></div>`;
  bindEvents();
}

function renderHeader(): string {
  return `<header class="topbar">
    <a class="brand" href="/" aria-label="Stock Label Run home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>Stock Label Run</span></a>
    <nav class="site-nav" aria-label="Primary navigation"><a href="/demo" ${demoMode ? 'aria-current="page"' : ''}>Demo</a><a href="#how-it-works">How it works</a><a href="/privacy/">Privacy</a></nav>
    <div class="top-actions"><span class="connection ${online ? '' : 'is-offline'}"><span aria-hidden="true"></span>${online ? 'Local & ready' : 'Offline · still ready'}</span>${deferredInstall ? '<button class="quiet-button install-button" type="button">Install app</button>' : ''}${demoMode ? '' : `<button class="quiet-button license-button" type="button">${unlocked ? 'Run room unlocked' : 'Unlock run room'}</button>`}</div>
  </header>`;
}

function renderDemoBanner(): string {
  return `<aside class="demo-banner" aria-label="Demo status"><span><b>Demo</b> — sample data, nothing is saved</span><div><button class="reset-demo quiet-button" type="button">Reset demo</button><button class="start-real secondary-button" type="button">Start for real</button></div></aside>`;
}

function renderIntro(hasItems: boolean): string {
  return `<section class="intro ${hasItems ? 'intro-compact' : ''}" aria-labelledby="page-title">
    <div class="intro-copy">
      <p class="eyebrow">Local receiving labels</p>
      <h1 id="page-title">Create barcode labels from a stock CSV</h1>
      <p class="lede">For small shops and makers receiving stock, turn one purchase list into checked labels and a saved print receipt.</p>
      ${hasItems ? '' : `<div class="intro-actions"><a class="primary-button sample-link" href="/demo">Try it with sample data</a><a class="secondary-button" href="#import">Import my CSV</a></div><p class="action-detail">The sample opens a nine-label receiving run.</p><ul class="intro-facts"><li><b>Private</b><span>CSV stays in this browser.</span></li><li><b>Offline</b><span>Opens after the first visit.</span></li><li><b>Free core</b><span>A4 labels, receipts, and backups.</span></li></ul>`}
    </div>
    ${hasItems ? '' : `<figure class="hero-print"><img src="/assets/receiving-run.webp" width="1200" height="800" alt="A halftone purchase list flowing through a label printer into a strip of barcode labels" fetchpriority="high" decoding="async"><figcaption>CSV to print proof</figcaption></figure>`}
  </section>`;
}

function renderImport(hasItems: boolean): string {
  return `<section id="import" class="import-section ${hasItems ? 'with-data' : ''}" aria-labelledby="import-title">
    <div class="section-heading"><p class="section-number">01 / Import</p><h2 id="import-title">${hasItems ? 'Source file' : 'Import a receiving CSV'}</h2><p>${hasItems ? `Stored in the ${demoMode ? 'demo' : 'local'} browser space · fingerprint ${fingerprint(draft.rawCsv)}` : 'Required columns: name, SKU, barcode. Quantity is optional and defaults to one.'}</p></div>
    ${hasItems ? `<div class="source-summary"><span class="file-stamp" aria-hidden="true">CSV</span><div><b>${h(draft.fileName)}</b><small>Imported ${h(formatDate(draft.importedAt))} · ${draft.items.length} product rows</small></div><button class="replace-file secondary-button" type="button">Replace CSV</button><button class="clear-run text-button danger-text" type="button">Clear run</button></div>` : `
      <div><div class="drop-zone ${importError ? 'has-error' : ''}" tabindex="0" role="button" aria-describedby="file-help file-error"><input id="csv-file" type="file" accept=".csv,text/csv" hidden><span class="drop-icon" aria-hidden="true">↓</span><strong>Choose a CSV <span>or drop it here</span></strong><small id="file-help">Nothing is uploaded. Maximum 2 MB.</small></div><p id="file-error" class="field-error" role="alert">${h(importError)}</p><div class="import-alternatives"><button class="paste-toggle secondary-button" type="button">Paste CSV text</button>${demoMode ? '' : '<a class="sample-link text-button" href="/demo">Try it with sample data</a>'}<button class="template-button text-button" type="button">Download template</button>${runs.length ? `<button class="history-button text-button empty-history-button" type="button">Run receipts <span>${runs.length}</span></button>` : ''}</div>${showPaste ? `<form class="paste-form"><label for="paste-csv">CSV text</label><textarea id="paste-csv" rows="7" spellcheck="false" required>${h(SAMPLE_CSV)}</textarea><button class="primary-button" type="submit">Check pasted rows</button></form>` : ''}</div>`}
  </section>`;
}

function renderWorkspace(): string {
  const invalid = invalidCount(); const total = totalLabels(); const labels = expandedLabels().slice(0, labelCapacity());
  return `<div class="workspace"><div class="work-column">
    <section id="check" class="check-section" aria-labelledby="check-title"><div class="section-heading inline-heading"><div><p class="section-number">02 / Check</p><h2 id="check-title">${invalid ? `${invalid} row${invalid === 1 ? ' needs' : 's need'} attention` : 'Every row is printable'}</h2></div><span class="status-lozenge ${invalid ? 'warning' : 'success'}">${invalid ? 'Fix before printing' : 'Checks passed'}</span></div><p class="check-note">Checks cover supported characters and GTIN checksums. They do not allocate barcodes or certify retailer compliance.</p><div class="table-wrap"><table><thead><tr><th scope="col">Product / SKU</th><th scope="col">Barcode</th><th scope="col">Type</th><th scope="col">Qty</th><th scope="col">Check</th></tr></thead><tbody>${draft.items.map(renderItemRow).join('')}</tbody></table></div></section>
    <section id="print" class="print-settings" aria-labelledby="print-title"><div class="section-heading"><p class="section-number">03 / Print</p><h2 id="print-title">Print ${total} labels</h2><p>${Math.ceil(total / labelCapacity())} ${draft.preset === 'roll-50x30' ? 'individual label page' : 'sheet page'}${Math.ceil(total / labelCapacity()) === 1 ? '' : 's'} plus a run receipt.</p></div><div class="settings-grid"><label>Run name<input id="run-name" value="${h(draft.runName)}" maxlength="60"></label><label>Label stock<select id="preset"><option value="a4-30" ${draft.preset === 'a4-30' ? 'selected' : ''}>A4 · 30-up · 70 × 29.7 mm</option><option value="a4-24" ${draft.preset === 'a4-24' ? 'selected' : ''}>A4 · 24-up · 70 × 35 mm ${unlocked ? '' : '— unlock'}</option><option value="roll-50x30" ${draft.preset === 'roll-50x30' ? 'selected' : ''}>Roll · 50 × 30 mm ${unlocked ? '' : '— unlock'}</option></select></label><label class="footer-field">Custom footer <span>${unlocked ? 'optional' : 'run room feature'}</span><input id="label-footer" value="${h(draft.footer)}" maxlength="36" ${unlocked ? '' : 'disabled'} placeholder="e.g. Batch 28 Aug"></label></div>${total > FREE_LABEL_LIMIT && !unlocked ? `<div class="limit-note"><b>This run has ${total} labels.</b> Free runs print up to ${FREE_LABEL_LIMIT}; unlock the run room for larger receiving days.</div>` : ''}<div class="print-actions"><button class="primary-button print-labels" type="button" ${invalid || total === 0 ? 'disabled' : ''}>Print label run</button><button class="secondary-button print-receipt" type="button" ${invalid || total === 0 ? 'disabled' : ''}>Print receipt only</button><button class="history-button text-button" type="button">Run receipts <span>${runs.length}</span></button></div><p class="print-tip">In the browser print dialog, choose “Save as PDF” for a PDF copy. Set scale to 100% and turn off headers and footers.</p></section>
  </div><aside class="proof-column" aria-labelledby="proof-title"><div class="proof-heading"><div><p class="eyebrow">Live print proof</p><h2 id="proof-title">Page 1</h2></div><span>${labels.length} / ${labelCapacity()}</span></div><div class="sheet-proof preset-${draft.preset}">${labels.map(renderLabel).join('')}${Array.from({ length: Math.max(0, labelCapacity() - labels.length) }, () => '<div class="blank-label" aria-hidden="true"></div>').join('')}</div><p class="proof-note">Dashed lines are cut guides and do not print.</p></aside></div>`;
}

function renderItemRow(item: StockItem, index: number): string {
  const issue = item.issues.join('. ');
  return `<tr class="${issue ? 'invalid-row' : ''}"><td data-label="Product / SKU"><input aria-label="Product name, row ${index + 1}" data-index="${index}" data-field="name" value="${h(item.name)}"><input class="sku-input" aria-label="SKU, row ${index + 1}" data-index="${index}" data-field="sku" value="${h(item.sku)}"></td><td data-label="Barcode"><input class="barcode-input" aria-label="Barcode, row ${index + 1}" data-index="${index}" data-field="barcode" value="${h(item.barcode)}" aria-invalid="${issue ? 'true' : 'false'}" ${issue ? `aria-describedby="issue-${index}"` : ''}></td><td data-label="Type"><select aria-label="Symbology, row ${index + 1}" data-index="${index}" data-field="symbology">${(['EAN-13', 'UPC-A', 'Code 128', 'Code 39'] as Symbology[]).map((type) => `<option ${type === item.symbology ? 'selected' : ''}>${type}</option>`).join('')}</select></td><td data-label="Quantity"><input class="qty-input" aria-label="Quantity, row ${index + 1}" data-index="${index}" data-field="quantity" type="number" min="1" max="999" value="${item.quantity}"></td><td data-label="Check"><span id="issue-${index}" class="row-status ${issue ? 'bad' : 'good'}"><i aria-hidden="true">${issue ? '!' : '✓'}</i>${h(issue || 'Ready')}</span></td></tr>`;
}

function renderLabel(item: StockItem): string { return `<article class="stock-label"><strong>${h(item.name)}</strong>${barcodeSvg(item.barcode, item.symbology)}<span class="human-code">${h(item.barcode)}</span><div><b>${h(item.sku)}</b><small>${h(draft.footer || item.symbology)}</small></div></article>`; }

function renderPrintSheets(): string {
  const capacity = labelCapacity(); const labels = expandedLabels(); const pages: StockItem[][] = [];
  for (let index = 0; index < labels.length; index += capacity) pages.push(labels.slice(index, index + capacity));
  return `<div class="print-label-pages" aria-hidden="true">${pages.map((page, pageIndex) => `<section class="print-sheet preset-${draft.preset}"><div class="print-sheet-labels">${page.map(renderLabel).join('')}</div><span class="print-page-number">${h(draft.runName)} · ${pageIndex + 1}/${pages.length}</span></section>`).join('')}</div>`;
}

function renderHistory(): string {
  return `<section class="history-section" aria-labelledby="history-title"><div class="section-heading inline-heading"><div><p class="section-number">Local archive</p><h2 id="history-title">Run receipts</h2></div><button class="close-history quiet-button" type="button">Close</button></div>${runs.length ? `<ul class="run-list">${runs.map((run) => `<li><div><b>${h(run.runName)}</b><span>${h(formatDate(run.printedAt))} · ${run.labelCount} labels · ${run.items.length} SKUs</span><small>${h(run.fileName)} · ${fingerprint(run.rawCsv)}</small></div><button class="reprint-run secondary-button" data-run-id="${run.id}" type="button">Open receipt</button><button class="delete-run text-button danger-text" data-run-id="${run.id}" type="button">Delete</button></li>`).join('')}</ul>` : '<div class="empty-history"><b>No printed runs yet.</b><p>Receipts appear here after you choose Print label run or Print receipt only.</p></div>'}</section>`;
}

function renderHowItWorks(): string {
  return `<section id="how-it-works" class="how-it-works" aria-labelledby="how-title"><p class="section-number">How it works</p><h2 id="how-title">Make a receiving run in three steps</h2><ol><li><b>Import the list</b><span>Choose a CSV or paste its rows.</span></li><li><b>Check each barcode</b><span>Fix values or quantities before printing.</span></li><li><b>Print and keep the receipt</b><span>Save the label sheet and its run record.</span></li></ol></section>`;
}

function renderLimitsAndPrivacy(): string {
  return `<section class="limits-section" aria-labelledby="limits-title"><p class="section-number">Data and limits</p><h2 id="limits-title">What stays local and what this does not do</h2><p>Your CSV, draft, and run receipts stay in this browser. Export a JSON receipt backup before clearing browser data.</p><p>It does not allocate barcodes, manage inventory, certify marketplace labels, or control a printer driver.</p><a href="/privacy/">Read the privacy policy</a></section>`;
}

function renderPaidTier(): string {
  return `<section class="paid-tier" aria-labelledby="paid-title"><p class="section-number">One-time upgrade</p><h2 id="paid-title">Run room upgrade — US $12 once</h2><p>It adds unlimited labels per run, A4 24-up and 50 × 30 mm stock, and custom label footers. CSV checking, A4 30-up labels, receipts, backups, and accessibility stay free.</p><p class="billing-status"><b>Checkout is temporarily unavailable.</b> Product registration with the billing service is still required. Existing license holders can restore a license below.</p><button class="secondary-button license-button" type="button">Restore or view license</button></section>`;
}

function renderLicense(): string {
  return `<section class="license-panel" aria-labelledby="license-title"><button class="close-license" type="button" aria-label="Close unlock panel">×</button><p class="section-number">One-time upgrade</p><h2 id="license-title">${unlocked ? 'Your run room is unlocked' : 'Restore a run room license'}</h2><p>${unlocked ? 'This device has an active license.' : 'Checkout is temporarily unavailable while billing registration completes. If you already bought a license, paste it below to restore your paid features.'}</p>${unlocked ? '<p class="license-good"><span aria-hidden="true">✓</span> License active on this device.</p>' : `<form class="restore-form"><label for="license-token">Have a license? Paste it here</label><div><input id="license-token" autocomplete="off" spellcheck="false" required><button class="secondary-button" type="submit">Verify license</button></div><p class="license-message" role="status"></p></form>`}<small>Sociobot/Dodo is the merchant of record. Refunds revoke a license. <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></small></section>`;
}

function renderReceipt(run: SavedRun): string {
  return `<section class="run-receipt" aria-labelledby="receipt-title"><header><div><p>Stock Label Run · print receipt</p><h2 id="receipt-title">${h(run.runName)}</h2></div><div class="receipt-mark">RUN<br><b>${run.id.slice(0, 8).toUpperCase()}</b></div></header><dl><div><dt>Printed</dt><dd>${h(formatDate(run.printedAt))}</dd></div><div><dt>Source</dt><dd>${h(run.fileName)}</dd></div><div><dt>File fingerprint</dt><dd>${fingerprint(run.rawCsv)}</dd></div><div><dt>Label stock</dt><dd>${h(run.preset)}</dd></div><div><dt>Products</dt><dd>${run.items.length}</dd></div><div><dt>Labels</dt><dd>${run.labelCount}</dd></div></dl><table><thead><tr><th>SKU</th><th>Product</th><th>Barcode</th><th>Type</th><th>Labels</th></tr></thead><tbody>${run.items.map((item) => `<tr><td>${h(item.sku)}</td><td>${h(item.name)}</td><td>${h(item.barcode)}</td><td>${item.symbology}</td><td>${item.quantity}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="4">Total labels</th><td>${run.labelCount}</td></tr></tfoot></table><footer><p>Reconciled by: __________________________</p><p>Source CSV and this receipt are stored only in this browser.</p></footer></section>`;
}

function renderFooter(): string {
  return `<footer><p><b>Stock Label Run</b> · Make checked barcode labels and keep the print receipt.</p><nav aria-label="Legal and product links"><a href="/demo">Demo</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><button class="export-runs" type="button">Export backup</button><label class="text-link">Import backup<input class="import-backup" type="file" accept="application/json" hidden></label></nav><p class="provenance">Built by Param Factory · ${VERSION} · Original illustration generated for this product.</p></footer>`;
}

function bindEvents(): void {
  document.querySelector('.notice-close')?.addEventListener('click', () => { notice = ''; render(); });
  document.querySelectorAll<HTMLElement>('.license-button').forEach((button) => button.addEventListener('click', () => { showLicense = !showLicense; render(); scrollToPanel('.license-panel'); }));
  document.querySelector('.close-license')?.addEventListener('click', () => { showLicense = false; render(); });
  document.querySelector('.install-button')?.addEventListener('click', async () => { await deferredInstall?.prompt(); deferredInstall = null; render(); });
  document.querySelector('.reset-demo')?.addEventListener('click', () => void resetDemo());
  document.querySelector('.start-real')?.addEventListener('click', () => void leaveDemo());
  const drop = document.querySelector<HTMLElement>('.drop-zone'); const file = document.querySelector<HTMLInputElement>('#csv-file');
  drop?.addEventListener('click', () => file?.click());
  drop?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); file?.click(); } });
  drop?.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
  drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop?.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('dragging'); const dropped = event.dataTransfer?.files[0]; if (dropped) void readFile(dropped); });
  file?.addEventListener('change', () => { if (file.files?.[0]) void readFile(file.files[0]); });
  document.querySelector('.paste-toggle')?.addEventListener('click', () => { showPaste = !showPaste; render(); });
  document.querySelector('.paste-form')?.addEventListener('submit', (event) => { event.preventDefault(); processCsv(document.querySelector<HTMLTextAreaElement>('#paste-csv')?.value ?? '', 'pasted-list.csv'); });
  document.querySelector('.template-button')?.addEventListener('click', () => download('stock-label-template.csv', 'name,sku,barcode,quantity,symbology\n', 'text/csv'));
  document.querySelector('.replace-file')?.addEventListener('click', () => { draft = emptyDraft(); importError = ''; void saveDraft(draft, storageScope); render(); });
  document.querySelector('.clear-run')?.addEventListener('click', () => { if (confirm(`Clear ${draft.items.length} imported rows from this ${demoMode ? 'demo' : 'device'}? Printed receipts will remain.`)) { draft = emptyDraft(); void saveDraft(draft, storageScope); render(); } });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-index][data-field]').forEach((control) => control.addEventListener('change', () => updateItem(control)));
  document.querySelector('#run-name')?.addEventListener('change', (event) => { draft.runName = (event.target as HTMLInputElement).value.trim() || 'Receiving run'; void persist(); });
  document.querySelector('#preset')?.addEventListener('change', (event) => { const value = (event.target as HTMLSelectElement).value as Draft['preset']; if (!unlocked && value !== 'a4-30') { if (!demoMode) { showLicense = true; notice = 'That stock size is included in the one-time run room upgrade.'; render(); scrollToPanel('.license-panel'); } else { notice = 'Extra stock sizes are available after restoring a paid license outside the demo.'; render(); } return; } draft.preset = value; void persist(true); });
  document.querySelector('#label-footer')?.addEventListener('change', (event) => { draft.footer = (event.target as HTMLInputElement).value.trim(); void persist(true); });
  document.querySelector('.print-labels')?.addEventListener('click', () => void beginPrint('labels'));
  document.querySelector('.print-receipt')?.addEventListener('click', () => void beginPrint('receipt'));
  document.querySelectorAll<HTMLElement>('.history-button').forEach((button) => button.addEventListener('click', () => { showHistory = true; render(); scrollToPanel('.history-section'); }));
  document.querySelector('.close-history')?.addEventListener('click', () => { showHistory = false; printRun = null; render(); });
  document.querySelectorAll<HTMLElement>('.reprint-run').forEach((button) => button.addEventListener('click', () => { printRun = runs.find((run) => run.id === button.dataset.runId) ?? null; render(); setTimeout(() => { document.body.dataset.print = 'receipt'; window.print(); }, 50); }));
  document.querySelectorAll<HTMLElement>('.delete-run').forEach((button) => button.addEventListener('click', async () => { const run = runs.find((entry) => entry.id === button.dataset.runId); if (run && confirm(`Delete the receipt “${run.runName}”? This cannot be undone.`)) { await deleteRun(run.id, storageScope); runs = await loadRuns(storageScope); render(); } }));
  document.querySelector('.restore-form')?.addEventListener('submit', (event) => { event.preventDefault(); const token = document.querySelector<HTMLInputElement>('#license-token')?.value.trim(); if (token) void verifyLicense(token, true); });
  document.querySelector('.export-runs')?.addEventListener('click', () => exportBackup());
  document.querySelector<HTMLInputElement>('.import-backup')?.addEventListener('change', (event) => void restoreBackup((event.target as HTMLInputElement).files?.[0]));
}

function scrollToPanel(selector: string): void { requestAnimationFrame(() => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' })); }

async function readFile(file: File): Promise<void> {
  if (file.size > 2 * 1024 * 1024) { importError = 'That file is over 2 MB. Split the receiving list and try again.'; render(); return; }
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') { importError = 'Choose a .csv file. Spreadsheet workbooks should be exported as CSV first.'; render(); return; }
  processCsv(await file.text(), file.name);
}

function processCsv(text: string, fileName: string): void {
  try {
    const items = importCsv(text);
    draft = { ...emptyDraft(), items, rawCsv: text, fileName, importedAt: new Date().toISOString() };
    importError = ''; showPaste = false;
    notice = items.some((item) => item.issues.length) ? 'CSV imported. Fix the marked rows before printing.' : `${items.length} product rows imported and checked.`;
    void saveDraft(draft, storageScope); render(); document.querySelector('#check')?.scrollIntoView({ behavior: 'smooth' });
  } catch (error) { importError = error instanceof Error ? error.message : 'The CSV could not be read.'; render(); }
}

function updateItem(control: HTMLInputElement | HTMLSelectElement): void {
  const index = Number(control.dataset.index); const field = control.dataset.field as keyof StockItem; const item = draft.items[index];
  if (!item) return;
  if (field === 'quantity') item.quantity = Number(control.value);
  else if (field === 'symbology') item.symbology = control.value as Symbology;
  else if (field === 'barcode') { item.barcode = control.value.replace(/\s/g, ''); if (!control.closest('tr')?.querySelector('select:focus')) item.symbology = inferSymbology(item.barcode, item.symbology); }
  else if (field === 'name' || field === 'sku') item[field] = control.value.trim();
  item.issues = [];
  if (!item.name) item.issues.push('Product name is empty');
  if (!item.sku) item.issues.push('SKU is empty');
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) item.issues.push('Quantity must be a whole number from 1 to 999');
  const barcodeIssue = validateBarcode(item.barcode, item.symbology); if (barcodeIssue) item.issues.push(barcodeIssue);
  void persist(true);
}

async function persist(rerender = false): Promise<void> { await saveDraft(draft, storageScope); if (rerender) render(); }

async function beginPrint(mode: 'labels' | 'receipt'): Promise<void> {
  const count = totalLabels(); if (invalidCount() || !count) return;
  if (!unlocked && count > FREE_LABEL_LIMIT) { if (!demoMode) { showLicense = true; notice = `Free runs include up to ${FREE_LABEL_LIMIT} labels.`; render(); scrollToPanel('.license-panel'); } else { notice = `Free runs include up to ${FREE_LABEL_LIMIT} labels outside the demo.`; render(); } return; }
  const run: SavedRun = { ...structuredClone(draft), id: crypto.randomUUID(), printedAt: new Date().toISOString(), labelCount: count };
  await saveRun(run, storageScope); runs = await loadRuns(storageScope); printRun = run; render(); requestAnimationFrame(() => { document.body.dataset.print = mode; window.print(); });
}

function formatDate(value: string): string { return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'; }
function download(name: string, content: string, type: string): void { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
function exportBackup(): void { download(`stock-label-runs-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ product: SLUG, version: 1, exportedAt: new Date().toISOString(), runs }, null, 2), 'application/json'); }

async function restoreBackup(file?: File): Promise<void> {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()) as { product?: string; runs?: SavedRun[] };
    if (data.product !== SLUG || !Array.isArray(data.runs)) throw new Error('Not a Stock Label Run backup');
    await importRuns(data.runs, storageScope); runs = await loadRuns(storageScope); notice = `${data.runs.length} receipt${data.runs.length === 1 ? '' : 's'} restored.`; showHistory = true;
  } catch { notice = 'That backup could not be read. Choose a Stock Label Run JSON export.'; }
  render();
}

function cachedLicenseIsValid(): boolean { try { const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as { valid?: boolean } | null; return Boolean(localStorage.getItem(LICENSE_KEY) && cached?.valid); } catch { return false; } }

async function verifyLicense(token: string, userInitiated = false): Promise<void> {
  if (demoMode) return;
  const message = document.querySelector<HTMLElement>('.license-message'); if (message) message.textContent = 'Verifying…';
  try {
    const response = await fetch(`${VERIFY_URL}?license=${encodeURIComponent(token)}`); const result = await response.json() as { valid: boolean; reason?: string };
    localStorage.setItem(LICENSE_KEY, token); localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: result.valid, checkedAt: Date.now() })); unlocked = result.valid;
    notice = result.valid ? 'Run room unlocked on this device.' : `License no longer active${result.reason ? ` (${result.reason.replace('_', ' ')})` : ''}.`;
    if (result.valid || userInitiated) render();
  } catch { if (message) message.textContent = 'Could not verify while offline. Your free tools still work; try again when connected.'; }
}

async function initLicense(): Promise<void> {
  if (demoMode) return;
  const url = new URL(location.href); const returnedToken = url.searchParams.get('license');
  if (returnedToken) { localStorage.setItem(LICENSE_KEY, returnedToken); url.searchParams.delete('license'); history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`); showLicense = true; await verifyLicense(returnedToken); return; }
  const token = localStorage.getItem(LICENSE_KEY); if (!token || !online) return;
  try { const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as { checkedAt?: number } | null; if (!cached?.checkedAt || Date.now() - cached.checkedAt > 86_400_000) void verifyLicense(token); } catch { void verifyLicense(token); }
}

async function seedDemo(): Promise<void> {
  const existing = await loadDraft('demo').catch(() => null);
  if (existing?.items?.length) { draft = existing; return; }
  draft = { ...emptyDraft(), items: importCsv(SAMPLE_CSV), rawCsv: SAMPLE_CSV, fileName: 'sample-receiving.csv', importedAt: new Date().toISOString(), runName: 'Sample receiving run' };
  await saveDraft(draft, 'demo');
}

async function resetDemo(): Promise<void> {
  try { await clearScope('demo'); draft = emptyDraft(); runs = []; await seedDemo(); notice = 'Demo reset to the sample receiving run.'; } catch (error) { notice = error instanceof Error ? error.message : 'The demo could not reset. Close other demo tabs and try again.'; }
  render();
}

async function leaveDemo(): Promise<void> { try { await clearScope('demo'); } finally { location.assign('/'); } }

window.addEventListener('online', () => { online = true; render(); });
window.addEventListener('offline', () => { online = false; render(); });
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredInstall = event as BeforeInstallPromptEvent; render(); });
window.addEventListener('afterprint', () => { delete document.body.dataset.print; });

async function init(): Promise<void> {
  if (demoMode) await seedDemo(); else { const stored = await loadDraft('real').catch(() => null); if (stored?.items?.length) draft = stored; }
  runs = await loadRuns(storageScope).catch(() => []); render(); await initLicense();
  if ('serviceWorker' in navigator) { navigator.serviceWorker.addEventListener('message', (event) => { if (event.data?.type === 'UPDATE_AVAILABLE') { notice = 'A fresh version is ready. Reload to update.'; render(); } }); void navigator.serviceWorker.register('/sw.js').catch(() => undefined); }
}

void init();
