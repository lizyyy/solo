export type NotificationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export type SourceType = 'repertoire' | 'audio' | 'contract' | 'chat' | 'other';

export type CommentType = 'annotation' | 'supplement' | 'decision';

export interface Notification {
  id: string;
  title: string;
  status: NotificationStatus;
  studentName: string;
  instrument: string;
  piece: string;
  rehearsalTime?: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
}

export interface Version {
  id: string;
  notificationId: string;
  versionNumber: number;
  snapshot: Partial<Notification>;
  modifiedBy: string;
  modifiedAt: string;
  changeReason: string;
  diff?: DiffEntry[];
}

export interface Source {
  id: string;
  notificationId: string;
  type: SourceType;
  name: string;
  description: string;
  reference: string;
  uploadTime: string;
  uploadedBy: string;
}

export interface Comment {
  id: string;
  notificationId: string;
  content: string;
  author: string;
  createdAt: string;
  type: CommentType;
}

export interface DiffEntry {
  field: string;
  oldValue: any;
  newValue: any;
  action: 'add' | 'remove' | 'update';
}

export interface SourceInput {
  type: SourceType;
  name: string;
  description: string;
  reference: string;
}

export const statusLabels: Record<NotificationStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消'
};

export const statusColors: Record<NotificationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-600'
};

export const sourceTypeLabels: Record<SourceType, string> = {
  repertoire: '曲目表',
  audio: '音频文件',
  contract: '合同截图',
  chat: '群聊批注',
  other: '其他材料'
};

export const sourceTypeColors: Record<SourceType, string> = {
  repertoire: 'bg-purple-100 text-purple-700',
  audio: 'bg-green-100 text-green-700',
  contract: 'bg-blue-100 text-blue-700',
  chat: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700'
};

export const commentTypeLabels: Record<CommentType, string> = {
  annotation: '批注',
  supplement: '补录备注',
  decision: '决策记录'
};

export const commentTypeColors: Record<CommentType, string> = {
  annotation: 'bg-blue-50 border-blue-200',
  supplement: 'bg-amber-50 border-amber-200',
  decision: 'bg-emerald-50 border-emerald-200'
};
