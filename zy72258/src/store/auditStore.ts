import { create } from 'zustand';
import { db } from '../db';
import type { AuditLog } from '../types';

interface AuditStore {
  logs: AuditLog[];
  isLoading: boolean;
  loadLogs: (limit?: number) => Promise<void>;
  getLogById: (id: string) => AuditLog | undefined;
  copyCommand: (command: string) => Promise<boolean>;
  exportLogsToCsv: () => Promise<void>;
}

export const useAuditStore = create<AuditStore>((set, get) => ({
  logs: [],
  isLoading: false,

  loadLogs: async (limit = 100) => {
    set({ isLoading: true });
    try {
      const logs = await db.auditLogs
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
      set({ logs, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('加载审计日志失败:', error);
    }
  },

  getLogById: (id: string) => {
    return get().logs.find(l => l.id === id);
  },

  copyCommand: async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      return true;
    } catch (error) {
      console.error('复制命令失败:', error);
      return false;
    }
  },

  exportLogsToCsv: async () => {
    const logs = get().logs;
    if (logs.length === 0) {
      alert('暂无日志可导出');
      return;
    }

    const headers = ['时间', '操作人', '操作类型', '操作内容', '可重跑命令', '是否成功'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString('zh-CN'),
      log.operator,
      log.actionType,
      log.message,
      log.rerunnableCommand,
      log.success ? '是' : '否',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_log_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  },
}));
