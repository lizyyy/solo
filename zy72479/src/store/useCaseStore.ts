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

  generateReport: (caseId: string) => string;
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
          let newResultType: ResultType;
          let newStatus: CaseStatus;

          if (status === 'confirmed') {
            newResultType = 'conflict_confirmed';
            newStatus = 'normal';
            resolutionConclusion = [
              '冲突复核结论：小姜已确认采信两边证据。',
              '路口照片记录21:00时段噪声54dB属正常范围，公交刷卡时段记录22:30后噪声严重均属实，说明噪声问题存在时段性差异。',
              '调解结论：噪声问题属实，但具有时段性，21:00前后相对正常，22:30后明显加重，需加强深夜时段管控。',
              remark ? `复核备注：${remark}` : '',
            ].filter(Boolean).join('');
          } else if (status === 'rejected') {
            newResultType = 'conflict_rejected';
            newStatus = 'conflict';
            resolutionConclusion = [
              '冲突复核结论：小姜已驳回，证据存疑需补充。',
              '路口照片与公交刷卡时段证词矛盾点未消除，21:00照片与22:30后公交刷卡说法的时段差异尚无法判定是噪声时段性变化还是取证偏差，暂不形成最终结论，需补充更多时段证据。',
              remark ? `复核备注：${remark}` : '',
            ].filter(Boolean).join('');
          } else {
            return { conflicts: updatedConflicts };
          }

          const newHistoryLogs: HistoryLog[] = [];

          if (allConflictsResolved) {
            newHistoryLogs.push({
              id: `log-${Date.now()}-conflict-action`,
              caseId: conflict.caseId,
              action: status === 'confirmed' ? '冲突复核-已确认采信' : '冲突复核-已驳回',
              operator: reviewer,
              timestamp: now,
              detail: resolutionConclusion,
            });

            newHistoryLogs.push({
              id: `log-${Date.now()}-conflict-result`,
              caseId: conflict.caseId,
              action: status === 'confirmed' ? '更新案件状态-冲突已确认' : '更新案件状态-冲突已驳回待补',
              operator: '系统',
              timestamp: now,
              detail: status === 'confirmed'
                ? `案件状态更新为正常，结果标签更新为「冲突已确认采信」。结论：噪声问题存在时段性差异，需加强深夜时段管控。注意：此案件不是顺利记录，而是经冲突复核后确认采信的时段差异案件。`
                : `案件保持冲突状态，结果标签更新为「冲突已驳回待补」。结论：证据矛盾点未消除，需补充更多时段证据材料。注意：此案件驳回原因是照片与公交刷卡时段冲突，与居民原文缺失无关。`,
            });
          }

          return {
            conflicts: updatedConflicts,
            cases: state.cases.map(c =>
              c.id === conflict.caseId
                ? {
                    ...c,
                    status: allConflictsResolved ? newStatus : c.status,
                    resultType: allConflictsResolved ? newResultType : c.resultType,
                    conflictResolved: allConflictsResolved,
                    conflictResolution: status,
                    finalConclusion: allConflictsResolved ? resolutionConclusion : c.finalConclusion,
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
              action: '居民意见完整性检查通过',
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
                      resultType: 'conflict_confirmed',
                      conflictResolved: false,
                      conflictResolution: null,
                      finalConclusion: undefined,
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
              finalConclusion = '路口照片与公交刷卡时段证据冲突已由小姜人工确认采信。两类证据描述的时段不同（21:00 vs 22:30后），均属实，说明噪声问题存在时段性差异。调解结论：噪声问题属实，但具有时段性，21:00前后相对正常，22:30后明显加重，需加强深夜时段管控。';
            } else {
              finalConclusion = '证据冲突已驳回，路口照片与公交刷卡时段矛盾点未消除，暂不形成结论，需补充更多时段证据材料后重新提交复核。此案件驳回原因是照片与公交刷卡时段冲突，与居民原文缺失无关。';
            }
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: confirmedConflict ? '生成冲突确认结论' : '生成冲突驳回结论',
              operator: '系统',
              timestamp: now,
              detail: finalConclusion,
            });
          } else if (caseItem.status === 'conflict' && hasUnresolvedConflict) {
            finalConclusion = '';
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '等待人工复核',
              operator: '系统',
              timestamp: now,
              detail: '冲突尚未处理，请在冲突复核表中人工选择确认或驳回',
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
          } else if (caseItem.status === 'normal' && caseItem.resultType === 'smooth') {
            finalConclusion = '路口照片与公交刷卡时段证据一致，居民意见完整。两类证据互相印证，已形成完整证据链。调解结论：噪声问题属实，已通知相关方整改。';
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '生成正常结案结论',
              operator: '系统',
              timestamp: now,
              detail: finalConclusion,
            });
          } else if (caseItem.resultType === 'conflict_confirmed' && caseItem.conflictResolved) {
            finalConclusion = caseItem.finalConclusion || '路口照片与公交刷卡时段证据冲突已确认采信，噪声问题存在时段性差异。';
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '冲突确认结论已生成',
              operator: '系统',
              timestamp: now,
              detail: finalConclusion,
            });
          } else if (caseItem.resultType === 'conflict_rejected') {
            finalConclusion = caseItem.finalConclusion || '证据冲突已驳回，需补充更多时段证据材料。';
            newLogs.push({
              id: `log-${Date.now()}-s3b`,
              caseId,
              action: '冲突驳回结论已生成',
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
                    finalConclusion: finalConclusion || c.finalConclusion,
                    updatedAt: now,
                  }
                : c
            ),
          };
        });
      },

      generateReport: (caseId) => {
        const state = get();
        const caseItem = state.cases.find(c => c.id === caseId);
        if (!caseItem) return '';

        const evidences = state.evidences.filter(e => e.caseId === caseId);
        const conflicts = state.conflicts.filter(c => c.caseId === caseId);
        const historyLogs = state.historyLogs.filter(h => h.caseId === caseId)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const roadPhotos = evidences.filter(e => e.type === 'road_photo');
        const busCards = evidences.filter(e => e.type === 'bus_card');

        let report = '';
        report += `夜间经济噪声调解报告\n`;
        report += `${'='.repeat(50)}\n\n`;
        report += `案件编号：${caseItem.id}\n`;
        report += `案件名称：${caseItem.title}\n`;
        report += `地址：${caseItem.address}\n`;
        report += `案件状态：${caseItem.status === 'normal' ? '正常' : caseItem.status === 'pending_review' ? '待社区书记复核' : caseItem.status === 'conflict' ? '冲突待复核' : '补录'}\n`;
        report += `结果类型：${caseItem.resultType === 'smooth' ? '顺利记录' : caseItem.resultType === 'summary_only' ? '居民意见仅汇总' : caseItem.resultType === 'old_supplemented' ? '旧口径补录' : caseItem.resultType === 'conflict_confirmed' ? '冲突已确认采信' : '冲突已驳回待补'}\n`;
        report += `创建时间：${caseItem.createdAt}\n`;
        report += `更新时间：${caseItem.updatedAt}\n\n`;

        report += `一、案件描述\n${'-'.repeat(30)}\n${caseItem.description}\n\n`;

        report += `二、路口照片证据（主流程）\n${'-'.repeat(30)}\n`;
        roadPhotos.forEach((ev, i) => {
          report += `\n[${i + 1}] ${ev.title}\n`;
          report += `  来源：${ev.source}\n`;
          report += `  描述：${ev.description}\n`;
          report += `  居民意见完整性：${ev.hasOriginalText ? '有原文' : '仅汇总无原文'}\n`;
          if (ev.summary && !ev.hasOriginalText) {
            report += `  汇总内容：${ev.summary}\n`;
          }
          report += `  录入时间：${ev.createdAt}\n`;
        });

        report += `\n三、公交刷卡时段证据（现场说法）\n${'-'.repeat(30)}\n`;
        busCards.forEach((ev, i) => {
          report += `\n[${i + 1}] ${ev.title}\n`;
          report += `  来源：${ev.source}\n`;
          report += `  描述：${ev.description}\n`;
          if (ev.metadata?.supplemented) {
            report += `  【补录数据】原数据时段：${ev.metadata.originalPeriod}\n`;
          }
          report += `  录入时间：${ev.createdAt}\n`;
        });

        if (conflicts.length > 0) {
          report += `\n四、冲突复核记录\n${'-'.repeat(30)}\n`;
          conflicts.forEach((conf, i) => {
            const evA = evidences.find(e => e.id === conf.evidenceAId);
            const evB = evidences.find(e => e.id === conf.evidenceBId);
            report += `\n[${i + 1}] 冲突点：${conf.conflictPoint}\n`;
            report += `  路口照片方：${evA?.title || '未知'}\n`;
            report += `  公交刷卡方：${evB?.title || '未知'}\n`;
            report += `  复核状态：${conf.status === 'pending' ? '待处理' : conf.status === 'confirmed' ? '已确认采信' : '已驳回'}\n`;
            if (conf.reviewer) {
              report += `  复核人：${conf.reviewer}\n`;
              report += `  复核时间：${conf.reviewedAt}\n`;
            }
            if (conf.remark) {
              report += `  复核备注：${conf.remark}\n`;
            }
          });
        }

        report += `\n五、统一处理结论\n${'-'.repeat(30)}\n`;
        if (caseItem.finalConclusion) {
          report += `${caseItem.finalConclusion}\n`;
        } else if (caseItem.status === 'conflict') {
          report += `【冲突待复核】路口照片与公交刷卡时段证据存在矛盾，等待人工确认或驳回，系统不会自动拍板。\n`;
        } else {
          report += `结论尚未生成，请完成三步流程。\n`;
        }

        report += `\n六、操作历史记录\n${'-'.repeat(30)}\n`;
        historyLogs.forEach((log) => {
          report += `[${log.timestamp}] ${log.action}（${log.operator}）：${log.detail}\n`;
        });

        return report;
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
