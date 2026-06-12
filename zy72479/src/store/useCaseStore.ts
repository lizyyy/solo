import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Case, Evidence, ConflictItem, HistoryLog, ConflictStatus, CaseStatus, ResultType } from '../types';
import { mockCases, mockEvidences, mockConflicts, mockHistoryLogs } from '../data/mockData';

interface CaseState {
  cases: Case[];
  evidences: Evidence[];
  conflicts: ConflictItem[];
  historyLogs: HistoryLog[];
  selectedCaseId: string | null;

  selectCase: (caseId: string) => void;
  getCaseById: (caseId: string) => Case | undefined;
  getEvidencesByCaseId: (caseId: string) => Evidence[];
  getConflictsByCaseId: (caseId: string) => ConflictItem[];
  getHistoryByCaseId: (caseId: string) => HistoryLog[];

  updateConflictStatus: (conflictId: string, status: ConflictStatus, reviewer: string, remark?: string) => void;
  updateCaseStatus: (caseId: string, status: CaseStatus) => void;
  addHistoryLog: (caseId: string, action: string, operator: string, detail: string) => void;
  advanceStep: (caseId: string) => void;
  resetToInitialData: () => void;

  simulateStep1ImportRoadPhoto: (caseId: string) => void;
  simulateStep2ReviewBusCard: (caseId: string) => void;
  simulateStep3ConflictReview: (caseId: string) => void;
}

