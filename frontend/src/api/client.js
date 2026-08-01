/**
 * API helper with credentials and automatic refresh on 401.
 */

const ROOT = import.meta.env.VITE_ROOT_PATH || '/extra/analyses';
const API_BASE = `${ROOT}/api/v1`;

const NO_REFRESH_PATHS = new Set(['/auth/login', '/auth/registration', '/auth/refresh']);

/** @type {Set<() => void>} */
const unauthorizedHandlers = new Set();

/**
 * Register a callback invoked when auth cookies are no longer valid.
 * @param {() => void} handler
 * @returns {() => void} unsubscribe
 */
export function addUnauthorizedHandler(handler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

/**
 * Notify listeners that the session is gone.
 */
function notifyUnauthorized() {
  unauthorizedHandlers.forEach((handler) => handler());
}

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
  if (response.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    const refreshed = await rawRequest('/auth/refresh', { method: 'POST' });
    if (refreshed.ok) {
      response = await rawRequest(path, options);
    }
    if (response.status === 401) {
      notifyUnauthorized();
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
