import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addUnauthorizedHandler, apiRequest, readJson } from '../api/client';
import { sortAnalyses, uniqueNames } from '../utils/validators';

const AnalysesContext = createContext(null);

const EMPTY_GRAPH_FILTER = { name: '', begin: '', end: '' };

/**
 * Provide shared analysis history across pages.
 * @param {{children: import('react').ReactNode}} props
 */
export function AnalysesProvider({ children }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphFilter, setGraphFilterState] = useState(EMPTY_GRAPH_FILTER);

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

  /**
   * Replace an analysis after successful update and re-sort (order may change).
   * @param {object} item
   */
  const updateLocal = useCallback((item) => {
    setHistory((prev) => {
      const next = (prev || []).map((row) => (row.id === item.id ? item : row));
      return sortAnalyses(next);
    });
  }, []);

  /**
   * Update graph page filters (name / period). Survives SPA navigation, not full reload.
   * @param {Partial<{name: string, begin: string, end: string}>|Function} next
   */
  const setGraphFilter = useCallback((next) => {
    setGraphFilterState((prev) => {
      const patch = typeof next === 'function' ? next(prev) : next;
      return { ...prev, ...patch };
    });
  }, []);

  /**
   * Reset graph filters (e.g. on logout).
   */
  const clearGraphFilter = useCallback(() => {
    setGraphFilterState(EMPTY_GRAPH_FILTER);
  }, []);

  useEffect(() => {
    return addUnauthorizedHandler(() => {
      setHistory(null);
      setGraphFilterState(EMPTY_GRAPH_FILTER);
    });
  }, []);

  const names = useMemo(() => uniqueNames(history || []), [history]);

  const value = useMemo(
    () => ({
      history: history || [],
      loaded: history !== null,
      loading,
      error,
      names,
      graphFilter,
      setGraphFilter,
      clearGraphFilter,
      ensureLoaded,
      addLocal,
      removeLocal,
      updateLocal,
      setHistory,
    }),
    [
      history,
      loading,
      error,
      names,
      graphFilter,
      setGraphFilter,
      clearGraphFilter,
      ensureLoaded,
      addLocal,
      removeLocal,
      updateLocal,
    ],
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
