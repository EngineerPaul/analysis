import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AnalysesChart from '../components/AnalysesChart';
import DataTable from '../components/DataTable';
import ScrollableSelect from '../components/ScrollableSelect';
import { useAnalyses } from '../context/AnalysesContext';
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
  const { history, names, ensureLoaded, loaded, graphFilter, setGraphFilter } = useAnalyses();
  const { name, begin, end } = graphFilter;
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

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

  return (
    <div className="page">
      <div className="content">
        <Link className="back-link" to="/">← На Главную</Link>
        <h2 className="section-title">Создание графика</h2>
        <div className="filters graph-filters">
          <ScrollableSelect
            options={names}
            value={name}
            onChange={(next) => setGraphFilter({ name: next })}
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
            <AnalysesChart items={chartItems} />
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
      </div>
    </div>
  );
}
