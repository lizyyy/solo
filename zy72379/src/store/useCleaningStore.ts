import { create } from 'zustand';
import type {
  StoreType,
  PhotoEvidence,
  NoteEvidence,
  UnitConversion,
  ConflictResolutionStatus,
  ThresholdReviewStatus,
  EvidenceChainNode,
  OperationType,
} from '@/types';
import {
  mockRecords,
  mockPhotoEvidences,
  mockNoteEvidences,
  mockUnitConversions,
  mockConflicts,
  mockThresholdAlerts,
  mockEvidenceChain,
} from '@/data/mockRecords';
import { caliberHistory } from '@/data/caliberHistory';

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error('Failed to save to localStorage');
  }
};

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createChainNode = (
  recordId: string,
  operationType: OperationType,
  description: string,
  operator: string,
  evidenceRefs: string[] = []
): Omit<EvidenceChainNode, 'id'> => ({
  recordId,
  operationType,
  description,
  operator,
  operateTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
  evidenceRefs,
});

export const useCleaningStore = create<StoreType>((set, get) => ({
  records: loadFromStorage('strain_records', mockRecords),
  photoEvidences: loadFromStorage('photo_evidences', mockPhotoEvidences),
  noteEvidences: loadFromStorage('note_evidences', mockNoteEvidences),
  unitConversions: loadFromStorage('unit_conversions', mockUnitConversions),
  conflicts: loadFromStorage('conflicts', mockConflicts),
  thresholdAlerts: loadFromStorage('threshold_alerts', mockThresholdAlerts),
  evidenceChain: loadFromStorage('evidence_chain', mockEvidenceChain),
  caliberHistory: caliberHistory,
  workflowStep: 3,
  selectedRecordId: null,

  setSelectedRecord: (id: string | null) => {
    set({ selectedRecordId: id });
  },

  setWorkflowStep: (step: number) => {
    set({ workflowStep: step });
  },

  addPhotoEvidence: (evidence: Omit<PhotoEvidence, 'id'>) => {
    const newEvidence: PhotoEvidence = {
      ...evidence,
      id: generateId('PHOTO'),
    };
    const chainNode = createChainNode(
      evidence.recordId,
      'import_photo',
      `导入工况照片，提取数值${evidence.extractedValue}${evidence.extractedUnit}`,
      '系统',
      [newEvidence.id]
    );

    set(state => {
      const newPhotoEvidences = [...state.photoEvidences, newEvidence];
      const newChain = [...state.evidenceChain, { ...chainNode, id: generateId('CHAIN') }];
      const newRecords = state.records.map(r => {
        if (r.id === evidence.recordId && !r.evidenceSources.includes('photo')) {
          return {
            ...r,
            evidenceSources: [...r.evidenceSources, 'photo' as const],
            updateTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
          };
        }
        return r;
      });

      saveToStorage('photo_evidences', newPhotoEvidences);
      saveToStorage('evidence_chain', newChain);
      saveToStorage('strain_records', newRecords);

      return {
        photoEvidences: newPhotoEvidences,
        evidenceChain: newChain,
        records: newRecords,
      };
    });
  },

  addNoteEvidence: (evidence: Omit<NoteEvidence, 'id'>) => {
    const newEvidence: NoteEvidence = {
      ...evidence,
      id: generateId('NOTE'),
    };
    const chainNode = createChainNode(
      evidence.recordId,
      'review_note',
      `${evidence.inspectorName}审阅巡检备注，记录数值${evidence.notedValue}${evidence.notedUnit}`,
      evidence.inspectorName,
      [newEvidence.id]
    );

    set(state => {
      const newNoteEvidences = [...state.noteEvidences, newEvidence];
      const newChain = [...state.evidenceChain, { ...chainNode, id: generateId('CHAIN') }];
      const newRecords = state.records.map(r => {
        if (r.id === evidence.recordId) {
          const sources = r.evidenceSources.includes('note') ? r.evidenceSources : [...r.evidenceSources, 'note' as const];
          return {
            ...r,
            evidenceSources: sources,
            updateTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
          };
        }
        return r;
      });

      saveToStorage('note_evidences', newNoteEvidences);
      saveToStorage('evidence_chain', newChain);
      saveToStorage('strain_records', newRecords);

      return {
        noteEvidences: newNoteEvidences,
        evidenceChain: newChain,
        records: newRecords,
      };
    });
  },

  resolveConflict: (
    conflictId: string,
    status: ConflictResolutionStatus,
    resolvedBy: string,
    note?: string
  ) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const statusDescriptions: Record<ConflictResolutionStatus, string> = {
      pending: '待裁决',
      accept_photo: '采信工况照片证据',
      accept_note: '采信手写备注证据',
      rejected: '驳回待重审',
    };

    set(state => {
      const newConflicts = state.conflicts.map(c =>
        c.id === conflictId
          ? { ...c, resolutionStatus: status, resolvedBy, resolutionTime: now, resolutionNote: note }
          : c
      );

      const conflict = state.conflicts.find(c => c.id === conflictId);
      if (!conflict) return { conflicts: newConflicts };

      const chainNode = createChainNode(
        conflict.recordId,
        'conflict_resolution',
        `${resolvedBy}裁决冲突：${statusDescriptions[status]}${note ? ` - ${note}` : ''}`,
        resolvedBy,
        [conflictId]
      );
      const newChain = [...state.evidenceChain, { ...chainNode, id: generateId('CHAIN') }];

      let newRecords = state.records;
      if (status !== 'pending' && status !== 'rejected') {
        newRecords = state.records.map(r => {
          if (r.id === conflict.recordId) {
            return { ...r, recordStatus: 'normal' as const, updateTime: now };
          }
          return r;
        });
      }

      saveToStorage('conflicts', newConflicts);
      saveToStorage('evidence_chain', newChain);
      saveToStorage('strain_records', newRecords);

      return {
        conflicts: newConflicts,
        evidenceChain: newChain,
        records: newRecords,
      };
    });
  },

  reviewThresholdAlert: (
    alertId: string,
    status: ThresholdReviewStatus,
    reviewedBy: string,
    comment?: string
  ) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const statusDescriptions: Record<ThresholdReviewStatus, string> = {
      pending_review: '待复核',
      confirmed: '确认正常，数据可用',
      needs_recalibration: '设备需要校准',
      rejected: '数据作废，不可使用',
    };

    set(state => {
      const newAlerts = state.thresholdAlerts.map(a =>
        a.id === alertId
          ? { ...a, reviewStatus: status, reviewedBy, reviewComment: comment, reviewTime: now }
          : a
      );

      const alert = state.thresholdAlerts.find(a => a.id === alertId);
      if (!alert) return { thresholdAlerts: newAlerts };

      const chainNode = createChainNode(
        alert.recordId,
        'threshold_review',
        `${reviewedBy}复核超阈值记录：${statusDescriptions[status]}${comment ? ` - ${comment}` : ''}`,
        reviewedBy,
        [alertId]
      );
      const newChain = [...state.evidenceChain, { ...chainNode, id: generateId('CHAIN') }];

      let newRecords = state.records;
      if (status !== 'pending_review') {
        newRecords = state.records.map(r => {
          if (r.id === alert.recordId) {
            const newStatus = status === 'confirmed' ? 'normal' as const :
                            status === 'needs_recalibration' ? 'pending_review' as const :
                            'over_threshold' as const;
            return { ...r, recordStatus: newStatus, updateTime: now };
          }
          return r;
        });
      }

      saveToStorage('threshold_alerts', newAlerts);
      saveToStorage('evidence_chain', newChain);
      saveToStorage('strain_records', newRecords);

      return {
        thresholdAlerts: newAlerts,
        evidenceChain: newChain,
        records: newRecords,
      };
    });
  },

  updateRecordCaliber: (recordId: string, conversion: UnitConversion) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const chainNode = createChainNode(
      recordId,
      'unit_conversion',
      `更新单位换算口径：${conversion.description}，使用版本${conversion.caliberVersion}`,
      '系统',
      [conversion.id]
    );

    set(state => {
      const newConversions = [...state.unitConversions, conversion];
      const newChain = [...state.evidenceChain, { ...chainNode, id: generateId('CHAIN') }];
      const newRecords = state.records.map(r => {
        if (r.id === recordId) {
          return {
            ...r,
            cleanedValue: r.originalValue * conversion.conversionFactor,
            cleanedUnit: conversion.toUnit,
            caliberSource: `${conversion.caliberVersion} (${conversion.effectiveDate})`,
            updateTime: now,
          };
        }
        return r;
      });

      saveToStorage('unit_conversions', newConversions);
      saveToStorage('evidence_chain', newChain);
      saveToStorage('strain_records', newRecords);

      return {
        unitConversions: newConversions,
        evidenceChain: newChain,
        records: newRecords,
      };
    });

    if (get().workflowStep < 3) {
      get().setWorkflowStep(3);
    }
  },

  addEvidenceChainNode: (node: Omit<EvidenceChainNode, 'id'>) => {
    const newNode: EvidenceChainNode = {
      ...node,
      id: generateId('CHAIN'),
    };
    set(state => {
      const newChain = [...state.evidenceChain, newNode];
      saveToStorage('evidence_chain', newChain);
      return { evidenceChain: newChain };
    });
  },

  resetAllData: () => {
    saveToStorage('strain_records', mockRecords);
    saveToStorage('photo_evidences', mockPhotoEvidences);
    saveToStorage('note_evidences', mockNoteEvidences);
    saveToStorage('unit_conversions', mockUnitConversions);
    saveToStorage('conflicts', mockConflicts);
    saveToStorage('threshold_alerts', mockThresholdAlerts);
    saveToStorage('evidence_chain', mockEvidenceChain);

    set({
      records: mockRecords,
      photoEvidences: mockPhotoEvidences,
      noteEvidences: mockNoteEvidences,
      unitConversions: mockUnitConversions,
      conflicts: mockConflicts,
      thresholdAlerts: mockThresholdAlerts,
      evidenceChain: mockEvidenceChain,
      workflowStep: 3,
      selectedRecordId: null,
    });
  },
}));
