import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnalysesForm from '../components/AnalysesForm';
import DataTable from '../components/DataTable';
import GraphForm from '../components/GraphForm';
import Modal from '../components/Modal';
import { useAnalyses } from '../context/AnalysesContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest, readJson } from '../api/client';
import { formatDate, formatNumber } from '../utils/validators';

/**
 * Main page with toolbar and analyses table.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();
  const {
    history,
    ensureLoaded,
    addLocal,
    removeLocal,
    updateLocal,
    loading,
    error,
    setHistory,
    setGraphFilter,
    clearGraphFilter,
  } = useAnalyses();
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filterName, setFilterName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [applied, setApplied] = useState({ name: '', from: '', to: '' });

  useEffect(() => {
    if (!user) return;
    console.log({
      id: user.id,
      login: user.login,
      name: user.name,
      surname: user.surname,
    });
  }, [user]);

  useEffect(() => {
    (async () => {
      const data = await ensureLoaded();
      if (data === null) navigate('/login');
    })();
  }, [ensureLoaded, navigate]);

  const names = useMemo(
    () => [...new Set(history.map((item) => item.name))].sort((a, b) => a.localeCompare(b, 'ru')),
    [history],
  );

  const visible = useMemo(() => {
    let rows = history;
    if (applied.name) rows = rows.filter((item) => item.name === applied.name);
    if (applied.from || applied.to) {
      const start = applied.from && applied.to
        ? (applied.from < applied.to ? applied.from : applied.to)
        : applied.from || applied.to;
      const end = applied.from && applied.to
        ? (applied.from < applied.to ? applied.to : applied.from)
        : applied.from || applied.to;
      rows = rows.filter((item) => item.date >= start && item.date <= end);
    }
    return rows;
  }, [history, applied]);

  /**
   * Close any analysis modal and drop unsaved edits.
   */
  function closeAnalysesModal() {
    setModal(null);
    setEditing(null);
  }

  /**
   * Create analysis via API and update local store.
   * @param {object} payload
   */
  async function handleCreate(payload) {
    const response = await apiRequest('/analyses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (response.status !== 201) return;
    const item = await readJson(response);
    addLocal(item);
    sessionStorage.setItem('last_org', payload.organization || '');
    sessionStorage.setItem('last_date', payload.date || '');
    closeAnalysesModal();
  }

  /**
   * Update analysis via API and re-sort local history.
   * @param {object} payload
   */
  async function handleUpdate(payload) {
    if (!editing) return;
    const response = await apiRequest(`/analyses/${editing.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!response.ok) return;
    const item = await readJson(response);
    updateLocal(item);
    closeAnalysesModal();
  }

  /**
   * Delete analysis via API.
   * @param {object} row
   */
  async function handleDelete(row) {
    const response = await apiRequest(`/analyses/${row.id}`, { method: 'DELETE' });
    if (response.status === 204) removeLocal(row.id);
  }

  /**
   * Open edit modal with row data.
   * @param {object} row
   */
  function handleEdit(row) {
    setEditing(row);
    setModal('edit');
  }

  /**
   * Logout current user.
   */
  async function handleLogout() {
    await apiRequest('/auth/logout', { method: 'POST' });
    clearUser();
    setHistory(null);
    clearGraphFilter();
    navigate('/login');
  }

  const columns = [
    { key: 'name', title: 'Название' },
    { key: 'date', title: 'Дата', render: (row) => formatDate(row.date) },
    { key: 'value', title: 'Значение', render: (row) => formatNumber(row.value) },
    {
      key: 'refs',
      title: 'Референс',
      render: (row) => (
        row.ref_lower != null
          ? `${formatNumber(row.ref_lower)} — ${formatNumber(row.ref_upper)}`
          : '—'
      ),
    },
    { key: 'organization', title: 'Организация', render: (row) => row.organization || '—' },
    { key: 'note', title: 'Примечание', render: (row) => row.note || '—' },
  ];

  return (
    <div className="page">
      <div className="content">
        <div className="toolbar">
          <div className="toolbar-left">
            <button type="button" className="btn primary" onClick={() => setModal('analyses')}>
              <span className="btn-text">Добавить анализ</span>
              <img className="btn-icon" src={`${import.meta.env.BASE_URL}icons/add.svg`} alt="" />
            </button>
            <button type="button" className="btn primary" onClick={() => setModal('graph')}>
              <span className="btn-text">Создать график</span>
              <img className="btn-icon" src={`${import.meta.env.BASE_URL}icons/chart.svg`} alt="" />
            </button>
          </div>
          <button type="button" className="btn danger" onClick={handleLogout}>
            <span className="btn-text">Выйти</span>
            <img className="btn-icon" src={`${import.meta.env.BASE_URL}icons/logout.svg`} alt="" />
          </button>
        </div>

        <div className="filters">
          <span>Выбрать анализ и даты</span>
          <select value={filterName} onChange={(e) => setFilterName(e.target.value)}>
            <option value="">-----</option>
            {names.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="filters-dates">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="dash">—</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => setApplied({ name: filterName, from: dateFrom, to: dateTo })}
          >
            Выбрать
          </button>
        </div>

        {loading ? <p>Загрузка...</p> : null}
        {error && error !== 'unauthorized' ? <p className="server-error">{error}</p> : null}
        <DataTable
          columns={columns}
          rows={visible}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      </div>

      {modal === 'analyses' ? (
        <Modal title="Добавление анализа" onClose={closeAnalysesModal}>
          <AnalysesForm onSuccess={handleCreate} onCancel={closeAnalysesModal} />
        </Modal>
      ) : null}
      {modal === 'edit' && editing ? (
        <Modal title="Редактирование анализа" onClose={closeAnalysesModal}>
          <AnalysesForm
            key={editing.id}
            initial={editing}
            onSuccess={handleUpdate}
            onCancel={closeAnalysesModal}
          />
        </Modal>
      ) : null}
      {modal === 'graph' ? (
        <Modal title="Создание графика" onClose={() => setModal(null)}>
          <GraphForm
            onCancel={() => setModal(null)}
            onCreate={({ name, begin, end }) => {
              setGraphFilter({ name, begin, end });
              setModal(null);
              navigate('/graph');
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
