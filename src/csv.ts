import type { StockItem, Symbology } from './types';
import { validateBarcode } from './barcode';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (quoted) {
      if (char === '"' && normalized[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('A quoted field is not closed. Check the final row of your CSV.');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const aliases = {
  name: ['name', 'product', 'product name', 'item', 'description'],
  sku: ['sku', 'item code', 'product code', 'stock code'],
  barcode: ['barcode', 'barcode value', 'ean', 'upc', 'gtin'],
  quantity: ['quantity', 'qty', 'labels', 'count'],
  symbology: ['symbology', 'barcode type', 'type', 'format'],
};

function findColumn(headers: string[], names: string[]): number {
  return headers.findIndex((header) => names.includes(header.toLowerCase().trim()));
}

export function inferSymbology(value: string, requested = ''): Symbology {
  const clean = requested.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('ean13')) return 'EAN-13';
  if (clean.includes('upca') || clean === 'upc') return 'UPC-A';
  if (clean.includes('code39')) return 'Code 39';
  if (clean.includes('code128')) return 'Code 128';
  if (/^\d{13}$/.test(value)) return 'EAN-13';
  if (/^\d{12}$/.test(value)) return 'UPC-A';
  if (/^[0-9A-Z. $/+%-]+$/.test(value)) return 'Code 39';
  return 'Code 128';
}

export function rowsToItems(rows: string[][]): StockItem[] {
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one product row.');
  const headers = rows[0];
  const columns = {
    name: findColumn(headers, aliases.name),
    sku: findColumn(headers, aliases.sku),
    barcode: findColumn(headers, aliases.barcode),
    quantity: findColumn(headers, aliases.quantity),
    symbology: findColumn(headers, aliases.symbology),
  };
  const missing = (['name', 'sku', 'barcode'] as const).filter((key) => columns[key] < 0);
  if (missing.length) {
    throw new Error(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Use name, sku, barcode, and optional quantity.`);
  }
  return rows.slice(1).map((row, index) => {
    const get = (column: number) => (column < 0 ? '' : (row[column] ?? '').trim());
    const name = get(columns.name);
    const sku = get(columns.sku);
    const barcode = get(columns.barcode).replace(/\s/g, '');
    const quantityText = get(columns.quantity) || '1';
    const quantity = Number(quantityText);
    const symbology = inferSymbology(barcode, get(columns.symbology));
    const issues: string[] = [];
    if (!name) issues.push('Product name is empty');
    if (!sku) issues.push('SKU is empty');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) issues.push('Quantity must be a whole number from 1 to 999');
    const barcodeIssue = validateBarcode(barcode, symbology);
    if (barcodeIssue) issues.push(barcodeIssue);
    return {
      id: crypto.randomUUID?.() ?? `row-${Date.now()}-${index}`,
      name,
      sku,
      barcode,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      symbology,
      issues,
    };
  });
}

export function importCsv(text: string): StockItem[] {
  return rowsToItems(parseCsv(text));
}

export const SAMPLE_CSV = `name,sku,barcode,quantity,symbology
Cedar soap,SOAP-CEDAR,5901234123457,4,EAN-13
Small canvas pouch,POUCH-S,036602301979,3,UPC-A
Repair kit,KIT-REPAIR,REPAIR-042,2,Code 128`;
