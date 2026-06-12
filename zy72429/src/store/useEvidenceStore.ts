import { create } from 'zustand';
import type {
  EvidencePack,
  TrackAlias,
  VerificationOrder,
  OperationLog,
  ConflictItem,
  Operator,
  EvidenceStatus,
} from '../types';
import {
  evidencePacks as initialPacks,
  trackAliases as initialAliases,
  verificationOrders as initialOrders,
  operationLogs as initialLogs,
  conflictItems as initialConflicts,
} from '../data/mockData';

interface EvidenceState {
  evidencePacks: EvidencePack[];
  trackAliases: TrackAlias[];
  verificationOrders: VerificationOrder[];
  operationLogs: OperationLog[];
  conflictItems: ConflictItem[];
  currentRole: Operator;
  setCurrentRole: (role: Operator) => void;
  getEvidenceById: (id: string) => EvidencePack | undefined;
  getLogsByEvidenceId: (id: string) => OperationLog[];
  getConflictsByEvidenceId: (id: string) => ConflictItem[];
  getTrackAliasById: (id?: string) => TrackAlias | undefined;
  getVerificationOrderById: (id?: string) => VerificationOrder | undefined;
  addOperationLog: (
    evidencePackId: string,
    operator: Operator,
    action: string,
    detail: string
  ) => void;
  updateEvidenceStatus: (id: string, status: EvidenceStatus) => void;
  updateEvidenceStep: (id: string, step: number) => void;
  resolveConflict: (
    conflictId: string,
    resolution: 'confirm' | 'reject'
  ) => void;
  managerReview: (evidenceId: string, approved: boolean) => void;
  confirmVerificationOrder: (evidenceId: string, sourceNote: string) => void;
}

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  evidencePacks: initialPacks,
  trackAliases: initialAliases,
  verificationOrders: initialOrders,
  operationLogs: initialLogs,
  conflictItems: initialConflicts,
  currentRole: '阿梅',

  setCurrentRole: (role) => set({ currentRole: role }),

  getEvidenceById: (id) => {
    return get().evidencePacks.find((p) => p.id === id);
  },

  getLogsByEvidenceId: (id) => {
    return get()
      .operationLogs.filter((log) => log.evidencePackId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  getConflictsByEvidenceId: (id) => {
    return get().conflictItems.filter((c) => c.evidencePackId === id);
  },

  getTrackAliasById: (id) => {
    if (!id) return undefined;
    return get().trackAliases.find((t) => t.id === id);
  },

  getVerificationOrderById: (id) => {
    if (!id) return undefined;
    return get().verificationOrders.find((v) => v.id === id);
  },

  addOperationLog: (evidencePackId, operator, action, detail) => {
    const newLog: OperationLog = {
      id: `log-${Date.now()}`,
      evidencePackId,
      operator,
      action,
      detail,
      createdAt: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    set((state) => ({
      operationLogs: [...state.operationLogs, newLog],
    }));
  },

  updateEvidenceStatus: (id, status) => {
    set((state) => ({
      evidencePacks: state.evidencePacks.map((p) =>
        p.id === id ? { ...p, status } : p
      ),
    }));
  },

  updateEvidenceStep: (id, step) => {
    set((state) => ({
      evidencePacks: state.evidencePacks.map((p) =>
        p.id === id ? { ...p, currentStep: step } : p
      ),
    }));
  },

  resolveConflict: (conflictId, resolution) => {
    const conflict = get().conflictItems.find((c) => c.id === conflictId);
    if (!conflict) return;

    if (resolution === 'confirm') {
      const evidence = get().getEvidenceById(conflict.evidencePackId);
      const trackAlias = get().getTrackAliasById(evidence?.trackAliasId);

      const changeDetail = {
        before: conflict.contractContent,
        after: conflict.aliasContent,
        reason: `${conflict.difference}；依据曲目别名表（生效日期：${trackAlias?.effectiveDate ?? '未知'}），由阿梅确认采用别名表口径`,
      };

      set((state) => ({
        conflictItems: state.conflictItems.map((c) =>
          c.id === conflictId ? { ...c, resolved: true, resolution, changeDetail } : c
        ),
        verificationOrders: state.verificationOrders.map((v) =>
          v.evidencePackId === conflict.evidencePackId && trackAlias
            ? { ...v, trackName: trackAlias.newName, sourceNote: `由合同旧名"${trackAlias.oldName}"更正为别名表标准名"${trackAlias.newName}"，${changeDetail.reason}` }
            : v
        ),
      }));

      get().addOperationLog(
        conflict.evidencePackId,
        '阿梅',
        '确认冲突处理',
        `曲目名称由"${trackAlias?.oldName ?? conflict.contractContent}"更正为"${trackAlias?.newName ?? conflict.aliasContent}"，${changeDetail.reason}`
      );
    } else {
      set((state) => ({
        conflictItems: state.conflictItems.map((c) =>
          c.id === conflictId ? { ...c, resolved: true, resolution } : c
        ),
      }));

      get().addOperationLog(
        conflict.evidencePackId,
        '阿梅',
        '驳回冲突处理',
        `驳回别名表口径，维持合同原文：${conflict.contractContent}`
      );
      get().updateEvidenceStep(conflict.evidencePackId, 1);
    }
  },

  managerReview: (evidenceId, approved) => {
    const evidence = get().getEvidenceById(evidenceId);
    if (!evidence) return;

    if (approved) {
      get().addOperationLog(
        evidenceId,
        '店长',
        '复核通过',
        `确认授权地区遗漏"${evidence.missingCity}"为合同笔误，按完整地区处理`
      );
      get().updateEvidenceStatus(evidenceId, 'processing');
      get().updateEvidenceStep(evidenceId, 2);
    } else {
      get().addOperationLog(
        evidenceId,
        '店长',
        '复核驳回',
        `授权地区确实遗漏"${evidence.missingCity}"，需重新提交合同`
      );
      get().updateEvidenceStatus(evidenceId, 'pending');
      get().updateEvidenceStep(evidenceId, 1);
    }
  },

  confirmVerificationOrder: (evidenceId, sourceNote) => {
    const evidence = get().getEvidenceById(evidenceId);
    const verificationOrder = get().getVerificationOrderById(evidence?.verificationOrderId);
    const trackAlias = get().getTrackAliasById(evidence?.trackAliasId);

    set((state) => ({
      verificationOrders: state.verificationOrders.map((v) =>
        v.evidencePackId === evidenceId
          ? { ...v, status: 'confirmed', sourceNote, updatedAt: new Date().toLocaleString('zh-CN') }
          : v
      ),
    }));

    const trackDisplay = verificationOrder
      ? verificationOrder.trackName
      : trackAlias?.newName ?? '未知';
    const logDetail = evidence?.hasConflict
      ? `核销单已确认，曲目名称：${trackDisplay}，备注：${sourceNote}`
      : `核销单已确认，曲目名称：${trackDisplay}，备注：${sourceNote}`;

    get().addOperationLog(
      evidenceId,
      '阿梅',
      '更新课时核销单',
      logDetail
    );
    get().updateEvidenceStatus(evidenceId, 'completed');
    get().updateEvidenceStep(evidenceId, 3);
  },
}));
