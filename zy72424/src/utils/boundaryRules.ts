import { BoundaryRules } from '../types';

export const DEFAULT_BOUNDARY_RULES: BoundaryRules = {
  remarkPreserve: {
    preserveLineBreaks: true,
    preserveWhitespace: true,
    noTruncation: true,
  },
  reworkDetection: {
    keywords: ['返工', '重录', '补录', '修正', '重新'],
    caseSensitive: false,
    useRegex: false,
  },
  duplicateImport: {
    hashAlgorithm: 'sha256',
    updateTimeOnDuplicate: true,
    preventDuplicateStats: true,
  },
  historyTracking: {
    trackAllFields: true,
    keepFullHistory: true,
    enableRollback: true,
  },
};

export function getRemarkPreserveRules() {
  return DEFAULT_BOUNDARY_RULES.remarkPreserve;
}

export function getReworkDetectionRules() {
  return DEFAULT_BOUNDARY_RULES.reworkDetection;
}

export function getDuplicateImportRules() {
  return DEFAULT_BOUNDARY_RULES.duplicateImport;
}

export function getHistoryTrackingRules() {
  return DEFAULT_BOUNDARY_RULES.historyTracking;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
