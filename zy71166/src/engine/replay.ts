import type { GameState, ReplayRecord, TurnSnapshot } from './types';
import { getFinalEvaluation } from './rules';

const STORAGE_KEY = 'dc-cooling-replays';
const MAX_REPLAYS = 20;

export function saveReplay(gameState: GameState): ReplayRecord {
  const finalSnapshot = gameState.snapshotHistory[gameState.snapshotHistory.length - 1];
  const completedTurns = gameState.turnState.turn - 1 + (gameState.gamePhase === 'won' ? 1 : 0);

  const evaluation = getFinalEvaluation(
    gameState.turnState.score,
    gameState.totalTurns,
    completedTurns,
    finalSnapshot.racks,
    finalSnapshot.turnState.totalCost,
    finalSnapshot.turnState.budget,
  );

  const record: ReplayRecord = {
    gameId: gameState.gameId,
    levelId: gameState.levelId,
    levelName: gameState.levelName,
    finalScore: gameState.turnState.score,
    gamePhase: gameState.gamePhase,
    failReason: gameState.failReason,
    totalTurns: gameState.totalTurns,
    completedTurns,
    totalCost: gameState.turnState.totalCost,
    snapshots: gameState.snapshotHistory,
    operationLog: gameState.operationLog,
    eventLog: gameState.eventLog,
    createdAt: gameState.createdAt,
  };

  const replays = loadReplays();
  replays.unshift(record);

  if (replays.length > MAX_REPLAYS) {
    replays.length = MAX_REPLAYS;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(replays));
  } catch (e) {
    console.error('Failed to save replay:', e);
  }

  return record;
}

export function loadReplays(): ReplayRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load replays:', e);
    return [];
  }
}

export function getReplayById(gameId: string): ReplayRecord | undefined {
  const replays = loadReplays();
  return replays.find((r) => r.gameId === gameId);
}

export function deleteReplay(gameId: string): void {
  const replays = loadReplays();
  const filtered = replays.filter((r) => r.gameId !== gameId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearAllReplays(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function interpolateSnapshots(
  from: TurnSnapshot,
  to: TurnSnapshot,
  progress: number,
): TurnSnapshot {
  const p = Math.max(0, Math.min(1, progress));

  return {
    turn: from.turn,
    racks: from.racks.map((rack, i) => {
      const toRack = to.racks[i];
      return {
        ...rack,
        load: rack.load + (toRack.load - rack.load) * p,
        temperature: rack.temperature + (toRack.temperature - rack.temperature) * p,
      };
    }),
    acUnits: from.acUnits.map((ac, i) => {
      const toAC = to.acUnits[i];
      return {
        ...ac,
        powerDraw: ac.powerDraw + (toAC.powerDraw - ac.powerDraw) * p,
      };
    }),
    turnState: {
      ...from.turnState,
      score: Math.round(from.turnState.score + (to.turnState.score - from.turnState.score) * p),
      totalCost: from.turnState.totalCost + (to.turnState.totalCost - from.turnState.totalCost) * p,
    },
  };
}

export function getReplayEventsAtTurn(
  replay: ReplayRecord,
  turn: number,
) {
  return {
    operations: replay.operationLog.filter((op) => op.turn === turn),
    events: replay.eventLog.filter((evt) => evt.turn === turn),
  };
}
