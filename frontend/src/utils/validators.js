/**
 * Client-side validation helpers matching backend rules.
 */

export const LOGIN_RE = /^[a-zA-Z0-9]{6,20}$/;
export const NAME_RE = /^[a-zA-Zа-яА-ЯёЁ]{2,30}$/;
export const ANALYSIS_NAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9 ]{1,60}$/;
export const ORG_RE = /^[a-zA-Zа-яА-ЯёЁ0-9 "']{0,30}$/;
export const CYRILLIC_RE = /[а-яА-ЯёЁ]/;

/**
 * Validate login: no Cyrillic, Latin/digits only, length 6-20.
 * @param {string} login
 * @returns {string|null}
 */
export function validateLogin(login) {
  if (CYRILLIC_RE.test(login)) {
    return 'Логин не должен содержать кириллицу';
  }
  if (!LOGIN_RE.test(login)) {
    return 'Логин: 6-20 символов, только латиница и цифры';
  }
  return null;
}

/**
 * Validate password according to TZ rules (no Cyrillic).
 * @param {string} password
 * @returns {string|null}
 */
export function validatePassword(password) {
  if (CYRILLIC_RE.test(password || '')) {
    return 'Пароль не должен содержать кириллицу';
  }
  if (!password || password.length < 6 || password.length > 20) {
    return 'Пароль должен быть от 6 до 20 символов';
  }
  if (/[\t\n\r\0]/.test(password)) {
    return 'Пароль содержит запрещённые символы';
  }
  return null;
}

/**
 * Sort analyses by date then name then id.
 * @param {Array} items
 * @returns {Array}
 */
export function sortAnalyses(items) {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.name !== b.name) return a.name.localeCompare(b.name, 'ru');
    return a.id - b.id;
  });
}

/**
 * Unique analysis names sorted alphabetically.
 * @param {Array} items
 * @returns {string[]}
 */
export function uniqueNames(items) {
  return [...new Set(items.map((item) => item.name))].sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Format ISO date YYYY-MM-DD to display.
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Format a numeric value for display (2 decimal places).
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toFixed(2);
}
