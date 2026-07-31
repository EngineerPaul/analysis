import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest, readJson } from '../api/client';
import { LOGIN_RE, validatePassword } from '../utils/validators';

/**
 * Login page.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  /**
   * Update a form field.
   * @param {string} key
   * @param {string} value
   */
  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  /**
   * Submit login form.
   * @param {SubmitEvent} event
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');
    const next = {};
    if (!LOGIN_RE.test(form.login)) next.login = 'Некорректный логин';
    const passwordError = validatePassword(form.password);
    if (passwordError) next.password = passwordError;
    setErrors(next);
    if (Object.keys(next).length) return;

    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (response.status === 200) {
      navigate('/');
      return;
    }
    const data = await readJson(response);
    if (response.status === 401) setServerError('Неверный логин или пароль');
    else setServerError(data?.detail ? JSON.stringify(data.detail) : 'Ошибка входа');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="back-link" to="/registration">← На страницу Регистрации</Link>
        <h1>Вход</h1>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Логин
            <input value={form.login} onChange={(e) => update('login', e.target.value)} />
            {errors.login ? <span className="field-error">{errors.login}</span> : null}
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
            {errors.password ? <span className="field-error">{errors.password}</span> : null}
          </label>
          {serverError ? <div className="server-error">{serverError}</div> : null}
          <button type="submit" className="btn primary center">Войти</button>
        </form>
      </div>
    </div>
  );
}
