export type PointStatus = 'pending' | 'confirmed' | 'exception' | 'merged';

export type SourceType = 'street' | 'photo' | 'approval';

export type ActionType = 'import' | 'merge' | 'confirm' | 'exception' | 'update' | 'review' | 'unmerge';

export interface BusStop {
  id: string;
  name: string;
  standardizedName: string;
  lat: number;
  lng: number;
  status: PointStatus;
  address?: string;
  notes?: string;
  isBoundary: boolean;
  needsReview: boolean;
  mergeSuggestions?: MergeSuggestion[];
  mergedIds: string[];
  mergedIntoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MergeSuggestion {
  targetId: string;
  similarity: number;
  distance: number;
  reason: string;
}

export interface DataSource {
  id: string;
  busStopId: string;
  type: SourceType;
  rawName: string;
  rawData: Record<string, string>;
  fileName?: string;
  importedAt: string;
}

export interface ProcessRecord {
  id: string;
  busStopId: string;
  action: ActionType;
  operator: string;
  remark?: string;
  timestamp: string;
  beforeState?: Partial<BusStop>;
  afterState?: Partial<BusStop>;
}

export interface AppState {
  busStops: BusStop[];
  dataSources: DataSource[];
  processRecords: ProcessRecord[];
  selectedBusStopId: string | null;
  filters: {
    status?: PointStatus;
    source?: SourceType;
    search?: string;
  };
}

export interface AppActions {
  setSelectedBusStop: (id: string | null) => void;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  confirmBusStop: (id: string, remark?: string) => void;
  markAsException: (id: string, remark?: string) => void;
  mergeBusStops: (sourceId: string, targetId: string, remark?: string) => void;
  unmergeBusStop: (id: string, remark?: string) => void;
  addNote: (id: string, notes: string) => void;
  exportData: () => string;
  importData: (jsonStr: string) => void;
  resetWithSampleData: () => void;
  getDataSourceByBusStopId: (busStopId: string) => DataSource[];
  getProcessRecordsByBusStopId: (busStopId: string) => ProcessRecord[];
}

export type AppStore = AppState & AppActions;

export const statusLabels: Record<PointStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  exception: '例外',
  merged: '已归并',
};

export const statusColors: Record<PointStatus, string> = {
  pending: '#6b7280',
  confirmed: '#10b981',
  exception: '#ef4444',
  merged: '#8b5cf6',
};

export const sourceLabels: Record<SourceType, string> = {
  street: '街道表格',
  photo: '现场照片',
  approval: '审批记录',
};

export const sourceColors: Record<SourceType, string> = {
  street: '#3b82f6',
  photo: '#f59e0b',
  approval: '#8b5cf6',
};

export const actionLabels: Record<ActionType, string> = {
  import: '导入数据',
  merge: '归并点位',
  confirm: '确认点位',
  exception: '标记例外',
  update: '更新信息',
  review: '人工审核',
  unmerge: '取消归并',
};
