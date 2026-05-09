import type { Certificate, HistoryRecord } from './types';

const CERTIFICATES_KEY = 'certificate_tool_certificates';
const HISTORY_KEY = 'certificate_tool_history';

export function loadCertificates(): Certificate[] {
  const data = localStorage.getItem(CERTIFICATES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveCertificates(certificates: Certificate[]): void {
  localStorage.setItem(CERTIFICATES_KEY, JSON.stringify(certificates));
}

export function loadHistory(): HistoryRecord[] {
  const data = localStorage.getItem(HISTORY_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveHistory(history: HistoryRecord[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function addHistoryRecord(record: Omit<HistoryRecord, 'id' | 'timestamp'>): void {
  const history = loadHistory();
  const newRecord: HistoryRecord = {
    ...record,
    id: generateId(),
    timestamp: new Date().toISOString()
  };
  history.unshift(newRecord);
  saveHistory(history);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
