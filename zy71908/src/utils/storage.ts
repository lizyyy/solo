import type { ArchiveRecord, FilterState, ExportSummary } from '../types';

const STORAGE_KEYS = {
  RECORDS: 'archive_records',
  EXPORT_HISTORY: 'export_history',
  FILTER_STATE: 'filter_state',
} as const;

export function getStoredRecords(): ArchiveRecord[] | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    return parsed.map((r: any) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      sources: r.sources.map((s: any) => ({
        ...s,
        recordedAt: new Date(s.recordedAt),
      })),
      versions: r.versions.map((v: any) => ({
        ...v,
        changedAt: new Date(v.changedAt),
      })),
    }));
  } catch (e) {
    console.error('Failed to read records from storage:', e);
    return null;
  }
}

export function setStoredRecords(records: ArchiveRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save records to storage:', e);
  }
}

export function getStoredFilterState(): FilterState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FILTER_STATE);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to read filter state from storage:', e);
    return null;
  }
}

export function setStoredFilterState(state: FilterState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FILTER_STATE, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save filter state to storage:', e);
  }
}

export function getExportHistory(): ExportSummary[] | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXPORT_HISTORY);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    return parsed.map((e: any) => ({
      ...e,
      exportedAt: new Date(e.exportedAt),
    }));
  } catch (e) {
    console.error('Failed to read export history from storage:', e);
    return null;
  }
}

export function addExportSummary(summary: ExportSummary): void {
  try {
    const history = getExportHistory() || [];
    history.unshift(summary);
    if (history.length > 50) {
      history.splice(50);
    }
    localStorage.setItem(STORAGE_KEYS.EXPORT_HISTORY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save export summary:', e);
  }
}

export function clearAllStorage(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
