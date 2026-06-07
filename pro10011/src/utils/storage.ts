import type { ValuationRecord, JudgmentHistory } from '../types';

const STORAGE_KEY = 'otc_warning_records';
const JUDGMENTS_KEY = 'otc_warning_judgments';

export const saveRecords = (records: ValuationRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save records to localStorage:', e);
  }
};

export const loadRecords = (): ValuationRecord[] | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load records from localStorage:', e);
    return null;
  }
};

export const saveJudgment = (judgment: JudgmentHistory): void => {
  try {
    const judgments = loadAllJudgments();
    judgments.push(judgment);
    localStorage.setItem(JUDGMENTS_KEY, JSON.stringify(judgments));
  } catch (e) {
    console.error('Failed to save judgment to localStorage:', e);
  }
};

export const loadAllJudgments = (): JudgmentHistory[] => {
  try {
    const data = localStorage.getItem(JUDGMENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load judgments from localStorage:', e);
    return [];
  }
};

export const loadJudgmentsByRecordId = (recordId: string): JudgmentHistory[] => {
  return loadAllJudgments().filter(j => j.recordId === recordId);
};

export const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(JUDGMENTS_KEY);
};
