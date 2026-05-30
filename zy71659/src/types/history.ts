export type EntityType = 'anomaly' | 'sample' | 'segment' | 'report' | 'batch';
export type HistoryAction = 
  | 'created' 
  | 'updated' 
  | 'confirmed' 
  | 'dismissed' 
  | 'corrected' 
  | 'exported'
  | 'imported'
  | 'deleted';

export interface HistoryRecord {
  id?: string;
  entityType: EntityType;
  entityId: string;
  action: HistoryAction;
  operator: string;
  timestamp: number;
  beforeState: unknown;
  afterState: unknown;
  comment?: string;
}

export const HISTORY_ACTION_LABELS: Record<HistoryAction, string> = {
  created: '创建',
  updated: '更新',
  confirmed: '确认',
  dismissed: '忽略',
  corrected: '修正',
  exported: '导出',
  imported: '导入',
  deleted: '删除',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  anomaly: '异常事件',
  sample: '采样数据',
  segment: '工况段',
  report: '分析报告',
  batch: '导入批次',
};
