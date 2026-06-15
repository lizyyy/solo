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

const getNowDate = () => getNowTime().split(' ')[0];

function generateExportContent(
  record: CopyrightRecord,
  options?: { 
    isSupplemented?: boolean; 
    supplementedBy?: string; 
    supplementedDate?: string;
    supplementedSource?: string;
    phoneFixed?: boolean;
  }
): string {
  const { materialName, promptVersion, knowledgeBaseLink, knowledgeBaseSource, hasPhoneLeak, leakedPhone } = record;
  const nowTime = getNowTime();
  const isSupplemented = options?.isSupplemented || false;
  const supplementedBy = options?.supplementedBy || '小乔';
  const supplementedDate = options?.supplementedDate || getNowDate();
  const supplementedSource = options?.supplementedSource || knowledgeBaseSource;
  const phoneFixed = options?.phoneFixed || false;

  const lines: string[] = [];
  lines.push(`【素材名称】${materialName}`);
  lines.push(`【提示词版本】${promptVersion}`);

  if (knowledgeBaseLink && knowledgeBaseSource) {
    lines.push(`【版权口径来源】${knowledgeBaseSource}`);
    lines.push(`【知识库链接】${knowledgeBaseLink}`);
  } else {
    lines.push(`【版权口径来源】⚠️ 缺失，待知识库编辑补录`);
    lines.push(`【知识库链接】⚠️ 缺失，待知识库编辑补录`);
  }

  if (isSupplemented) {
    lines.push(`【补录说明】知识库引用由${supplementedBy}于${supplementedDate}补录，来源为${supplementedSource}。`);
  }

  if (knowledgeBaseLink && knowledgeBaseSource) {
    const versionTag = promptVersion;
    if (versionTag >= 'v2.3') {
      lines.push(`【版权说明】本素材由AI生成，参考知识库${knowledgeBaseSource}执行。`);
      lines.push(`【使用范围】可用于商业宣传物料、网页背景。`);
      lines.push(`【注意事项】不得单独作为商标标识使用。`);
    } else if (versionTag >= 'v2.2') {
      lines.push(`【版权说明】本素材由AI生成，参考知识库${knowledgeBaseSource}执行。`);
      lines.push(`【使用范围】可用于社交媒体推广、产品详情页。`);
      lines.push(`【注意事项】需标注"AI生成"字样。`);
    } else {
      lines.push(`【版权说明】本素材由AI生成，参考知识库${knowledgeBaseSource}（旧口径）执行。`);
      lines.push(`【使用范围】可用于内部活动宣传、节日祝福海报。`);
      lines.push(`【注意事项】旧口径素材建议尽快更新到最新版本。`);
    }
  } else {
    lines.push(`【版权说明】⚠️ 知识库引用缺失，请联系知识库编辑小乔补录后再使用。`);
    lines.push(`【使用范围】暂不确定，补录知识库口径后确认。`);
    lines.push(`【注意事项】⚠️ 缺少版权口径，请勿直接使用。`);
  }

  if (phoneFixed) {
    lines.push(`【脱敏状态】已完成脱敏检查，手机号漏遮问题已修正。`);
  } else if (hasPhoneLeak) {
    const masked = leakedPhone ? leakedPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '****';
    lines.push(`【脱敏状态】⚠️ 检测到手机号未脱敏！`);
    lines.push(`【问题内容】导出中包含手机号：${masked}（原始值：${leakedPhone || '未知'}）`);
    lines.push(`【处理建议】请算法同事复核后修正，别急着归为正常记录。`);
  } else if (!knowledgeBaseLink) {
    lines.push(`【脱敏状态】暂未完成，待知识库引用补录后重新生成导出。`);
  } else {
    lines.push(`【脱敏状态】已完成脱敏检查，未发现敏感信息。`);
  }

  lines.push(`【导出生成时间】${nowTime}`);
  lines.push(`【联系方式】如有疑问，请联系版权组。`);

  return lines.join('\n');
}

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
        const nowDate = getNowDate();
        
        const updatedRecord: CopyrightRecord = {
          ...r,
          knowledgeBaseLink: link,
          knowledgeBaseSource: source,
          status: 'supplemented' as RecordStatus,
        };

        const newExportContent = generateExportContent(updatedRecord, {
          isSupplemented: true,
          supplementedBy: operator,
          supplementedDate: nowDate,
          supplementedSource: source,
        });

        return {
          ...updatedRecord,
          exportContent: newExportContent,
          history: [
            ...r.history,
            {
              id: generateId(),
              action: 'supplement_kb',
              operator,
              description: `补录知识库引用链接，来源为${source}`,
              oldValue: oldLink,
              newValue: link,
              timestamp: getNowTime(),
            },
            {
              id: generateId(),
              action: 'generate_export',
              operator: '系统',
              description: '补录链接后重新生成脱敏导出',
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
        
        const fixedRecord: CopyrightRecord = {
          ...r,
          status: 'normal' as RecordStatus,
          hasPhoneLeak: false,
        };

        const newExportContent = generateExportContent(fixedRecord, {
          phoneFixed: true,
        });

        return {
          ...fixedRecord,
          exportContent: newExportContent,
          history: [
            ...r.history,
            {
              id: generateId(),
              action: 'algorithm_review',
              operator,
              description: '算法同事复核完成，已修正手机号漏遮问题',
              oldValue: '手机号漏遮',
              newValue: '已脱敏处理',
              timestamp: getNowTime(),
            },
            {
              id: generateId(),
              action: 'generate_export',
              operator: '系统',
              description: '修正后重新生成脱敏导出',
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

        const isSupplemented = r.status === 'supplemented';
        const supplementedHistoryEntry = r.history.find(h => h.action === 'supplement_kb');
        const supplementedBy = supplementedHistoryEntry?.operator || '小乔';
        
        const newExportContent = generateExportContent(r, {
          isSupplemented,
          supplementedBy,
          supplementedDate: getNowDate(),
          supplementedSource: r.knowledgeBaseSource,
        });

        return {
          ...r,
          exportContent: newExportContent,
          history: [
            ...r.history,
            {
              id: generateId(),
              action: 'rerun_export',
              operator,
              description: '手动重新生成脱敏导出，已更新导出内容',
              timestamp: getNowTime(),
            },
          ],
          updatedAt: getNowTime(),
        };
      }),
    }));
  },
}));
