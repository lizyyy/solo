import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlacementRecord, ModificationHistory, UserRole, RecordStatus } from '../types';
import { MOCK_RECORDS, MOCK_HISTORY } from '../data/mockData';

interface RecordStore {
  records: PlacementRecord[];
  history: ModificationHistory[];
  currentUser: UserRole;
  currentUserName: string;
  setCurrentUser: (role: UserRole, name: string) => void;
  updateRecord: (id: string, update: Partial<PlacementRecord>, reason: string) => void;
  reviewRecord: (id: string, result: 'confirmed' | 'rejected', comment: string) => void;
  markQuestion: (id: string, question: string) => void;
  getRecordById: (id: string) => PlacementRecord | undefined;
  getHistoryByRecordId: (id: string) => ModificationHistory[];
  getRecordsByStatus: (status: RecordStatus) => PlacementRecord[];
  exportInspectionSheet: (scope: 'all' | 'pending' | 'disputed') => string;
  resetData: () => void;
}

const ROLE_NAMES: Record<UserRole, string> = {
  exhibit_engineer: '布展工程师',
  project_lead: '工程负责人',
  docent: '讲解员',
};

export const useRecordStore = create<RecordStore>()(
  persist(
    (set, get) => ({
      records: MOCK_RECORDS,
      history: MOCK_HISTORY,
      currentUser: 'exhibit_engineer',
      currentUserName: '张伟',

      setCurrentUser: (role, name) => {
        set({ currentUser: role, currentUserName: name });
      },

      updateRecord: (id, update, reason) => {
        const record = get().records.find((r) => r.id === id);
        if (!record) return;

        const changedFields = Object.keys(update) as (keyof PlacementRecord)[];
        const newHistoryEntries: ModificationHistory[] = changedFields.map((field, idx) => ({
          id: `H-${Date.now()}-${idx}`,
          recordId: id,
          operator: get().currentUserName,
          operatorRole: get().currentUser,
          action: '修改字段',
          field: String(field),
          oldValue: String(record[field] ?? ''),
          newValue: String(update[field] ?? ''),
          reason,
          timestamp: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }).replace(/\//g, '-'),
        }));

        set((state) => ({
          records: state.records.map((r) => (r.id === id ? { ...r, ...update } : r)),
          history: [...newHistoryEntries, ...state.history],
        }));
      },

      reviewRecord: (id, result, comment) => {
        const now = new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).replace(/\//g, '-');

        const newHistory: ModificationHistory = {
          id: `H-${Date.now()}`,
          recordId: id,
          operator: get().currentUserName,
          operatorRole: get().currentUser,
          action: result === 'confirmed' ? '复核确认' : '复核驳回',
          field: 'reviewResult',
          oldValue: '',
          newValue: result,
          reason: comment,
          timestamp: now,
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  reviewResult: result,
                  reviewComment: comment,
                  reviewedBy: get().currentUserName,
                  reviewedAt: now,
                  status: result === 'confirmed' ? 'reviewed' : 'pending',
                  isDisputed: result === 'confirmed' ? false : r.isDisputed,
                }
              : r
          ),
          history: [newHistory, ...state.history],
        }));
      },

      markQuestion: (id, question) => {
        const now = new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).replace(/\//g, '-');

        const newHistory: ModificationHistory = {
          id: `H-${Date.now()}`,
          recordId: id,
          operator: get().currentUserName,
          operatorRole: get().currentUser,
          action: '标注疑问',
          field: 'pendingReason',
          oldValue: '',
          newValue: question,
          reason: question,
          timestamp: now,
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? { ...r, pendingReason: r.pendingReason ? `${r.pendingReason}；${question}` : question }
              : r
          ),
          history: [newHistory, ...state.history],
        }));
      },

      getRecordById: (id) => get().records.find((r) => r.id === id),

      getHistoryByRecordId: (id) => get().history.filter((h) => h.recordId === id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),

      getRecordsByStatus: (status) => get().records.filter((r) => r.status === status),

      exportInspectionSheet: (scope) => {
        const { records, history } = get();
        let filteredRecords: PlacementRecord[];

        switch (scope) {
          case 'pending':
            filteredRecords = records.filter((r) => r.status === 'pending');
            break;
          case 'disputed':
            filteredRecords = records.filter((r) => r.isDisputed);
            break;
          default:
            filteredRecords = records;
        }

        const now = new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).replace(/\//g, '-');

        const statusText = (s: RecordStatus) => {
          const map: Record<RecordStatus, string> = { normal: '正常', pending: '待处理', reviewed: '已复核', closed: '已关闭' };
          return map[s];
        };

        const sourceText = (s: string) => {
          const map: Record<string, string> = { initial: '初始录入', late_attachment: '晚到附件', duplicate: '重复项', manual_correction: '人工更正' };
          return map[s] ?? s;
        };

        let sheet = `文物展柜摆位巡检单\n`;
        sheet += `导出时间：${now}\n`;
        sheet += `导出范围：${scope === 'all' ? '全部记录' : scope === 'pending' ? '仅待处理' : '仅争议记录'}\n`;
        sheet += `导出人：${get().currentUserName}（${ROLE_NAMES[get().currentUser]}）\n`;
        sheet += `${'='.repeat(60)}\n\n`;

        const pendingCount = filteredRecords.filter((r) => r.status === 'pending').length;
        const disputedCount = filteredRecords.filter((r) => r.isDisputed).length;
        const normalCount = filteredRecords.filter((r) => r.status === 'normal').length;
        const reviewedCount = filteredRecords.filter((r) => r.status === 'reviewed').length;

        sheet += `统计：共 ${filteredRecords.length} 条 | 正常 ${normalCount} | 待处理 ${pendingCount} | 已复核 ${reviewedCount} | 争议 ${disputedCount}\n\n`;
        sheet += `${'─'.repeat(60)}\n\n`;

        filteredRecords.forEach((r, idx) => {
          sheet += `[${idx + 1}] ${r.id}\n`;
          sheet += `    展柜：${r.cabinetId}  文物：${r.artifactName}（${r.artifactCode}）\n`;
          sheet += `    位置：${r.position}\n`;
          sheet += `    坐标：${r.coordinateAxis}  轴向翻转：${r.axisFlipped ? '是' : '否'}\n`;
          sheet += `    状态：${statusText(r.status)}  来源：${sourceText(r.source)}\n`;
          sheet += `    录入人：${r.createdBy}  录入时间：${r.createdAt}\n`;

          if (r.pendingReason) {
            sheet += `    ⚠ 待处理原因：${r.pendingReason}\n`;
          }

          if (r.isDisputed) {
            sheet += `    ⚡ 争议记录\n`;
          }

          if (r.reviewResult) {
            sheet += `    ✓ 复核结果：${r.reviewResult === 'confirmed' ? '确认' : '驳回'}（${r.reviewedBy} ${r.reviewedAt}）\n`;
            if (r.reviewComment) {
              sheet += `      复核意见：${r.reviewComment}\n`;
            }
          }

          const relatedHistory = history.filter((h) => h.recordId === r.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          if (relatedHistory.length > 0) {
            sheet += `    修改历史（${relatedHistory.length}条）：\n`;
            relatedHistory.forEach((h) => {
              sheet += `      ${h.timestamp} ${h.operator}（${ROLE_NAMES[h.operatorRole]}）${h.action}`;
              if (h.field) sheet += ` [${h.field}]`;
              if (h.oldValue || h.newValue) sheet += ` "${h.oldValue}"→"${h.newValue}"`;
              if (h.reason) sheet += ` 原因：${h.reason}`;
              sheet += `\n`;
            });
          }

          sheet += `\n`;
        });

        sheet += `${'='.repeat(60)}\n`;
        sheet += `上一班备注（请在此填写交接信息）：\n\n\n`;
        sheet += `签字：________________  日期：________________\n`;

        return sheet;
      },

      resetData: () => {
        set({ records: MOCK_RECORDS, history: MOCK_HISTORY });
      },
    }),
    {
      name: 'artifact-cabinet-storage',
    }
  )
);
