import { create } from 'zustand';
import type {
  ManifestRecord,
  KnowledgeReference,
  FeedbackTicket,
  ConflictRecord,
  OverrideHistory,
  SelfCheckResult,
  ManifestField,
  ConflictStatus,
  SelfCheckType,
  ManifestStatus,
} from '../types';
import {
  mockManifests,
  mockKnowledgeReferences,
  mockFeedbackTickets,
  mockConflicts,
  mockOverrideHistory,
} from '../data/mockData';

const UNRESOLVED_STATUSES: ConflictStatus[] = ['pending', 'deferred'];
const isUnresolved = (s: ConflictStatus) => UNRESOLVED_STATUSES.includes(s);
const isResolved = (s: ConflictStatus) =>
  s === 'confirmed_knowledge' || s === 'confirmed_ticket';

interface ManifestState {
  manifests: ManifestRecord[];
  knowledgeReferences: KnowledgeReference[];
  feedbackTickets: FeedbackTicket[];
  conflicts: ConflictRecord[];
  overrideHistory: OverrideHistory[];
  selfCheckResults: SelfCheckResult[];
  selectedManifestId: string | null;
  activeConflictId: string | null;

  getManifestById: (id: string) => ManifestRecord | undefined;
  getKnowledgeByManifestId: (id: string) => KnowledgeReference[];
  getTicketsByManifestId: (id: string) => FeedbackTicket[];

  getAllConflictsByManifestId: (id: string) => ConflictRecord[];
  getUnresolvedConflictsByManifestId: (id: string) => ConflictRecord[];
  getResolvedConflictsByManifestId: (id: string) => ConflictRecord[];
  manifestHasUnresolvedConflict: (id: string) => boolean;

  getOverrideHistoryByManifestId: (id: string) => OverrideHistory[];
  getOverriddenFieldsByManifestId: (id: string) => OverrideHistory[];

  setSelectedManifestId: (id: string | null) => void;
  setActiveConflictId: (id: string | null) => void;

  importKnowledgeBase: (
    manifestId: string,
    url: string,
    title: string,
    extractedFields: Record<string, string>
  ) => void;
  resolveConflict: (
    conflictId: string,
    status: ConflictStatus,
    reason: string
  ) => void;
  manualOverrideField: (
    manifestId: string,
    fieldKey: string,
    newValue: string,
    operator: string
  ) => void;
  simulateBatchRun: () => void;
  verifyOverride: (
    manifestId: string,
    fieldKey: string,
    operator: string
  ) => void;

  runSelfCheck: () => void;
  runSingleSelfCheck: (type: SelfCheckType) => SelfCheckResult;

  exportData: () => string;
  getExportData: () => object;
}

const generateId = () => Math.random().toString(36).substring(2, 11);
const now = () => new Date().toISOString();

const selfCheckLabels: Record<SelfCheckType, string> = {
  duplicate_import: '重复导入检测',
  override_detection: '改判覆盖检测',
  recalculation: '补录重算校验',
  export_consistency: '导出一致性校验',
};

const conflictStatusLabels: Record<ConflictStatus, string> = {
  pending: '待裁决',
  deferred: '暂不裁决',
  confirmed_knowledge: '采纳知识库',
  confirmed_ticket: '采纳工单',
};

const computeManifestStatus = (
  manifest: ManifestRecord,
  unresolvedCount: number,
  overriddenCount: number
): ManifestStatus => {
  if (overriddenCount > 0) return 'overridden';
  if (unresolvedCount > 0) return 'conflict';
  if (manifest.stepProgress >= 3) return 'completed';
  if (manifest.stepProgress === 2) return 'verified';
  if (manifest.stepProgress >= 1) return 'processing';
  return 'pending';
};

