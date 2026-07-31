import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { apiRequest, readJson } from '../api/client';
import { sortAnalyses, uniqueNames } from '../utils/validators';

const AnalysesContext = createContext(null);

/**
 * Provide shared analysis history across pages.
 * @param {{children: import('react').ReactNode}} props
 */
export function AnalysesProvider({ children }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Load full analysis list from backend if not cached.
   * @param {boolean} [force]
   */
  const ensureLoaded = useCallback(async (force = false) => {
    if (history !== null && !force) return history;
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest('/analyses');
      if (response.status === 401) {
        setHistory(null);
        setError('unauthorized');
        return null;
      }
      if (!response.ok) {
        setError('Не удалось загрузить анализы');
        return null;
      }
      const data = await readJson(response);
      const sorted = sortAnalyses(data || []);
      setHistory(sorted);
      return sorted;
    } finally {
      setLoading(false);
    }
  }, [history]);

  /**
   * Append analysis after successful create.
   * @param {object} item
   */
  const addLocal = useCallback((item) => {
    setHistory((prev) => sortAnalyses([...(prev || []), item]));
  }, []);

  /**
   * Remove analysis locally after successful delete.
   * @param {number} id
   */
  const removeLocal = useCallback((id) => {
    setHistory((prev) => (prev || []).filter((item) => item.id !== id));
  }, []);

  const names = useMemo(() => uniqueNames(history || []), [history]);

  const value = useMemo(
    () => ({
      history: history || [],
      loaded: history !== null,
      loading,
      error,
      names,
      ensureLoaded,
      addLocal,
      removeLocal,
      setHistory,
    }),
    [history, loading, error, names, ensureLoaded, addLocal, removeLocal],
  );

  return <AnalysesContext.Provider value={value}>{children}</AnalysesContext.Provider>;
}

/**
 * Access analyses store.
 */
export function useAnalyses() {
  const ctx = useContext(AnalysesContext);
  if (!ctx) {
    throw new Error('useAnalyses must be used inside AnalysesProvider');
  }
  return ctx;
}
