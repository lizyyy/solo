import { create } from 'zustand';
import type {
  ClaimRecord,
  RecordStatus,
  ConflictItem,
  EvidenceItem,
  TimelineNode,
} from '../types/claim';
import { mockRecords } from '../data/mockData';

interface ClaimStore {
  records: ClaimRecord[];
  currentRecord: ClaimRecord | null;
  filter: RecordStatus | 'all';
  searchKeyword: string;

  setFilter: (status: RecordStatus | 'all') => void;
  setSearchKeyword: (keyword: string) => void;
  setCurrentRecord: (record: ClaimRecord | null) => void;
  getRecordById: (id: string) => ClaimRecord | undefined;
  getFilteredRecords: () => ClaimRecord[];

  importManualJudgment: (recordId: string, data: {
    conclusion: string;
    evidences: Omit<EvidenceItem, 'id' | 'source' | 'timestamp' | 'operator'>[];
  }) => void;

  reviewPromptVersion: (recordId: string, data: {
    version: string;
    conclusion: string;
    isOldCriteria?: boolean;
    evidences: Omit<EvidenceItem, 'id' | 'source' | 'timestamp' | 'operator'>[];
  }) => void;

  resolveConflict: (recordId: string, conflictId: string, resolution: ConflictItem['resolution']) => void;
  resolveAllConflicts: (recordId: string, resolution: ConflictItem['resolution']) => void;

