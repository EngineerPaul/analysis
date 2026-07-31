import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [params] = useSearchParams();
  const { history, names, ensureLoaded, loaded } = useAnalyses();
  const [name, setName] = useState(params.get('name') || '');
  const [begin, setBegin] = useState(params.get('begin') || '');
  const [end, setEnd] = useState(params.get('end') || '');
  const [chartItems, setChartItems] = useState([]);
  const [built, setBuilt] = useState(Boolean(params.get('name')));

  useEffect(() => {
    (async () => {
      const data = await ensureLoaded();
      if (data === null) navigate('/login');
    })();
  }, [ensureLoaded, navigate]);

  useEffect(() => {
    const paramName = params.get('name') || '';
    if (!paramName) return;
    setName(paramName);
    setBegin(params.get('begin') || '');
    setEnd(params.get('end') || '');
    setBuilt(true);
  }, [params]);

  useEffect(() => {
    if (!built || !loaded) return;
    setChartItems(filterRows(history, name, begin, end));
  }, [built, loaded, history, name, begin, end]);

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
   * Validate filters and rebuild chart dataset.
   */
  function handleBuild() {
    if (!name) return;
    if (begin && end && begin > end) return;
    setBuilt(true);
    setChartItems(filterRows(history, name, begin, end));
  }

  return (
    <div className="page">
      <div className="content">
        <Link className="back-link" to="/">← На Главную</Link>
        <h2 className="section-title">Создание графика:</h2>
        <div className="filters graph-filters">
          <ScrollableSelect options={names} value={name} onChange={setName} />
          <input type="date" value={begin} onChange={(e) => setBegin(e.target.value)} />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button type="button" className="btn primary" onClick={handleBuild}>Построить</button>
        </div>

        <div className="chart-zone">
          {built && chartItems.length ? <AnalysesChart items={chartItems} /> : (
            <div className="chart-empty">Выберите анализ и нажмите «Построить»</div>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={chartItems}
          onDelete={(row) => setChartItems((prev) => prev.filter((item) => item.id !== row.id))}
        />
      </div>
    </div>
  );
}
