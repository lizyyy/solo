import fs from 'fs';
import path from 'path';
import type { HistoryEntry, ChangeRecord, CleanTrack } from './models.js';

const HISTORY_DIR = '.dj-clean-history';

function ensureHistoryDir(basePath: string): string {
  const dir = path.join(basePath, HISTORY_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function loadHistory(basePath: string): HistoryEntry[] {
  const dir = ensureHistoryDir(basePath);
  const historyFile = path.join(dir, 'history.json');
  if (!fs.existsSync(historyFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveHistory(basePath: string, entries: HistoryEntry[]): void {
  const dir = ensureHistoryDir(basePath);
  const historyFile = path.join(dir, 'history.json');
  fs.writeFileSync(historyFile, JSON.stringify(entries, null, 2), 'utf-8');
}

export function recordHistory(
  basePath: string,
  sessionId: string,
  inputFiles: string[],
  stats: { totalInput: number; successfullyParsed: number; parseErrors: number; bpmFixed: number; bpmHalfSpeed: number; bpmDoubleSpeed: number; keysNormalized: number; keysFailed: number; energyParsed: number; energyFailed: number; duplicatesFound: number; duplicatesMerged: number; manualConfirmed: number; autoChanges: number; manualChanges: number; fieldsFilledFromMerge: number },
  changes: ChangeRecord[],
): void {
  const entries = loadHistory(basePath);

  const entry: HistoryEntry = {
    sessionId,
    timestamp: new Date().toISOString(),
    inputFiles,
    summary: stats,
    changes,
  };

  entries.push(entry);
  saveHistory(basePath, entries);
}

export function checkManualConfirmations(
  basePath: string,
  trackId: string,
  field: string,
): ChangeRecord | null {
  const entries = loadHistory(basePath);

  for (let i = entries.length - 1; i >= 0; i--) {
    for (const change of entries[i].changes) {
      if (
        change.trackId === trackId &&
        change.field === field &&
        change.source === 'manual' &&
        !change.superseded
      ) {
        return change;
      }
    }
  }
  return null;
}

export function protectManualOverrides(
  basePath: string,
  proposedChanges: ChangeRecord[],
): { protected: ChangeRecord[]; overridden: ChangeRecord[] } {
  const protectedChanges: ChangeRecord[] = [];
  const overridden: ChangeRecord[] = [];

  for (const change of proposedChanges) {
    if (change.source === 'manual') {
      protectedChanges.push(change);
      continue;
    }

    const existing = checkManualConfirmations(basePath, change.trackId, change.field);
    if (existing && existing.newValue !== change.newValue) {
      const blocked: ChangeRecord = {
        ...change,
        superseded: true,
        reason: `${change.reason} [被阻止: 已有人工确认记录 "${existing.newValue}" by ${existing.reason}]`,
      };
      overridden.push(blocked);
    } else {
      protectedChanges.push(change);
    }
  }

  return { protected: protectedChanges, overridden };
}

export function applyManualConfirmation(
  basePath: string,
  trackId: string,
  trackTitle: string,
  trackArtist: string,
  field: string,
  value: string,
  reason: string,
): ChangeRecord {
  const entries = loadHistory(basePath);

  for (const entry of entries) {
    for (const change of entry.changes) {
      if (
        change.trackId === trackId &&
        change.field === field &&
        change.source === 'manual' &&
        !change.superseded
      ) {
        change.superseded = true;
      }
    }
  }
  saveHistory(basePath, entries);

  const record: ChangeRecord = {
    trackId,
    trackTitle,
    trackArtist,
    changeType: 'manual_confirm',
    field,
    oldValue: '(手动覆盖)',
    newValue: value,
    reason,
    timestamp: new Date().toISOString(),
    source: 'manual',
    superseded: false,
  };

  return record;
}

export function getHistory(basePath: string): HistoryEntry[] {
  return loadHistory(basePath);
}

export function getChangeLogForTrack(basePath: string, trackId: string): ChangeRecord[] {
  const entries = loadHistory(basePath);
  const records: ChangeRecord[] = [];

  for (const entry of entries) {
    for (const change of entry.changes) {
      if (change.trackId === trackId) {
        records.push(change);
      }
    }
  }

  return records.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
