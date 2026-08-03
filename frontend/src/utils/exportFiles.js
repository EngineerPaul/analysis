import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { chartSvgToPngBlob, chartSvgToPngDataUrl } from './chartImage';
import { downloadBlob, escapeHtml, makeExportFilename } from './download';
import { formatDate, formatNumber } from './validators';

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
 * Shared PDF document styles (title + full-width rule under header).
 * @returns {string}
 */
function pdfBaseStyles() {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      background: #ffffff;
      color: #1a1a1a;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    h1 {
      font-size: 16px;
      margin: 0 0 10px;
      color: #1f4d38;
      font-weight: bold;
    }
    .title-rule {
      border: none;
      border-top: 1.5px solid #1f4d38;
      margin: 0 -28px 14px;
      width: calc(100% + 56px);
    }
    .meta { margin: 0 0 6px; }
  `;
}

/**
 * Paginate a tall canvas into an A4 portrait PDF and download.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
function canvasToPdfDownload(canvas, filename) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * pageW) / canvas.width;
  const imgData = canvas.toDataURL('image/png');
  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0.5) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  pdf.save(filename);
}

/**
 * Wait until iframe document is ready.
 * @param {HTMLIFrameElement} iframe
 * @returns {Promise<Document>}
 */
function waitIframeDoc(iframe) {
  return new Promise((resolve, reject) => {
    const finish = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) {
        reject(new Error('Не удалось подготовить PDF'));
        return;
      }
      resolve(doc);
    };
    if (iframe.contentDocument?.readyState === 'complete') {
      finish();
      return;
    }
    iframe.onload = finish;
  });
}

/**
 * Render HTML in an isolated iframe (no main-page flash) → PDF download.
 * @param {string} html
 * @param {string} filename
 */
async function htmlToPdfDownload(html, filename) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:794px',
    'height:1123px',
    'opacity:0',
    'pointer-events:none',
    'border:0',
  ].join(';');
  document.body.appendChild(iframe);

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  try {
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>`);
    doc.close();
    await waitIframeDoc(iframe);
    doc.body.innerHTML = html;

    // Allow images (chart data-URL) to decode before capture.
    await Promise.all(
      [...doc.images].map((img) => (
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          })
      )),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    iframe.style.height = `${Math.max(doc.body.scrollHeight + 40, 200)}px`;

    const canvas = await html2canvas(doc.body, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: doc.body.scrollWidth,
      windowHeight: doc.body.scrollHeight,
    });
    canvasToPdfDownload(canvas, filename);
  } finally {
    iframe.remove();
    window.scrollTo(scrollX, scrollY);
  }
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
 * Download graph page PDF: title with user, dates, chart, table (+ organization).
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
  const bodyRows = rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(formatNumber(row.value))}</td>
      <td>${escapeHtml(refsLabel(row))}</td>
      <td>${escapeHtml(formatDate(row.date))}</td>
      <td>${escapeHtml(row.organization || '—')}</td>
      <td class="note">${escapeHtml(row.note || '—')}</td>
    </tr>
  `).join('');

  const html = `
    <style>
      ${pdfBaseStyles()}
      .chart { width: 100%; margin: 14px 0 18px; display: block; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td {
        border: 1px solid #b7cfc2;
        padding: 4px 5px;
        text-align: center;
        vertical-align: middle;
        word-wrap: break-word;
        font-size: 9px;
      }
      th { background: #c3dcce; color: #1f4d38; font-weight: bold; }
      td.note, th.note { text-align: left; }
      col.c-num { width: 5%; }
      col.c-val { width: 12%; }
      col.c-ref { width: 18%; }
      col.c-date { width: 12%; }
      col.c-org { width: 16%; }
      col.c-note { width: 37%; }
    </style>
    <h1>${escapeHtml(title)}</h1>
    <hr class="title-rule" />
    <p class="meta"><strong>Дата скачивания:</strong> ${escapeHtml(todayDisplay())}</p>
    <p class="meta"><strong>Анализ:</strong> ${escapeHtml(analysisName)}</p>
    <p class="meta"><strong>Интервал:</strong> ${escapeHtml(formatDate(period.from))} — ${escapeHtml(formatDate(period.to))}</p>
    <img class="chart" src="${chartDataUrl}" alt="График" />
    <table>
      <colgroup>
        <col class="c-num" /><col class="c-val" /><col class="c-ref" />
        <col class="c-date" /><col class="c-org" /><col class="c-note" />
      </colgroup>
      <thead>
        <tr>
          <th>№</th>
          <th>Значение</th>
          <th>Референс</th>
          <th>Дата</th>
          <th>Организация</th>
          <th class="note">Примечание</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;

  await htmlToPdfDownload(html, makeExportFilename('grafik', 'pdf'));
}

/**
 * Download home page PDF with user name in title and visible analyses table.
 * @param {{user: object|null, rows: Array}} params
 */
export async function downloadHomePdf({ user, rows }) {
  const person = userLabel(user);
  const title = person ? `Список анализов ${person}` : 'Список анализов';
  const bodyRows = rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="name">${escapeHtml(row.name)}</td>
      <td>${escapeHtml(formatDate(row.date))}</td>
      <td>${escapeHtml(formatNumber(row.value))}</td>
      <td>${escapeHtml(refsLabel(row))}</td>
      <td>${escapeHtml(row.organization || '—')}</td>
      <td class="note">${escapeHtml(row.note || '—')}</td>
    </tr>
  `).join('');

  const html = `
    <style>
      ${pdfBaseStyles()}
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td {
        border: 1px solid #b7cfc2;
        padding: 4px 4px;
        text-align: center;
        vertical-align: middle;
        word-wrap: break-word;
        font-size: 8.5px;
      }
      th { background: #c3dcce; color: #1f4d38; font-weight: bold; }
      td.name, th.name, td.note, th.note { text-align: left; }
      col.c-num { width: 4%; }
      col.c-name { width: 18%; }
      col.c-date { width: 10%; }
      col.c-val { width: 10%; }
      col.c-ref { width: 14%; }
      col.c-org { width: 14%; }
      col.c-note { width: 30%; }
    </style>
    <h1>${escapeHtml(title)}</h1>
    <hr class="title-rule" />
    <p class="meta"><strong>Дата скачивания:</strong> ${escapeHtml(todayDisplay())}</p>
    <table>
      <colgroup>
        <col class="c-num" /><col class="c-name" /><col class="c-date" />
        <col class="c-val" /><col class="c-ref" /><col class="c-org" /><col class="c-note" />
      </colgroup>
      <thead>
        <tr>
          <th>№</th>
          <th class="name">Название</th>
          <th>Дата</th>
          <th>Значение</th>
          <th>Референс</th>
          <th>Организация</th>
          <th class="note">Примечание</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;

  await htmlToPdfDownload(html, makeExportFilename('analizy', 'pdf'));
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
