import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StoreState, ReviewRecord, ChangeLog, RecordStatus } from '../types';
import { mockRecords, mockChangeLogs } from '../data/mockData';

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      records: mockRecords,
      changeLogs: mockChangeLogs,
      currentFilter: 'all',

      setFilter: (filter) => set({ currentFilter: filter }),

      getRecordById: (id) => {
        return get().records.find((r) => r.id === id);
      },

      getChangeLogsByRecordId: (recordId) => {
        return get()
          .changeLogs.filter((log) => log.recordId === recordId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      updateRecordStatus: (id, status, reason, operator) => {
        const record = get().getRecordById(id);
        if (!record) return;

        const newLog: ChangeLog = {
          id: generateId(),
          recordId: id,
          type: 'status_update',
          field: 'status',
          oldValue: record.status,
          newValue: status,
          operator,
          reason,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  updatedAt: new Date().toISOString(),
                  pendingReason: status === 'pending' ? reason : '',
                }
              : r
          ),
          changeLogs: [...state.changeLogs, newLog],
        }));
      },

      addComment: (id, comment, operator) => {
        const record = get().getRecordById(id);
        if (!record) return;

        const newLog: ChangeLog = {
          id: generateId(),
          recordId: id,
          type: 'comment_add',
          field: 'comment',
          oldValue: record.comment,
          newValue: comment,
          operator,
          reason: '补充讲评记录',
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, comment, updatedAt: new Date().toISOString() } : r
          ),
          changeLogs: [...state.changeLogs, newLog],
        }));
      },

      updateDifficulty: (id, difficulty, reason, operator) => {
        const record = get().getRecordById(id);
        if (!record) return;

        const newLog: ChangeLog = {
          id: generateId(),
          recordId: id,
          type: 'difficulty_update',
          field: 'currentDifficulty',
          oldValue: record.currentDifficulty,
          newValue: difficulty,
          operator,
          reason,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  currentDifficulty: difficulty,
                  questionBankData: { ...r.questionBankData, currentDifficulty: difficulty },
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
          changeLogs: [...state.changeLogs, newLog],
        }));
      },

      exportRecord: (id) => {
        const record = get().getRecordById(id);
        const logs = get().getChangeLogsByRecordId(id);
        if (!record) return '';

        const formatDate = (dateStr: string) =>
          new Date(dateStr).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });

        const exportContent = `
概率树复核报告
==============

【基本信息】
记录ID: ${record.id}
来源: ${record.source}
当前状态: ${record.status === 'pending' ? '待处理' : record.status === 'completed' ? '已完成' : record.status === 'material_only' ? '补材料' : '改结论'}
当前难度: ${record.currentDifficulty}
最后修改人: ${record.reviewer}
创建时间: ${formatDate(record.createdAt)}
更新时间: ${formatDate(record.updatedAt)}

【题目信息】
题目ID: ${record.questionBankData.questionId}
原难度: ${record.questionBankData.originalDifficulty}
知识点: ${record.questionBankData.knowledgePoint}
概率树: ${record.questionBankData.probabilityTree}

【讲评记录】
${record.comment || '(无)'}

【变更历史】
${logs
  .map(
    (log, index) => `
${index + 1}. [${formatDate(log.timestamp)}] ${log.operator}
   操作: ${log.type === 'difficulty_update' ? '难度更新' : log.type === 'comment_add' ? '讲评补充' : log.type === 'question_bank_edit' ? '题库修改' : '状态变更'}
   字段: ${log.field}
   变更: ${log.oldValue || '(空)'} → ${log.newValue || '(空)'}
   原因: ${log.reason}
`
  )
  .join('')}

---
导出时间: ${formatDate(new Date().toISOString())}
`;

        return exportContent;
      },
    }),
    {
      name: 'probability-tree-review-storage',
    }
  )
);
