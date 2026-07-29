/**
 * API helper with credentials and automatic refresh on 401.
 */

const ROOT = import.meta.env.VITE_ROOT_PATH || '/extra/analysis';
const API_BASE = `${ROOT}/api/v1`;

/**
 * Low-level fetch wrapper that always sends cookies.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function rawRequest(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
}

/**
 * Perform an API request and retry once after refresh on 401.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function apiRequest(path, options = {}) {
  let response = await rawRequest(path, options);
  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/registration' && path !== '/auth/refresh') {
    const refreshed = await rawRequest('/auth/refresh', { method: 'POST' });
    if (refreshed.ok) {
      response = await rawRequest(path, options);
    }
  }
  return response;
}

/**
 * Parse JSON body safely.
 * @param {Response} response
 * @returns {Promise<any>}
 */
export async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
