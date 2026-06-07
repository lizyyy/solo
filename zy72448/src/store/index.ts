import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppState,
  Contract,
  Track,
  TrackAlias,
  Conflict,
  CheckType,
  SelfCheckResult,
  CheckItem,
  WeeklyReport,
} from '../types';
import { generateId, getWeekNumber, calculateAmountDiff } from '../utils/helpers';

const initialMockData = () => {
  const now = new Date().toISOString();
  const trackAliases: TrackAlias[] = [
    { id: generateId(), canonicalName: '月光奏鸣曲', aliasName: '月光现场版', aliasType: '现场名', source: '别名表', createdAt: now },
    { id: generateId(), canonicalName: '月光奏鸣曲', aliasName: 'Moonlight Sonata', aliasType: '版权名', source: '合同', createdAt: now },
    { id: generateId(), canonicalName: '命运交响曲', aliasName: '命运现场演奏版', aliasType: '现场名', source: '别名表', createdAt: now },
    { id: generateId(), canonicalName: '命运交响曲', aliasName: 'Symphony No.5', aliasType: '版权名', source: '别名表', createdAt: now },
    { id: generateId(), canonicalName: '致爱丽丝', aliasName: '致爱丽丝现场', aliasType: '现场名', source: '合同', createdAt: now },
    { id: generateId(), canonicalName: '致爱丽丝', aliasName: 'Für Elise', aliasType: '版权名', source: '别名表', createdAt: now },
  ];

  const contracts: Contract[] = [
    { id: generateId(), contractNo: 'HT-2026-001', contractDate: '2026-06-01', totalAmount: 15000, status: 'imported', createdAt: now, step: 1 },
    { id: generateId(), contractNo: 'HT-2026-002', contractDate: '2026-06-03', totalAmount: 22000, status: 'reviewing', createdAt: now, step: 2 },
  ];

  const tracks: Track[] = [
    { id: generateId(), contractId: contracts[0].id, trackName: '月光现场版', nameType: '现场名', amount: 5000, reviewStatus: '待复核', matchedCanonicalName: '月光奏鸣曲' },
    { id: generateId(), contractId: contracts[0].id, trackName: '命运现场演奏版', nameType: '现场名', amount: 5000, reviewStatus: '正常', matchedCanonicalName: '命运交响曲' },
    { id: generateId(), contractId: contracts[0].id, trackName: '致爱丽丝现场', nameType: '现场名', amount: 5000, reviewStatus: '正常', matchedCanonicalName: '致爱丽丝' },
    { id: generateId(), contractId: contracts[1].id, trackName: 'Moonlight Sonata', nameType: '版权名', amount: 7000, reviewStatus: '待复核', matchedCanonicalName: '月光奏鸣曲' },
    { id: generateId(), contractId: contracts[1].id, trackName: 'Symphony No.5', nameType: '版权名', amount: 8000, reviewStatus: '正常', matchedCanonicalName: '命运交响曲' },
    { id: generateId(), contractId: contracts[1].id, trackName: '未知曲目X', nameType: '未知', amount: 7000, reviewStatus: '待复核' },
  ];

  const conflicts: Conflict[] = [
    {
      id: generateId(),
      type: '双重身份',
      trackId: tracks[0].id,
      evidence: {
        contractEvidence: '合同 HT-2026-001 中曲目"月光现场版"为现场名',
        aliasEvidence: '别名表中"月光奏鸣曲"同时存在现场名和版权名两种别名',
      },
      status: '待处理',
      createdAt: now,
    },
    {
      id: generateId(),
      type: '别名缺失',
      trackId: tracks[5].id,
      evidence: {
        contractEvidence: '合同 HT-2026-002 中曲目"未知曲目X"无法在别名表中找到对应记录',
      },
      status: '待处理',
      createdAt: now,
    },
  ];

  return { contracts, tracks, trackAliases, conflicts };
};

