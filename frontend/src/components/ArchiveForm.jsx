import { useState } from 'react';

/**
 * Modal form to upload a file into the archive.
 * @param {{maxBytes: number, onSuccess: Function, onCancel: Function}} props
 */
export default function ArchiveForm({ maxBytes, uploadMaxBytes, onSuccess, onCancel }) {
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const acceptLimit = uploadMaxBytes || maxBytes;

  /**
   * Client-side validation.
   * @returns {boolean}
   */
  function validate() {
    const next = {};
    if (note.length > 200) next.note = 'Максимум 200 символов';
    if (!file) next.file = 'Выберите файл';
    else if (file.size > acceptLimit) {
      const mb = (acceptLimit / (1024 * 1024)).toFixed(0);
      next.file = `Файл больше ${mb} МБ`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /**
   * Submit multipart form to parent.
   * @param {SubmitEvent} event
   */
  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSuccess({ note: note.trim(), file });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Примечание
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setErrors((prev) => ({ ...prev, note: '' }));
          }}
          rows={3}
          maxLength={200}
        />
        {errors.note ? <span className="field-error">{errors.note}</span> : null}
      </label>

      <label className="file-field">
        Файл
        <input
          type="file"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setErrors((prev) => ({ ...prev, file: '' }));
          }}
        />
        {file ? <span className="file-name">{file.name}</span> : null}
        {errors.file ? <span className="field-error">{errors.file}</span> : null}
      </label>

      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Отмена</button>
        <button type="submit" className="btn primary" disabled={submitting}>
          Сохранить
        </button>
      </div>
    </form>
  );
}
