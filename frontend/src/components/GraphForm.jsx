import { useEffect, useState } from 'react';
import { useAnalyses } from '../context/AnalysesContext';

/**
 * Modal form that redirects to graph page with query params.
 * @param {{onCreate: Function, onCancel: Function}} props
 */
export default function GraphForm({ onCreate, onCancel }) {
  const { names, history } = useAnalyses();
  const [name, setName] = useState('');
  const [begin, setBegin] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!name) return;
    if (begin && end) return;
    const dates = history.filter((item) => item.name === name).map((item) => item.date).sort();
    if (!dates.length) return;
    setBegin((prev) => prev || dates[0]);
    setEnd((prev) => prev || dates[dates.length - 1]);
  }, [name, history, begin, end]);

  /**
   * Validate and submit graph creation.
   * @param {SubmitEvent} event
   */
  function handleSubmit(event) {
    event.preventDefault();
    if (!name || !names.includes(name)) {
      setError('Выберите название из списка');
      return;
    }
    const start = begin <= end ? begin : end;
    const finish = begin <= end ? end : begin;
    onCreate({ name, begin: start, end: finish });
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Название анализа
        <select value={name} onChange={(e) => setName(e.target.value)}>
          <option value="">-----</option>
          {names.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <div className="refs-block">
        <span className="refs-label">Период</span>
        <div className="refs-row">
          <input type="date" value={begin} onChange={(e) => setBegin(e.target.value)} />
          <span className="dash">—</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Отмена</button>
        <button type="submit" className="btn primary">Создать</button>
      </div>
    </form>
  );
}
