import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../services/api.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [backendOnline, setBackendOnline] = useState(null); // null = unknown yet
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      await api.health();
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getHistory(50);
      setHistory(data);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    refreshHistory();
    refreshStats();
  }, [checkHealth, refreshHistory, refreshStats]);

  const addToHistory = useCallback((record) => {
    setHistory((prev) => [record, ...prev].slice(0, 200));
  }, []);

  const value = {
    backendOnline,
    history,
    historyLoading,
    stats,
    refreshHistory,
    refreshStats,
    addToHistory,
    checkHealth,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
}