export const useCaseStore = create<CaseState>()(
  persist(
    (set, get) => ({
      cases: mockCases,
      evidences: mockEvidences,
      conflicts: mockConflicts,
      historyLogs: mockHistoryLogs,
      selectedCaseId: null,

      selectCase: (caseId) => set({ selectedCaseId: caseId }),

      getCaseById: (caseId) => get().cases.find(c => c.id === caseId),

      getEvidencesByCaseId: (caseId) => get().evidences.filter(e => e.caseId === caseId),

      getConflictsByCaseId: (caseId) => get().conflicts.filter(c => c.caseId === caseId),

      getHistoryByCaseId: (caseId) => get().historyLogs.filter(h => h.caseId === caseId).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),

      updateConflictStatus: (conflictId, status, reviewer, remark) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        set(state => {
          const conflict = state.conflicts.find(c => c.id === conflictId);
          if (!conflict) return {};

          const updatedConflicts = state.conflicts.map(c =>
            c.id === conflictId
              ? { ...c, status, reviewer, reviewedAt: now, remark }
              : c
          );

          const pendingConflicts = updatedConflicts.filter(
            c => c.caseId === conflict.caseId && c.status === 'pending'
          );
          const allConflictsResolved = pendingConflicts.length === 0 && status !== 'pending';

          let resolutionConclusion = '';
          let newResultType: ResultType | undefined;
          let newStatus: CaseStatus | undefined;

          if (status === 'confirmed') {
            resolutionConclusion = `冲突复核结论：已确认，采信两边证据。路口照片记录的21:00时段噪声正常，公交刷卡时段记录的22:30后噪声严重均属实，说明噪声问题存在时段差异。${remark ? `复核备注：${remark}` : ''}`;
            newResultType = 'smooth';
            newStatus = 'normal';
          } else if (status === 'rejected') {
            resolutionConclusion = `冲突复核结论：已驳回，证据存疑需补充。路口照片与公交刷卡时段证词矛盾点未消除，暂不形成结论，需补充更多时段证据。${remark ? `复核备注：${remark}` : ''}`;
            newStatus = 'pending_review';
          }

          const newHistoryLogs: HistoryLog[] = [];

          if (status !== 'pending') {
            newHistoryLogs.push({
              id: `log-${Date.now()}-1`,
              caseId: conflict.caseId,
              action: status === 'confirmed' ? '冲突复核-已确认' : '冲突复核-已驳回',
              operator: reviewer,
              timestamp: now,
              detail: resolutionConclusion,
            });

            newHistoryLogs.push({
              id: `log-${Date.now()}-2`,
              caseId: conflict.caseId,
              action: '更新统一结果',
              operator: '系统',
              timestamp: now,
              detail: status === 'confirmed'
                ? '冲突已确认采信，案件状态更新为正常，证据链已形成完整闭环，结论：噪声问题存在时段性'
                : '冲突已驳回，案件状态更新为待复核，需补充更多证据材料',
            });
          }

          return {
            conflicts: updatedConflicts,
            cases: state.cases.map(c =>
              c.id === conflict.caseId
                ? {
                    ...c,
                    status: allConflictsResolved ? (newStatus ?? c.status) : c.status,
                    resultType: allConflictsResolved && status === 'confirmed' ? (newResultType ?? c.resultType) : c.resultType,
                    conflictResolved: allConflictsResolved,
                    conflictResolution: status === 'pending' ? c.conflictResolution : status,
                    finalConclusion: resolutionConclusion || c.finalConclusion,
                    updatedAt: now,
                  }
                : c
            ),
            historyLogs: [...state.historyLogs, ...newHistoryLogs],
          };
        });
      },

      updateCaseStatus: (caseId, status) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        set(state => ({
          cases: state.cases.map(c =>
            c.id === caseId ? { ...c, status, updatedAt: now } : c
          ),
        }));
      },

      addHistoryLog: (caseId, action, operator, detail) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        const newLog: HistoryLog = {
          id: `log-${Date.now()}`,
          caseId,
          action,
          operator,
          timestamp: now,
          detail,
        };
        set(state => ({
          historyLogs: [...state.historyLogs, newLog],
        }));
      },

      advanceStep: (caseId) => {
        set(state => ({
          cases: state.cases.map(c =>
            c.id === caseId && c.currentStep < 3
              ? { ...c, currentStep: c.currentStep + 1, updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }
              : c
          ),
        }));
      },

      simulateStep1ImportRoadPhoto: (caseId) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        const newLogs: HistoryLog[] = [
          {
            id: `log-${Date.now()}-s1`,
            caseId,
            action: '第一步：导入路口照片',
            operator: '小姜',
            timestamp: now,
            detail: '路口照片证据已导入系统。正在检查居民意见完整性...',
          },
        ];

        set(state => {
          const caseItem = state.cases.find(c => c.id === caseId);
          if (!caseItem) return {};

          const evidences = state.evidences.filter(e => e.caseId === caseId);
          const hasSummaryOnly = evidences.some(e => e.type === 'road_photo' && !e.hasOriginalText);

          let newStatus: CaseStatus = caseItem.status;
          let newResultType: ResultType = caseItem.resultType;

          if (hasSummaryOnly) {
            newLogs.push({
              id: `log-${Date.now()}-s1b`,
              caseId,
              action: '检测到居民意见仅汇总',
              operator: '系统',
              timestamp: now,
              detail: '居民意见只剩汇总没有原文，自动标记为待社区书记复核，暂不归入正常结案',
            });
            newStatus = 'pending_review';
            newResultType = 'summary_only';
          } else {
            newLogs.push({
              id: `log-${Date.now()}-s1b`,
              caseId,
              action: '居民意见完整性检查',
              operator: '系统',
              timestamp: now,
              detail: '居民意见有原文，证据材料完整，可进入下一步',
            });
          }

          newLogs.push({
            id: `log-${Date.now()}-s1c`,
            caseId,
            action: '第一步完成',
            operator: '系统',
            timestamp: now,
            detail: hasSummaryOnly
              ? '路口照片导入完成，但居民意见不完整，已标记待复核，仍可继续补看公交刷卡时段'
              : '路口照片导入完成，证据完整，流程正常',
          });

          return {
            historyLogs: [...state.historyLogs, ...newLogs],
            cases: state.cases.map(c =>
              c.id === caseId
                ? {
                    ...c,
                    currentStep: Math.max(c.currentStep, 1),
                    status: newStatus,
                    resultType: newResultType,
                    updatedAt: now,
                  }
                : c
            ),
          };
        });
      },

      simulateStep2ReviewBusCard: (caseId) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        const newLogs: HistoryLog[] = [
          {
            id: `log-${Date.now()}-s2`,
            caseId,
            action: '第二步：补看公交刷卡时段',
            operator: '小姜',
            timestamp: now,
            detail: '街道规划员小姜开始补看公交刷卡时段的现场说法证据...',
          },
        ];

        set(state => {
          const caseItem = state.cases.find(c => c.id === caseId);
          if (!caseItem) return {};

          const conflicts = state.conflicts.filter(c => c.caseId === caseId);
          const hasConflict = conflicts.some(c => c.status === 'pending');
          const busEvidences = state.evidences.filter(e => e.caseId === caseId && e.type === 'bus_card');
          const hasSupplemented = busEvidences.some(e => e.metadata?.supplemented);

          if (hasConflict) {
            newLogs.push({
              id: `log-${Date.now()}-s2b`,
              caseId,
              action: '检测到证据冲突',
              operator: '系统',
              timestamp: now,
              detail: '路口照片证据与公交刷卡时段证据存在矛盾。已自动列出冲突点，请小姜人工选择确认或驳回，系统不会自动拍板。',
            });
            newLogs.push({
              id: `log-${Date.now()}-s2c`,
              caseId,
              action: '进入冲突复核',
              operator: '系统',
              timestamp: now,
              detail: '案件状态更新为冲突待复核，必须完成人工复核后才能生成最终结论',
            });

            return {
              historyLogs: [...state.historyLogs, ...newLogs],
              cases: state.cases.map(c =>
                c.id === caseId
                  ? {
                      ...c,
                      currentStep: Math.max(c.currentStep, 2),
                      status: 'conflict',
                      conflictResolved: false,
                      conflictResolution: null,
                      updatedAt: now,
                    }
                  : c
              ),
            };
          }

          if (hasSupplemented) {
            newLogs.push({
              id: `log-${Date.now()}-s2b`,
              caseId,
              action: '检测到补录证据',
              operator: '系统',
              timestamp: now,
              detail: '公交刷卡时段数据为后来补录的旧口径数据，与主流程存在时间差，已标注补录来源',
            });
            newLogs.push({
              id: `log-${Date.now()}-s2c`,
              caseId,
              action: '第二步完成',
              operator: '系统',
              timestamp: now,
              detail: '公交刷卡时段补看完成，无冲突。补录证据已纳入，案件标记为补录状态',
            });

            return {
              historyLogs: [...state.historyLogs, ...newLogs],
              cases: state.cases.map(c =>
                c.id === caseId
                  ? {
                      ...c,
                      currentStep: Math.max(c.currentStep, 2),
                      status: c.status === 'pending_review' ? c.status : 'supplemented',
                      resultType: 'old_supplemented',
                      updatedAt: now,
                    }
                  : c
              ),
            };
          }

          newLogs.push({
            id: `log-${Date.now()}-s2b`,
            caseId,
            action: '证据一致性检查',
            operator: '系统',
            timestamp: now,
            detail: '公交刷卡时段证据与路口照片证据一致，无矛盾',
          });
          newLogs.push({
            id: `log-${Date.now()}-s2c`,
            caseId,
            action: '第二步完成',
            operator: '系统',
            timestamp: now,
            detail: '公交刷卡时段补看完成，证据相互印证，可进入复核更新环节',
          });

          return {
            historyLogs: [...state.historyLogs, ...newLogs],
            cases: state.cases.map(c =>
              c.id === caseId
                ? {
                    ...c,
                    currentStep: Math.max(c.currentStep, 2),
                    updatedAt: now,
                  }
                : c
            ),
          };
        });
      },

      simulateStep3ConflictReview: (caseId) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });

        set(state => {
          const caseItem = state.cases.find(c => c.id === caseId);
          if (!caseItem) return {};

          const conflicts = state.conflicts.filter(c => c.caseId === caseId);
          const hasUnresolvedConflict = conflicts.some(c => c.status === 'pending');

          const newLogs: HistoryLog[] = [
            {
              id: `log-${Date.now()}-s3`,
              caseId,
              action: '第三步：冲突复核表更新',
              operator: '小姜',
              timestamp: now,
              detail: hasUnresolvedConflict
                ? '仍有未处理的冲突，小姜必须在冲突复核表中人工选择确认或驳回，系统不会自动拍板'
                : '所有冲突已处理完毕，准备生成最终结论',
            },
          ];

          let finalConclusion = '';
          if (caseItem.status === 'conflict' && !hasUnresolvedConflict) {
            const confirmedConflict = conflicts.find(c => c.status === 'confirmed');
            if (confirmedConflict) {
              finalConclusion = '路口照片与公交刷卡时段证据冲突已由小姜人工确认采信。两类证据描述的时段不同（21:00 vs 22:30后），均属实，说明噪声问题存在时段性差异。证据链完整，调解结论：噪声问题属实，需加强深夜时段管控。';
            } else {
              finalConclusion = '证据冲突已驳回，暂不形成结论，需补充更多时段证据材料后重新提交复核。';
            }
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '生成统一结论',
              operator: '系统',
              timestamp: now,
              detail: finalConclusion,
            });
          } else if (caseItem.status === 'pending_review') {
            finalConclusion = '居民意见仅剩汇总无原文，已标记待社区书记复核。路口照片与公交刷卡时段证据虽一致，但因居民意见材料不完整，暂不归入正常结案，需等待书记复核确认汇总意见的有效性。';
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '结论暂挂待复核',
              operator: '系统',
              timestamp: now,
              detail: finalConclusion,
            });
          } else if (caseItem.status === 'supplemented') {
            finalConclusion = '路口照片为主流程证据，公交刷卡时段为后来补录的旧口径数据，两者存在时间差。补录证据已纳入考量，综合判断噪声问题属实，已标注补录来源以备追溯。';
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '生成补录案件结论',
              operator: '系统',
              timestamp: now,
              detail: finalConclusion,
            });
          } else {
            finalConclusion = '路口照片与公交刷卡时段证据一致，居民意见完整。两类证据互相印证，已形成完整证据链。调解结论：噪声问题属实，已通知相关方整改。';
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '生成正常结案结论',
              operator: '系统',
              timestamp: now,
              detail: finalConclusion,
            });
          }

          return {
            historyLogs: [...state.historyLogs, ...newLogs],
            cases: state.cases.map(c =>
              c.id === caseId
                ? {
                    ...c,
                    currentStep: 3,
                    finalConclusion,
                    updatedAt: now,
                  }
                : c
            ),
          };
        });
      },

      resetToInitialData: () => {
        set({
          cases: mockCases,
          evidences: mockEvidences,
          conflicts: mockConflicts,
          historyLogs: mockHistoryLogs,
          selectedCaseId: null,
        });
      },
    }),
    {
      name: 'noise-mediation-storage',
    }
  )
);
