import type { ActionItem, PlaybackRecord, GameState } from '../types';

export const createPlaybackRecord = (caseId: string): PlaybackRecord => {
  return {
    caseId,
    actionTimeline: [],
    startTime: Date.now(),
    endTime: 0
  };
};

export const recordAction = (
  record: PlaybackRecord,
  actionType: string,
  payload: any,
  stateSnapshot: Partial<GameState>
): PlaybackRecord => {
  const actionItem: ActionItem = {
    timestamp: Date.now(),
    actionType,
    payload,
    snapshot: { ...stateSnapshot }
  };

  return {
    ...record,
    actionTimeline: [...record.actionTimeline, actionItem]
  };
};

export const finishPlaybackRecord = (record: PlaybackRecord): PlaybackRecord => {
  return {
    ...record,
    endTime: Date.now()
  };
};

export const getPlaybackDuration = (record: PlaybackRecord): number => {
  if (record.endTime === 0) return 0;
  return record.endTime - record.startTime;
};

export const getActionAtTime = (
  record: PlaybackRecord,
  targetTime: number
): ActionItem | null => {
  const relativeTime = record.startTime + targetTime;
  
  for (let i = record.actionTimeline.length - 1; i >= 0; i--) {
    if (record.actionTimeline[i].timestamp <= relativeTime) {
      return record.actionTimeline[i];
    }
  }
  
  return record.actionTimeline[0] || null;
};

export const getActionAtStep = (
  record: PlaybackRecord,
  step: number
): ActionItem | null => {
  if (step < 0 || step >= record.actionTimeline.length) return null;
  return record.actionTimeline[step];
};

export const seekToStep = (
  record: PlaybackRecord,
  step: number
): { state: Partial<GameState> | null; action: ActionItem | null } => {
  const action = getActionAtStep(record, step);
  if (!action) return { state: null, action: null };
  
  const accumulatedState: Partial<GameState> = {};
  
  for (let i = 0; i <= step; i++) {
    const snapshot = record.actionTimeline[i].snapshot;
    Object.assign(accumulatedState, snapshot);
  }
  
  return { state: accumulatedState, action };
};

export const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getActionTypeLabel = (actionType: string): string => {
  const labels: Record<string, string> = {
    'VIEW_ACCIDENT': '查看事故卡',
    'VIEW_CLAUSE': '查看保单条款',
    'VIEW_PHOTO': '查看照片证据',
    'ADD_MARK': '添加证据标记',
    'REMOVE_MARK': '移除证据标记',
    'MATCH_CLAUSE': '匹配条款',
    'UPDATE_RISK_SCORE': '更新风险评分',
    'SET_CONCLUSION': '设置结论',
    'TRIGGER_MATERIAL_UPDATE': '收到材料更新',
    'ACCEPT_MATERIAL_UPDATE': '接受材料更新',
    'SUBMIT_JUDGMENT': '提交判断'
  };
  return labels[actionType] || actionType;
};

export const savePlaybackToStorage = (record: PlaybackRecord): void => {
  try {
    const key = `playback_${record.caseId}`;
    localStorage.setItem(key, JSON.stringify(record));
  } catch (e) {
    console.error('Failed to save playback record:', e);
  }
};

export const loadPlaybackFromStorage = (caseId: string): PlaybackRecord | null => {
  try {
    const key = `playback_${caseId}`;
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data) as PlaybackRecord;
    }
    return null;
  } catch (e) {
    console.error('Failed to load playback record:', e);
    return null;
  }
};
