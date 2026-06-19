const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
};

const hasDualIdentity = (canonicalName, aliases) => {
  const types = new Set(
    aliases.filter(a => a.canonicalName === canonicalName).map(a => a.aliasType)
  );
  return types.size > 1;
};

const pushStatusHistory = (track, fromStatus, toStatus, operator, reason) => {
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

function createAppStore() {
  const now = new Date().toISOString();

  const trackAliases = [
    { id: 'a1', canonicalName: '月光奏鸣曲', aliasName: '月光现场版', aliasType: '现场名', source: '别名表', createdAt: now },
    { id: 'a2', canonicalName: '月光奏鸣曲', aliasName: 'Moonlight Sonata', aliasType: '版权名', source: '合同', createdAt: now },
    { id: 'a3', canonicalName: '命运交响曲', aliasName: '命运现场演奏版', aliasType: '现场名', source: '别名表', createdAt: now },
    { id: 'a4', canonicalName: '命运交响曲', aliasName: 'Symphony No.5', aliasType: '版权名', source: '别名表', createdAt: now },
  ];

  let state = {
    contracts: [],
    tracks: [],
    trackAliases,
    conflicts: [],
    selfCheckResults: [],
    weeklyReports: [],
    operationLogs: [],
  };

  const get = () => state;
  const set = (updater) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) };
    } else {
      state = { ...state, ...updater };
    }
  };

  const addOperationLog = (log) => {
    set((s) => ({
      operationLogs: [
        { ...log, id: generateId(), timestamp: new Date().toISOString() },
        ...s.operationLogs,
      ],
    }));
  };

  const importContract = (contractData, trackData) => {
    const now = new Date().toISOString();
    const contractId = 'c_' + generateId();

    const newContract = {
      ...contractData,
      id: contractId,
      createdAt: now,
      status: 'imported',
      step: 1,
    };

    const existingConflictTrackIds = new Set(
      get().conflicts.filter(c => c.type === '别名缺失' && c.status === '待处理').map(c => c.trackId)
    );

    const newTracks = trackData.map((t) => {
      const matchedAlias = get().trackAliases.find(a => a.aliasName === t.trackName);
      const isDual = matchedAlias && hasDualIdentity(matchedAlias.canonicalName, get().trackAliases);

      let reviewStatus, reviewReason, statusHistory;
      if (!matchedAlias) {
        reviewStatus = '待复核';
        reviewReason = '别名缺失，待补录曲目别名表后复核';
        statusHistory = [{ fromStatus: '正常', toStatus: '待复核', operator: '系统', timestamp: now, reason: '别名表中无匹配记录，需补录后复核' }];
      } else if (isDual) {
        reviewStatus = '待复核';
        reviewReason = '同一标准名同时存在现场名和版权名，待音乐老师复核';
        statusHistory = [{ fromStatus: '正常', toStatus: '待复核', operator: '系统', timestamp: now, reason: '检测到双重身份（同一首歌有现场名和版权名）' }];
      } else {
        reviewStatus = '正常';
        reviewReason = '合同导入时匹配别名表，仅单一类型映射，自动归正常';
        statusHistory = [{ fromStatus: '正常', toStatus: '正常', operator: '系统', timestamp: now, reason: '合同导入时匹配别名表，仅单一类型映射' }];
      }

      return {
        ...t,
        id: 't_' + generateId(),
        contractId,
        reviewStatus,
        reviewReason,
        matchedCanonicalName: matchedAlias?.canonicalName,
        statusHistory,
      };
    });

    const newConflicts = [];
    newTracks.forEach((track) => {
      const matchedAlias = get().trackAliases.find(a => a.aliasName === track.trackName);

      if (!matchedAlias) {
        const alreadyHas = Array.from(existingConflictTrackIds).some(existingTrackId => {
          const existingTrack = get().tracks.find(t => t.id === existingTrackId);
          return existingTrack?.trackName === track.trackName;
        });
        if (!alreadyHas) {
          newConflicts.push({
            id: 'cf_' + generateId(),
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
            id: 'cf_' + generateId(),
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

    set((s) => ({
      contracts: [...s.contracts, newContract],
      tracks: [...s.tracks, ...newTracks],
      conflicts: [...s.conflicts, ...newConflicts],
    }));

    addOperationLog({
      operationType: '合同导入',
      operator: '录音师小段',
      targetId: contractId,
      description: `导入合同 ${contractData.contractNo}，包含 ${trackData.length} 首曲目`,
    });

    return { contractId, newTracks, newConflicts };
  };

  const addTrackAlias = (alias) => {
    const now = new Date().toISOString();
    const newAlias = {
      ...alias,
      id: 'a_' + generateId(),
      createdAt: now,
    };

    set((s) => ({
      trackAliases: [...s.trackAliases, newAlias],
    }));

    const isDual = hasDualIdentity(alias.canonicalName, get().trackAliases);

    const directMatchTracks = get().tracks.filter(t => t.trackName === alias.aliasName);
    const canonicalTracks = get().tracks.filter(t => t.matchedCanonicalName === alias.canonicalName);
    const allAffectedTracks = new Map();
    [...directMatchTracks, ...canonicalTracks].forEach(t => allAffectedTracks.set(t.id, t));

    if (allAffectedTracks.size > 0) {
      const affectedIds = new Set(allAffectedTracks.keys());

      set((state) => ({
        tracks: state.tracks.map((t) => {
          if (!affectedIds.has(t.id)) return t;
          const fromStatus = t.reviewStatus;
          const toStatus = '待复核';
          const isDirectMatch = t.trackName === alias.aliasName;
          const reason = isDual
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
              status: '待处理',
              evidence: {
                ...c.evidence,
                alias补录Evidence: {
                  aliasName: alias.aliasName,
                  canonicalName: alias.canonicalName,
                  aliasType: alias.aliasType,
                  source: alias.source,
                  补录At: now,
                  operator: '录音师小段',
                  补录后是否触发双重身份: isDual,
                },
              },
            };
          }

          return c;
        }),
      }));

      if (isDual) {
        set((state) => {
          const newDualConflicts = [];
          allAffectedTracks.forEach((track) => {
            const hasExisting = state.conflicts.some(
              c => c.trackId === track.id && c.type === '双重身份' && c.status === '待处理'
            );
            if (!hasExisting) {
              const isDirectMatch = track.trackName === alias.aliasName;
              newDualConflicts.push({
                id: 'cf_' + generateId(),
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
          return { conflicts: [...state.conflicts, ...newDualConflicts] };
        });
      }
    }

    addOperationLog({
      operationType: '别名添加',
      operator: '录音师小段',
      targetId: newAlias.id,
      beforeData: JSON.stringify({
        aliasCount: get().trackAliases.length - 1,
        directlyAffectedTracks: directMatchTracks.length,
        canonicalAffectedTracks: canonicalTracks.length,
      }, null, 2),
      afterData: JSON.stringify({
        aliasCount: get().trackAliases.length,
        directlyAffectedTracks: directMatchTracks.length,
        canonicalAffectedTracks: canonicalTracks.length,
        isDualIdentity: isDual,
      }, null, 2),
      description: `补录别名映射：${alias.aliasName} (${alias.aliasType}) → ${alias.canonicalName}${isDual ? ' [触发双重身份]' : ''}${canonicalTracks.length > directMatchTracks.length ? ` [回扫${canonicalTracks.length - directMatchTracks.length}首同标准名曲目]` : ''}`,
    });

    return { newAlias, directMatchTracks, canonicalTracks, allAffectedTracks, isDual };
  };

  const resolveConflict = (id, action, handler, remarks) => {
    const now = new Date().toISOString();
    const conflict = get().conflicts.find(c => c.id === id);
    if (!conflict) return null;

    const track = get().tracks.find(t => t.id === conflict.trackId);
    if (!track) return null;

    const newConflictStatus = action === 'confirm' ? '已确认' : '已驳回';
    const newTrackStatus = action === 'confirm' ? '已确认' : '已驳回';

    const resolvedReason = action === 'confirm'
      ? (conflict.type === '别名缺失'
          ? '别名缺失已补录并确认，映射关系经过人工复核'
          : conflict.type === '双重身份'
          ? '双重身份已确认，同一首歌的现场名和版权名均归集到同一标准名'
          : '冲突已确认')
      : '冲突已驳回，数据保持原样';

    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id
          ? { ...c, status: newConflictStatus, handler, handledAt: now, remarks, resolvedReason }
          : c
      ),
      tracks: state.tracks.map((t) =>
        t.id === conflict.trackId
          ? pushStatusHistory(t, t.reviewStatus, newTrackStatus, handler, resolvedReason)
          : t
      ),
    }));

    addOperationLog({
      operationType: '冲突处理',
      operator: handler,
      targetId: id,
      description: `${action === 'confirm' ? '确认' : '驳回'}${conflict.type}冲突${remarks ? `：${remarks}` : ''}`,
    });

    return { newConflictStatus, newTrackStatus, resolvedReason };
  };

  const generateWeeklyReport = (weekNumber, year) => {
    const now = new Date().toISOString();
    const reportId = 'r_' + generateId();

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

    const canonicalGroups = new Map();
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

    const report = {
      id: reportId,
      weekNumber,
      year,
      totalAmount: confirmedTracks.reduce((s, t) => s + t.amount, 0),
      trackCount: confirmedTracks.length,
      contractCount: new Set(confirmedTracks.map((t) => t.contractId)).size,
      generatedAt: now,
      details,
    };

    set((s) => ({
      weeklyReports: [report, ...s.weeklyReports.filter(
        (r) => !(r.weekNumber === weekNumber && r.year === year)
      )],
    }));

    addOperationLog({
      operationType: '周报生成',
      operator: '录音师小段',
      targetId: reportId,
      description: `生成 ${year}年第${weekNumber}周 周报，总金额 ${report.totalAmount} 元（已排除待复核/已驳回曲目 ${pendingTracks.length} 首）`,
    });

    return { report, allWeekTracks, confirmedTracks, pendingTracks };
  };

  return { get, importContract, addTrackAlias, resolveConflict, generateWeeklyReport };
}

const passed = [];
const failed = [];

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed.push(label);
  } else {
    console.log(`  ❌ ${label}: ${detail || '条件不满足'}`);
    failed.push(label);
  }
}

console.log('='.repeat(70));
console.log('🧪 音乐社团经费报销 - 完整流程验证 (v3)');
console.log('='.repeat(70));
console.log();

const store = createAppStore();

// ============ 第一步：合同导入 ============
console.log('📋 【第一步】合同导入 - 含"小夜曲"（别名缺失）');
console.log('-'.repeat(70));

const importResult = store.importContract(
  {
    contractNo: 'HT-TEST-001',
    contractDate: '2026-06-10',
    totalAmount: 18000,
  },
  [
    { trackName: '月光现场版', nameType: '现场名', amount: 5000, remarks: '' },
    { trackName: '命运现场演奏版', nameType: '现场名', amount: 6000, remarks: '' },
    { trackName: '小夜曲', nameType: '未知', amount: 7000, remarks: '别名表中没有' },
  ]
);

console.log(`  导入 ${importResult.newTracks.length} 首曲目，${importResult.newConflicts.length} 个冲突`);

const moonLive = importResult.newTracks.find(t => t.trackName === '月光现场版');
const fateLive = importResult.newTracks.find(t => t.trackName === '命运现场演奏版');
const serenade = importResult.newTracks.find(t => t.trackName === '小夜曲');

check('月光现场版：双重身份 → 待复核', moonLive.reviewStatus === '待复核', `实际: ${moonLive.reviewStatus}`);
check('命运现场演奏版：双重身份 → 待复核', fateLive.reviewStatus === '待复核', `实际: ${fateLive.reviewStatus}`);
check('小夜曲：别名缺失 → 待复核', serenade.reviewStatus === '待复核', `实际: ${serenade.reviewStatus}`);
console.log();

// ============ 第二步：补录"小夜曲"版权名 ============
console.log('📝 【第二步】补录"小夜曲"版权名别名');
console.log('-'.repeat(70));

const addAlias1 = store.addTrackAlias({
  canonicalName: '小夜曲',
  aliasName: '小夜曲',
  aliasType: '版权名',
  source: '人工',
});

const trackAfterAlias1 = store.get().tracks.find(t => t.trackName === '小夜曲');
check('小夜曲补录后：仍待复核', trackAfterAlias1.reviewStatus === '待复核', `实际: ${trackAfterAlias1.reviewStatus}`);
check('小夜曲补录后：有标准名映射', trackAfterAlias1.matchedCanonicalName === '小夜曲', `实际: ${trackAfterAlias1.matchedCanonicalName}`);

const missingConflict1 = store.get().conflicts.find(
  c => c.type === '别名缺失' && store.get().tracks.find(t => t.id === c.trackId)?.trackName === '小夜曲'
);
check('别名缺失冲突：未自动确认', missingConflict1.status === '待处理', `实际: ${missingConflict1.status}`);
check('别名缺失冲突：有补录证据链', !!missingConflict1.evidence.alias补录Evidence, '缺少 alias补录Evidence');
console.log();

// ============ 第三步：补录"小夜曲现场版"现场名 → 触发双重身份 ============
console.log('🎭 【第三步】补录"小夜曲现场版"现场名 → 验证双重身份回扫');
console.log('-'.repeat(70));

const beforeDualConflicts = store.get().conflicts.filter(c => c.type === '双重身份').length;

const addAlias2 = store.addTrackAlias({
  canonicalName: '小夜曲',
  aliasName: '小夜曲现场版',
  aliasType: '现场名',
  source: '人工',
});

const afterDualConflicts = store.get().conflicts.filter(c => c.type === '双重身份').length;
const newDualCount = afterDualConflicts - beforeDualConflicts;

console.log(`  补录前双重身份冲突: ${beforeDualConflicts}`);
console.log(`  补录后双重身份冲突: ${afterDualConflicts}`);
console.log(`  新增双重身份冲突: ${newDualCount}`);

check('hasDualIdentity 检测到双重身份', addAlias2.isDual === true, `isDual = ${addAlias2.isDual}`);
check('回扫生成了双重身份冲突（>0）', newDualCount > 0, `新增 ${newDualCount} 个，期望 > 0`);

const trackAfterAlias2 = store.get().tracks.find(t => t.trackName === '小夜曲');
check('小夜曲：状态变为待复核（双重身份）', trackAfterAlias2.reviewStatus === '待复核', `实际: ${trackAfterAlias2.reviewStatus}`);
check('小夜曲：reviewReason 含"双重身份"', trackAfterAlias2.reviewReason.includes('双重身份'), `实际: ${trackAfterAlias2.reviewReason}`);

const dualConflictForSerenade = store.get().conflicts.find(
  c => c.type === '双重身份' && c.status === '待处理' &&
    store.get().tracks.find(t => t.id === c.trackId)?.trackName === '小夜曲'
);
check('小夜曲有双重身份冲突记录', !!dualConflictForSerenade, '未找到对应冲突');

if (dualConflictForSerenade) {
  check('双重身份冲突：合同证据含"已有曲目"', dualConflictForSerenade.evidence.contractEvidence.includes('已有曲目'), `实际: ${dualConflictForSerenade.evidence.contractEvidence}`);
  check('双重身份冲突：有补录证据链', !!dualConflictForSerenade.evidence.alias补录Evidence, '缺少 alias补录Evidence');
}

console.log();
console.log('  📜 小夜曲完整状态变更轨迹:');
trackAfterAlias2.statusHistory.forEach((h, i) => {
  console.log(`    ${i + 1}. ${h.fromStatus} → ${h.toStatus}  [${h.operator}] ${h.reason}`);
});
console.log();

// ============ 第四步：重算周报 ============
console.log('📊 【第四步】周报生成 - 验证待复核曲目不计入');
console.log('-'.repeat(70));

const weekInfo = getWeekNumber(new Date('2026-06-10'));
const report1 = store.generateWeeklyReport(weekInfo.week, weekInfo.year);

console.log(`  本周全部曲目: ${report1.allWeekTracks.length}`);
console.log(`  计入周报（正常/已确认）: ${report1.confirmedTracks.length}`);
console.log(`  不计入（待复核/已驳回）: ${report1.pendingTracks.length}`);
console.log(`  周报总金额: ¥${report1.report.totalAmount}`);

const serenadeInReport = report1.confirmedTracks.find(t => t.trackName === '小夜曲');
const fateInReport = report1.confirmedTracks.find(t => t.trackName === '命运现场演奏版');

check('小夜曲不在周报中（待复核）', !serenadeInReport, '小夜曲不应出现在已确认曲目中');
check('命运交响曲不在周报中（待复核）', !fateInReport, '命运现场演奏版不应出现在已确认曲目中');
console.log();

// ============ 第五步：音乐老师确认小夜曲的双重身份冲突 ============
console.log('✅ 【第五步】音乐老师确认小夜曲双重身份冲突');
console.log('-'.repeat(70));

if (dualConflictForSerenade) {
  const resolveResult = store.resolveConflict(
    dualConflictForSerenade.id,
    'confirm',
    '音乐老师',
    '确认小夜曲现场版和版权名归属同一标准名'
  );

  const trackAfterResolve = store.get().tracks.find(t => t.trackName === '小夜曲');
  check('确认后曲目状态: 已确认', trackAfterResolve.reviewStatus === '已确认', `实际: ${trackAfterResolve.reviewStatus}`);
  check('确认后状态历史: 3条（正常→待复核→待复核→已确认）', trackAfterResolve.statusHistory.length >= 3, `实际: ${trackAfterResolve.statusHistory.length} 条`);

  console.log('  📜 确认后完整状态变更轨迹:');
  trackAfterResolve.statusHistory.forEach((h, i) => {
    console.log(`    ${i + 1}. ${h.fromStatus} → ${h.toStatus}  [${h.operator}] ${h.reason}`);
  });
}
console.log();

// ============ 第六步：重算周报，确认小夜曲进入 ============
console.log('📊 【第六步】确认后重算周报 - 小夜曲应计入');
console.log('-'.repeat(70));

const report2 = store.generateWeeklyReport(weekInfo.week, weekInfo.year);

const serenadeInReport2 = report2.confirmedTracks.find(t => t.trackName === '小夜曲');
check('确认后小夜曲计入周报', !!serenadeInReport2, '已确认的小夜曲应出现在周报中');

const serenadeDetail = report2.report.details.find(d => d.canonicalName === '小夜曲');
if (serenadeDetail) {
  console.log(`  周报中"小夜曲": ${serenadeDetail.trackCount}首, ¥${serenadeDetail.totalAmount}`);
}
console.log();

// ============ 第七步：别名缺失冲突去重 ============
console.log('� 【第七步】再次导入同名"小夜曲"验证别名缺失冲突去重');
console.log('-'.repeat(70));

const beforeMissingCount = store.get().conflicts.filter(c => c.type === '别名缺失' && c.status === '待处理').length;

const importResult2 = store.importContract(
  {
    contractNo: 'HT-TEST-002',
    contractDate: '2026-06-11',
    totalAmount: 7000,
  },
  [
    { trackName: '小夜曲', nameType: '未知', amount: 7000, remarks: '第二批' },
  ]
);

const afterMissingCount = store.get().conflicts.filter(c => c.type === '别名缺失' && c.status === '待处理').length;
const newMissingFromImport = importResult2.newConflicts.filter(c => c.type === '别名缺失');

check('别名缺失去重：同曲目名不重复创建', newMissingFromImport.length === 0, `新增了 ${newMissingFromImport.length} 个别名缺失冲突`);
console.log();

// ============ 第八步：操作日志证据链 ============
console.log('📜 【第八步】操作日志 - 证据链完整性');
console.log('-'.repeat(70));

const logs = store.get().operationLogs;
console.log(`  总操作日志: ${logs.length} 条`);

const aliasAddLogs = logs.filter(l => l.operationType === '别名添加');
const dualIdentityLog = aliasAddLogs.find(l => l.description.includes('触发双重身份'));
check('别名添加日志标记双重身份', !!dualIdentityLog, '未找到含"触发双重身份"的日志');

const backScanLog = aliasAddLogs.find(l => l.description.includes('回扫'));
check('回扫同标准名曲目日志', !!backScanLog, '未找到含"回扫"的日志');

const conflictLogs = logs.filter(l => l.operationType === '冲突处理');
const dualResolveLog = conflictLogs.find(l => l.description.includes('双重身份'));
check('冲突处理日志记录双重身份确认', !!dualResolveLog, '未找到双重身份冲突处理日志');
console.log();

// ============ 最终总结 ============
console.log('='.repeat(70));
console.log('🏁 验证总结');
console.log('='.repeat(70));
console.log();
console.log(`  通过: ${passed.length} 项`);
console.log(`  失败: ${failed.length} 项`);
console.log();

if (failed.length > 0) {
  console.log('  ❌ 失败项:');
  failed.forEach(f => console.log(`    - ${f}`));
  console.log();
  console.log('⚠️ 存在未通过的验证项，请检查！');
} else {
  console.log('🎉 全部验证通过！');
}
console.log('='.repeat(70));

process.exit(failed.length > 0 ? 1 : 0);
