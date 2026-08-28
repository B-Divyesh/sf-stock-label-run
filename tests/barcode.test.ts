import { describe, expect, it } from 'vitest';
import { barcodeModules, validGtinChecksum, validateBarcode } from '../src/barcode';
import { importCsv, parseCsv } from '../src/csv';

describe('GTIN validation', () => {
  it('accepts known EAN-13 and UPC-A checksums', () => {
    expect(validGtinChecksum('5901234123457')).toBe(true);
    expect(validGtinChecksum('036602301979')).toBe(true);
  });

  it('rejects an incorrect checksum with an actionable error', () => {
    expect(validateBarcode('5901234123458', 'EAN-13')).toBe('EAN-13 checksum does not match');
  });

  it('produces the standard 95-module EAN-13 symbol', () => {
    expect(barcodeModules('5901234123457', 'EAN-13')).toHaveLength(95);
  });
});

describe('CSV import', () => {
  it('preserves quoted commas and maps common header aliases', () => {
    const items = importCsv('Product,Item Code,GTIN,Qty\n"Soap, cedar",S-1,5901234123457,4');
    expect(items[0]).toMatchObject({ name: 'Soap, cedar', sku: 'S-1', quantity: 4, issues: [] });
  });

  it('reports an unclosed quoted field', () => {
    expect(() => parseCsv('name,sku\n"broken,S-1')).toThrow(/not closed/);
  });

  it('keeps invalid rows and explains why', () => {
    const [item] = importCsv('name,sku,barcode,quantity\nWidget,W-1,5901234123458,0');
    expect(item.issues).toEqual(expect.arrayContaining(['Quantity must be a whole number from 1 to 999', 'EAN-13 checksum does not match']));
  });
});
