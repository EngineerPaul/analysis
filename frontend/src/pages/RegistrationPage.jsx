import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest, readJson } from '../api/client';
import { CYRILLIC_RE, NAME_RE, validateLogin, validatePassword } from '../utils/validators';

/**
 * Registration page.
 */
export default function RegistrationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    login: '',
    password: '',
    password2: '',
    name: '',
    surname: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  /**
   * Update a single form field; show Cyrillic error immediately for login/password.
   * @param {string} key
   * @param {string} value
   */
  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if ((key === 'login' || key === 'password' || key === 'password2') && CYRILLIC_RE.test(value)) {
      const message = key === 'login'
        ? 'Логин не должен содержать кириллицу'
        : 'Пароль не должен содержать кириллицу';
      setErrors((prev) => ({ ...prev, [key]: message }));
      return;
    }
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  /**
   * Client-side validation.
   * @returns {boolean}
   */
  function validate() {
    const next = {};
    const loginError = validateLogin(form.login);
    if (loginError) next.login = loginError;
    const passwordError = validatePassword(form.password);
    if (passwordError) next.password = passwordError;
    if (CYRILLIC_RE.test(form.password2)) {
      next.password2 = 'Пароль не должен содержать кириллицу';
    } else if (form.password !== form.password2) {
      next.password2 = 'Пароли не совпадают';
    }
    if (!NAME_RE.test(form.name)) next.name = 'Имя: только буквы, 2-30';
    if (!NAME_RE.test(form.surname)) next.surname = 'Фамилия: только буквы, 2-30';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /**
   * Submit registration.
   * @param {SubmitEvent} event
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');
    if (!validate()) return;
    const response = await apiRequest('/auth/registration', {
      method: 'POST',
      body: JSON.stringify({
        login: form.login,
        password: form.password,
        name: form.name,
        surname: form.surname,
      }),
    });
    if (response.status === 201) {
      navigate('/');
      return;
    }
    const data = await readJson(response);
    if (response.status === 409) setServerError('Логин уже занят');
    else setServerError(data?.detail ? JSON.stringify(data.detail) : 'Ошибка регистрации');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="back-link" to="/login">← На страницу Входа</Link>
        <h1>Регистрация</h1>
        <form className="stack-form" onSubmit={handleSubmit}>
          {[
            ['login', 'Логин'],
            ['password', 'Пароль', 'password'],
            ['password2', 'Подтверждение пароля', 'password'],
            ['name', 'Имя'],
            ['surname', 'Фамилия'],
          ].map(([key, label, type = 'text']) => (
            <label key={key}>
              {label}
              <input
                type={type}
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
              />
              {errors[key] ? <span className="field-error">{errors[key]}</span> : null}
            </label>
          ))}
          {serverError ? <div className="server-error">{serverError}</div> : null}
          <button type="submit" className="btn primary center">Зарегистрироваться</button>
        </form>
      </div>
    </div>
  );
}
