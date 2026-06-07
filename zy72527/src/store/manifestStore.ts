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
} from '../types';
import {
  mockManifests,
  mockKnowledgeReferences,
  mockFeedbackTickets,
  mockConflicts,
  mockOverrideHistory,
} from '../data/mockData';

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
  getConflictsByManifestId: (id: string) => ConflictRecord[];
  getOverrideHistoryByManifestId: (id: string) => OverrideHistory[];

  setSelectedManifestId: (id: string | null) => void;
  setActiveConflictId: (id: string | null) => void;

  importKnowledgeBase: (manifestId: string, url: string, title: string, extractedFields: Record<string, string>) => void;
  resolveConflict: (conflictId: string, status: ConflictStatus, reason: string) => void;
  manualOverrideField: (manifestId: string, fieldKey: string, newValue: string, operator: string) => void;
  simulateBatchRun: () => void;
  verifyOverride: (manifestId: string, fieldKey: string, operator: string) => void;

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
  getKnowledgeByManifestId: (id) => get().knowledgeReferences.filter((k) => k.manifestId === id),
  getTicketsByManifestId: (id) => get().feedbackTickets.filter((t) => t.manifestId === id),
  getConflictsByManifestId: (id) => get().conflicts.filter((c) => c.manifestId === id && c.status === 'pending'),
  getOverrideHistoryByManifestId: (id) => get().overrideHistory.filter((o) => o.manifestId === id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

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
      });
    });

    const hasConflict = newConflicts.length > 0;

    set((state) => ({
      knowledgeReferences: [...state.knowledgeReferences, newKnowledge],
      conflicts: [...state.conflicts, ...newConflicts],
      manifests: state.manifests.map((m) =>
        m.id === manifestId
          ? {
              ...m,
              supplementFields: newSupplementFields,
              stepProgress: (m.stepProgress < 1 ? 1 : m.stepProgress) as 0 | 1 | 2 | 3,
              hasConflict,
              status: hasConflict ? 'conflict' : (m.stepProgress >= 2 ? 'completed' : 'processing'),
              updatedAt: now(),
            }
          : m
      ),
    }));
  },

  resolveConflict: (conflictId, status, reason) => {
    const state = get();
    const conflict = state.conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, status, decidedBy: '阿宁', decidedAt: now(), decisionReason: reason }
          : c
      ),
    }));

    const state2 = get();
    const remainingConflicts = state2.getConflictsByManifestId(conflict.manifestId);
    const manifest = state2.getManifestById(conflict.manifestId);
    if (!manifest) return;

    let newSupplementFields = [...manifest.supplementFields];
    if (status === 'confirmed_knowledge' || status === 'confirmed_ticket') {
      const newValue = status === 'confirmed_knowledge' ? conflict.knowledgeValue : conflict.ticketValue;
      const newSource = status === 'confirmed_knowledge' ? 'knowledge_base' : 'ticket';
      const existingIdx = newSupplementFields.findIndex((f) => f.key === conflict.fieldKey);
      const ocrField = manifest.ocrFields.find((f) => f.key === conflict.fieldKey);
      const resolvedField: ManifestField = {
        key: conflict.fieldKey,
        label: ocrField?.label || conflict.fieldKey,
        value: newValue,
        confidence: 0.95,
        source: newSource,
        paramVersion: newSource === 'knowledge_base' ? 'kb-v2.3.1' : undefined,
        updatedAt: now(),
        operator: '阿宁',
      };
      if (existingIdx >= 0) {
        newSupplementFields[existingIdx] = resolvedField;
      } else {
        newSupplementFields.push(resolvedField);
      }
    }

    set((state) => ({
      manifests: state.manifests.map((m) =>
        m.id === conflict.manifestId
          ? {
              ...m,
              supplementFields: newSupplementFields,
              hasConflict: remainingConflicts.length > 0,
              stepProgress: (m.stepProgress < 2 ? 2 : m.stepProgress) as 0 | 1 | 2 | 3,
              status: remainingConflicts.length > 0 ? 'conflict' : (m.hasOverride ? 'overridden' : 'completed'),
              updatedAt: now(),
            }
          : m
      ),
    }));
  },

  manualOverrideField: (manifestId, fieldKey, newValue, operator) => {
    const state = get();
    const manifest = state.getManifestById(manifestId);
    if (!manifest) return;

    const existingField = manifest.supplementFields.find((f) => f.key === fieldKey) || manifest.ocrFields.find((f) => f.key === fieldKey);
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
      updatedAt: now(),
      operator,
    };
    if (idx >= 0) {
      newSupplementFields[idx] = newField;
    } else {
      newSupplementFields.push(newField);
    }

    set((state) => ({
      overrideHistory: [...state.overrideHistory, history],
      manifests: state.manifests.map((m) =>
        m.id === manifestId
          ? { ...m, supplementFields: newSupplementFields, updatedAt: now() }
          : m
      ),
    }));
  },

  simulateBatchRun: () => {
    const state = get();
    const protectedOverrides = state.overrideHistory.filter((o) => o.isProtected && !o.wasOverridden);

    const updatedOverrides = state.overrideHistory.map((o) =>
      o.isProtected && !o.wasOverridden
        ? { ...o, wasOverridden: true, overriddenByBatch: 'BATCH-' + Date.now().toString().slice(-8) }
        : o
    );

    const affectedManifestIds = [...new Set(protectedOverrides.map((o) => o.manifestId))];

    set((state) => ({
      overrideHistory: updatedOverrides,
      manifests: state.manifests.map((m) =>
        affectedManifestIds.includes(m.id)
          ? { ...m, hasOverride: true, status: 'overridden', updatedAt: now() }
          : m
      ),
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

    const state2 = get();
    const remaining = state2.overrideHistory.filter((o) => o.manifestId === manifestId && o.wasOverridden);

    set((state) => ({
      manifests: state.manifests.map((m) =>
        m.id === manifestId
          ? {
              ...m,
              hasOverride: remaining.length > 0,
              status: remaining.length > 0 ? 'overridden' : (m.hasConflict ? 'conflict' : 'verified'),
              updatedAt: now(),
            }
          : m
      ),
    }));
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
        });
        result.failedCount = result.failedItems.length;
        result.passed = result.failedCount === 0;
        break;
      }
      case 'export_consistency': {
        result.totalCount = state.manifests.length;
        const exportData = state.getExportData();
        const pageData = state.manifests.map((m) => ({
          id: m.id,
          manifestNo: m.manifestNo,
          fieldCount: m.supplementFields.length || m.ocrFields.length,
        }));
        const exportPageData = (exportData as { manifests: { id: string; manifestNo: string; fieldCount: number }[] }).manifests.map((m) => ({
          id: m.id,
          manifestNo: m.manifestNo,
          fieldCount: m.fieldCount,
        }));
        const inconsistent = pageData.filter((p, i) => {
          const e = exportPageData[i];
          return !e || p.fieldCount !== e.fieldCount;
        });
        inconsistent.forEach((item) => {
          result.failedItems.push({
            manifestId: item.id,
            manifestNo: item.manifestNo,
            reason: '页面字段数与导出字段数不一致',
          });
        });
        result.failedCount = result.failedItems.length;
        result.passed = result.failedCount === 0;
        break;
      }
    }

    return result;
  },

  runSelfCheck: () => {
    const types: SelfCheckType[] = ['duplicate_import', 'override_detection', 'recalculation', 'export_consistency'];
    const results = types.map((t) => get().runSingleSelfCheck(t));
    set({ selfCheckResults: results });
  },

  getExportData: () => {
    const state = get();
    return {
      exportedAt: now(),
      manifests: state.manifests.map((m) => ({
        id: m.id,
        manifestNo: m.manifestNo,
        status: m.status,
        hasConflict: m.hasConflict,
        hasOverride: m.hasOverride,
        fieldCount: m.supplementFields.length || m.ocrFields.length,
        fields: m.supplementFields.length > 0 ? m.supplementFields : m.ocrFields,
      })),
      conflicts: state.conflicts,
      overrideHistory: state.overrideHistory,
    };
  },

  exportData: () => {
    const data = get().getExportData();
    return JSON.stringify(data, null, 2);
  },
}));
