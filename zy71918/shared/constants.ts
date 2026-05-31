import type { ClipStatus, SourceType, ChangeType, UserRole } from './types';

export const STATUS_CONFIG: Record<ClipStatus, { label: string; color: string; bgColor: string; description: string }> = {
  pending_ad_script: {
    label: '待补广告口播表',
    color: '#8B4513',
    bgColor: '#FDF5E6',
    description: '剪辑点已录入，等待补录广告口播表',
  },
  pending_review: {
    label: '待审核',
    color: '#4682B4',
    bgColor: '#F0F8FF',
    description: '材料齐全，等待制作人审核',
  },
  pending: {
    label: '待处理',
    color: '#CD5C5C',
    bgColor: '#FFF5F5',
    description: '存在问题，需要处理',
  },
  ready: {
    label: '可导出',
    color: '#2F4F4F',
    bgColor: '#F0FFF0',
    description: '审核通过，可导出上线',
  },
  archived: {
    label: '已归档',
    color: '#6B6B6B',
    bgColor: '#F5F5F5',
    description: '已导出上线，归档完成',
  },
};

export const SOURCE_TYPE_CONFIG: Record<SourceType, { label: string; color: string; icon: string }> = {
  edit_point: {
    label: '剪辑点',
    color: '#8B4513',
    icon: 'Scissors',
  },
  ad_script: {
    label: '广告口播表',
    color: '#D2691E',
    icon: 'FileText',
  },
  audio_track: {
    label: '原始音轨',
    color: '#4682B4',
    icon: 'Music',
  },
};

export const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; color: string; bgColor: string; description: string }> = {
  material_only: {
    label: '补材料',
    color: '#D2B48C',
    bgColor: '#FAF0E6',
    description: '仅补充缺失材料，未改变结论',
  },
  conclusion_change: {
    label: '改结论',
    color: '#4682B4',
    bgColor: '#F0F8FF',
    description: '修改了原始内容，结论有变化',
  },
};

export const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  editor: {
    label: '剪辑师',
    color: '#8B4513',
  },
  operator: {
    label: '运营',
    color: '#D2691E',
  },
  producer: {
    label: '制作人',
    color: '#2F4F4F',
  },
  admin: {
    label: '管理员',
    color: '#6B6B6B',
  },
};

export const STATUS_TRANSITION_RULES: Record<ClipStatus, ClipStatus[]> = {
  pending_ad_script: ['pending_review', 'pending'],
  pending_review: ['pending', 'ready', 'pending_review'],
  pending: ['pending_review', 'pending'],
  ready: ['archived', 'pending'],
  archived: ['pending'],
};

export const MOCK_USERS = [
  { id: 'u1', name: '张明', role: 'editor' as UserRole },
  { id: 'u2', name: '李华', role: 'editor' as UserRole },
  { id: 'u3', name: '王芳', role: 'operator' as UserRole },
  { id: 'u4', name: '赵强', role: 'operator' as UserRole },
  { id: 'u5', name: '陈静', role: 'producer' as UserRole },
  { id: 'u6', name: '刘伟', role: 'admin' as UserRole },
];

export const DEFAULT_OPERATOR_ID = 'u1';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function getSourceResponsiblePerson(sourceType: SourceType) {
  if (sourceType === 'edit_point' || sourceType === 'audio_track') {
    return MOCK_USERS.find(u => u.role === 'editor');
  }
  return MOCK_USERS.find(u => u.role === 'operator');
}
