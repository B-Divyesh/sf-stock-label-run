export type Symbology = 'EAN-13' | 'UPC-A' | 'Code 128' | 'Code 39';

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  quantity: number;
  symbology: Symbology;
  issues: string[];
}

export interface Draft {
  runName: string;
  fileName: string;
  rawCsv: string;
  importedAt: string;
  items: StockItem[];
  preset: 'a4-30' | 'a4-24' | 'roll-50x30';
  footer: string;
}

export interface SavedRun extends Draft {
  id: string;
  printedAt: string;
  labelCount: number;
}
