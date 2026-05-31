export type RecordStatus = 'pending' | 'completed' | 'material_only' | 'conclusion_changed';

export type ChangeType = 'difficulty_update' | 'comment_add' | 'question_bank_edit' | 'status_update';

export interface QuestionBankData {
  questionId: string;
  originalDifficulty: string;
  currentDifficulty: string;
  questionContent: string;
  knowledgePoint: string;
  probabilityTree: string;
}

export interface ReviewRecord {
  id: string;
  source: string;
  status: RecordStatus;
  currentDifficulty: string;
  reviewer: string;
  pendingReason: string;
  comment: string;
  questionBankData: QuestionBankData;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  type: ChangeType;
  field: string;
  oldValue: string;
  newValue: string;
  operator: string;
  reason: string;
  timestamp: string;
}

export interface StoreState {
  records: ReviewRecord[];
  changeLogs: ChangeLog[];
  currentFilter: RecordStatus | 'all';
  setFilter: (filter: RecordStatus | 'all') => void;
  getRecordById: (id: string) => ReviewRecord | undefined;
  getChangeLogsByRecordId: (recordId: string) => ChangeLog[];
  updateRecordStatus: (id: string, status: RecordStatus, reason: string, operator: string) => void;
  addComment: (id: string, comment: string, operator: string) => void;
  updateDifficulty: (id: string, difficulty: string, reason: string, operator: string) => void;
  exportRecord: (id: string) => string;
}

export const statusLabels: Record<RecordStatus | 'all', string> = {
  all: '全部',
  pending: '待处理',
  completed: '已完成',
  material_only: '补材料',
  conclusion_changed: '改结论',
};

export const statusColors: Record<RecordStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  material_only: 'bg-blue-100 text-blue-800',
  conclusion_changed: 'bg-red-100 text-red-800',
};

export const changeTypeLabels: Record<ChangeType, string> = {
  difficulty_update: '难度更新',
  comment_add: '讲评补充',
  question_bank_edit: '题库修改',
  status_update: '状态变更',
};

export const difficultyOptions = ['基础', '简单', '中等', '困难', '挑战'];
