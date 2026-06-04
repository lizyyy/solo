import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppState,
  UserRole,
  RecordData,
  ConflictData,
  ProcessStep,
  ProcessStatus,
  ConflictStatus,
  UnitConversion,
} from '../types';
import {
  mockRecords,
  mockThresholdTable,
  mockNameplateParams,
  mockConflicts,
  mockUnitConversion,
  mockProcessState,
  roleLabels,
} from '../data/mockData';

interface AppActions {
  setCurrentRole: (role: UserRole) => void;
  setSelectedRecordId: (id: string | null) => void;
  advanceProcessStep: () => void;
  setStepStatus: (step: ProcessStep, status: ProcessStatus) => void;
  markNameplateReviewed: () => void;
  markConversionUpdated: () => void;
  resolveConflict: (
    conflictId: string,
    decision: 'confirm' | 'reject',
    reason: string
  ) => void;
  reviewRecord: (
    recordId: string,
    approved: boolean,
    note: string
  ) => void;
  updateUnitConversionTradeOff: (
    parameterSource: 'threshold' | 'nameplate',
    parameterSourceLabel: string,
    tradeOffReason: string
  ) => void;
  resetDemo: () => void;
}

const initialState: AppState = {
  currentRole: 'analyst',
  records: mockRecords,
  thresholdTable: mockThresholdTable,
  nameplateParams: mockNameplateParams,
  conflicts: mockConflicts,
  unitConversion: mockUnitConversion,
  processState: mockProcessState,
  selectedRecordId: null,
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentRole: (role) => set({ currentRole: role }),

      setSelectedRecordId: (id) => set({ selectedRecordId: id }),

      advanceProcessStep: () => {
        const { processState } = get();
        const stepsOrder: ProcessStep[] = [
          'threshold_import',
          'nameplate_review',
          'conversion_update',
        ];
        const currentIndex = stepsOrder.indexOf(processState.currentStep);
        if (currentIndex < stepsOrder.length - 1) {
          const nextStep = stepsOrder[currentIndex + 1];
          set({
            processState: {
              ...processState,
              currentStep: nextStep,
              steps: {
                ...processState.steps,
                [processState.currentStep]: 'completed' as ProcessStatus,
                [nextStep]: 'in_progress' as ProcessStatus,
              },
            },
          });
        }
      },

      setStepStatus: (step, status) => {
        const { processState } = get();
        set({
          processState: {
            ...processState,
            steps: {
              ...processState.steps,
              [step]: status,
            },
          },
        });
      },

      markNameplateReviewed: () => {
        const { processState } = get();
        set({
          processState: {
            ...processState,
            nameplateReviewedByHe: true,
          },
        });
        get().advanceProcessStep();
      },

      markConversionUpdated: () => {
        const { processState } = get();
        set({
          processState: {
            ...processState,
            conversionUpdated: true,
            steps: {
              ...processState.steps,
              conversion_update: 'completed' as ProcessStatus,
            },
          },
        });
      },

      resolveConflict: (conflictId, decision, reason) => {
        const { conflicts, unitConversion } = get();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const updatedConflicts = conflicts.map((c) => {
          if (c.id === conflictId) {
            return {
              ...c,
              status: (decision === 'confirm' ? 'confirmed' : 'rejected') as ConflictStatus,
              decision: {
                id: `DEC-${Date.now()}`,
                conflictId,
                decision,
                reason,
                operator: roleLabels.engineer,
                decisionTime: now,
              },
            };
          }
          return c;
        }) as ConflictData[];

        const newVersion: UnitConversion['historyVersions'][0] = {
          version: `v${parseInt(unitConversion.parameterVersion.slice(1)) + 0.1}`,
          formula: unitConversion.formula,
          parameterSource:
            decision === 'confirm'
              ? '安全阈值表 v1.3'
              : '设备铭牌 #EQ-2024-001',
          updateTime: now,
          reason: `何工${decision === 'confirm' ? '确认' : '驳回'}阈值冲突：${reason}`,
        };

        const updatedConversion: UnitConversion = {
          ...unitConversion,
          parameterSource: decision === 'confirm' ? 'threshold' : 'nameplate',
          parameterSourceLabel:
            decision === 'confirm'
              ? '安全阈值表 v1.3'
              : '设备铭牌 #EQ-2024-001',
          parameterVersion: newVersion.version,
          tradeOffReason: `何工于 ${now} ${decision === 'confirm' ? '确认' : '驳回'}阈值冲突，决策理由：${reason}`,
          updateTime: now,
          updatedBy: roleLabels.engineer,
          historyVersions: [newVersion, ...unitConversion.historyVersions],
        };

        set({
          conflicts: updatedConflicts,
          unitConversion: updatedConversion,
        });

        const updatedRecords = get().records.map((r) => {
          if (r.type === 'supplemented') {
            return {
              ...r,
              calculationNote: {
                ...r.calculationNote,
                parameterVersion: newVersion.version,
                tradeOffReason:
                  decision === 'confirm'
                    ? `使用阈值表 v1.3 参数，何工于 ${now} 确认。原始测量口径缺失，从设备铭牌 RDS-200 #EQ-2024-001 补录旧口径 0.3mm。`
                    : `使用铭牌参数 v1.0，何工于 ${now} 驳回阈值表 v1.3。原始测量口径缺失，从设备铭牌 RDS-200 #EQ-2024-001 补录旧口径 0.3mm。`,
              },
            };
          }
          if (r.type === 'overwritten') {
            return {
              ...r,
              thresholdMax: decision === 'confirm' ? 6.0 : 5.5,
              calculationNote: {
                ...r.calculationNote,
                parameterVersion: newVersion.version,
                tradeOffReason:
                  decision === 'confirm'
                    ? `测量值 7.8 m/s > 阈值 6.0 m/s，但被平均值 4.5 掩盖。使用阈值表 v1.3 参数，何工于 ${now} 确认。**不归正常**，留待维修师傅复核。`
                    : `测量值 7.8 m/s > 阈值 5.5 m/s，但被平均值 4.5 掩盖。使用铭牌参数 v1.0，何工于 ${now} 驳回阈值表 v1.3。**不归正常**，留待维修师傅复核。`,
              },
            };
          }
          return {
            ...r,
            calculationNote: {
              ...r.calculationNote,
              parameterVersion: newVersion.version,
              tradeOffReason:
                decision === 'confirm'
                  ? `使用阈值表 v1.3 参数，何工于 ${now} 确认。测量值 4.2 < 阈值 6.0，正常。`
                  : `使用铭牌参数 v1.0，何工于 ${now} 驳回阈值表 v1.3。测量值 4.2 < 阈值 5.5，正常。`,
            },
          };
        }) as RecordData[];

        set({ records: updatedRecords });
        get().markNameplateReviewed();
      },

      reviewRecord: (recordId, approved, note) => {
        const { records } = get();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const updatedRecords = records.map((r) => {
          if (r.id === recordId && r.status === 'pending_review') {
            const newStatus: 'reviewed' | 'rejected' = approved ? 'reviewed' : 'rejected';
            return {
              ...r,
              status: newStatus,
              reviewNote: note,
              reviewedBy: roleLabels.technician,
              reviewedAt: now,
              processLogs: [
                ...r.processLogs,
                {
                  id: `LOG-${Date.now()}`,
                  recordId,
                  step: 'conversion_update',
                  operator: roleLabels.technician,
                  action: `维修师傅复核：${approved ? '通过' : '驳回'}。备注：${note}`,
                  timestamp: now,
                },
              ],
            };
          }
          return r;
        }) as RecordData[];

        set({ records: updatedRecords });
      },

      updateUnitConversionTradeOff: (
        parameterSource,
        parameterSourceLabel,
        tradeOffReason
      ) => {
        const { unitConversion } = get();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        set({
          unitConversion: {
            ...unitConversion,
            parameterSource,
            parameterSourceLabel,
            tradeOffReason,
            updateTime: now,
          },
        });
      },

      resetDemo: () => {
        set({ ...initialState });
      },
    }),
    {
      name: 'raindrop-demo-storage',
      partialize: (state) => ({
        currentRole: state.currentRole,
        records: state.records,
        conflicts: state.conflicts,
        unitConversion: state.unitConversion,
        processState: state.processState,
        selectedRecordId: state.selectedRecordId,
      }),
    }
  )
);
