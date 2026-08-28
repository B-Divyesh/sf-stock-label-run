import type { Symbology } from './types';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function validGtinChecksum(value: string): boolean {
  if (!/^\d+$/.test(value) || ![12, 13].includes(value.length)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function validateBarcode(value: string, symbology: Symbology): string | null {
  if (!value) return 'Barcode is empty';
  if (symbology === 'EAN-13') {
    if (!/^\d{13}$/.test(value)) return 'EAN-13 needs exactly 13 digits';
    if (!validGtinChecksum(value)) return 'EAN-13 checksum does not match';
  }
  if (symbology === 'UPC-A') {
    if (!/^\d{12}$/.test(value)) return 'UPC-A needs exactly 12 digits';
    if (!validGtinChecksum(value)) return 'UPC-A checksum does not match';
  }
  if (symbology === 'Code 39' && !/^[0-9A-Z. $/+%-]+$/.test(value)) return 'Code 39 supports uppercase letters, numbers, space, and . $ / + % -';
  if (symbology === 'Code 128' && !/^[\x20-\x7E]+$/.test(value)) return 'Code 128 supports printable ASCII only';
  if (value.length > 48) return 'Barcode is too long for a readable label';
  return null;
}

function encodeEan13(value: string): string {
  const parity = PARITY[Number(value[0])];
  let modules = '101';
  for (let i = 1; i <= 6; i += 1) modules += parity[i - 1] === 'L' ? L[Number(value[i])] : G[Number(value[i])];
  modules += '01010';
  for (let i = 7; i <= 12; i += 1) modules += R[Number(value[i])];
  return `${modules}101`;
}

const CODE39: Record<string, string> = {
  '0':'nnnwwnwnn','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
  A:'wnnnnwnnw',B:'nnwnnwnnw',C:'wnwnnwnnn',D:'nnnnwwnnw',E:'wnnnwwnnn',F:'nnwnwwnnn',G:'nnnnnwwnw',H:'wnnnnwwnn',I:'nnwnnwwnn',J:'nnnnwwwnn',
  K:'wnnnnnnww',L:'nnwnnnnww',M:'wnwnnnnwn',N:'nnnnwnnww',O:'wnnnwnnwn',P:'nnwnwnnwn',Q:'nnnnnnwww',R:'wnnnnnwwn',S:'nnwnnnwwn',T:'nnnnwnwwn',
  U:'wwnnnnnnw',V:'nwwnnnnnw',W:'wwwnnnnnn',X:'nwnnwnnnw',Y:'wwnnwnnnn',Z:'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','$':'nwnwnwnnn','/':'nwnwnnnwn','+':'nwnnnwnwn','%':'nnnwnwnwn','*':'nwnnwnwnn'
};

function encodeCode39(value: string): string {
  return `*${value}*`.split('').map((char) => [...CODE39[char]].map((width, index) => `${index % 2 === 0 ? '1' : '0'}`.repeat(width === 'w' ? 3 : 1)).join('')).join('0');
}

const C128 = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'
];

function widthsToModules(widths: string): string {
  return [...widths].map((width, index) => (index % 2 === 0 ? '1' : '0').repeat(Number(width))).join('');
}

function encodeCode128(value: string): string {
  const codes = [...value].map((char) => char.charCodeAt(0) - 32);
  const checksum = (104 + codes.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  return [104, ...codes, checksum, 106].map((code) => widthsToModules(C128[code])).join('');
}

export function barcodeModules(value: string, symbology: Symbology): string {
  if (symbology === 'EAN-13') return encodeEan13(value);
  if (symbology === 'UPC-A') return encodeEan13(`0${value}`);
  if (symbology === 'Code 39') return encodeCode39(value);
  return encodeCode128(value);
}

export function barcodeSvg(value: string, symbology: Symbology): string {
  const modules = barcodeModules(value, symbology);
  const quiet = 10;
  const bars: string[] = [];
  let start = -1;
  for (let index = 0; index <= modules.length; index += 1) {
    if (modules[index] === '1' && start < 0) start = index;
    if (modules[index] !== '1' && start >= 0) {
      bars.push(`<rect x="${start + quiet}" y="0" width="${index - start}" height="42"/>`);
      start = -1;
    }
  }
  return `<svg class="barcode" viewBox="0 0 ${modules.length + quiet * 2} 42" preserveAspectRatio="none" role="img" aria-label="${symbology} barcode ${escapeXml(value)}"><g fill="currentColor">${bars.join('')}</g></svg>`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] ?? char));
}
