import type { ActionType, EntityType, HistoryRecord } from '@/types';

const generateId = (): string => {
  return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createHistoryRecord = (
  entityType: EntityType,
  entityId: string,
  action: ActionType,
  afterData: Record<string, unknown>,
  beforeData?: Record<string, unknown>,
  notes?: string,
  operator: string = '本地用户'
): HistoryRecord => {
  return {
    id: generateId(),
    entityType,
    entityId,
    action,
    beforeData: beforeData ? JSON.parse(JSON.stringify(beforeData)) : undefined,
    afterData: JSON.parse(JSON.stringify(afterData)),
    operator,
    timestamp: new Date().toISOString(),
    notes,
  };
};

export const formatHistoryAction = (record: HistoryRecord): string => {
  const typeLabels: Record<EntityType, string> = {
    samplePack: '采样包',
    track: '曲目',
    credential: '凭证',
  };
  
  const actionLabels: Record<ActionType, string> = {
    create: '创建了',
    update: '更新了',
    delete: '删除了',
    link: '关联了',
    unlink: '取消关联了',
  };
  
  return `${actionLabels[record.action]}${typeLabels[record.entityType]}`;
};

export const getHistoryForEntity = (
  history: HistoryRecord[],
  entityType: EntityType,
  entityId: string
): HistoryRecord[] => {
  return history
    .filter((h) => h.entityType === entityType && h.entityId === entityId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};
