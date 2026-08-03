import { useEffect, useMemo, useState } from 'react';
import { ANALYSIS_NAME_RE, ORG_RE, formatNumber, parseNumber } from '../utils/validators';
import { useAnalyses } from '../context/AnalysesContext';

/**
 * Map an analysis row to editable form fields.
 * @param {object} row
 */
function rowToForm(row) {
  return {
    name: row.name || '',
    date: row.date || '',
    value: row.value != null && row.value !== '' ? formatNumber(row.value) : '',
    ref_lower: row.ref_lower != null ? formatNumber(row.ref_lower) : '',
    ref_upper: row.ref_upper != null ? formatNumber(row.ref_upper) : '',
    organization: row.organization || '',
    note: row.note || '',
  };
}

/**
 * Form for creating or editing an analysis inside a modal.
 * @param {{initial?: object|null, onSuccess: Function, onCancel: Function, submitLabel?: string}} props
 */
export default function AnalysesForm({ initial = null, onSuccess, onCancel, submitLabel }) {
  const { history, names } = useAnalyses();
  const isEdit = Boolean(initial);
  const defaults = useMemo(() => {
    if (isEdit) return rowToForm(initial);
    const org = sessionStorage.getItem('last_org') || '';
    const date = sessionStorage.getItem('last_date') || '';
    return {
      name: '',
      date,
      value: '',
      ref_lower: '',
      ref_upper: '',
      organization: org,
      note: '',
    };
  }, [initial, isEdit]);

  const [form, setForm] = useState(defaults);
  const [errors, setErrors] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [highlight, setHighlight] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const value = form.name.trim().toLowerCase();
    if (!value) {
      setSuggestions([]);
      return;
    }
    const exact = names.find((name) => name.toLowerCase() === value);
    if (exact) {
      setSuggestions([]);
      return;
    }
    setSuggestions(names.filter((name) => name.toLowerCase().startsWith(value)).slice(0, 8));
  }, [form.name, names]);

  /**
   * Update one form field.
   * @param {string} key
   * @param {string} value
   */
  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  /**
   * Autofill organization/refs from last same-named analysis (create mode only).
   */
  function handleNameBlur() {
    setSuggestions([]);
    if (isEdit) return;
    const match = [...history].reverse().find((item) => item.name === form.name.trim());
    if (!match) return;
    const next = {
      organization: sessionStorage.getItem('last_org') || match.organization || '',
      ref_lower: match.ref_lower != null ? formatNumber(match.ref_lower) : '',
      ref_upper: match.ref_upper != null ? formatNumber(match.ref_upper) : '',
    };
    setForm((prev) => ({ ...prev, ...next }));
    setHighlight({ organization: true, ref_lower: true, ref_upper: true });
  }

  /**
   * Validate local form state.
   * @returns {boolean}
   */
  function validate() {
    const next = {};
    if (!ANALYSIS_NAME_RE.test(form.name.trim())) next.name = 'Некорректное название';
    if (!form.date) next.date = 'Укажите дату';
    if (form.value === '' || Number.isNaN(parseNumber(form.value))) next.value = 'Укажите число';
    const hasUpper = form.ref_upper !== '';
    const hasLower = form.ref_lower !== '';
    if (hasUpper !== hasLower) {
      next.ref_upper = 'Заполните оба референса или ни одного';
      next.ref_lower = 'Заполните оба референса или ни одного';
    } else if (hasUpper) {
      const upper = parseNumber(form.ref_upper);
      const lower = parseNumber(form.ref_lower);
      if (Number.isNaN(upper) || Number.isNaN(lower)) {
        next.ref_upper = 'Укажите число';
        next.ref_lower = 'Укажите число';
      } else if (upper <= lower) {
        next.ref_upper = 'Верхнее должно быть больше нижнего';
      }
    }
    if (form.organization && !ORG_RE.test(form.organization)) {
      next.organization = 'Некорректная организация';
    }
    if (form.note && form.note.length > 1500) next.note = 'Максимум 1500 символов';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /**
   * Submit create or update payload to the parent handler.
   * @param {SubmitEvent} event
   */
  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSuccess({
        name: form.name.trim(),
        date: form.date,
        value: parseNumber(form.value),
        ref_upper: form.ref_upper === '' ? null : parseNumber(form.ref_upper),
        ref_lower: form.ref_lower === '' ? null : parseNumber(form.ref_lower),
        organization: form.organization || null,
        note: form.note || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const buttonLabel = submitLabel || (isEdit ? 'Сохранить' : 'Добавить');

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Название
        <div className="suggest-wrap">
          <input
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            onBlur={handleNameBlur}
            onFocus={() => setHighlight((prev) => ({ ...prev, name: false }))}
          />
          {suggestions.length > 0 ? (
            <ul className="suggestions">
              {suggestions.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      updateField('name', item);
                      setSuggestions([]);
                    }}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {errors.name ? <span className="field-error">{errors.name}</span> : null}
      </label>

      <label>
        Дата
        <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
        {errors.date ? <span className="field-error">{errors.date}</span> : null}
      </label>

      <label>
        Значение
        <input value={form.value} onChange={(e) => updateField('value', e.target.value)} />
        {errors.value ? <span className="field-error">{errors.value}</span> : null}
      </label>

      <div className="refs-block">
        <span className="refs-label">Нижнее и верхнее референсные значения</span>
        <div className="refs-row">
          <input
            className={highlight.ref_lower ? 'autofilled' : ''}
            value={form.ref_lower}
            onChange={(e) => updateField('ref_lower', e.target.value)}
            onFocus={() => setHighlight((prev) => ({ ...prev, ref_lower: false }))}
            placeholder="Нижнее"
          />
          <input
            className={highlight.ref_upper ? 'autofilled' : ''}
            value={form.ref_upper}
            onChange={(e) => updateField('ref_upper', e.target.value)}
            onFocus={() => setHighlight((prev) => ({ ...prev, ref_upper: false }))}
            placeholder="Верхнее"
          />
        </div>
        {errors.ref_lower || errors.ref_upper ? (
          <span className="field-error">{errors.ref_lower || errors.ref_upper}</span>
        ) : null}
      </div>

      <label>
        Организация
        <input
          className={highlight.organization ? 'autofilled' : ''}
          value={form.organization}
          onChange={(e) => updateField('organization', e.target.value)}
          onFocus={() => setHighlight((prev) => ({ ...prev, organization: false }))}
        />
        {errors.organization ? <span className="field-error">{errors.organization}</span> : null}
      </label>

      <label>
        Примечание
        <textarea value={form.note} onChange={(e) => updateField('note', e.target.value)} rows={3} />
        {errors.note ? <span className="field-error">{errors.note}</span> : null}
      </label>

      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Отмена</button>
        <button type="submit" className="btn primary" disabled={submitting}>
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}