  verifyDuplicate: (recordId: string, result: 'approved' | 'rejected', remark: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 10);
const now = () => new Date().toLocaleString('zh-CN', { hour12: false });

export const useClaimStore = create<ClaimStore>((set, get) => ({
  records: mockRecords,
  currentRecord: null,
  filter: 'all',
  searchKeyword: '',

  setFilter: (status) => set({ filter: status }),
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  setCurrentRecord: (record) => set({ currentRecord: record }),

  getRecordById: (id) => get().records.find((r) => r.id === id),

  getFilteredRecords: () => {
    const { records, filter, searchKeyword } = get();
    let result = records;

    if (filter !== 'all') {
      result = result.filter((r) => r.status === filter);
    }

    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(kw) ||
          r.userName.toLowerCase().includes(kw) ||
          r.materialType.toLowerCase().includes(kw)
      );
    }

    return result;
  },

  importManualJudgment: (recordId, data) => {
    set((state) => {
      const records = state.records.map((record) => {
        if (record.id !== recordId) return record;

        const timelineNode: TimelineNode = {
          id: generateId(),
          timestamp: now(),
          operator: '当前用户',
          action: '导入人工改判表',
          description: '完成人工审核数据导入',
          source: 'manual_judgment',
        };

        const evidences: EvidenceItem[] = data.evidences.map((e) => ({
          ...e,
          id: generateId(),
          source: 'manual_judgment' as const,
          timestamp: now(),
          operator: '当前用户',
        }));

        return {
          ...record,
          status: 'pending_review' as const,
          manualJudgment: {
            importedAt: now(),
            operator: '当前用户',
            conclusion: data.conclusion,
            evidences,
          },
          timeline: [...record.timeline, timelineNode],
        };
      });

      const current = state.currentRecord;
      const currentRecord =
        current && current.id === recordId
          ? records.find((r) => r.id === recordId) || null
          : current;

      return { records, currentRecord };
    });
  },

  reviewPromptVersion: (recordId, data) => {
    set((state) => {
      const records = state.records.map((record) => {
        if (record.id !== recordId) return record;

        const timelineNode: TimelineNode = {
          id: generateId(),
          timestamp: now(),
          operator: '小孟',
          action: '补看提示词版本号',
          description: '完成现场说法数据核对',
          source: 'prompt_version',
        };

        const evidences: EvidenceItem[] = data.evidences.map((e) => ({
          ...e,
          id: generateId(),
          source: 'prompt_version' as const,
          timestamp: now(),
          operator: '小孟',
        }));

        const manualConclusion = record.manualJudgment?.conclusion || '';
        const promptConclusion = data.conclusion;
        const isConsistent = manualConclusion === promptConclusion;
        const isOldCriteria = data.isOldCriteria;

        let status: RecordStatus = 'completed';
        let resultType = record.resultType;
        let conflicts = record.conflicts || [];
        let finalConclusion = record.finalConclusion;

        if (isOldCriteria && !isConsistent) {
          status = 'conflict';
          resultType = 'old_criteria';
          conflicts = [];

          const allFields = new Set<string>();
          record.manualJudgment?.evidences.forEach((e) => allFields.add(e.field));
          evidences.forEach((e) => allFields.add(e.field));

          allFields.forEach((field) => {
            const m = record.manualJudgment?.evidences.find((e) => e.field === field);
            const p = evidences.find((e) => e.field === field);
            if (m && p && m.value !== p.value) {
              conflicts.push({
                id: generateId(),
                field,
                manualValue: m.value,
                promptValue: p.value,
              });
            }
          });
        } else if (!isConsistent && !isOldCriteria) {
          status = 'pending_verify';
          resultType = 'duplicate';
        } else {
          resultType = 'success';
          finalConclusion = promptConclusion;
        }

        const updateTimeline: TimelineNode[] = [...record.timeline, timelineNode];

        if (status === 'pending_verify') {
          updateTimeline.push({
            id: generateId(),
            timestamp: now(),
            operator: '系统',
            action: '标记待复核',
            description: '检测到数据不一致，转标注负责人复核',
          });
        } else if (status === 'conflict') {
          updateTimeline.push({
            id: generateId(),
            timestamp: now(),
            operator: '系统',
            action: '标记冲突',
            description: '检测到新旧口径差异，需确认',
          });
        } else {
          updateTimeline.push({
            id: generateId(),
            timestamp: now(),
            operator: '系统',
            action: '证据回放更新',
            description: '两边证据一致，标记为顺利通过',
          });
        }

        return {
          ...record,
          status,
          resultType,
          finalConclusion,
          conflicts,
          promptVersion: {
            reviewedAt: now(),
            operator: '小孟',
            version: data.version,
            conclusion: data.conclusion,
            isOldCriteria: data.isOldCriteria,
            evidences,
          },
          timeline: updateTimeline,
        };
      });

      const current = state.currentRecord;
      const currentRecord =
        current && current.id === recordId
          ? records.find((r) => r.id === recordId) || null
          : current;

      return { records, currentRecord };
    });
  },

  resolveConflict: (recordId, conflictId, resolution) => {
    set((state) => {
      const records = state.records.map((record) => {
        if (record.id !== recordId) return record;

        const conflicts = (record.conflicts || []).map((c) =>
          c.id === conflictId ? { ...c, resolution } : c
        );

        const allResolved = conflicts.every((c) => c.resolution);

        const timelineNode: TimelineNode = {
          id: generateId(),
          timestamp: now(),
          operator: '小孟',
          action: '处理冲突',
          description: `已处理字段冲突：${conflicts.find((c) => c.id === conflictId)?.field}`,
        };

        let finalConclusion = record.finalConclusion;
        let status = record.status;

        if (allResolved) {
          const resolved = conflicts[0];
          if (resolved?.resolution === 'confirm_manual') {
            finalConclusion = record.manualJudgment?.conclusion;
          } else if (resolved?.resolution === 'confirm_prompt') {
            finalConclusion = record.promptVersion?.conclusion;
          }
          status = 'completed';
        }

        return {
          ...record,
          conflicts,
          finalConclusion,
          status,
          timeline: [...record.timeline, timelineNode],
        };
      });

      const current = state.currentRecord;
      const currentRecord =
        current && current.id === recordId
          ? records.find((r) => r.id === recordId) || null
          : current;

      return { records, currentRecord };
    });
  },

  resolveAllConflicts: (recordId, resolution) => {
    set((state) => {
      const records = state.records.map((record) => {
        if (record.id !== recordId) return record;

        const conflicts = (record.conflicts || []).map((c) => ({ ...c, resolution }));

        let finalConclusion: string | undefined;
        if (resolution === 'confirm_manual') {
          finalConclusion = record.manualJudgment?.conclusion;
        } else if (resolution === 'confirm_prompt') {
          finalConclusion = record.promptVersion?.conclusion;
        }

        const timelineNode: TimelineNode = {
          id: generateId(),
          timestamp: now(),
          operator: '小孟',
          action: '确认全部冲突',
          description:
            resolution === 'confirm_manual'
              ? '全部以人工改判表为准'
              : resolution === 'confirm_prompt'
                ? '全部以提示词版本号为准'
                : '全部驳回，需重新审核',
        };

        return {
          ...record,
          conflicts,
          finalConclusion,
          status: 'completed' as const,
          timeline: [...record.timeline, timelineNode],
        };
      });

      const current = state.currentRecord;
      const currentRecord =
        current && current.id === recordId
          ? records.find((r) => r.id === recordId) || null
          : current;

      return { records, currentRecord };
    });
  },

  verifyDuplicate: (recordId, result, remark) => {
    set((state) => {
      const records = state.records.map((record) => {
        if (record.id !== recordId) return record;

        const timelineNode: TimelineNode = {
          id: generateId(),
          timestamp: now(),
          operator: '标注负责人',
          action: '复核完成',
          description: result === 'approved' ? '确认重复计入，已合并' : '核实非重复，予以通过',
        };

        return {
          ...record,
          status: 'completed' as const,
          finalConclusion:
            result === 'approved'
              ? '确认重复计入，合并处理'
              : record.manualJudgment?.conclusion,
          verification: {
            verifiedAt: now(),
            verifier: '标注负责人',
            result,
            remark,
          },
          timeline: [...record.timeline, timelineNode],
        };
      });

      const current = state.currentRecord;
      const currentRecord =
        current && current.id === recordId
          ? records.find((r) => r.id === recordId) || null
          : current;

      return { records, currentRecord };
    });
  },
}));
