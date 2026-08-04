import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { chartSvgToPngBlob, chartSvgToPngDataUrl } from './chartImage';
import { downloadBlob, makeExportFilename } from './download';
import { formatDate, formatNumber } from './validators';

/** Printable page margin: 1 cm on all sides. */
const PDF_MARGIN_MM = 10;

/** @type {{regular: string, bold: string}|null} */
let fontsCache = null;

/**
 * Today's date as DD.MM.YYYY for document headers.
 * @returns {string}
 */
function todayDisplay() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${now.getFullYear()}`;
}

/**
 * Capitalize the first letter of a name part.
 * @param {string} part
 * @returns {string}
 */
function capitalizePart(part) {
  const value = String(part || '').trim();
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * User display name with capitalized first letters.
 * @param {{name?: string, surname?: string}|null} user
 * @returns {string}
 */
function userLabel(user) {
  if (!user) return '';
  return [capitalizePart(user.name), capitalizePart(user.surname)].filter(Boolean).join(' ');
}

/**
 * Format reference pair for PDF tables.
 * @param {object} row
 * @returns {string}
 */
function refsLabel(row) {
  if (row.ref_lower == null || row.ref_upper == null) return '—';
  return `${formatNumber(row.ref_lower)} — ${formatNumber(row.ref_upper)}`;
}

/**
 * Resolve period bounds; empty begin/end → min/max of rows.
 * @param {Array} rows
 * @param {string} begin
 * @param {string} end
 * @returns {{from: string, to: string}}
 */
export function resolvePeriod(rows, begin, end) {
  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  return {
    from: begin || dates[0] || '',
    to: end || dates[dates.length - 1] || '',
  };
}

/**
 * Convert ArrayBuffer to base64 without spreading huge typed arrays.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Load DejaVu fonts from same-origin public/fonts (selectable Cyrillic text).
 * @returns {Promise<{regular: string, bold: string}>}
 */
async function loadFonts() {
  if (fontsCache) return fontsCache;

  const base = import.meta.env.BASE_URL || '/';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);

  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch(`${base}fonts/DejaVuSans.ttf`, { signal: controller.signal }),
      fetch(`${base}fonts/DejaVuSans-Bold.ttf`, { signal: controller.signal }),
    ]);
    if (!regularRes.ok || !boldRes.ok) {
      throw new Error('Не удалось загрузить шрифты для PDF');
    }
    fontsCache = {
      regular: arrayBufferToBase64(await regularRes.arrayBuffer()),
      bold: arrayBufferToBase64(await boldRes.arrayBuffer()),
    };
    return fontsCache;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Таймаут загрузки шрифтов для PDF');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Register Cyrillic fonts on a jsPDF document.
 * @param {import('jspdf').jsPDF} doc
 */
async function ensureFonts(doc) {
  const fonts = await loadFonts();
  doc.addFileToVFS('DejaVuSans.ttf', fonts.regular);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.bold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
  doc.setFont('DejaVuSans', 'normal');
}

/**
 * Draw title, rule and meta lines. Returns Y for next content.
 * @param {import('jspdf').jsPDF} doc
 * @param {string} title
 * @param {string[]} metaLines
 * @returns {number}
 */
function drawHeader(doc, title, metaLines) {
  const pageW = doc.internal.pageSize.getWidth();
  let y = PDF_MARGIN_MM;

  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(31, 77, 56);
  doc.text(title, PDF_MARGIN_MM, y + 5);
  y += 9;

  doc.setDrawColor(31, 77, 56);
  doc.setLineWidth(0.35);
  doc.line(PDF_MARGIN_MM, y, pageW - PDF_MARGIN_MM, y);
  y += 6;

  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  metaLines.forEach((line) => {
    doc.text(line, PDF_MARGIN_MM, y);
    y += 5;
  });
  return y + 2;
}

/**
 * Draw a selectable text table with 1cm margins and row-aware page breaks.
 * @param {import('jspdf').jsPDF} doc
 * @param {object} options
 */
function drawTable(doc, options) {
  autoTable(doc, {
    margin: {
      top: PDF_MARGIN_MM,
      right: PDF_MARGIN_MM,
      bottom: PDF_MARGIN_MM,
      left: PDF_MARGIN_MM,
    },
    styles: {
      font: 'DejaVuSans',
      fontStyle: 'normal',
      fontSize: 8,
      cellPadding: 1.5,
      overflow: 'linebreak',
      valign: 'middle',
      halign: 'center',
      textColor: [26, 26, 26],
      lineColor: [183, 207, 194],
      lineWidth: 0.1,
    },
    headStyles: {
      font: 'DejaVuSans',
      fontStyle: 'bold',
      fillColor: [195, 220, 206],
      textColor: [31, 77, 56],
      halign: 'center',
    },
    ...options,
  });
}

/**
 * Save PDF the same way as Excel (blob download).
 * @param {import('jspdf').jsPDF} doc
 * @param {string} filename
 */
function savePdf(doc, filename) {
  downloadBlob(doc.output('blob'), filename);
}

/**
 * Download chart as PNG with analysis title.
 * @param {{svgEl: SVGSVGElement, analysisName: string}} params
 */
export async function downloadChartPng({ svgEl, analysisName }) {
  const blob = await chartSvgToPngBlob(svgEl, { title: analysisName, scale: 2 });
  downloadBlob(blob, makeExportFilename('grafik', 'png'));
}

/**
 * Download graph page PDF: text header/table + chart image.
 * @param {object} params
 */
export async function downloadGraphPdf({
  user,
  analysisName,
  begin,
  end,
  rows,
  svgEl,
}) {
  const period = resolvePeriod(rows, begin, end);
  const chartDataUrl = await chartSvgToPngDataUrl(svgEl, { scale: 2 });
  const person = userLabel(user);
  const title = person ? `График анализов ${person}` : 'График анализов';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await ensureFonts(doc);

  let y = drawHeader(doc, title, [
    `Дата скачивания: ${todayDisplay()}`,
    `Анализ: ${analysisName}`,
    `Интервал: ${formatDate(period.from)} — ${formatDate(period.to)}`,
  ]);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgW = pageW - PDF_MARGIN_MM * 2;
  const imgH = imgW * (360 / 760);
  if (y + imgH > pageH - PDF_MARGIN_MM) {
    doc.addPage();
    y = PDF_MARGIN_MM;
  }
  doc.addImage(chartDataUrl, 'PNG', PDF_MARGIN_MM, y, imgW, imgH);
  y += imgH + 6;

  const usableW = pageW - PDF_MARGIN_MM * 2;
  drawTable(doc, {
    startY: y,
    head: [['№', 'Значение', 'Референс', 'Дата', 'Организация', 'Примечание']],
    body: rows.map((row, index) => [
      String(index + 1),
      formatNumber(row.value),
      refsLabel(row),
      formatDate(row.date),
      row.organization || '—',
      row.note || '—',
    ]),
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 32 },
      3: { cellWidth: 22 },
      4: { cellWidth: 30 },
      5: { cellWidth: Math.max(24, usableW - 10 - 22 - 32 - 22 - 30), halign: 'left' },
    },
  });

  savePdf(doc, makeExportFilename('grafik', 'pdf'));
}

/**
 * Download home page PDF as selectable text with 1cm margins.
 * @param {{user: object|null, rows: Array}} params
 */
export async function downloadHomePdf({ user, rows }) {
  const person = userLabel(user);
  const title = person ? `Список анализов ${person}` : 'Список анализов';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await ensureFonts(doc);

  const startY = drawHeader(doc, title, [
    `Дата скачивания: ${todayDisplay()}`,
  ]);

  const usableW = doc.internal.pageSize.getWidth() - PDF_MARGIN_MM * 2;
  drawTable(doc, {
    startY,
    head: [['№', 'Название', 'Дата', 'Значение', 'Референс', 'Организация', 'Примечание']],
    body: rows.map((row, index) => [
      String(index + 1),
      row.name,
      formatDate(row.date),
      formatNumber(row.value),
      refsLabel(row),
      row.organization || '—',
      row.note || '—',
    ]),
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 32, halign: 'left' },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
      6: { cellWidth: Math.max(24, usableW - 10 - 32 - 20 - 20 - 28 - 28), halign: 'left' },
    },
  });

  savePdf(doc, makeExportFilename('analizy', 'pdf'));
}

/**
 * Download visible home table as XLSX (header row first; refs split).
 * @param {{rows: Array}} params
 */
export function downloadHomeXlsx({ rows }) {
  const header = [
    '№',
    'Название',
    'Дата',
    'Значение',
    'Референс нижний',
    'Референс верхний',
    'Организация',
    'Примечание',
  ];
  const data = [
    header,
    ...rows.map((row, index) => [
      index + 1,
      row.name,
      formatDate(row.date),
      Number(row.value),
      row.ref_lower == null ? '' : Number(row.ref_lower),
      row.ref_upper == null ? '' : Number(row.ref_upper),
      row.organization || '',
      row.note || '',
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Анализы');
  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    makeExportFilename('analizy', 'xlsx'),
  );
}
