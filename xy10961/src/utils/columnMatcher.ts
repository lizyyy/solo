import { defaultConfig } from '../config/default';

export function findColumn(headers: string[], columnTypes: string[]): string | null {
  for (const columnType of columnTypes) {
    const found = headers.find(h => 
      h.toLowerCase().includes(columnType.toLowerCase()) ||
      columnType.toLowerCase().includes(h.toLowerCase())
    );
    if (found) return found;
  }
  return null;
}

export function findColumnByConfig(headers: string[], configKey: keyof typeof defaultConfig.列名映射): string | null {
  const columnTypes = defaultConfig.列名映射[configKey];
  return findColumn(headers, columnTypes);
}

export function getColumnValue(row: any, headers: string[], configKey: keyof typeof defaultConfig.列名映射): string {
  const columnName = findColumnByConfig(headers, configKey);
  if (!columnName) return '';
  const value = row[columnName];
  return value !== undefined && value !== null ? String(value).trim() : '';
}
