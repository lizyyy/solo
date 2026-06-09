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
  confirmThresholdImported: () => void;
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

      confirmThresholdImported: () => {
        const { processState, records } = get();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const updatedRecords = records.map((r) => {
          const baseLog = {
            id: `LOG-${Date.now()}-${r.id}`,
            recordId: r.id,
            step: 'threshold_import' as ProcessStep,
            operator: roleLabels.analyst,
            timestamp: now,
          };
          if (r.type === 'smooth') {
            return {
              ...r,
              processLogs: [
                ...r.processLogs,
                {
                  ...baseLog,
                  action: '第一步确认：顺利记录，测量值在阈值范围且口径匹配，流程推进至何工补看铭牌。',
                },
              ],
            };
          }
          if (r.type === 'overwritten') {
            return {
              ...r,
              processLogs: [
                ...r.processLogs,
                {
                  ...baseLog,
                  action: '第一步确认：超阈值被平均值盖掉，**暂不归正常**，已挂起待后续：何工补看铭牌 → 维修师傅复核 → 单位换算更新。',
                },
              ],
            };
          }
          return {
            ...r,
            processLogs: [
              ...r.processLogs,
              {
                ...baseLog,
                action: '第一步确认：测量口径缺失，需留待第二步何工补看设备铭牌参数后补录旧口径。',
              },
            ],
          };
        }) as RecordData[];

        set({
          records: updatedRecords,
          processState: {
            ...processState,
            thresholdImported: true,
          },
        });
        get().advanceProcessStep();
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
        const { processState, records, unitConversion } = get();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const updatedRecords = records.map((r) => {
          const baseLog = {
            id: `LOG-CU-${Date.now()}-${r.id}`,
            recordId: r.id,
            step: 'conversion_update' as ProcessStep,
            operator: roleLabels.analyst,
            timestamp: now,
          };
          if (r.type === 'smooth') {
            return {
              ...r,
              calculationNote: {
                ...r.calculationNote,
                parameterVersion: unitConversion.parameterVersion,
                tradeOffReason: `${r.calculationNote.tradeOffReason} 单位换算说明于 ${now} 更新，参数版本同步为 ${unitConversion.parameterVersion}。`,
              },
              processLogs: [
                ...r.processLogs,
                {
                  ...baseLog,
                  action: `第三步：单位换算说明更新完成。参数版本 ${unitConversion.parameterVersion}，来源：${unitConversion.parameterSourceLabel}。顺利记录确认正常归档。`,
                },
              ],
            };
          }
          if (r.type === 'overwritten') {
            return {
              ...r,
              calculationNote: {
                ...r.calculationNote,
                parameterVersion: unitConversion.parameterVersion,
                tradeOffReason: `${r.calculationNote.tradeOffReason} 单位换算说明于 ${now} 更新，参数版本同步为 ${unitConversion.parameterVersion}。`,
              },
              processLogs: [
                ...r.processLogs,
                {
                  ...baseLog,
                  action: `第三步：单位换算说明更新完成。参数版本 ${unitConversion.parameterVersion}，来源：${unitConversion.parameterSourceLabel}。超阈值被平均值盖掉记录${r.status === 'pending_review' ? '仍挂起待维修师傅复核' : r.status === 'reviewed' ? '已复核通过，最终归档' : '已驳回'}。`,
                },
              ],
            };
          }
          return {
            ...r,
            calculationNote: {
              ...r.calculationNote,
              parameterVersion: unitConversion.parameterVersion,
              tradeOffReason: `${r.calculationNote.tradeOffReason} 单位换算说明于 ${now} 更新，参数版本同步为 ${unitConversion.parameterVersion}。`,
            },
            processLogs: [
              ...r.processLogs,
              {
                ...baseLog,
                action: `第三步：单位换算说明更新完成。参数版本 ${unitConversion.parameterVersion}，来源：${unitConversion.parameterSourceLabel}。旧口径补录记录（0.3mm）确认归档。`,
              },
            ],
          };
        }) as RecordData[];

        set({
          records: updatedRecords,
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
          const baseLog = {
            id: `LOG-NP-${Date.now()}-${r.id}`,
            recordId: r.id,
            step: 'nameplate_review' as ProcessStep,
            operator: roleLabels.engineer,
            timestamp: now,
          };
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
              processLogs: [
                ...r.processLogs,
                {
                  ...baseLog,
                  action: `第二步：何工补看设备铭牌 RDS-200 #EQ-2024-001，发现测量口径缺失，${decision === 'confirm' ? '确认使用阈值表 v1.3（6.0 m/s）' : '驳回阈值表改用铭牌 v1.0（5.5 m/s）'}，补录旧口径 0.3mm。`,
                },
              ],
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
              processLogs: [
                ...r.processLogs,
                {
                  ...baseLog,
                  action: `第二步：何工补看设备铭牌参数，${decision === 'confirm' ? '确认使用阈值表 v1.3（最大阈值 6.0 m/s）' : '驳回阈值表改用铭牌 v1.0（最大阈值 5.5 m/s）'}。超阈值被平均值盖掉记录维持**挂起待维修师傅复核**状态，不自动归正常。`,
                },
              ],
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
            processLogs: [
              ...r.processLogs,
              {
                ...baseLog,
                action: `第二步：何工补看设备铭牌参数，口径 0.5mm 与测量一致，${decision === 'confirm' ? '确认使用阈值表 v1.3' : '驳回阈值表改用铭牌 v1.0'}，顺利记录保持正常。`,
              },
            ],
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
