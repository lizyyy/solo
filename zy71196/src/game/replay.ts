import type { GameState, GameAction, GameRecord } from './types';
import { LEVELS } from './config';

export const saveGameRecord = (state: GameState): GameRecord => {
  const level = LEVELS.find((l) => l.id === state.levelId);
  
  const record: GameRecord = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    levelId: state.levelId,
    levelName: level?.name || '未知关卡',
    score: state.score,
    scoreBreakdown: { ...state.scoreBreakdown },
    totalRounds: state.totalRounds,
    completedRounds: state.currentRound - 1,
    failed: state.failed,
    failureReason: state.failureReason,
    leakCount: state.leakPoints.length,
    timestamp: Date.now(),
    actions: [...state.actions],
  };

  const records = loadGameRecords();
  records.push(record);
  localStorage.setItem('roof-inspection-records', JSON.stringify(records));

  return record;
};

export const loadGameRecords = (): GameRecord[] => {
  try {
    const data = localStorage.getItem('roof-inspection-records');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load game records:', e);
  }
  return [];
};

export const getGameRecord = (id: string): GameRecord | undefined => {
  const records = loadGameRecords();
  return records.find((r) => r.id === id);
};

export const deleteGameRecord = (id: string): void => {
  const records = loadGameRecords();
  const filtered = records.filter((r) => r.id !== id);
  localStorage.setItem('roof-inspection-records', JSON.stringify(filtered));
};

export const clearGameRecords = (): void => {
  localStorage.removeItem('roof-inspection-records');
};

export const getBestScore = (levelId: number): number | null => {
  const records = loadGameRecords();
  const levelRecords = records.filter((r) => r.levelId === levelId && !r.failed);
  if (levelRecords.length === 0) return null;
  return Math.max(...levelRecords.map((r) => r.score));
};

export const getReplayActions = (record: GameRecord): GameAction[] => {
  return record.actions;
};

export const getActionAtTime = (
  actions: GameAction[],
  time: number
): GameAction | null => {
  const sorted = [...actions].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].timestamp <= time) {
      return sorted[i];
    }
  }
  return null;
};

export const getRoundActions = (actions: GameAction[], round: number): GameAction[] => {
  return actions.filter((a) => a.round === round);
};

export const getKeyMoments = (actions: GameAction[]): Array<{
  label: string;
  action: GameAction;
}> => {
  const moments: Array<{ label: string; action: GameAction }> = [];

  actions.forEach((action) => {
    if (action.type === 'game_start') {
      moments.push({ label: '游戏开始', action });
    } else if (action.type === 'round_end') {
      moments.push({ label: `第 ${action.round} 回合结束`, action });
    } else if (action.type === 'rainfall_change') {
      moments.push({ label: `雨量变化: ${action.payload.rainfallIntensity}%`, action });
    } else if (action.type === 'tool_use' && action.payload.success) {
      moments.push({
        label: `使用 ${action.payload.tool} 工具`,
        action,
      });
    }
  });

  return moments;
};

export const formatReplayTime = (timestamp: number, startTime: number): string => {
  const diff = Math.floor((timestamp - startTime) / 1000);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const getReplayDuration = (actions: GameAction[]): number => {
  if (actions.length === 0) return 0;
  const sorted = [...actions].sort((a, b) => a.timestamp - b.timestamp);
  return sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
};
