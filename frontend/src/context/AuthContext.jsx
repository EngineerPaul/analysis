import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addUnauthorizedHandler, apiRequest, readJson } from '../api/client';

const AuthContext = createContext(null);

const STORAGE_KEY = 'analyses_user';

/**
 * Read cached user from localStorage.
 * @returns {{id: number, login: string, name: string, surname: string}|null}
 */
function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      !data
      || typeof data.id !== 'number'
      || typeof data.login !== 'string'
      || typeof data.name !== 'string'
      || typeof data.surname !== 'string'
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Persist user profile to localStorage.
 * @param {{id: number, login: string, name: string, surname: string}|null} user
 */
function writeStoredUser(user) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

/**
 * Provide authenticated user profile across the app.
 * @param {{children: import('react').ReactNode}} props
 */
export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => readStoredUser());
  const [ready, setReady] = useState(false);

  /**
   * Set current user and sync localStorage.
   * @param {{id: number, login: string, name: string, surname: string}|null} next
   */
  const setUser = useCallback((next) => {
    setUserState(next);
    writeStoredUser(next);
  }, []);

  /**
   * Clear profile (logout / expired session).
   */
  const clearUser = useCallback(() => {
    setUserState(null);
    writeStoredUser(null);
  }, []);

  useEffect(() => {
    return addUnauthorizedHandler(clearUser);
  }, [clearUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await apiRequest('/auth/me');
      if (cancelled) return;
      if (response.ok) {
        const data = await readJson(response);
        if (data) setUser(data);
      } else {
        clearUser();
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [setUser, clearUser]);

  const value = useMemo(
    () => ({
      user,
      ready,
      setUser,
      clearUser,
    }),
    [user, ready, setUser, clearUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access auth store.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
