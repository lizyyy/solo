import { create } from 'zustand';
import { CopyrightRecord, RecordStatus, HistoryEntry } from '../types';
import { demoRecords } from '../data/demoRecords';

interface RecordStore {
  records: CopyrightRecord[];
  selectedRecordId: string | null;
  filterStatus: RecordStatus | 'all';
  setFilterStatus: (status: RecordStatus | 'all') => void;
  selectRecord: (id: string | null) => void;
  getSelectedRecord: () => CopyrightRecord | null;
  supplementKnowledgeBase: (recordId: string, link: string, source: string, operator: string) => void;
  submitAlgorithmReview: (recordId: string, operator: string) => void;
  confirmFixComplete: (recordId: string, operator: string) => void;
  rerunExport: (recordId: string, operator: string) => void;
  addHistoryEntry: (recordId: string, entry: Omit<HistoryEntry, 'id'>) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

const getNowTime = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

export const useRecordStore = create<RecordStore>((set, get) => ({
  records: demoRecords,
  selectedRecordId: demoRecords[0]?.id || null,
  filterStatus: 'all',

  setFilterStatus: (status) => set({ filterStatus: status }),

  selectRecord: (id) => set({ selectedRecordId: id }),

  getSelectedRecord: () => {
    const { records, selectedRecordId } = get();
    return records.find((r) => r.id === selectedRecordId) || null;
  },

  addHistoryEntry: (recordId, entry) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              history: [...r.history, { ...entry, id: generateId() }],
              updatedAt: getNowTime(),
            }
          : r
      ),
    }));
  },

  supplementKnowledgeBase: (recordId, link, source, operator) => {
    set((state) => ({
      records: state.records.map((r) => {
        if (r.id !== recordId) return r;
        const oldLink = r.knowledgeBaseLink || '无';
        return {
          ...r,
          knowledgeBaseLink: link,
          knowledgeBaseSource: source,
          status: 'supplemented' as RecordStatus,
          hasPhoneLeak: false,
          exportContent: r.exportContent.replace(
            /【补录说明】[\s\S]*?【/,
            `【补录说明】知识库引用由${operator}于${getNowTime().split(' ')[0]}补录，来源为${source}。\n【`
          ),
          history: [
            ...r.history,
            {
              id: generateId(),
              action: 'supplement_kb',
              operator,
              description: '补录知识库引用链接',
              oldValue: oldLink,
              newValue: link,
              timestamp: getNowTime(),
            },
            {
              id: generateId(),
              action: 'mark_supplemented',
              operator: '系统',
              description: '标记为已补录记录',
              timestamp: getNowTime(),
            },
          ],
          updatedAt: getNowTime(),
        };
      }),
    }));
  },

  submitAlgorithmReview: (recordId, operator) => {
    set((state) => ({
      records: state.records.map((r) => {
        if (r.id !== recordId) return r;
        return {
          ...r,
          history: [
            ...r.history,
            {
              id: generateId(),
              action: 'pending_algorithm_review',
              operator,
              description: '提交算法同事复核手机号漏遮问题',
              timestamp: getNowTime(),
            },
          ],
          updatedAt: getNowTime(),
        };
      }),
    }));
  },

  confirmFixComplete: (recordId, operator) => {
    set((state) => ({
      records: state.records.map((r) => {
        if (r.id !== recordId) return r;
        return {
          ...r,
          status: 'normal' as RecordStatus,
          hasPhoneLeak: false,
          exportContent: r.exportContent
            .replace(/【脱敏状态】⚠️ 检测到手机号未脱敏！\n【问题内容】导出中包含手机号：[\s\S]*?【处理建议】[\s\S]*?\n/, '【脱敏状态】已完成脱敏检查，未发现敏感信息。\n')
            .replace(/手机号 \d+\*{4}\d+ 未脱敏/, '已修正'),
          history: [
            ...r.history,
            {
              id: generateId(),
              action: 'algorithm_review',
              operator,
              description: '算法同事复核完成，已修正手机号漏遮问题',
              timestamp: getNowTime(),
            },
            {
              id: generateId(),
              action: 'fix_complete',
              operator: '系统',
              description: '修正完成，标记为正常记录',
              timestamp: getNowTime(),
            },
          ],
          updatedAt: getNowTime(),
        };
      }),
    }));
  },

  rerunExport: (recordId, operator) => {
    set((state) => ({
      records: state.records.map((r) => {
        if (r.id !== recordId) return r;
        return {
          ...r,
          history: [
            ...r.history,
            {
              id: generateId(),
              action: 'rerun_export',
              operator,
              description: '重新生成脱敏导出',
              timestamp: getNowTime(),
            },
          ],
          updatedAt: getNowTime(),
        };
      }),
    }));
  },
}));
