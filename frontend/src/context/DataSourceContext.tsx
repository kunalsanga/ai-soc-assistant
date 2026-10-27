import React, { createContext, useContext, useState, useEffect } from 'react';
import { dataSourceService } from '../services/api';
import type { DataSourceId, DataSourcesSummary } from '../services/api';

interface DataSourceContextType {
  activeSource: DataSourceId;
  setActiveSource: (source: DataSourceId) => void;
  summary: DataSourcesSummary | null;
  refreshSummary: () => Promise<void>;
  loading: boolean;
}

const DataSourceContext = createContext<DataSourceContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'soc_active_data_source';

export const DataSourceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSource, setActiveSourceState] = useState<DataSourceId>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY) as DataSourceId;
    return saved && ['demo', 'live_wazuh', 'dataset_replay'].includes(saved) ? saved : 'demo';
  });

  const [summary, setSummary] = useState<DataSourcesSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshSummary = async () => {
    setLoading(true);
    try {
      const data = await dataSourceService.getSources(activeSource);
      setSummary(data);
    } catch {
      // Keep existing summary if backend is temporarily unreachable
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSummary();
  }, [activeSource]);

  const setActiveSource = (source: DataSourceId) => {
    setActiveSourceState(source);
    localStorage.setItem(LOCAL_STORAGE_KEY, source);
  };

  return (
    <DataSourceContext.Provider
      value={{
        activeSource,
        setActiveSource,
        summary,
        refreshSummary,
        loading,
      }}
    >
      {children}
    </DataSourceContext.Provider>
  );
};

const defaultContextValue: DataSourceContextType = {
  activeSource: 'demo',
  setActiveSource: () => {},
  summary: null,
  refreshSummary: async () => {},
  loading: false,
};

export const useDataSource = (): DataSourceContextType => {
  const context = useContext(DataSourceContext);
  return context || defaultContextValue;
};
