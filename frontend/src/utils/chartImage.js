/**
 * Chart SVG → PNG helpers for downloads and PDF embedding.
 */

const CHART_W = 760;
const CHART_H = 360;

/**
 * Prepare a standalone SVG clone with inlined styles (no CSS classes).
 * @param {SVGSVGElement} svgEl
 * @returns {SVGSVGElement}
 */
function prepareSvgClone(svgEl) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(CHART_W));
  clone.setAttribute('height', String(CHART_H));
  clone.querySelectorAll('circle[fill="transparent"]').forEach((node) => node.remove());
  clone.querySelectorAll('.grid-line').forEach((el) => {
    el.setAttribute('stroke', 'rgba(90, 170, 210, 0.35)');
    el.setAttribute('stroke-width', '1');
  });
  clone.querySelectorAll('.tick-label').forEach((el) => {
    el.setAttribute('fill', '#5a7a6a');
    el.setAttribute('font-size', '11');
    el.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
  });
  clone.querySelectorAll('.chart-point circle').forEach((el) => {
    if (el.getAttribute('fill') === '#ffffff') el.remove();
    else el.setAttribute('r', '5');
  });
  return clone;
}

/**
 * Serialize SVG element to a Blob.
 * @param {SVGSVGElement} svgEl
 * @returns {Blob}
 */
function svgToBlob(svgEl) {
  const xml = new XMLSerializer().serializeToString(svgEl);
  return new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Render chart SVG to a PNG canvas, optionally with a title above.
 * @param {SVGSVGElement} svgEl
 * @param {{title?: string, scale?: number}} [options]
 * @returns {Promise<HTMLCanvasElement>}
 */
export function chartSvgToCanvas(svgEl, options = {}) {
  const title = options.title || '';
  const scale = options.scale || 2;
  const titleH = title ? 44 : 0;
  const canvas = document.createElement('canvas');
  canvas.width = CHART_W * scale;
  canvas.height = (CHART_H + titleH) * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);

  if (title) {
    ctx.fillStyle = '#1f4d38';
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, CHART_W / 2, titleH / 2);
  }

  const clone = prepareSvgClone(svgEl);
  const blob = svgToBlob(clone);
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, titleH, CHART_W, CHART_H);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось отрисовать график'));
    };
    img.src = url;
  });
}

/**
 * Convert chart SVG to PNG data URL.
 * @param {SVGSVGElement} svgEl
 * @param {{title?: string, scale?: number}} [options]
 * @returns {Promise<string>}
 */
export async function chartSvgToPngDataUrl(svgEl, options = {}) {
  const canvas = await chartSvgToCanvas(svgEl, options);
  return canvas.toDataURL('image/png');
}

/**
 * Convert chart SVG to PNG Blob.
 * @param {SVGSVGElement} svgEl
 * @param {{title?: string, scale?: number}} [options]
 * @returns {Promise<Blob>}
 */
export async function chartSvgToPngBlob(svgEl, options = {}) {
  const canvas = await chartSvgToCanvas(svgEl, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Не удалось создать PNG'));
      else resolve(blob);
    }, 'image/png');
  });
}
