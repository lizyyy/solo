import type { BendLossRecord, ConflictEntry, Nameplate, ScreenshotAttachment, SelfCheckResult, DuplicateInfo } from '@/types';

export function checkNameplateValidation(nameplates: Nameplate[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;
  const codeMap = new Map<string, string[]>();

  for (const np of nameplates) {
    const warnings: string[] = [];
    if (!np.equipmentCode.trim()) { warnings.push('设备编码为空'); passed = false; }
    if (!np.fiberType.trim()) { warnings.push('光纤类型为空'); passed = false; }
    if (np.coreDiameter <= 0 || np.coreDiameter > 1000) { warnings.push(`芯径异常: ${np.coreDiameter}μm`); passed = false; }
    if (np.claddingDiameter <= 0 || np.claddingDiameter > 1000) { warnings.push(`包层直径异常: ${np.claddingDiameter}μm`); passed = false; }
    if (np.coreDiameter >= np.claddingDiameter) { warnings.push(`芯径(${np.coreDiameter}μm) ≥ 包层直径(${np.claddingDiameter}μm)`); passed = false; }
    if (np.minBendRadius <= 0 || np.minBendRadius > 500) { warnings.push(`最小弯曲半径异常: ${np.minBendRadius}mm`); passed = false; }
    if (warnings.length > 0) {
      details.push(`铭牌 ${np.equipmentCode || np.id}: ${warnings.join('; ')}`);
    }

    const code = np.equipmentCode.trim();
    const existing = codeMap.get(code) || [];
    existing.push(np.id);
    codeMap.set(code, existing);
  }

  for (const [code, ids] of codeMap) {
    if (ids.length > 1) {
      passed = false;
      details.push(`重复设备编码 "${code}" 出现 ${ids.length} 次 (ID: ${ids.map(id => id.slice(0,10)).join(', ')}) — 【铭牌参数重复】`);
    }
  }

  const count = details.length;
  return {
    type: 'nameplate_validation',
    passed,
    message: passed ? `铭牌参数校验通过 (${nameplates.length} 个)` : `发现 ${count} 项铭牌参数问题`,
    details,
  };
}

export function checkDuplicateImport(records: BendLossRecord[], nameplates: Nameplate[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;

  const exactMap = new Map<string, { ids: string[]; importTimes: string[] }>();

  for (const r of records) {
    const key = `${r.nameplateId}-${r.bendRadius}-${r.direction}-${r.lossValue}`;
    const entry = exactMap.get(key) || { ids: [], importTimes: [] };
    entry.ids.push(r.id);
    entry.importTimes.push(r.recordTime);
    exactMap.set(key, entry);
  }

  for (const [, { ids, importTimes }] of exactMap) {
    if (ids.length <= 1) continue;
    passed = false;
    const matchRec = records.find(r => r.id === ids[0])!;
    const np = nameplates.find(n => n.id === matchRec.nameplateId);
    const npName = np ? np.equipmentCode : matchRec.nameplateId.slice(0, 10);
    const timesSorted = [...importTimes].sort();
    const first = timesSorted[0];
    const last = timesSorted[timesSorted.length - 1];
    const timeDiffMs = new Date(last).getTime() - new Date(first).getTime();
    const sameBatch = timeDiffMs < 60 * 1000;

    let category: string;
    if (sameBatch) {
      category = '【本次重复】同一批次连续录入完全相同记录';
    } else {
      const allSupp = records.filter(r => ids.includes(r.id)).every(r => r.isSupplementary);
      if (allSupp) {
        category = '【历史重复】多份补录数据完全相同';
      } else {
        category = '【历史重复】跨越多批次的完全相同记录';
      }
    }
    details.push(`${category}: ${npName} | R=${matchRec.bendRadius}mm D=${matchRec.direction} L=${matchRec.lossValue}dB — 出现 ${ids.length} 次 (ID: ${ids.map(id => id.slice(0,10)).join(', ')})`);
  }

  const nameplateRadiusMap = new Map<string, number>();
  for (const np of nameplates) nameplateRadiusMap.set(np.id, np.minBendRadius);

  const nearDuplicateMap = new Map<string, string[]>();
  for (const r of records) {
    const nearKey = `${r.nameplateId}-${r.direction}`;
    const existing = nearDuplicateMap.get(nearKey) || [];
    existing.push(r.id);
    nearDuplicateMap.set(nearKey, existing);
  }

  for (const [, ids] of nearDuplicateMap) {
    if (ids.length <= 1) continue;
    const sameGroup = records.filter(r => ids.includes(r.id));
    const radii = sameGroup.map(r => r.bendRadius).sort((a, b) => a - b);
    for (let i = 1; i < radii.length; i++) {
      if (radii[i] === radii[i - 1]) continue;
    }
  }

  const count = details.length;
  return {
    type: 'duplicate_import',
    passed,
    message: passed ? `重复检测通过 (${records.length} 条无重复)` : `发现 ${count} 组重复记录（已标注重复来源）`,
    details,
  };
}

export function checkNegativeDirection(records: BendLossRecord[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;

  for (const r of records) {
    if (r.direction === '向左' || r.direction === '向右') {
      if (r.status !== 'pending_review' && r.status !== 'reviewed') {
        passed = false;
        details.push(`记录 ${r.id.slice(0,10)}: 方向"${r.direction}"但状态"${r.status}" — 应为"待复核"或"已复核"`);
      }
      if (r.direction === '向左' && r.status === 'pending_review' && !r.reviewer) {
        details.push(`提示: 记录 ${r.id.slice(0,10)} "向左"已正确标记待复核，需实验老师复核 (非错误，仅提示)`);
      }
    }
    if ((r.direction === '+' || r.direction === '-') && r.status === 'pending_review') {
      passed = false;
      details.push(`记录 ${r.id.slice(0,10)}: 方向为规范值"${r.direction}"但状态异常停留在"待复核"`);
    }
  }

  const leftCount = records.filter(r => r.direction === '向左').length;
  const pendingCount = records.filter(r => r.status === 'pending_review').length;

  return {
    type: 'negative_direction',
    passed,
    message: passed ? `负方向检测通过 (向左${leftCount}条全部标记，待复核${pendingCount}条)` : `发现 ${details.filter(d => !d.startsWith('提示:')).length} 条负方向状态异常`,
    details,
  };
}

export function checkSupplementaryRecalc(records: BendLossRecord[], nameplates: Nameplate[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;
  const npMap = new Map(nameplates.map(n => [n.id, n]));

  for (const r of records) {
    if (r.isSupplementary) {
      if (!r.supplementaryNote || r.supplementaryNote.trim().length < 5) {
        passed = false;
        details.push(`补录记录 ${r.id.slice(0,10)}: 补录说明过短或缺失 ("${r.supplementaryNote || '空'}") — 请填写不少于5字的补录说明`);
      }
      if (r.status === 'normal' && r.direction !== '向左') {
        passed = false;
        details.push(`补录记录 ${r.id.slice(0,10)}: 状态为"正常"但补录后应触发关联重算 — 请确认补录数据对同铭牌其他记录的影响`);
      }
      const np = npMap.get(r.nameplateId);
      if (np && r.bendRadius < np.minBendRadius) {
        details.push(`补录超限: 记录 ${r.id.slice(0,10)} R=${r.bendRadius}mm < 铭牌最小${np.minBendRadius}mm (${np.equipmentCode})`);
      }
    }
  }

  const suppCount = records.filter(r => r.isSupplementary).length;
  const suppWithNote = records.filter(r => r.isSupplementary && r.supplementaryNote && r.supplementaryNote.length >= 5).length;

  return {
    type: 'supplementary_recalc',
    passed,
    message: passed ? `补录验证通过 (${suppCount}条补录，${suppWithNote}条说明合格)` : `发现 ${details.length} 条补录问题`,
    details,
  };
}

export function checkExportConsistency(records: BendLossRecord[], conflicts: ConflictEntry[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  if (pendingConflicts.length > 0) {
    passed = false;
    details.push(`存在 ${pendingConflicts.length} 条未裁决冲突 (${pendingConflicts.map(c => c.id.slice(0,10)).join(', ')}) — 请设备工程师在异常工况表裁决`);
  }

  const pendingReview = records.filter(r => r.status === 'pending_review');
  if (pendingReview.length > 0) {
    passed = false;
    details.push(`存在 ${pendingReview.length} 条待复核记录 (${pendingReview.map(r => r.id.slice(0,10)).join(', ')}) — 请实验老师复核方向判定`);
  }

  const conflictRecords = records.filter(r => r.status === 'conflict');
  if (conflictRecords.length > 0) {
    passed = false;
    details.push(`存在 ${conflictRecords.length} 条处于"冲突"状态的记录 — 需裁决后状态变更才能导出`);
  }

  const reviewStatus = records.filter(r => r.status === 'reviewed');
  const reviewedWithConclusion = reviewStatus.filter(r => r.reviewConclusion && r.reviewConclusion.trim().length > 0);
  if (reviewStatus.length > reviewedWithConclusion.length) {
    passed = false;
    details.push(`${reviewStatus.length - reviewedWithConclusion.length} 条已复核记录缺少复核结论文字`);
  }

  const count = details.length;
  return {
    type: 'export_consistency',
    passed,
    message: passed ? `导出一致性通过 (可安全导出)` : `发现 ${count} 项导出前需处理问题`,
    details,
  };
}

export function checkScreenshotNoteIntegrity(screenshots: ScreenshotAttachment[], records: BendLossRecord[]): SelfCheckResult {
  const details: string[] = [];
  let passed = true;
  const recMap = new Map(records.map(r => [r.id, r]));

  for (const ss of screenshots) {
    if (!ss.note || ss.note.trim().length < 2) {
      passed = false;
      const r = recMap.get(ss.recordId);
      details.push(`截图 ${ss.id.slice(0,10)} (记录${r ? 'R=' + r.bendRadius + 'D=' + r.direction : ss.recordId.slice(0,10)}): 备注缺失或过短 — 维修群截图的备注不能留空`);
    }
    if (ss.note && ss.note.length > 2) {
      const keywords = ['最小弯曲半径', '芯径', '包层', '弯曲半径', '超', '小', '大', '短', '长', '向左', '向右', '铭牌', '实测'];
      const matched = keywords.filter(k => ss.note.includes(k));
      if (matched.length > 0) {
        details.push(`截图 ${ss.id.slice(0,10)} 备注含关键业务词: ${matched.join('、')} (非错误，提示已自动参与冲突比对)`);
      }
    }
  }

  const recordsWithoutNote = new Set<string>();
  for (const ss of screenshots) {
    if (!ss.note || ss.note.trim().length < 2) recordsWithoutNote.add(ss.recordId);
  }

  const count = details.filter(d => !d.includes('(非错误')).length;
  const ssCount = screenshots.length;
  const goodNotes = ssCount - recordsWithoutNote.size;
  return {
    type: 'screenshot_note_integrity',
    passed,
    message: passed ? `截图备注完整 (${goodNotes}/${ssCount} 条备注合格)` : `发现 ${count} 条截图备注不完整`,
    details,
  };
}

export function runAllSelfChecks(
  nameplates: Nameplate[],
  records: BendLossRecord[],
  conflicts: ConflictEntry[],
  screenshots: ScreenshotAttachment[]
): SelfCheckResult[] {
  return [
    checkNameplateValidation(nameplates),
    checkDuplicateImport(records, nameplates),
    checkNegativeDirection(records),
    checkSupplementaryRecalc(records, nameplates),
    checkExportConsistency(records, conflicts),
    checkScreenshotNoteIntegrity(screenshots, records),
  ];
}

export function classifyDuplicate(
  record: BendLossRecord,
  allRecords: BendLossRecord[],
  nameplates: Nameplate[]
): DuplicateInfo {
  void nameplates;
  const sameExact = allRecords.filter(r =>
    r.id !== record.id &&
    r.nameplateId === record.nameplateId &&
    r.bendRadius === record.bendRadius &&
    r.direction === record.direction &&
    r.lossValue === record.lossValue
  );

  if (sameExact.length === 0) {
    return { category: 'new_record', matchRecordIds: [], description: '新记录，无重复' };
  }

  const times = [...sameExact.map(r => r.recordTime), record.recordTime].sort();
  const first = times[0];
  const last = times[times.length - 1];
  const diffMs = new Date(last).getTime() - new Date(first).getTime();

  if (diffMs < 60 * 1000) {
    return {
      category: 'exact_same_import',
      matchRecordIds: sameExact.map(r => r.id),
      description: `本次重复：与 ${sameExact.length} 条记录在1分钟内连续录入完全相同数据`,
    };
  }

  return {
    category: 'history_duplicate',
    matchRecordIds: sameExact.map(r => r.id),
    description: `历史重复：与 ${sameExact.length} 条历史记录数据完全一致`,
  };
}
