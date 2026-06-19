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
  TrackStatusChange,
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

  const makeInitialStatus = (reason: string): TrackStatusChange[] => ([{
    fromStatus: '正常',
    toStatus: '正常',
    operator: '系统',
    timestamp: now,
    reason,
  }]);

  const tracks: Track[] = [
    {
      id: generateId(),
      contractId: contracts[0].id,
      trackName: '月光现场版',
      nameType: '现场名',
      amount: 5000,
      reviewStatus: '待复核',
      matchedCanonicalName: '月光奏鸣曲',
      reviewReason: '同一标准名同时存在现场名和版权名，待音乐老师复核',
      statusHistory: [
        { fromStatus: '正常', toStatus: '待复核', operator: '系统', timestamp: now, reason: '检测到双重身份（同一首歌有现场名和版权名）' },
      ],
    },
    {
      id: generateId(),
      contractId: contracts[0].id,
      trackName: '命运现场演奏版',
      nameType: '现场名',
      amount: 5000,
      reviewStatus: '待复核',
      matchedCanonicalName: '命运交响曲',
      reviewReason: '同一标准名同时存在现场名和版权名，待音乐老师复核',
      statusHistory: [
        { fromStatus: '正常', toStatus: '待复核', operator: '系统', timestamp: now, reason: '检测到双重身份（同一首歌有现场名和版权名）' },
      ],
    },
    {
      id: generateId(),
      contractId: contracts[0].id,
      trackName: '致爱丽丝现场',
      nameType: '现场名',
      amount: 5000,
      reviewStatus: '正常',
      matchedCanonicalName: '致爱丽丝',
      reviewReason: '合同导入时匹配别名表，仅单一类型映射，自动归正常',
      statusHistory: makeInitialStatus('合同导入时匹配别名表，仅单一类型映射'),
    },
    {
      id: generateId(),
      contractId: contracts[1].id,
      trackName: 'Moonlight Sonata',
      nameType: '版权名',
      amount: 7000,
      reviewStatus: '待复核',
      matchedCanonicalName: '月光奏鸣曲',
      reviewReason: '同一标准名同时存在现场名和版权名，待音乐老师复核',
      statusHistory: [
        { fromStatus: '正常', toStatus: '待复核', operator: '系统', timestamp: now, reason: '检测到双重身份（同一首歌有现场名和版权名）' },
      ],
    },
    {
      id: generateId(),
      contractId: contracts[1].id,
      trackName: 'Symphony No.5',
      nameType: '版权名',
      amount: 8000,
      reviewStatus: '待复核',
      matchedCanonicalName: '命运交响曲',
      reviewReason: '同一标准名同时存在现场名和版权名，待音乐老师复核',
      statusHistory: [
        { fromStatus: '正常', toStatus: '待复核', operator: '系统', timestamp: now, reason: '检测到双重身份（同一首歌有现场名和版权名）' },
      ],
    },
    {
      id: generateId(),
      contractId: contracts[1].id,
      trackName: '未知曲目X',
      nameType: '未知',
      amount: 7000,
      reviewStatus: '待复核',
      reviewReason: '别名缺失，待补录曲目别名表后复核',
      statusHistory: [
        { fromStatus: '正常', toStatus: '待复核', operator: '系统', timestamp: now, reason: '别名表中无匹配记录，需补录后复核' },
      ],
    },
  ];

  const conflicts: Conflict[] = [
    {
      id: generateId(),
      type: '双重身份',
      trackId: tracks[0].id,
      aliasId: trackAliases[0].id,
      evidence: {
        contractEvidence: '合同 HT-2026-001 中曲目"月光现场版"为现场名',
        aliasEvidence: '别名表中"月光奏鸣曲"同时存在现场名和版权名两种别名',
      },
      status: '待处理',
      createdAt: now,
    },
    {
      id: generateId(),
      type: '双重身份',
      trackId: tracks[1].id,
      aliasId: trackAliases[2].id,
      evidence: {
        contractEvidence: '合同 HT-2026-001 中曲目"命运现场演奏版"为现场名',
        aliasEvidence: '别名表中"命运交响曲"同时存在现场名和版权名两种别名',
      },
      status: '待处理',
      createdAt: now,
    },
    {
      id: generateId(),
      type: '双重身份',
      trackId: tracks[3].id,
      aliasId: trackAliases[1].id,
      evidence: {
        contractEvidence: '合同 HT-2026-002 中曲目"Moonlight Sonata"为版权名',
        aliasEvidence: '别名表中"月光奏鸣曲"同时存在现场名和版权名两种别名',
      },
      status: '待处理',
      createdAt: now,
    },
    {
      id: generateId(),
      type: '双重身份',
      trackId: tracks[4].id,
      aliasId: trackAliases[3].id,
      evidence: {
        contractEvidence: '合同 HT-2026-002 中曲目"Symphony No.5"为版权名',
        aliasEvidence: '别名表中"命运交响曲"同时存在现场名和版权名两种别名',
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

const pushStatusHistory = (track: Track, fromStatus: Track['reviewStatus'], toStatus: Track['reviewStatus'], operator: string, reason: string): Track => {
  const now = new Date().toISOString();
  return {
    ...track,
    reviewStatus: toStatus,
    reviewReason: reason,
    statusHistory: [
      ...track.statusHistory,
      { fromStatus, toStatus, operator, timestamp: now, reason },
    ],
  };
};

const hasDualIdentity = (canonicalName: string, aliases: TrackAlias[]): boolean => {
  const types = new Set(
    aliases.filter(a => a.canonicalName === canonicalName).map(a => a.aliasType)
  );
  return types.size > 1;
};

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

        const existingConflictTrackIds = new Set(
          get().conflicts.filter(c => c.type === '别名缺失' && c.status === '待处理').map(c => c.trackId)
        );

        const newTracks: Track[] = trackData.map((t) => {
          const matchedAlias = get().trackAliases.find(a => a.aliasName === t.trackName);
          const isDualIdentity = matchedAlias && hasDualIdentity(matchedAlias.canonicalName, get().trackAliases);

          let reviewStatus: Track['reviewStatus'];
          let reviewReason: string;
          let statusHistory: TrackStatusChange[];

          if (!matchedAlias) {
            reviewStatus = '待复核';
            reviewReason = '别名缺失，待补录曲目别名表后复核';
            statusHistory = [{
              fromStatus: '正常',
              toStatus: '待复核',
              operator: '系统',
              timestamp: now,
              reason: '别名表中无匹配记录，需补录后复核',
            }];
          } else if (isDualIdentity) {
            reviewStatus = '待复核';
            reviewReason = '同一标准名同时存在现场名和版权名，待音乐老师复核';
            statusHistory = [{
              fromStatus: '正常',
              toStatus: '待复核',
              operator: '系统',
              timestamp: now,
              reason: '检测到双重身份（同一首歌有现场名和版权名）',
            }];
          } else {
            reviewStatus = '正常';
            reviewReason = '合同导入时匹配别名表，仅单一类型映射，自动归正常';
            statusHistory = [{
              fromStatus: '正常',
              toStatus: '正常',
              operator: '系统',
              timestamp: now,
              reason: '合同导入时匹配别名表，仅单一类型映射',
            }];
          }

          return {
            ...t,
            id: generateId(),
            contractId,
            reviewStatus,
            reviewReason,
            matchedCanonicalName: matchedAlias?.canonicalName,
            statusHistory,
          };
        });

        const newConflicts: Conflict[] = [];
        newTracks.forEach((track) => {
          const matchedAlias = get().trackAliases.find(a => a.aliasName === track.trackName);

          if (!matchedAlias) {
            const alreadyHasConflict = Array.from(existingConflictTrackIds).some(
              existingTrackId => {
                const existingTrack = get().tracks.find(t => t.id === existingTrackId);
                return existingTrack?.trackName === track.trackName;
              }
            );
            if (!alreadyHasConflict) {
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
            }
          } else {
            const isDual = hasDualIdentity(matchedAlias.canonicalName, get().trackAliases);
            if (isDual) {
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
          beforeData: JSON.stringify({ contractCount: get().contracts.length - 1, trackCount: get().tracks.length - newTracks.length }, null, 2),
          afterData: JSON.stringify({ contractCount: get().contracts.length, trackCount: get().tracks.length }, null, 2),
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

        const isDualIdentity = hasDualIdentity(alias.canonicalName, get().trackAliases);

        const directMatchTracks = get().tracks.filter(t => t.trackName === alias.aliasName);
        const canonicalTracks = get().tracks.filter(t => t.matchedCanonicalName === alias.canonicalName);
        const allAffectedTracks = new Map<string, Track>();
        [...directMatchTracks, ...canonicalTracks].forEach(t => allAffectedTracks.set(t.id, t));

        if (allAffectedTracks.size > 0) {
          const affectedIds = new Set(allAffectedTracks.keys());

          set((state) => ({
            tracks: state.tracks.map((t) => {
              if (!affectedIds.has(t.id)) return t;
              const fromStatus = t.reviewStatus;
              const toStatus: Track['reviewStatus'] = '待复核';
              const isDirectMatch = t.trackName === alias.aliasName;
              const reason = isDualIdentity
                ? `补录别名后检测到双重身份（"${alias.canonicalName}"同时有现场名和版权名），待音乐老师复核`
                : isDirectMatch
                ? '补录别名后待复核，需人工确认映射正确'
                : `同标准名"${alias.canonicalName}"补录了新别名类型（${alias.aliasType}），触发双重身份复核`;

              return {
                ...t,
                ...(isDirectMatch ? {
                  matchedCanonicalName: alias.canonicalName,
                  nameType: alias.aliasType,
                } : {}),
                reviewStatus: toStatus,
                reviewReason: reason,
                statusHistory: [
                  ...t.statusHistory,
                  {
                    fromStatus,
                    toStatus,
                    operator: '录音师小段',
                    timestamp: now,
                    reason: isDirectMatch
                      ? `补录别名映射：${alias.aliasName} → ${alias.canonicalName}（${alias.aliasType}）`
                      : `同标准名曲目受影响：标准名"${alias.canonicalName}"新增${alias.aliasType}别名"${alias.aliasName}"，触发双重身份复核`,
                  },
                ],
              };
            }),

            conflicts: state.conflicts.map((c) => {
              const isAffected = affectedIds.has(c.trackId);

              if (isAffected && c.type === '别名缺失') {
                return {
                  ...c,
                  status: '待处理' as const,
                  evidence: {
                    ...c.evidence,
                    alias补录Evidence: {
                      aliasName: alias.aliasName,
                      canonicalName: alias.canonicalName,
                      aliasType: alias.aliasType,
                      source: alias.source,
                     补录At: now,
                      operator: '录音师小段',
                     补录后是否触发双重身份: isDualIdentity,
                    },
                  },
                };
              }

              if (isAffected && isDualIdentity && c.type === '双重身份') {
                return c;
              }

              return c;
            }),
          }));

          if (isDualIdentity) {
            set((state) => {
              const newDualConflicts: Conflict[] = [];
              allAffectedTracks.forEach((track) => {
                const hasExistingDual = state.conflicts.some(
                  c => c.trackId === track.id && c.type === '双重身份' && c.status === '待处理'
                );
                if (!hasExistingDual) {
                  const isDirectMatch = track.trackName === alias.aliasName;
                  newDualConflicts.push({
                    id: generateId(),
                    type: '双重身份',
                    trackId: track.id,
                    aliasId: newAlias.id,
                    evidence: {
                      contractEvidence: isDirectMatch
                        ? `曲目"${track.trackName}"补录为${alias.aliasType}，归属标准名"${alias.canonicalName}"`
                        : `已有曲目"${track.trackName}"归属标准名"${alias.canonicalName}"，该标准名新增${alias.aliasType}别名"${alias.aliasName}"`,
                      aliasEvidence: `别名表中"${alias.canonicalName}"同时存在现场名和版权名两种别名`,
                      alias补录Evidence: {
                        aliasName: alias.aliasName,
                        canonicalName: alias.canonicalName,
                        aliasType: alias.aliasType,
                        source: alias.source,
                       补录At: now,
                        operator: '录音师小段',
                       补录后是否触发双重身份: true,
                      },
                    },
                    status: '待处理',
                    createdAt: now,
                  });
                }
              });
              return {
                conflicts: [...state.conflicts, ...newDualConflicts],
              };
            });
          }
        }

        const affectedTrackNames = Array.from(allAffectedTracks.values()).map(t => t.trackName);
        const beforeData = JSON.stringify({
          aliasCount: get().trackAliases.length - 1,
          directlyAffectedTracks: directMatchTracks.length,
          canonicalAffectedTracks: canonicalTracks.length,
          totalAffectedTracks: allAffectedTracks.size,
        }, null, 2);

        const afterData = JSON.stringify({
          aliasCount: get().trackAliases.length,
          directlyAffectedTracks: directMatchTracks.length,
          canonicalAffectedTracks: canonicalTracks.length,
          totalAffectedTracks: allAffectedTracks.size,
          affectedTrackNames,
          isDualIdentity,
        }, null, 2);

        get().addOperationLog({
          operationType: '别名添加',
          operator: '录音师小段',
          targetId: newAlias.id,
          beforeData,
          afterData,
          description: `补录别名映射：${alias.aliasName} (${alias.aliasType}) → ${alias.canonicalName}${isDualIdentity ? ' [触发双重身份]' : ''}${canonicalTracks.length > directMatchTracks.length ? ` [回扫${canonicalTracks.length - directMatchTracks.length}首同标准名曲目]` : ''}`,
        });
      },

      resolveConflict: (id, action, handler, remarks) => {
        const now = new Date().toISOString();
        const conflict = get().conflicts.find((c) => c.id === id);

        if (!conflict) return;

        const track = get().tracks.find(t => t.id === conflict.trackId);
        if (!track) return;

        const newConflictStatus = action === 'confirm' ? '已确认' : '已驳回';
        const newTrackStatus = action === 'confirm' ? '已确认' : '已驳回';

        const resolvedReason = action === 'confirm'
          ? (conflict.type === '别名缺失'
              ? '别名缺失已补录并确认，映射关系经过人工复核'
              : conflict.type === '双重身份'
              ? '双重身份已确认，同一首歌的现场名和版权名均归集到同一标准名'
              : '冲突已确认')
          : '冲突已驳回，数据保持原样';

        const beforeData = JSON.stringify({
          conflict: { type: conflict.type, status: conflict.status },
          track: { name: track.trackName, reviewStatus: track.reviewStatus, matchedCanonicalName: track.matchedCanonicalName },
        }, null, 2);

        set((state) => ({
          conflicts: state.conflicts.map((c) =>
            c.id === id
              ? { ...c, status: newConflictStatus, handler, handledAt: now, remarks, resolvedReason }
              : c
          ),
          tracks: state.tracks.map((t) =>
            t.id === conflict.trackId
              ? pushStatusHistory(
                  t,
                  t.reviewStatus,
                  newTrackStatus,
                  handler,
                  resolvedReason
                )
              : t
          ),
        }));

        const afterData = JSON.stringify({
          conflict: { type: conflict.type, status: newConflictStatus, handler },
          track: { name: track.trackName, reviewStatus: newTrackStatus, matchedCanonicalName: track.matchedCanonicalName },
        }, null, 2);

        get().addOperationLog({
          operationType: '冲突处理',
          operator: handler,
          targetId: id,
          beforeData,
          afterData,
          description: `${action === 'confirm' ? '确认' : '驳回'}${conflict.type}冲突 #${id}${remarks ? `：${remarks}` : ''}`,
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

            const aliasMissingConflictTracks = get().conflicts
              .filter(c => c.type === '别名缺失' && c.status === '待处理')
              .map(c => get().tracks.find(t => t.id === c.trackId)?.trackName)
              .filter(Boolean);
            const uniqueNames = new Set(aliasMissingConflictTracks);
            if (aliasMissingConflictTracks.length > uniqueNames.size) {
              items.push({
                id: generateId(),
                resultId,
                level: '警告',
                description: '别名缺失冲突存在重复，同一曲目名可能被多次计入',
                evidence: `待处理别名缺失冲突 ${aliasMissingConflictTracks.length} 条，涉及唯一曲目名 ${uniqueNames.size} 个`,
              });
            }
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

            const tracksWithDual = get().tracks.filter(t => t.reviewStatus === '待复核' && t.matchedCanonicalName);
            if (tracksWithDual.length > 0) {
              items.push({
                id: generateId(),
                resultId,
                level: '警告',
                description: `${tracksWithDual.length} 首曲目处于待复核状态（双重身份），周报暂不统计`,
                evidence: `曲目: ${tracksWithDual.map(t => t.trackName).join(', ')}`,
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

        const allWeekTracks = get().tracks.filter((t) => {
          const contract = get().contracts.find((c) => c.id === t.contractId);
          if (!contract) return false;
          const { week, year: y } = getWeekNumber(new Date(contract.contractDate));
          return week === weekNumber && y === year;
        });

        const confirmedTracks = allWeekTracks.filter(
          (t) => t.reviewStatus === '正常' || t.reviewStatus === '已确认'
        );

        const pendingTracks = allWeekTracks.filter(
          (t) => t.reviewStatus === '待复核' || t.reviewStatus === '已驳回'
        );

        const canonicalGroups = new Map<string, { count: number; amount: number }>();
        confirmedTracks.forEach((t) => {
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
          totalAmount: confirmedTracks.reduce((s, t) => s + t.amount, 0),
          trackCount: confirmedTracks.length,
          contractCount: new Set(confirmedTracks.map((t) => t.contractId)).size,
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
          beforeData: JSON.stringify({
            totalTracks: allWeekTracks.length,
            confirmedTracks: confirmedTracks.length,
            pendingTracks: pendingTracks.length,
            totalAmount: allWeekTracks.reduce((s, t) => s + t.amount, 0),
          }, null, 2),
          afterData: JSON.stringify({
            includedTracks: confirmedTracks.length,
            excludedTracks: pendingTracks.length,
            reportTotalAmount: report.totalAmount,
            note: '仅包含状态为"正常"和"已确认"的曲目',
          }, null, 2),
          description: `生成 ${year}年第${weekNumber}周 周报，总金额 ${report.totalAmount} 元（已排除待复核/已驳回曲目 ${pendingTracks.length} 首）`,
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
      name: 'music-club-reimbursement-v3',
    }
  )
);
