import type { ProcessedData, FittingResult, PreprocessConfig } from '../types';

const STORAGE_KEY = 'fatigue_fitting_data';
const HISTORY_KEY = 'fatigue_fitting_history';

interface StoredData {
  processedData: ProcessedData[];
  fittingResult: FittingResult | null;
  preprocessConfig: PreprocessConfig;
  savedAt: string;
}

interface HistoryRecord {
  id: string;
  batchName: string;
  material: string;
  dataCount: number;
  model: string;
  r2: number;
  savedAt: string;
  operator: string;
  remark: string;
}

export const saveToStorage = (
  processedData: ProcessedData[],
  fittingResult: FittingResult | null,
  preprocessConfig: PreprocessConfig
): void => {
  const data: StoredData = {
    processedData,
    fittingResult,
    preprocessConfig,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadFromStorage = (): StoredData | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

export const saveToHistory = (
  batchName: string,
  material: string,
  dataCount: number,
  model: string,
  r2: number,
  operator: string,
  remark: string,
  processedData: ProcessedData[],
  fittingResult: FittingResult | null,
  preprocessConfig: PreprocessConfig
): string => {
  const id = `HIST-${Date.now()}`;
  const record: HistoryRecord = {
    id,
    batchName,
    material,
    dataCount,
    model,
    r2,
    savedAt: new Date().toISOString(),
    operator,
    remark,
  };

  const history = loadHistory();
  history.unshift(record);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  
  const fullData: StoredData & { id: string } = {
    id,
    processedData,
    fittingResult,
    preprocessConfig,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(`${HISTORY_KEY}_${id}`, JSON.stringify(fullData));

  return id;
};

export const loadHistory = (): HistoryRecord[] => {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
};

export const loadHistoryDetail = (id: string): StoredData | null => {
  const stored = localStorage.getItem(`${HISTORY_KEY}_${id}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

export const deleteHistoryRecord = (id: string): void => {
  const history = loadHistory();
  const filtered = history.filter(r => r.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  localStorage.removeItem(`${HISTORY_KEY}_${id}`);
};

export const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const clearAllHistory = (): void => {
  const history = loadHistory();
  history.forEach(r => localStorage.removeItem(`${HISTORY_KEY}_${r.id}`));
  localStorage.removeItem(HISTORY_KEY);
};
