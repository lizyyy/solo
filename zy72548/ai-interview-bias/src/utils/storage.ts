import type { AppState, ReviewRecord, Role } from '../types';

const STORAGE_KEY = 'ai_interview_bias_state';

export const loadState = (): AppState => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (serialized) {
      return JSON.parse(serialized);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return getDefaultState();
};

export const saveState = (state: AppState): void => {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Failed to save state:', e);
  }
};

export const getDefaultState = (): AppState => ({
  currentRole: 'product_manager',
  currentUser: '阿宁',
  reviewRecords: [],
  promptVersions: [],
  activeTab: 'import',
});

export const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const clearState = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getRoleName = (role: Role): string => {
  const map: Record<Role, string> = {
    product_manager: 'AI产品经理',
    operation_reviewer: '运营复核人',
    admin: '管理员',
  };
  return map[role];
};

export const getStatusName = (status: ReviewRecord['status']): string => {
  const map: Record<ReviewRecord['status'], string> = {
    pending_review: '待审核',
    conflict_detected: '存在冲突',
    pm_confirmed: '产品已确认',
    pm_rejected: '产品已驳回',
    pending_operation: '待运营复核',
    operation_approved: '运营已通过',
    operation_rejected: '运营已驳回',
    finalized: '已归档',
  };
  return map[status];
};

export const getConflictTypeName = (type: string): string => {
  const map: Record<string, string> = {
    prompt_version_mismatch: '提示词版本不匹配',
    model_version_changed: '模型版本变更',
    duplicate_import: '重复导入',
    conclusion_inconsistent: '结论不一致',
  };
  return map[type] || type;
};