const mockData = initialMockData();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      contracts: mockData.contracts,
      tracks: mockData.tracks,
      trackAliases: mockData.trackAliases,
      conflicts: mockData.conflicts,
      selfCheckResults: [],
      weeklyReports: [],
      operationLogs: [],

      importContract: (contractData, trackData) => {
        const now = new Date().toISOString();
        const contractId = generateId();

        const newContract: Contract = {
          ...contractData,
          id: contractId,
          createdAt: now,
          status: 'imported',
          step: 1,
        };

        const newTracks: Track[] = trackData.map((t) => {
          const matchedAlias = get().trackAliases.find(a => a.aliasName === t.trackName);
          const hasDualIdentity = matchedAlias && get().trackAliases.some(
            a => a.canonicalName === matchedAlias.canonicalName && a.aliasType !== matchedAlias.aliasType
          );
          
          return {
            ...t,
            id: generateId(),
            contractId,
            reviewStatus: hasDualIdentity ? '待复核' : '正常',
            matchedCanonicalName: matchedAlias?.canonicalName,
          };
        });

        const newConflicts: Conflict[] = [];
        newTracks.forEach((track) => {
          const matchedAlias = get().trackAliases.find(a => a.aliasName === track.trackName);
          
          if (!matchedAlias) {
            newConflicts.push({
              id: generateId(),
              type: '别名缺失',
              trackId: track.id,
              evidence: {
                contractEvidence: `合同 ${contractData.contractNo} 中曲目"${track.trackName}"无法在别名表中找到对应记录`,
              },
              status: '待处理',
              createdAt: now,
            });
          } else {
            const hasDualIdentity = get().trackAliases.some(
              a => a.canonicalName === matchedAlias.canonicalName && a.aliasType !== matchedAlias.aliasType
            );
            if (hasDualIdentity) {
              newConflicts.push({
                id: generateId(),
                type: '双重身份',
                trackId: track.id,
                aliasId: matchedAlias.id,
                evidence: {
                  contractEvidence: `合同 ${contractData.contractNo} 中曲目"${track.trackName}"为${track.nameType}`,
                  aliasEvidence: `别名表中"${matchedAlias.canonicalName}"同时存在现场名和版权名两种别名`,
                },
                status: '待处理',
                createdAt: now,
              });
            }
          }
        });

        set((state) => ({
          contracts: [...state.contracts, newContract],
          tracks: [...state.tracks, ...newTracks],
          conflicts: [...state.conflicts, ...newConflicts],
        }));

        get().addOperationLog({
          operationType: '合同导入',
          operator: '录音师小段',
          targetId: contractId,
          description: `导入合同 ${contractData.contractNo}，包含 ${trackData.length} 首曲目`,
        });
      },

      addTrackAlias: (alias) => {
        const now = new Date().toISOString();
        const newAlias: TrackAlias = {
          ...alias,
          id: generateId(),
          createdAt: now,
        };

        set((state) => ({
          trackAliases: [...state.trackAliases, newAlias],
        }));

        const affectedTracks = get().tracks.filter(t => t.trackName === alias.aliasName);
        if (affectedTracks.length > 0) {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.trackName === alias.aliasName
                ? { ...t, matchedCanonicalName: alias.canonicalName, nameType: alias.aliasType, reviewStatus: '正常' }
                : t
            ),
            conflicts: state.conflicts.map((c) =>
              affectedTracks.some(t => t.id === c.trackId) && c.type === '别名缺失'
                ? { ...c, status: '已确认', handler: '系统自动', handledAt: now, remarks: '别名已补录' }
                : c
            ),
          }));
        }

        get().addOperationLog({
          operationType: '别名添加',
          operator: '录音师小段',
          description: `添加别名映射：${alias.aliasName} (${alias.aliasType}) → ${alias.canonicalName}`,
        });
      },

      resolveConflict: (id, action, handler, remarks) => {
        const now = new Date().toISOString();
        const conflict = get().conflicts.find((c) => c.id === id);
        
        if (!conflict) return;

        const newStatus = action === 'confirm' ? '已确认' : '已驳回';
        
        set((state) => ({
          conflicts: state.conflicts.map((c) =>
            c.id === id
              ? { ...c, status: newStatus, handler, handledAt: now, remarks }
              : c
          ),
          tracks: state.tracks.map((t) =>
            t.id === conflict.trackId
              ? { ...t, reviewStatus: action === 'confirm' ? '已确认' : '已驳回' }
              : t
          ),
        }));

        get().addOperationLog({
          operationType: '冲突处理',
          operator: handler,
          targetId: id,
          description: `${action === 'confirm' ? '确认' : '驳回'}冲突 #${id}${remarks ? `：${remarks}` : ''}`,
        });
      },

      runSelfCheck: (type) => {
        const now = new Date().toISOString();
        const resultId = generateId();
        const items: CheckItem[] = [];

        switch (type) {
          case '重复导入': {
            const contractNos = new Map<string, number>();
            get().contracts.forEach((c) => {
              contractNos.set(c.contractNo, (contractNos.get(c.contractNo) || 0) + 1);
            });
            contractNos.forEach((count, no) => {
              if (count > 1) {
                items.push({
                  id: generateId(),
                  resultId,
                  level: '错误',
                  description: `合同号 ${no} 存在 ${count} 条重复记录`,
                  evidence: `涉及合同ID: ${get().contracts.filter(c => c.contractNo === no).map(c => c.id).join(', ')}`,
                });
              }
            });

            const trackSignatures = new Map<string, number>();
            get().tracks.forEach((t) => {
              const contract = get().contracts.find(c => c.id === t.contractId);
              const sig = `${t.trackName}-${contract?.contractDate}-${t.amount}`;
              trackSignatures.set(sig, (trackSignatures.get(sig) || 0) + 1);
            });
            trackSignatures.forEach((count, sig) => {
              if (count > 1) {
                items.push({
                  id: generateId(),
                  resultId,
                  level: '警告',
                  description: `疑似重复曲目：${sig}`,
                  evidence: `出现 ${count} 次`,
                });
              }
            });
            break;
          }

          case '同名异曲': {
            const nameToCanonical = new Map<string, Set<string>>();
            get().trackAliases.forEach((a) => {
              if (!nameToCanonical.has(a.aliasName)) {
                nameToCanonical.set(a.aliasName, new Set());
              }
              nameToCanonical.get(a.aliasName)!.add(a.canonicalName);
            });
            nameToCanonical.forEach((canonicals, name) => {
              if (canonicals.size > 1) {
                items.push({
                  id: generateId(),
                  resultId,
                  level: '错误',
                  description: `曲目名"${name}"对应多个标准名`,
                  evidence: `对应标准名: ${Array.from(canonicals).join(', ')}`,
                });
              }
            });

            const canonicalAmounts = new Map<string, number[]>();
            get().tracks.forEach((t) => {
              if (t.matchedCanonicalName) {
                if (!canonicalAmounts.has(t.matchedCanonicalName)) {
                  canonicalAmounts.set(t.matchedCanonicalName, []);
                }
                canonicalAmounts.get(t.matchedCanonicalName)!.push(t.amount);
              }
            });
            canonicalAmounts.forEach((amounts, canonical) => {
              if (amounts.length > 1) {
                const max = Math.max(...amounts);
                const min = Math.min(...amounts);
                const diff = calculateAmountDiff(max, min);
                if (diff > 1) {
                  items.push({
                    id: generateId(),
                    resultId,
                    level: '警告',
                    description: `曲目"${canonical}"的金额差异超过1%`,
                    evidence: `金额范围: ${min} - ${max}，差异: ${diff.toFixed(2)}%`,
                  });
                }
              }
            });
            break;
          }

          case '补录重算': {
            const tracksWithoutCanonical = get().tracks.filter((t) => !t.matchedCanonicalName);
            if (tracksWithoutCanonical.length > 0) {
              items.push({
                id: generateId(),
                resultId,
                level: '警告',
                description: `${tracksWithoutCanonical.length} 首曲目缺少标准名映射`,
                evidence: `曲目: ${tracksWithoutCanonical.map(t => t.trackName).join(', ')}`,
              });
            }

            const beforeTotal = get().tracks.reduce((sum, t) => sum + t.amount, 0);
            const canonicalGroups = new Map<string, number>();
            get().tracks.forEach((t) => {
              const key = t.matchedCanonicalName || `未归类-${t.trackName}`;
              canonicalGroups.set(key, (canonicalGroups.get(key) || 0) + t.amount);
            });
            const afterTotal = Array.from(canonicalGroups.values()).reduce((a, b) => a + b, 0);
            
            if (Math.abs(beforeTotal - afterTotal) > 0.01) {
              items.push({
                id: generateId(),
                resultId,
                level: '错误',
                description: '补录重算前后总金额不一致',
                evidence: `前: ${beforeTotal}, 后: ${afterTotal}, 差异: ${Math.abs(beforeTotal - afterTotal)}`,
              });
            } else {
              items.push({
                id: generateId(),
                resultId,
                level: '通过',
                description: '补录重算前后总金额一致',
                evidence: `总金额: ${beforeTotal}`,
              });
            }
            break;
          }

          case '导出一致': {
            const state = get();
            const pageData = JSON.stringify({
              contracts: state.contracts.length,
              tracks: state.tracks.length,
              trackAliases: state.trackAliases.length,
              totalAmount: state.tracks.reduce((s, t) => s + t.amount, 0),
            });

            const exportData = state.exportData();
            const parsed = JSON.parse(exportData);
            const exportedData = JSON.stringify({
              contracts: parsed.contracts.length,
              tracks: parsed.tracks.length,
              trackAliases: parsed.trackAliases.length,
              totalAmount: parsed.tracks.reduce((s: number, t: Track) => s + t.amount, 0),
            });

            if (pageData === exportedData) {
              items.push({
                id: generateId(),
                resultId,
                level: '通过',
                description: '页面展示数据与导出数据完全一致',
                evidence: `合同: ${state.contracts.length}条, 曲目: ${state.tracks.length}条, 别名: ${state.trackAliases.length}条`,
              });
            } else {
              items.push({
                id: generateId(),
                resultId,
                level: '错误',
                description: '页面展示数据与导出数据不一致',
                evidence: `页面: ${pageData}, 导出: ${exportedData}`,
              });
            }
            break;
          }
        }

        const hasErrors = items.some((i) => i.level === '错误');
        const hasWarnings = items.some((i) => i.level === '警告');
        const summary = hasErrors
          ? `检测完成，发现 ${items.filter(i => i.level === '错误').length} 个错误，${items.filter(i => i.level === '警告').length} 个警告`
          : hasWarnings
          ? `检测完成，发现 ${items.filter(i => i.level === '警告').length} 个警告`
          : '检测完成，全部通过';

        const result: SelfCheckResult = {
          id: resultId,
          checkType: type,
          runAt: now,
          status: 'completed',
          summary,
          items,
        };

        set((state) => ({
          selfCheckResults: [result, ...state.selfCheckResults],
        }));

        get().addOperationLog({
          operationType: '自检运行',
          operator: '系统',
          targetId: resultId,
          description: `运行${type}检测，${summary}`,
        });

        return result;
      },

      runAllSelfChecks: () => {
        const types: CheckType[] = ['重复导入', '同名异曲', '补录重算', '导出一致'];
        return types.map((type) => get().runSelfCheck(type));
      },

      generateWeeklyReport: (weekNumber, year) => {
        const now = new Date().toISOString();
        const reportId = generateId();

        const weekTracks = get().tracks.filter((t) => {
          const contract = get().contracts.find((c) => c.id === t.contractId);
          if (!contract) return false;
          const { week, year: y } = getWeekNumber(new Date(contract.contractDate));
          return week === weekNumber && y === year;
        });

        const canonicalGroups = new Map<string, { count: number; amount: number }>();
        weekTracks.forEach((t) => {
          const key = t.matchedCanonicalName || `未归类-${t.trackName}`;
          const existing = canonicalGroups.get(key) || { count: 0, amount: 0 };
          canonicalGroups.set(key, {
            count: existing.count + 1,
            amount: existing.amount + t.amount,
          });
        });

        const details = Array.from(canonicalGroups.entries()).map(([canonicalName, data]) => ({
          canonicalName,
          trackCount: data.count,
          totalAmount: data.amount,
        }));

        const report: WeeklyReport = {
          id: reportId,
          weekNumber,
          year,
          totalAmount: weekTracks.reduce((s, t) => s + t.amount, 0),
          trackCount: weekTracks.length,
          contractCount: new Set(weekTracks.map((t) => t.contractId)).size,
          generatedAt: now,
          details,
        };

        set((state) => ({
          weeklyReports: [report, ...state.weeklyReports.filter(
            (r) => !(r.weekNumber === weekNumber && r.year === year)
          )],
        }));

        get().addOperationLog({
          operationType: '周报生成',
          operator: '录音师小段',
          targetId: reportId,
          description: `生成 ${year}年第${weekNumber}周 周报，总金额 ${report.totalAmount} 元`,
        });

        return report;
      },

      exportData: () => {
        const state = get();
        return JSON.stringify(
          {
            contracts: state.contracts,
            tracks: state.tracks,
            trackAliases: state.trackAliases,
            conflicts: state.conflicts,
            exportTime: new Date().toISOString(),
          },
          null,
          2
        );
      },

      addOperationLog: (log) => {
        set((state) => ({
          operationLogs: [
            {
              ...log,
              id: generateId(),
              timestamp: new Date().toISOString(),
            },
            ...state.operationLogs,
          ],
        }));
      },

      getTracksByCanonicalName: (canonicalName) => {
        return get().tracks.filter((t) => t.matchedCanonicalName === canonicalName);
      },

      getConflictsByStatus: (status) => {
        return get().conflicts.filter((c) => c.status === status);
      },
    }),
    {
      name: 'music-club-reimbursement',
    }
  )
);
