import { forwardRef, useMemo, useState } from 'react';
import { formatNumber } from '../utils/validators';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const NOTE_PREVIEW_MAX = 100;
const TOOLTIP_MAX_WIDTH = 300;

/**
 * Truncate note for chart tooltip.
 * @param {string|null|undefined} note
 * @returns {string}
 */
function truncateNote(note) {
  if (!note) return '';
  if (note.length <= NOTE_PREVIEW_MAX) return note;
  return `${note.slice(0, NOTE_PREVIEW_MAX)}…`;
}

/**
 * Convert point array to SVG polyline points attribute.
 * @param {Array<{x:number,y:number}>} points
 * @returns {string}
 */
function toPoints(points) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

/**
 * Custom SVG chart for analysis values and optional reference lines.
 * @param {{items: Array}} props
 * @param {import('react').Ref<SVGSVGElement>} ref
 */
const AnalysesChart = forwardRef(function AnalysesChart({ items }, ref) {
  const [tooltip, setTooltip] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const width = 760;
  const height = 360;
  const padding = { top: 24, right: 24, bottom: 48, left: 56 };

  const model = useMemo(() => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => (a.date < b.date ? -1 : 1));
    const values = sorted.map((item) => Number(item.value));
    const refs = sorted
      .flatMap((item) => [item.ref_upper, item.ref_lower])
      .filter((value) => value !== null && value !== undefined)
      .map(Number);
    const all = [...values, ...refs];
    const minY = Math.min(...all);
    const maxY = Math.max(...all);
    const yPad = minY === maxY ? 1 : (maxY - minY) * 0.15;
    const yMin = minY - yPad;
    const yMax = maxY + yPad;
    const minDate = new Date(sorted[0].date).getTime();
    const maxDate = new Date(sorted[sorted.length - 1].date).getTime();
    const span = Math.max(maxDate - minDate, 1);
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const mapX = (iso) => padding.left + ((new Date(iso).getTime() - minDate) / span) * innerW;
    const mapY = (value) => padding.top + ((yMax - value) / (yMax - yMin)) * innerH;

    const valuePoints = sorted.map((item) => ({
      ...item,
      x: mapX(item.date),
      y: mapY(Number(item.value)),
    }));

    const upperPoints = [];
    const lowerPoints = [];
    sorted.forEach((item) => {
      if (item.ref_upper != null && item.ref_lower != null) {
        upperPoints.push({ x: mapX(item.date), y: mapY(Number(item.ref_upper)) });
        lowerPoints.push({ x: mapX(item.date), y: mapY(Number(item.ref_lower)) });
      }
    });

    const hasGaps = sorted.some((item) => item.ref_upper == null || item.ref_lower == null);
    const dash = hasGaps && upperPoints.length > 1 ? '6 4' : undefined;

    const xTicks = Array.from({ length: 7 }, (_, index) => {
      const t = minDate + (span * index) / 6;
      const date = new Date(t);
      return {
        x: padding.left + (innerW * index) / 6,
        label: `${MONTHS[date.getMonth()]}.${String(date.getFullYear()).slice(2)}`,
      };
    });
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = yMax - ((yMax - yMin) * index) / 4;
      return {
        y: padding.top + (innerH * index) / 4,
        label: value.toFixed(2),
      };
    });

    return { valuePoints, upperPoints, lowerPoints, xTicks, yTicks, dash };
  }, [items]);

  if (!model) {
    return <div className="chart-empty">Нет данных для графика</div>;
  }

  return (
    <div className="chart-wrap">
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        className="analyses-chart"
        role="img"
        aria-label="График анализов"
      >
        {model.xTicks.map((tick) => (
          <g key={`x-${tick.x}`}>
            <line x1={tick.x} y1={padding.top} x2={tick.x} y2={height - padding.bottom} className="grid-line" />
            <text x={tick.x} y={height - 16} textAnchor="middle" className="tick-label">{tick.label}</text>
          </g>
        ))}
        {model.yTicks.map((tick) => (
          <g key={`y-${tick.y}`}>
            <line x1={padding.left} y1={tick.y} x2={width - padding.right} y2={tick.y} className="grid-line" />
            <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" className="tick-label">{tick.label}</text>
          </g>
        ))}

        {model.upperPoints.length > 1 ? (
          <polyline
            fill="none"
            stroke="#e67e22"
            strokeWidth="2"
            strokeDasharray={model.dash}
            points={toPoints(model.upperPoints)}
          />
        ) : null}
        {model.lowerPoints.length > 1 ? (
          <polyline
            fill="none"
            stroke="#e67e22"
            strokeWidth="2"
            strokeDasharray={model.dash}
            points={toPoints(model.lowerPoints)}
          />
        ) : null}
        <polyline
          fill="none"
          stroke="#2f9e62"
          strokeWidth="2.5"
          points={toPoints(model.valuePoints)}
        />
        {model.valuePoints.map((point) => {
          const active = hoverId === point.id;
          return (
            <g
              key={point.id}
              className="chart-point"
              onMouseEnter={(event) => {
                const svg = event.currentTarget.ownerSVGElement;
                const svgRect = svg.getBoundingClientRect();
                const scaleX = svgRect.width / width;
                const scaleY = svgRect.height / height;
                const displayX = point.x * scaleX;
                const displayY = point.y * scaleY;
                const maxWidth = Math.min(TOOLTIP_MAX_WIDTH, svgRect.width * 0.85);
                const placeLeft = svgRect.width - displayX < maxWidth;
                setHoverId(point.id);
                setTooltip({
                  top: displayY,
                  placeLeft,
                  // When on the left, anchor via `right` so width is not squeezed to the remaining pixels.
                  left: placeLeft ? undefined : displayX,
                  right: placeLeft ? svgRect.width - displayX : undefined,
                  value: point.value,
                  date: point.date,
                  note: truncateNote(point.note),
                });
              }}
              onMouseLeave={() => {
                setHoverId(null);
                setTooltip(null);
              }}
            >
              {/* Larger invisible hit area */}
              <circle cx={point.x} cy={point.y} r="12" fill="transparent" />
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? 8 : 5}
                fill="#2f9e62"
              />
              {active ? (
                <circle cx={point.x} cy={point.y} r="3" fill="#ffffff" />
              ) : null}
            </g>
          );
        })}
      </svg>
      {tooltip ? (
        <div
          className={`chart-tooltip${tooltip.placeLeft ? ' is-left' : ''}`}
          style={{
            top: tooltip.top,
            left: tooltip.placeLeft ? 'auto' : tooltip.left,
            right: tooltip.placeLeft ? tooltip.right : 'auto',
          }}
        >
          <div>Значение: {formatNumber(tooltip.value)}</div>
          <div>Дата: {tooltip.date}</div>
          {tooltip.note ? <div>Примечание: {tooltip.note}</div> : null}
        </div>
      ) : null}
    </div>
  );
});

export default AnalysesChart;
