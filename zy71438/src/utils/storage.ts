import { Attempt, Player, Level } from '../types';

const STORAGE_KEYS = {
  PLAYER: 'synth_game_player',
  ATTEMPTS: 'synth_game_attempts',
  LEVELS: 'synth_game_levels',
};

export const savePlayer = (player: Player): void => {
  localStorage.setItem(STORAGE_KEYS.PLAYER, JSON.stringify(player));
};

export const getPlayer = (): Player | null => {
  const data = localStorage.getItem(STORAGE_KEYS.PLAYER);
  return data ? JSON.parse(data) : null;
};

export const saveAttempt = (attempt: Attempt): void => {
  const attempts = getAllAttempts();
  
  const existingIndex = attempts.findIndex(
    a => a.playerId === attempt.playerId && 
         a.levelId === attempt.levelId && 
         a.submissionBatch === attempt.submissionBatch
  );
  
  if (existingIndex >= 0) {
    const existing = attempts[existingIndex];
    const updatedFields = findUpdatedFields(existing, attempt);
    attempt.isUpdate = updatedFields.length > 0;
    attempt.updatedFields = updatedFields;
    attempts[existingIndex] = attempt;
  } else {
    attempt.isUpdate = false;
    attempt.updatedFields = [];
    attempts.push(attempt);
  }
  
  localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
};

const findUpdatedFields = (old: Attempt, current: Attempt): string[] => {
  const fields: string[] = [];
  
  if (JSON.stringify(old.oscillators) !== JSON.stringify(current.oscillators)) {
    fields.push('oscillators');
  }
  if (old.score !== current.score) {
    fields.push('score');
  }
  if (old.passed !== current.passed) {
    fields.push('passed');
  }
  
  return fields;
};

export const getAllAttempts = (): Attempt[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
  return data ? JSON.parse(data) : [];
};

export const getAttemptsByPlayer = (playerId: string): Attempt[] => {
  return getAllAttempts().filter(a => a.playerId === playerId);
};

export const getAttemptById = (id: string): Attempt | null => {
  return getAllAttempts().find(a => a.id === id) || null;
};

export const getAttemptsByLevelAndPlayer = (levelId: string, playerId: string): Attempt[] => {
  return getAllAttempts().filter(a => a.levelId === levelId && a.playerId === playerId);
};

export const getBestScore = (levelId: string, playerId: string): number => {
  const attempts = getAttemptsByLevelAndPlayer(levelId, playerId);
  if (attempts.length === 0) return 0;
  return Math.max(...attempts.map(a => a.score));
};

export const generateSubmissionBatch = (): string => {
  const now = new Date();
  return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
};

export const compareSubmissions = (
  oldAttempt: Attempt,
  newAttempt: Attempt
): {
  updatedFields: string[];
  isDuplicate: boolean;
  changes: Record<string, { old: any; new: any }>;
} => {
  const changes: Record<string, { old: any; new: any }> = {};
  
  if (JSON.stringify(oldAttempt.oscillators) !== JSON.stringify(newAttempt.oscillators)) {
    changes['oscillators'] = { old: oldAttempt.oscillators, new: newAttempt.oscillators };
  }
  if (oldAttempt.score !== newAttempt.score) {
    changes['score'] = { old: oldAttempt.score, new: newAttempt.score };
  }
  if (oldAttempt.passed !== newAttempt.passed) {
    changes['passed'] = { old: oldAttempt.passed, new: newAttempt.passed };
  }
  if (oldAttempt.operationLogs.length !== newAttempt.operationLogs.length) {
    changes['operationLogs'] = { 
      old: oldAttempt.operationLogs.length, 
      new: newAttempt.operationLogs.length 
    };
  }
  
  const updatedFields = Object.keys(changes);
  const isDuplicate = updatedFields.length === 0;
  
  return { updatedFields, isDuplicate, changes };
};

export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.PLAYER);
  localStorage.removeItem(STORAGE_KEYS.ATTEMPTS);
};

export const generatePlayerId = (): string => {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
