export type MaterialStatus = 'CONFIRMED' | 'PENDING' | 'REJECTED';

export type NoteResult = 'RESOLVED' | 'IN_PROGRESS' | 'ESCALATED';

export interface OpinionItem {
  id: string;
  content: string;
  isInDisclosure: boolean;
  isOld: boolean;
  isMissed: boolean;
}

export interface SupplementaryNote {
  id: string;
  content: string;
  handler: string;
  handledAt: string;
  process: string;
  result: NoteResult;
  resultText: string;
}

export interface LayerAbnormality {
  hasAbnormality: boolean;
  reason: string;
  suggestion: string;
  reviewed: boolean;
  affectedLayers: string[];
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  operator: string;
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface MaterialRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  fireZone: string;
  submissionDate: string;
  layerName: string;
  status: MaterialStatus;
  opinions: OpinionItem[];
  supplementaryNotes: SupplementaryNote[];
  layerAbnormality: LayerAbnormality;
  history: HistoryEntry[];
  submitter: string;
  reviewer: string;
}

export interface Filters {
  fireZone: string | null;
  type: string | null;
  status: MaterialStatus | null;
  hasAbnormality: boolean | null;
  dateFrom: string | null;
  dateTo: string | null;
  keyword: string;
}

export interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  rejected: number;
  abnormal: number;
}

export const STATUS_LABEL: Record<MaterialStatus, string> = {
  CONFIRMED: '已确认',
  PENDING: '待补件',
  REJECTED: '退回',
};

export const NOTE_RESULT_LABEL: Record<NoteResult, string> = {
  RESOLVED: '已解决',
  IN_PROGRESS: '处理中',
  ESCALATED: '已上报',
};

export const FIRE_ZONES = ['F1-防火分区A', 'F1-防火分区B', 'F2-防火分区A', 'F2-防火分区B', 'F3-防火分区A'];
export const MATERIAL_TYPES = ['防火封堵', '防火门', '防火卷帘', '防火玻璃', '喷淋管', '排烟风管', '电缆桥架'];
