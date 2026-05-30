import { CompletedLevel, CorrectionRecord } from '../types';

const COMPLETED_LEVELS_KEY = 'note-factory-completed-levels';
const CORRECTION_HISTORY_KEY = 'note-factory-correction-history';

export function getCompletedLevels(): CompletedLevel[] {
  try {
    const data = localStorage.getItem(COMPLETED_LEVELS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCompletedLevel(level: CompletedLevel): void {
  try {
    const levels = getCompletedLevels();
    const existingIndex = levels.findIndex(l => l.levelId === level.levelId);
    if (existingIndex >= 0) {
      if (level.score > levels[existingIndex].score) {
        levels[existingIndex] = level;
      }
    } else {
      levels.push(level);
    }
    localStorage.setItem(COMPLETED_LEVELS_KEY, JSON.stringify(levels));
  } catch {
    console.error('Failed to save completed level');
  }
}

export function getCorrectionHistory(): CorrectionRecord[] {
  try {
    const data = localStorage.getItem(CORRECTION_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCorrectionRecord(record: CorrectionRecord): void {
  try {
    const records = getCorrectionHistory();
    records.push(record);
    localStorage.setItem(CORRECTION_HISTORY_KEY, JSON.stringify(records));
  } catch {
    console.error('Failed to save correction record');
  }
}

export function getCorrectionByLevelId(levelId: string): CorrectionRecord[] {
  return getCorrectionHistory().filter(r => r.levelId === levelId);
}
