export const STORAGE_KEYS = {
  LEVELS: 'vinyl_be_levels',
  ROUNDS: 'vinyl_be_rounds',
  OPERATIONS: 'vinyl_be_operations',
  NOTES: 'vinyl_be_notes',
  CONFLICTS: 'vinyl_be_conflicts',
  CURRENT_STATE: 'vinyl_be_current_state',
  BACKUP_PREFIX: 'vinyl_be_backup_',
  SETTINGS: 'vinyl_be_settings',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export interface AppSettings {
  operatorName: string;
  autoBackup: boolean;
  backupIntervalMinutes: number;
  showJudgementTrace: boolean;
  defaultLevelId?: string;
}

export interface BackupInfo {
  timestamp: string;
  version: string;
  dataCount: {
    levels: number;
    rounds: number;
    operations: number;
    conflicts: number;
  };
}
