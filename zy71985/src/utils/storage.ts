import type { InventoryRecord, OperationLog, PermissionChange } from '@/types';
import { mockRecords, mockOperationLogs, mockPermissionChanges } from './mockData';

const STORAGE_KEYS = {
  RECORDS: 'inventory_records',
  LOGS: 'operation_logs',
  PERMISSIONS: 'permission_changes',
  INITIALIZED: 'data_initialized',
};

export function initializeData(): void {
  const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (initialized === 'true') return;

  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(mockRecords));
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(mockOperationLogs));
  localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(mockPermissionChanges));
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}

export function loadRecords(): InventoryRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
  return data ? JSON.parse(data) : [];
}

export function saveRecords(records: InventoryRecord[]): void {
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
}

export function loadOperationLogs(): OperationLog[] {
  const data = localStorage.getItem(STORAGE_KEYS.LOGS);
  return data ? JSON.parse(data) : [];
}

export function saveOperationLogs(logs: OperationLog[]): void {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
}

export function loadPermissionChanges(): PermissionChange[] {
  const data = localStorage.getItem(STORAGE_KEYS.PERMISSIONS);
  return data ? JSON.parse(data) : [];
}

export function savePermissionChanges(changes: PermissionChange[]): void {
  localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(changes));
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.RECORDS);
  localStorage.removeItem(STORAGE_KEYS.LOGS);
  localStorage.removeItem(STORAGE_KEYS.PERMISSIONS);
  localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
}

export function exportBackup(): string {
  const backup = {
    records: loadRecords(),
    operationLogs: loadOperationLogs(),
    permissionChanges: loadPermissionChanges(),
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
  };
  return JSON.stringify(backup, null, 2);
}

export function importBackup(jsonStr: string): boolean {
  try {
    const backup = JSON.parse(jsonStr);
    if (!backup.records || !backup.operationLogs || !backup.permissionChanges) {
      return false;
    }
    saveRecords(backup.records);
    saveOperationLogs(backup.operationLogs);
    savePermissionChanges(backup.permissionChanges);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    return true;
  } catch {
    return false;
  }
}
