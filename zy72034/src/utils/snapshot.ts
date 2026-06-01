import type {
  Game,
  Round,
  FarmState,
  Transaction,
  PauseRecord,
  SupplementRecord,
  GameSnapshot,
} from '../types';
import { saveSnapshot as saveToStorage, loadSnapshot as loadFromStorage } from './storage';

export function createSnapshot(
  game: Game,
  currentRoundState: Round | null,
  farmStates: FarmState[],
  transactions: Transaction[],
  pauseRecords: PauseRecord[],
  supplementRecords: SupplementRecord[]
): GameSnapshot {
  return {
    game: { ...game },
    currentRoundState: currentRoundState ? { ...currentRoundState } : null,
    farmStates: farmStates.map((fs) => ({ ...fs })),
    transactions: transactions.map((tx) => ({ ...tx })),
    pauseRecords: pauseRecords.map((pr) => ({ ...pr })),
    supplementRecords: supplementRecords.map((sr) => ({ ...sr })),
    timestamp: new Date().toISOString(),
  };
}

export function saveGameSnapshot(snapshot: GameSnapshot): void {
  try {
    saveToStorage(snapshot);
  } catch (error) {
    console.error('保存快照失败:', error);
    throw error;
  }
}

export function loadGameSnapshot(roundNumber: number): GameSnapshot | null {
  try {
    return loadFromStorage(roundNumber);
  } catch (error) {
    console.error('加载快照失败:', error);
    return null;
  }
}

export function rollbackToSnapshot(snapshot: GameSnapshot): {
  game: Game;
  currentRoundState: Round | null;
  farmStates: FarmState[];
  transactions: Transaction[];
  pauseRecords: PauseRecord[];
  supplementRecords: SupplementRecord[];
} {
  return {
    game: { ...snapshot.game },
    currentRoundState: snapshot.currentRoundState ? { ...snapshot.currentRoundState } : null,
    farmStates: snapshot.farmStates.map((fs) => ({ ...fs })),
    transactions: snapshot.transactions.map((tx) => ({ ...tx })),
    pauseRecords: snapshot.pauseRecords.map((pr) => ({ ...pr })),
    supplementRecords: snapshot.supplementRecords.map((sr) => ({ ...sr })),
  };
}

export function getLatestFarmState(
  farmStates: FarmState[],
  farmId: string,
  roundNumber: number
): FarmState | undefined {
  return farmStates
    .filter((fs) => fs.farmId === farmId && fs.roundNumber <= roundNumber)
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];
}

export function getRoundFarmStates(
  farmStates: FarmState[],
  roundNumber: number
): FarmState[] {
  return farmStates.filter((fs) => fs.roundNumber === roundNumber);
}

export function getRoundTransactions(
  transactions: Transaction[],
  roundNumber: number
): Transaction[] {
  return transactions.filter((tx) => tx.roundNumber === roundNumber);
}
