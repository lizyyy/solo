import { utils, writeFile } from 'xlsx';
import { 
  PickupOrder, 
  RepairOrder, 
  ClaimOrder, 
  AuditLog, 
  BatchResult,
  User,
  ImportError,
  ClaimRule
} from '@/types';
import { create } from 'zustand';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const generateOrderNo = (prefix: string): string => {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${dateStr}${random}`;
};

export const validatePickupOrder = (data: Record<string, any>): { valid: boolean; errors: string[]; suggestion?: string } => {
  const errors: string[] = [];

  if (!data.engineerName || data.engineerName.trim() === '') {
    errors.push('工程师姓名不能为空');
  }
  if (!data.partCode || data.partCode.trim() === '') {
    errors.push('配件编码不能为空');
  }
  if (!data.partName || data.partName.trim() === '') {
    errors.push('配件名称不能为空');
  }
  if (!data.quantity || isNaN(Number(data.quantity)) || Number(data.quantity) <= 0) {
    errors.push('数量必须是大于0的数字');
  }
  if (!data.pickupDate) {
    errors.push('领件日期不能为空');
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestion: errors.length > 0 ? '请检查必填字段是否完整，确保格式正确' : undefined
  };
};

export const validateRepairOrder = (data: Record<string, any>): { valid: boolean; errors: string[]; suggestion?: string } => {
  const errors: string[] = [];

  if (!data.customerName || data.customerName.trim() === '') {
    errors.push('客户姓名不能为空');
  }
  if (!data.faultType || data.faultType.trim() === '') {
    errors.push('故障类型不能为空');
  }
  if (!data.repairDate) {
    errors.push('维修日期不能为空');
  }
  if (!data.engineerName || data.engineerName.trim() === '') {
    errors.push('工程师姓名不能为空');
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestion: errors.length > 0 ? '请检查必填字段是否完整，确保格式正确' : undefined
  };
};

export const validateClaimRule = (data: Record<string, any>): { valid: boolean; errors: string[]; suggestion?: string } => {
  const errors: string[] = [];

  if (!data.ruleName || data.ruleName.trim() === '') {
    errors.push('规则名称不能为空');
  }
  if (!data.faultType || data.faultType.trim() === '') {
    errors.push('故障类型不能为空');
  }
  if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) < 0) {
    errors.push('索赔金额必须是非负数字');
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestion: errors.length > 0 ? '请检查必填字段是否完整，确保金额格式正确' : undefined
  };
};

export const exportToExcel = <T>(data: T[], fileName: string, sheetName: string = 'Sheet1') => {
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  writeFile(wb, `${fileName}.xlsx`);
};

export const exportToCSV = <T>(data: T[], fileName: string) => {
  const ws = utils.json_to_sheet(data);
  const csv = utils.sheet_to_csv(ws);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.csv`;
  link.click();
};

const currentUser: User = {
  id: 'user_001',
  name: '管理员',
  role: 'admin'
};

export const getCurrentUser = (): User => {
  return currentUser;
};

export const setCurrentUser = (user: User) => {
  Object.assign(currentUser, user);
};

interface AuditStore {
  logs: AuditLog[];
  addLog: (log: Omit<AuditLog, 'id' | 'operateTime'>) => void;
}

export const useAuditStore = create<AuditStore>((set) => ({
  logs: [],
  addLog: (log) => {
    const newLog: AuditLog = {
      ...log,
      id: generateId(),
      operateTime: new Date().toISOString()
    };
    set((state) => ({ logs: [newLog, ...state.logs] }));
  }
}));

export const recordAuditLog = (module: string, action: string, detail: Record<string, any> = {}) => {
  const user = getCurrentUser();
  useAuditStore.getState().addLog({
    module,
    action,
    operatorId: user.id,
    operatorName: user.name,
    operatorRole: user.role,
    detail
  });
};

export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    picked: 'bg-blue-100 text-blue-800',
    returned: 'bg-green-100 text-green-800',
    abnormal: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    paid: 'bg-emerald-100 text-emerald-800',
    yes: 'bg-green-100 text-green-800',
    no: 'bg-red-100 text-red-800',
    partial: 'bg-yellow-100 text-yellow-800'
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
};

export const getStatusText = (status: string): string => {
  const textMap: Record<string, string> = {
    pending: '待处理',
    picked: '已领件',
    returned: '已返还',
    abnormal: '异常',
    processing: '处理中',
    completed: '已完成',
    draft: '草稿',
    submitted: '已提交',
    approved: '已通过',
    rejected: '已拒绝',
    paid: '已赔付',
    yes: '已返还',
    no: '未返还',
    partial: '部分返还'
  };
  return textMap[status] || status;
};

export const formatCurrency = (amount: number): string => {
  return `¥${amount.toFixed(2)}`;
};

export const parseCSVData = (data: any[]): { data: Record<string, any>[]; headers: string[] } => {
  if (!data || data.length === 0) return { data: [], headers: [] };
  const headers = Object.keys(data[0]);
  return { data, headers };
};
