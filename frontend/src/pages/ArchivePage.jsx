import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ArchiveForm from '../components/ArchiveForm';
import Modal from '../components/Modal';
import { apiRequest, readJson } from '../api/client';
import { downloadBlob } from '../utils/download';
import { formatDate } from '../utils/validators';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Format ISO datetime for archive table.
 * @param {string} value
 * @returns {string}
 */
function formatCreatedAt(value) {
  if (!value) return '—';
  const date = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return formatDate(date);
  return value;
}

/**
 * Archive page: upload, list, download and delete files.
 */
export default function ArchivePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [maxBytes, setMaxBytes] = useState(DEFAULT_MAX_BYTES);
  const [uploadMaxBytes, setUploadMaxBytes] = useState(DEFAULT_MAX_BYTES * 10);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await apiRequest('/archive');
    if (response.status === 401) {
      navigate('/login');
      return;
    }
    if (!response.ok) {
      setError('Не удалось загрузить архив');
      setLoading(false);
      return;
    }
    const data = await readJson(response);
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const limits = await apiRequest('/archive/limits');
      if (limits.ok) {
        const data = await readJson(limits);
        if (data?.max_bytes) setMaxBytes(data.max_bytes);
        if (data?.upload_max_bytes) setUploadMaxBytes(data.upload_max_bytes);
      }
      await loadList();
    })();
  }, [loadList]);

  /**
   * Upload file via multipart API.
   * @param {{note: string, file: File}} payload
   */
  async function handleUpload({ note, file }) {
    const body = new FormData();
    body.append('note', note);
    body.append('file', file);
    const response = await apiRequest('/archive', { method: 'POST', body });
    if (response.status === 413) {
      setError('Файл слишком большой');
      return;
    }
    if (!response.ok) {
      const data = await readJson(response);
      setError(data?.detail ? String(data.detail) : 'Не удалось сохранить файл');
      return;
    }
    setModalOpen(false);
    setError('');
    await loadList();
  }

  /**
   * Download archive file to device.
   * @param {object} row
   */
  async function handleDownload(row) {
    const response = await apiRequest(`/archive/${row.id}/download`);
    if (!response.ok) {
      setError('Не удалось скачать файл');
      return;
    }
    const blob = await response.blob();
    downloadBlob(blob, row.original_name || `file-${row.id}`);
  }

  /**
   * Delete archive file.
   * @param {object} row
   */
  async function handleDelete(row) {
    const response = await apiRequest(`/archive/${row.id}`, { method: 'DELETE' });
    if (response.status === 204) {
      setItems((prev) => prev.filter((item) => item.id !== row.id));
      return;
    }
    setError('Не удалось удалить файл');
  }

  return (
    <div className="page">
      <div className="content">
        <Link className="back-link" to="/">← На Главную</Link>
        <div className="archive-toolbar">
          <h2 className="section-title">Архив</h2>
          <button type="button" className="btn primary" onClick={() => setModalOpen(true)}>
            Добавить
          </button>
        </div>

        {loading ? <p>Загрузка...</p> : null}
        {error ? <p className="server-error">{error}</p> : null}

        <div className="table-wrap">
          <table className="data-table archive-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Дата создания</th>
                <th className="cell-note">Примечание</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{formatCreatedAt(row.created_at)}</td>
                  <td className="cell-note">{row.note || '—'}</td>
                  <td className="actions-cell">
                    <div className="actions-inner">
                      <button
                        type="button"
                        className="icon-download"
                        title="Скачать"
                        aria-label="Скачать"
                        onClick={() => handleDownload(row)}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                          <path
                            d="M12 4v10m0 0l-4-4m4 4l4-4M5 18h14"
                            fill="none"
                            stroke="#2f9e62"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="icon-delete"
                        title="Удалить"
                        aria-label="Удалить"
                        onClick={() => handleDelete(row)}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path className="delete-x" d="M7 7l10 10M17 7L7 17" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="archive-empty">Файлов пока нет</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <Modal title="Сохранение файла" onClose={() => setModalOpen(false)}>
          <ArchiveForm
            maxBytes={maxBytes}
            uploadMaxBytes={uploadMaxBytes}
            onCancel={() => setModalOpen(false)}
            onSuccess={handleUpload}
          />
        </Modal>
      ) : null}
    </div>
  );
}
