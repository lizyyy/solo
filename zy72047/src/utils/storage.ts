import { STORAGE_KEYS, type StorageKey, type BackupInfo } from '@/types/storage';

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export const formatTimestamp = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const storage = {
  get: <T>(key: StorageKey, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[Storage] Failed to read ${key}:`, error);
      return defaultValue;
    }
  },

  set: <T>(key: StorageKey, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`[Storage] Failed to write ${key}:`, error);
    }
  },

  remove: (key: StorageKey): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[Storage] Failed to remove ${key}:`, error);
    }
  },

  clear: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        if (key !== STORAGE_KEYS.SETTINGS) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[Storage] Failed to clear:', error);
    }
  },
};

export const createBackup = (): BackupInfo => {
  const timestamp = getCurrentTimestamp();
  const backupKey = `${STORAGE_KEYS.BACKUP_PREFIX}${timestamp}` as StorageKey;

  const backupData = {
    levels: storage.get(STORAGE_KEYS.LEVELS, []),
    rounds: storage.get(STORAGE_KEYS.ROUNDS, []),
    operations: storage.get(STORAGE_KEYS.OPERATIONS, []),
    conflicts: storage.get(STORAGE_KEYS.CONFLICTS, []),
    notes: storage.get(STORAGE_KEYS.NOTES, []),
  };

  localStorage.setItem(backupKey, JSON.stringify(backupData));

  return {
    timestamp,
    version: '1.0.0',
    dataCount: {
      levels: backupData.levels.length,
      rounds: backupData.rounds.length,
      operations: backupData.operations.length,
      conflicts: backupData.conflicts.length,
    },
  };
};

export const listBackups = (): string[] => {
  const backups: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEYS.BACKUP_PREFIX)) {
      backups.push(key);
    }
  }
  return backups.sort().reverse();
};

export const restoreBackup = (backupKey: string): boolean => {
  try {
    const data = localStorage.getItem(backupKey);
    if (!data) return false;

    const backupData = JSON.parse(data);
    storage.set(STORAGE_KEYS.LEVELS, backupData.levels || []);
    storage.set(STORAGE_KEYS.ROUNDS, backupData.rounds || []);
    storage.set(STORAGE_KEYS.OPERATIONS, backupData.operations || []);
    storage.set(STORAGE_KEYS.CONFLICTS, backupData.conflicts || []);
    storage.set(STORAGE_KEYS.NOTES, backupData.notes || []);

    return true;
  } catch (error) {
    console.error('[Storage] Failed to restore backup:', error);
    return false;
  }
};

export const getOperatorName = (): string => {
  const settings = storage.get(STORAGE_KEYS.SETTINGS, { operatorName: '小林' });
  return settings.operatorName;
};