export const useManifestStore = create<ManifestState>((set, get) => ({
  manifests: mockManifests,
  knowledgeReferences: mockKnowledgeReferences,
  feedbackTickets: mockFeedbackTickets,
  conflicts: mockConflicts,
  overrideHistory: mockOverrideHistory,
  selfCheckResults: [],
  selectedManifestId: null,
  activeConflictId: null,

  getManifestById: (id) => get().manifests.find((m) => m.id === id),
  getKnowledgeByManifestId: (id) =>
    get().knowledgeReferences.filter((k) => k.manifestId === id),
  getTicketsByManifestId: (id) =>
    get().feedbackTickets.filter((t) => t.manifestId === id),

  getAllConflictsByManifestId: (id) =>
    get().conflicts.filter((c) => c.manifestId === id),

  getUnresolvedConflictsByManifestId: (id) =>
    get()
      .conflicts.filter(
        (c) => c.manifestId === id && isUnresolved(c.status)
      ),

  getResolvedConflictsByManifestId: (id) =>
    get()
      .conflicts.filter(
        (c) => c.manifestId === id && isResolved(c.status)
      ),

  manifestHasUnresolvedConflict: (id) =>
    get().getUnresolvedConflictsByManifestId(id).length > 0,

  getOverrideHistoryByManifestId: (id) =>
    get()
      .overrideHistory.filter((o) => o.manifestId === id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),

  getOverriddenFieldsByManifestId: (id) =>
    get().overrideHistory.filter(
      (o) => o.manifestId === id && o.wasOverridden
    ),

  setSelectedManifestId: (id) => set({ selectedManifestId: id }),
  setActiveConflictId: (id) => set({ activeConflictId: id }),

  importKnowledgeBase: (manifestId, url, title, extractedFields) => {
    const state = get();
    const manifest = state.manifests.find((m) => m.id === manifestId);
    if (!manifest) return;

    const newKnowledge: KnowledgeReference = {
      id: generateId(),
      manifestId,
      url,
      title,
      extractedFields,
      confidence: 0.93,
      modelVersion: 'kb-matcher-v2.3.1',
      importedAt: now(),
      importedBy: '阿宁',
    };

    const newSupplementFields = [...manifest.supplementFields];
    Object.entries(extractedFields).forEach(([key, value]) => {
      const existingIdx = newSupplementFields.findIndex((f) => f.key === key);
      const ocrField = manifest.ocrFields.find((f) => f.key === key);
      const newField: ManifestField = {
        key,
        label: ocrField?.label || key,
        value,
        confidence: 0.94,
        source: 'knowledge_base',
        paramVersion: 'kb-v2.3.1',
        tradeOffReason: '知识库补录',
        updatedAt: now(),
        operator: '阿宁',
      };
      if (existingIdx >= 0) {
        newSupplementFields[existingIdx] = newField;
      } else {
        newSupplementFields.push(newField);
      }
    });

    const tickets = state.getTicketsByManifestId(manifestId);
    const newConflicts: ConflictRecord[] = [];
    tickets.forEach((ticket) => {
      Object.entries(ticket.feedbackFields).forEach(([key, ticketValue]) => {
        const kbValue = extractedFields[key];
        const ocrField = manifest.ocrFields.find((f) => f.key === key);
        if (kbValue && ticketValue && kbValue !== ticketValue) {
          const existingSameConflict = state.conflicts.find(
            (c) =>
              c.manifestId === manifestId &&
              c.fieldKey === key &&
              isUnresolved(c.status)
          );
          if (!existingSameConflict) {
            newConflicts.push({
              id: generateId(),
              manifestId,
              fieldKey: key,
              fieldLabel: ocrField?.label || key,
              knowledgeValue: kbValue,
              ticketValue,
              knowledgeSource: url,
              ticketSource: ticket.ticketNo,
              status: 'pending',
            });
          }
        }
      });
    });

    set((s) => {
      const updatedManifest = s.manifests.map((m) => {
        if (m.id !== manifestId) return m;
        const nextStep = (m.stepProgress < 1 ? 1 : m.stepProgress) as 0 | 1 | 2 | 3;
        const prevUnresolved = s
          .getUnresolvedConflictsByManifestId(manifestId)
          .filter((c) => !newConflicts.find((nc) => nc.fieldKey === c.fieldKey)).length;
        const unresolvedCount = prevUnresolved + newConflicts.length;
        const overriddenCount = s.getOverriddenFieldsByManifestId(manifestId)
          .length;
        return {
          ...m,
          supplementFields: newSupplementFields,
          stepProgress: nextStep,
          hasConflict: unresolvedCount > 0,
          status: computeManifestStatus(
            { ...m, stepProgress: nextStep },
            unresolvedCount,
            overriddenCount
          ),
          updatedAt: now(),
        };
      });
      return {
        knowledgeReferences: [...s.knowledgeReferences, newKnowledge],
        conflicts: [...s.conflicts, ...newConflicts],
        manifests: updatedManifest,
      };
    });
  },

  resolveConflict: (conflictId, status, reason) => {
    const state = get();
    const conflict = state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;
    const manifestId = conflict.manifestId;

    set((s) => ({
      conflicts: s.conflicts.map((c) =>
        c.id === conflictId
          ? {
              ...c,
              status,
              decidedBy: '阿宁',
              decidedAt: now(),
              decisionReason: reason,
            }
          : c
      ),
    }));

    const state2 = get();
    const manifest = state2.getManifestById(manifestId);
    if (!manifest) return;

    let newSupplementFields = [...manifest.supplementFields];

    if (status === 'confirmed_knowledge' || status === 'confirmed_ticket') {
      const newValue =
        status === 'confirmed_knowledge'
          ? conflict.knowledgeValue
          : conflict.ticketValue;
      const newSource =
        status === 'confirmed_knowledge' ? 'knowledge_base' : 'ticket';
      const existingIdx = newSupplementFields.findIndex(
        (f) => f.key === conflict.fieldKey
      );
      const ocrField = manifest.ocrFields.find(
        (f) => f.key === conflict.fieldKey
      );
      const resolvedField: ManifestField = {
        key: conflict.fieldKey,
        label: ocrField?.label || conflict.fieldKey,
        value: newValue,
        confidence: 0.95,
        source: newSource,
        paramVersion: newSource === 'knowledge_base' ? 'kb-v2.3.1' : undefined,
        tradeOffReason:
          status === 'confirmed_knowledge'
            ? '人工裁决：采纳知识库值'
            : '人工裁决：采纳工单值',
        updatedAt: now(),
        operator: '阿宁',
      };
      if (existingIdx >= 0) {
        newSupplementFields[existingIdx] = resolvedField;
      } else {
        newSupplementFields.push(resolvedField);
      }
    }

    const shouldAdvanceStep =
      status === 'confirmed_knowledge' || status === 'confirmed_ticket';

    set((s) => {
      const unresolvedCount =
        s.getUnresolvedConflictsByManifestId(manifestId).length;
      const overriddenCount =
        s.getOverriddenFieldsByManifestId(manifestId).length;
      const nextStep = shouldAdvanceStep
        ? ((manifest.stepProgress < 2
            ? 2
            : manifest.stepProgress) as 0 | 1 | 2 | 3)
        : manifest.stepProgress;

      return {
        manifests: s.manifests.map((m) =>
          m.id === manifestId
            ? {
                ...m,
                supplementFields: newSupplementFields,
                hasConflict: unresolvedCount > 0,
                stepProgress: nextStep,
                status: computeManifestStatus(
                  { ...m, stepProgress: nextStep },
                  unresolvedCount,
                  overriddenCount
                ),
                updatedAt: now(),
              }
            : m
        ),
      };
    });
  },

  manualOverrideField: (manifestId, fieldKey, newValue, operator) => {
    const state = get();
    const manifest = state.getManifestById(manifestId);
    if (!manifest) return;

    const existingField =
      manifest.supplementFields.find((f) => f.key === fieldKey) ||
      manifest.ocrFields.find((f) => f.key === fieldKey);
    if (!existingField) return;

    const history: OverrideHistory = {
      id: generateId(),
      manifestId,
      fieldKey,
      fieldLabel: existingField.label,
      oldValue: existingField.value,
      newValue,
      oldSource: existingField.source,
      newSource: 'manual',
      operationType: 'manual_override',
      operator,
      isProtected: true,
      wasOverridden: false,
      createdAt: now(),
    };

    const newSupplementFields = [...manifest.supplementFields];
    const idx = newSupplementFields.findIndex((f) => f.key === fieldKey);
    const newField: ManifestField = {
      ...existingField,
      value: newValue,
      source: 'manual',
      paramVersion: undefined,
      tradeOffReason: '人工改判',
      updatedAt: now(),
      operator,
    };
    if (idx >= 0) {
      newSupplementFields[idx] = newField;
    } else {
      newSupplementFields.push(newField);
    }

    set((s) => {
      const unresolvedCount = s.getUnresolvedConflictsByManifestId(manifestId)
        .length;
      const newOverriddenList = [...s.overrideHistory, history];
      const overriddenCount = newOverriddenList.filter(
        (o) => o.manifestId === manifestId && o.wasOverridden
      ).length;

      return {
        overrideHistory: newOverriddenList,
        manifests: s.manifests.map((m) =>
          m.id === manifestId
            ? {
                ...m,
                supplementFields: newSupplementFields,
                hasConflict: unresolvedCount > 0,
                status: computeManifestStatus(
                  m,
                  unresolvedCount,
                  overriddenCount
                ),
                updatedAt: now(),
              }
            : m
        ),
      };
    });
  },

  simulateBatchRun: () => {
    const state = get();
    const protectedOverrides = state.overrideHistory.filter(
      (o) => o.isProtected && !o.wasOverridden
    );

    const batchId = 'BATCH-' + Date.now().toString().slice(-8);
    const updatedOverrides = state.overrideHistory.map((o) =>
      o.isProtected && !o.wasOverridden
        ? { ...o, wasOverridden: true, overriddenByBatch: batchId }
        : o
    );

    const affectedManifestIds = [
      ...new Set(protectedOverrides.map((o) => o.manifestId)),
    ];

    set((s) => ({
      overrideHistory: updatedOverrides,
      manifests: s.manifests.map((m) => {
        if (!affectedManifestIds.includes(m.id)) return m;
        const unresolvedCount = s
          .getUnresolvedConflictsByManifestId(m.id)
          .length;
        const newOverriddenCount = updatedOverrides.filter(
          (o) => o.manifestId === m.id && o.wasOverridden
        ).length;
        return {
          ...m,
          hasOverride: newOverriddenCount > 0,
          hasConflict: unresolvedCount > 0 || m.hasConflict,
          status: computeManifestStatus(
            m,
            unresolvedCount,
            newOverriddenCount
          ),
          updatedAt: now(),
        };
      }),
    }));
  },

  verifyOverride: (manifestId, fieldKey, operator) => {
    set((state) => ({
      overrideHistory: state.overrideHistory.map((o) =>
        o.manifestId === manifestId && o.fieldKey === fieldKey
          ? { ...o, wasOverridden: false, isProtected: false }
          : o
      ),
    }));

    const s2 = get();
    const remaining = s2
      .getOverriddenFieldsByManifestId(manifestId)
      .filter((o) => o.fieldKey !== fieldKey).length;
    const manifest = s2.getManifestById(manifestId);
    if (!manifest) return;

    set((s) => {
      const unresolvedCount = s
        .getUnresolvedConflictsByManifestId(manifestId)
        .length;
      const nextStep =
        remaining === 0 && unresolvedCount === 0 && manifest.stepProgress < 3
          ? (manifest.stepProgress === 2
              ? 3
              : manifest.stepProgress)
          : manifest.stepProgress;
      return {
        manifests: s.manifests.map((m) =>
          m.id === manifestId
            ? {
                ...m,
                hasOverride: remaining > 0,
                hasConflict: unresolvedCount > 0,
                stepProgress: nextStep as 0 | 1 | 2 | 3,
                status: computeManifestStatus(
                  { ...m, stepProgress: nextStep as 0 | 1 | 2 | 3 },
                  unresolvedCount,
                  remaining
                ),
                updatedAt: now(),
              }
            : m
        ),
      };
    });
  },

  runSingleSelfCheck: (type) => {
    const state = get();
    const result: SelfCheckResult = {
      type,
      label: selfCheckLabels[type],
      passed: true,
      totalCount: 0,
      failedCount: 0,
      failedItems: [],
      checkedAt: now(),
    };

    switch (type) {
      case 'duplicate_import': {
        result.totalCount = state.knowledgeReferences.length;
        const seen = new Map<string, number>();
        state.knowledgeReferences.forEach((k) => {
          const key = `${k.manifestId}-${k.url}`;
          seen.set(key, (seen.get(key) || 0) + 1);
        });
        seen.forEach((count, key) => {
          if (count > 1) {
            const [manifestId] = key.split('-');
            const manifest = state.getManifestById(manifestId);
            result.failedItems.push({
              manifestId,
              manifestNo: manifest?.manifestNo || '未知',
              reason: `同一知识库链接被导入 ${count} 次`,
            });
          }
        });
        result.failedCount = result.failedItems.length;
        result.passed = result.failedCount === 0;
        break;
      }
      case 'override_detection': {
        result.totalCount = state.overrideHistory.length;
        const overridden = state.overrideHistory.filter((o) => o.wasOverridden);
        overridden.forEach((o) => {
          const manifest = state.getManifestById(o.manifestId);
          result.failedItems.push({
            manifestId: o.manifestId,
            manifestNo: manifest?.manifestNo || '未知',
            reason: `字段[${o.fieldLabel}]人工改判被批跑覆盖，批跑号: ${o.overriddenByBatch}`,
          });
        });
        result.failedCount = result.failedItems.length;
        result.passed = result.failedCount === 0;
        break;
      }
      case 'recalculation': {
        result.totalCount = state.manifests.length;
        state.manifests.forEach((m) => {
          m.supplementFields.forEach((f) => {
            if (f.value.trim() !== f.value) {
              result.failedItems.push({
                manifestId: m.id,
                manifestNo: m.manifestNo,
                reason: `字段[${f.label}]补录值前后空格不一致`,
              });
            }
          });
          const unresolved = state.getUnresolvedConflictsByManifestId(m.id).length;
          if ((unresolved > 0) !== !!m.hasConflict) {
            result.failedItems.push({
              manifestId: m.id,
              manifestNo: m.manifestNo,
              reason: `舱单hasConflict标记与实际未决冲突数不一致`,
            });
          }
        });
        result.failedCount = result.failedItems.length;
        result.passed = result.failedCount === 0;
        break;
      }
      case 'export_consistency': {
        result.totalCount = state.manifests.length;
        const exportData = state.getExportData() as {
          manifests: Array<{
            id: string;
            manifestNo: string;
            unresolvedConflictCount: number;
            overriddenFieldCount: number;
            hasConflict: boolean;
            hasOverride: boolean;
          }>;
        };
        state.manifests.forEach((m, i) => {
          const e = exportData.manifests[i];
          if (!e) return;
          const pageUnresolved = state
            .getUnresolvedConflictsByManifestId(m.id)
            .length;
          const pageOverridden = state
            .getOverriddenFieldsByManifestId(m.id)
            .length;
          if (e.unresolvedConflictCount !== pageUnresolved) {
            result.failedItems.push({
              manifestId: m.id,
              manifestNo: m.manifestNo,
              reason: `未决冲突数不一致(页面:${pageUnresolved} vs 导出:${e.unresolvedConflictCount})`,
            });
          }
          if (e.overriddenFieldCount !== pageOverridden) {
            result.failedItems.push({
              manifestId: m.id,
              manifestNo: m.manifestNo,
              reason: `覆盖字段数不一致(页面:${pageOverridden} vs 导出:${e.overriddenFieldCount})`,
            });
          }
          if (e.hasConflict !== (pageUnresolved > 0)) {
            result.failedItems.push({
              manifestId: m.id,
              manifestNo: m.manifestNo,
              reason: `hasConflict标记不一致`,
            });
          }
          if (e.hasOverride !== (pageOverridden > 0)) {
            result.failedItems.push({
              manifestId: m.id,
              manifestNo: m.manifestNo,
              reason: `hasOverride标记不一致`,
            });
          }
        });
        result.failedCount = result.failedItems.length;
        result.passed = result.failedCount === 0;
        break;
      }
    }

    return result;
  },

  runSelfCheck: () => {
    const types: SelfCheckType[] = [
      'duplicate_import',
      'override_detection',
      'recalculation',
      'export_consistency',
    ];
    const results = types.map((t) => get().runSingleSelfCheck(t));
    set({ selfCheckResults: results });
  },

  getExportData: () => {
    const state = get();
    return {
      exportedAt: now(),
      dataSourceNote:
        '页面展示、接口返回、导出明细 均读取同一份Store状态',
      manifests: state.manifests.map((m) => {
        const unresolved = state.getUnresolvedConflictsByManifestId(m.id);
        const overridden = state.getOverriddenFieldsByManifestId(m.id);
        const resolved = state.getResolvedConflictsByManifestId(m.id);
        return {
          id: m.id,
          manifestNo: m.manifestNo,
          status: m.status,
          stepProgress: m.stepProgress,
          hasConflict: unresolved.length > 0,
          hasOverride: overridden.length > 0,
          unresolvedConflictCount: unresolved.length,
          overriddenFieldCount: overridden.length,
          resolvedConflictCount: resolved.length,
          fieldCount: m.supplementFields.length || m.ocrFields.length,
          fields: m.supplementFields.length > 0
            ? m.supplementFields
            : m.ocrFields,
          overriddenFields: overridden.map((o) => ({
            fieldKey: o.fieldKey,
            fieldLabel: o.fieldLabel,
            batchId: o.overriddenByBatch,
            operator: o.operator,
            createdAt: o.createdAt,
          })),
        };
      }),
      conflicts: state.conflicts.map((c) => ({
          ...c,
          conflictStatusLabel: conflictStatusLabels[c.status],
          isUnresolved: isUnresolved(c.status),
        })),
      overrideHistory: state.overrideHistory.map((o) => ({
          ...o,
          overrideStatusLabel: o.wasOverridden ? '已被批跑覆盖' : o.isProtected ? '受保护改判' : '普通改判',
        })),
      knowledgeReferences: state.knowledgeReferences,
      feedbackTickets: state.feedbackTickets,
    };
  },

  exportData: () => {
    const data = get().getExportData();
    return JSON.stringify(data, null, 2);
  },
}));

export { conflictStatusLabels, isUnresolved, isResolved };
