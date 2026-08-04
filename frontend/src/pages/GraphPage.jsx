import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AnalysesChart from '../components/AnalysesChart';
import DataTable from '../components/DataTable';
import ScrollableSelect from '../components/ScrollableSelect';
import { useAnalyses } from '../context/AnalysesContext';
import { useAuth } from '../context/AuthContext';
import { downloadChartPng, downloadGraphPdf } from '../utils/exportFiles';
import { formatDate, formatNumber } from '../utils/validators';

/**
 * Build filtered rows for the selected analysis and period.
 * @param {Array} history
 * @param {string} name
 * @param {string} begin
 * @param {string} end
 * @returns {Array}
 */
function filterRows(history, name, begin, end) {
  if (!name) return [];
  let rows = history.filter((item) => item.name === name);
  const dates = rows.map((item) => item.date).sort();
  const start = begin || dates[0];
  const finish = end || dates[dates.length - 1];
  if (start && finish) {
    const min = start <= finish ? start : finish;
    const max = start <= finish ? finish : start;
    rows = rows.filter((item) => item.date >= min && item.date <= max);
  }
  return rows;
}

/**
 * Graph page built from local analysis history.
 */
export default function GraphPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { history, names, ensureLoaded, loaded, graphFilter, setGraphFilter } = useAnalyses();
  const { name, begin, end } = graphFilter;
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    (async () => {
      const data = await ensureLoaded();
      if (data === null) navigate('/login');
    })();
  }, [ensureLoaded, navigate]);

  useEffect(() => {
    setHiddenIds(new Set());
  }, [name, begin, end]);

  const chartItems = useMemo(() => {
    if (!loaded || !name) return [];
    return filterRows(history, name, begin, end).filter((item) => !hiddenIds.has(item.id));
  }, [loaded, history, name, begin, end, hiddenIds]);

  const columns = useMemo(() => [
    { key: 'value', title: 'Значение', render: (row) => formatNumber(row.value) },
    {
      key: 'refs',
      title: 'Референсные значения',
      render: (row) => (
        row.ref_lower != null
          ? `${formatNumber(row.ref_lower)} — ${formatNumber(row.ref_upper)}`
          : '—'
      ),
    },
    { key: 'date', title: 'Дата', render: (row) => formatDate(row.date) },
    { key: 'note', title: 'Примечание', render: (row) => row.note || '—' },
  ], []);

  /**
   * Download graph PDF report.
   */
  async function handlePdf() {
    if (!chartRef.current || !chartItems.length) return;
    setExporting(true);
    try {
      await downloadGraphPdf({
        user,
        analysisName: name,
        begin,
        end,
        rows: chartItems,
        svgEl: chartRef.current,
      });
    } catch (err) {
      console.error(err);
      window.alert(err?.message || 'Не удалось скачать PDF');
    } finally {
      setExporting(false);
    }
  }

  /**
   * Download chart PNG with analysis title.
   */
  async function handlePng() {
    if (!chartRef.current || !chartItems.length) return;
    setExporting(true);
    try {
      await downloadChartPng({
        svgEl: chartRef.current,
        analysisName: name,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page">
      <div className="content">
        <Link className="back-link" to="/">← На Главную</Link>
        <h2 className="section-title">Создание графика</h2>
        <div className="filters graph-filters">
          <ScrollableSelect
            options={names}
            value={name}
            onChange={(next) => {
              if (!next) {
                setGraphFilter({ name: '', begin: '', end: '' });
                return;
              }
              setGraphFilter({ name: next });
            }}
          />
          <input
            type="date"
            value={begin}
            onChange={(e) => setGraphFilter({ begin: e.target.value })}
          />
          <input
            type="date"
            value={end}
            onChange={(e) => setGraphFilter({ end: e.target.value })}
          />
        </div>

        <div className="chart-zone">
          {chartItems.length ? (
            <AnalysesChart ref={chartRef} items={chartItems} />
          ) : (
            <div className="chart-empty">
              {name ? 'Нет данных за выбранный период' : 'Выберите анализ'}
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={chartItems}
          onDelete={(row) => {
            setHiddenIds((prev) => new Set(prev).add(row.id));
          }}
        />

        <div className="export-bar">
          <button
            type="button"
            className="btn primary"
            disabled={!chartItems.length || exporting}
            onClick={handlePdf}
          >
            Скачать PDF
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!chartItems.length || exporting}
            onClick={handlePng}
          >
            Скачать график
          </button>
        </div>
      </div>
    </div>
  );
}
