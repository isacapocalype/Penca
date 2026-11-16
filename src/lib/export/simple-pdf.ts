const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

function ascii(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, '?');
}

function escapePdf(text: string): string {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Penulis PDF minimal tanpa dependency. Cukup untuk laporan teks dan tabel
 * sederhana. Berkas PDF dihasilkan dari data aplikasi, bukan dicetak dari
 * WebView.
 */
export class SimplePdf {
  private pages: string[] = [];

  private current = '';

  private y = PAGE_HEIGHT - MARGIN;

  constructor(private readonly title: string) {}

  titleText(text: string): void {
    this.ensureSpace(30);
    this.textAt(MARGIN, this.y, text, 'F2', 17);
    this.y -= 24;
  }

  subtitle(text: string): void {
    this.ensureSpace(18);
    this.textAt(MARGIN, this.y, text, 'F1', 10);
    this.y -= 15;
  }

  section(text: string): void {
    this.ensureSpace(30);
    this.y -= 6;
    this.textAt(MARGIN, this.y, text, 'F2', 12);
    this.y -= 18;
  }

  field(label: string, value: string): void {
    this.ensureSpace(16);
    this.textAt(MARGIN, this.y, label, 'F1', 10);
    this.textAt(210, this.y, `: ${value}`, 'F1', 10);
    this.y -= 14;
  }

  table(headers: string[], rows: string[][], widths: number[]): void {
    this.ensureSpace(20);
    let x = MARGIN;

    for (const [index, header] of headers.entries()) {
      this.textAt(x, this.y, header, 'F2', 9);
      x += widths[index] ?? 80;
    }

    this.y -= 5;
    this.line(MARGIN, this.y, PAGE_WIDTH - MARGIN);
    this.y -= 12;

    for (const row of rows) {
      this.ensureSpace(16);
      x = MARGIN;

      for (const [index, cell] of row.entries()) {
        this.textAt(x, this.y, this.truncate(cell, widths[index] ?? 80), 'F1', 9);
        x += widths[index] ?? 80;
      }

      this.y -= 13;
    }
  }

  save(): Uint8Array {
    this.pages.push(this.current);

    const objects: Record<number, string> = {
      1: '<< /Type /Catalog /Pages 2 0 R >>',
      3: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      4: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    };
    const pageObjects: number[] = [];
    let next = 5;

    for (const content of this.pages) {
      const contentNumber = next++;
      const pageNumber = next++;
      objects[contentNumber] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
      objects[pageNumber] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`;
      pageObjects.push(pageNumber);
    }

    objects[2] =
      `<< /Type /Pages /Kids [${pageObjects.map((number) => `${number} 0 R`).join(' ')}] ` +
      `/Count ${pageObjects.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets: Record<number, number> = {};
    const numbers = Object.keys(objects)
      .map(Number)
      .sort((a, b) => a - b);

    for (const number of numbers) {
      offsets[number] = pdf.length;
      pdf += `${number} 0 obj\n${objects[number]}\nendobj\n`;
    }

    const maxObject = numbers[numbers.length - 1] ?? 0;
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;

    for (let object = 1; object <= maxObject; object++) {
      const offset = offsets[object] ?? 0;
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer << /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new TextEncoder().encode(pdf);
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed < MARGIN) {
      this.pages.push(this.current);
      this.current = '';
      this.y = PAGE_HEIGHT - MARGIN;
      this.textAt(MARGIN, this.y, `${this.title} - lanjutan`, 'F2', 12);
      this.y -= 22;
    }
  }

  private textAt(x: number, y: number, text: string, font: string, size: number): void {
    this.current += `BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET\n`;
  }

  private line(x: number, y: number, to: number): void {
    this.current += `${x.toFixed(2)} ${y.toFixed(2)} m ${to.toFixed(2)} ${y.toFixed(2)} l S\n`;
  }

  private truncate(text: string, width: number): string {
    const limit = Math.max(4, Math.floor(width / 4.6));
    const value = ascii(text);

    return value.length > limit ? `${value.slice(0, limit - 1)}...` : value;
  }
}
