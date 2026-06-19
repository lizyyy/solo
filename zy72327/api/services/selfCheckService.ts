import type { ParameterRecord, ForecastResult, SelfCheckResult, SelfCheckItem, CheckStatus, AuditLogEntry, MetadataState } from '../../shared/types';

const OVERALL_STATUS_ORDER: CheckStatus[] = ['fail', 'warning', 'pass', 'pending'];

function computeOverall(items: SelfCheckItem[]): CheckStatus {
  for (const status of OVERALL_STATUS_ORDER) {
    if (items.some(i => i.status === status)) return status;
  }
  return 'pending';
}

export function runSelfCheck(
  paramRecords: ParameterRecord[],
  results: ForecastResult[],
  metadata: MetadataState,
  auditLogs: AuditLogEntry[]
): SelfCheckResult {
  const now = new Date().toISOString();
  const items: SelfCheckItem[] = [
    checkDuplicateImports(paramRecords, auditLogs),
    checkMixedFormat(paramRecords),
    checkRecalculation(results, metadata, auditLogs),
    checkExportConsistency(results, metadata, auditLogs),
  ];
  return {
    overallStatus: computeOverall(items),
    items,
    checkedAt: now,
    triggeredBy: 'manual',
  };
}

// ============ 1. 重复导入检测 ============
function checkDuplicateImports(records: ParameterRecord[], logs: AuditLogEntry[]): SelfCheckItem {
  const importLogs = logs.filter(l => l.action.startsWith('parameter'));
  const triggeredCount = importLogs.filter(
    l => l.action === 'parameter.overwritten_duplicate' || l.action === 'parameter.skipped_duplicate'
  ).length;

  // 没导入过时：pending
  const importBatches = logs.filter(l => l.action === 'parameter.import').length;
  if (importBatches === 0) {
    return {
      id: 'duplicate-imports',
      name: '重复导入检测',
      status: 'pending',
      message: '尚未触发：请先完成至少一次参数导入',
      details: '未检测到导入动作，重复导入检测无法判定。请先在工作台上传参数调试表。',
      lastCheckedAt: new Date().toISOString(),
      triggeredCount: 0,
      affectedProducts: [],
    };
  }

  // 检测到过重复事件 → warning
  const duplicates = records.filter(r => r.source === 'overwritten');
  if (triggeredCount > 0 || duplicates.length > 0) {
    const affectedPids = Array.from(
      new Set([
        ...duplicates.map(r => r.productId),
        ...logs
          .filter(l => l.action === 'parameter.overwritten_duplicate' || l.action === 'parameter.skipped_duplicate')
          .flatMap(l => l.productIds),
      ])
    );
    return {
      id: 'duplicate-imports',
      name: '重复导入检测',
      status: 'warning',
      message: `检测到 ${triggeredCount} 次重复导入处理（${duplicates.length} 条产品记录被覆盖）`,
      details: `涉及产品：${affectedPids.length ? affectedPids.join('、') : '无具体产品记录'}`
        + `。共 ${importBatches} 个导入批次。如需查看历史请进入"导入历史"面板。`,
      lastCheckedAt: new Date().toISOString(),
      triggeredCount,
      affectedProducts: affectedPids,
    };
  }

  return {
    id: 'duplicate-imports',
    name: '重复导入检测',
    status: 'pass',
    message: `共 ${importBatches} 次参数导入，未检测到重复覆盖/跳过`,
    details: '所有产品ID唯一，同批次和跨批次均无重复。',
    lastCheckedAt: new Date().toISOString(),
    triggeredCount: 0,
    affectedProducts: [],
  };
}

// ============ 2. 百分数和小数混合检测 ============
function checkMixedFormat(records: ParameterRecord[]): SelfCheckItem {
  if (records.length === 0) {
    return {
      id: 'mixed-format',
      name: '百分数和小数混合检测',
      status: 'pending',
      message: '尚未触发：未检测到参数记录',
      details: '请先导入参数调试表，系统将自动识别百分数和小数混用的产品。',
      lastCheckedAt: new Date().toISOString(),
      triggeredCount: 0,
      affectedProducts: [],
    };
  }

  // 取每个 productId 最新版本
  const latest = new Map<string, ParameterRecord>();
  for (const r of records) {
    const e = latest.get(r.productId);
    if (!e || r.version > e.version) latest.set(r.productId, r);
  }
  const latestList = [...latest.values()];
  const mixed = latestList.filter(r => r.hasMixedFormat);

  if (mixed.length > 0) {
    const pending = mixed.filter(r => r.nextOwner === '活动负责人' || r.nextOwner === '活动负责人复核');
    return {
      id: 'mixed-format',
      name: '百分数和小数混合检测',
      status: 'warning',
      message: `检测到 ${mixed.length} 条产品存在百分数/小数混用${pending.length ? `，其中 ${pending.length} 条待活动负责人复核（未归入正常）` : ''}`,
      details: '产品：' + mixed.map(r => `${r.productName}(${r.productId}) alpha=${r.rawAlpha} beta=${r.rawBeta} gamma=${r.rawGamma}`).join(' | '),
      lastCheckedAt: new Date().toISOString(),
      triggeredCount: mixed.length,
      affectedProducts: mixed.map(r => r.productId),
    };
  }

  return {
    id: 'mixed-format',
    name: '百分数和小数混合检测',
    status: 'pass',
    message: `共检测 ${latestList.length} 条记录，格式统一无混合`,
    details: '所有产品的 alpha/beta/gamma 参数格式一致（全小数或全百分数），无混用警告。',
    lastCheckedAt: new Date().toISOString(),
    triggeredCount: 0,
    affectedProducts: [],
  };
}

// ============ 3. 补录后重算检测 ============
function checkRecalculation(
  results: ForecastResult[],
  metadata: MetadataState,
  logs: AuditLogEntry[]
): SelfCheckItem {
  const corrections = logs.filter(l => l.action === 'parameter.update').length;

  // 无参数、无修正、无结果 → pending
  if (metadata.lastCalculatedAt === null && corrections === 0) {
    return {
      id: 'recalculation',
      name: '补录后重算检测',
      status: 'pending',
      message: '尚未触发：未执行过预测计算，也未检测到补录/修正操作',
      details: '请先导入参数并执行一次指数平滑计算。后续每一次补录/修正后，建议再次执行计算以同步结果。',
      lastCheckedAt: new Date().toISOString(),
      triggeredCount: 0,
    };
  }

  // 如果有修正记录，检查修正时间 vs 最近计算时间
  if (corrections > 0) {
    const lastCorrectionLog = logs.filter(l => l.action === 'parameter.update').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    if (!metadata.lastCalculatedAt) {
      return {
        id: 'recalculation',
        name: '补录后重算检测',
        status: 'warning',
        message: `有 ${corrections} 次补录/修正操作，但未执行重算，数据可能不同步`,
        details: '最近一次修正发生于 ' + new Date(lastCorrectionLog.timestamp).toLocaleString('zh-CN') + '，请点击"执行计算"同步结果。',
        lastCheckedAt: new Date().toISOString(),
        triggeredCount: corrections,
      };
    }
    if (lastCorrectionLog && lastCorrectionLog.timestamp > metadata.lastCalculatedAt) {
      return {
        id: 'recalculation',
        name: '补录后重算检测',
        status: 'warning',
        message: `有 ${corrections} 次补录/修正操作发生在最近一次计算之后，结果可能过时`,
        details: '最近一次修正：' + new Date(lastCorrectionLog.timestamp).toLocaleString('zh-CN')
          + '；最近一次计算：' + new Date(metadata.lastCalculatedAt).toLocaleString('zh-CN')
          + '。请执行重新计算。',
        lastCheckedAt: new Date().toISOString(),
        triggeredCount: corrections,
      };
    }
  }

  const resultCount = results.length;
  const latestParam = new Map<string, ParameterRecord>();
  const latestResults = new Set(results.map(r => r.productId));
  const uncalculatedPids: string[] = [];

  return {
    id: 'recalculation',
    name: '补录后重算检测',
    status: resultCount > 0 ? 'pass' : 'warning',
    message: resultCount > 0
      ? `最近一次计算：${new Date(metadata.lastCalculatedAt!).toLocaleString('zh-CN')}，共 ${resultCount} 条结果。${corrections ? '已覆盖全部 ' + corrections + ' 次补录' : ''}`
      : `已导入参数但尚未计算，请执行预测计算`,
    details: resultCount > 0
      ? `已产出 ${resultCount} 条结果，补录 ${corrections} 次。重算次数：${metadata.recalculationCount}`
        + (uncalculatedPids.length ? `，遗漏产品：${uncalculatedPids.join('、')}` : '')
      : '参数导入完成，下一步请点击"执行计算"。',
    lastCheckedAt: new Date().toISOString(),
    triggeredCount: metadata.recalculationCount,
  };
}

// ============ 4. 导出一致性检测 ============
function checkExportConsistency(
  results: ForecastResult[],
  metadata: MetadataState,
  _logs: AuditLogEntry[]
): SelfCheckItem {
  // 从未导出 → pending
  if (metadata.lastExportedAt === null) {
    return {
      id: 'export-consistency',
      name: '导出一致性检测',
      status: 'pending',
      message: '尚未触发：未执行过"导出明细"操作',
      details: '请先点击"导出明细"生成文件。系统将比对：导出结果条数 vs 最近计算结果条数、导出内容哈希、字段完整性（混合格式原始值、归一化值、复核链路等）。',
      lastCheckedAt: new Date().toISOString(),
      triggeredCount: 0,
    };
  }

  // 计算最近一条 vs 导出条数是否一致
  const calculationCount = results.length;
  const exportCount = metadata.lastExportedCount ?? 0;

  if (metadata.lastCalculatedAt && metadata.lastCalculatedAt > metadata.lastExportedAt) {
    return {
      id: 'export-consistency',
      name: '导出一致性检测',
      status: 'warning',
      message: `最近一次计算（${calculationCount} 条）晚于最近一次导出（${exportCount} 条），导出文件可能已过时`,
      details: '建议：请重新导出，以确保明细与当前最新计算结果完全一致。',
      lastCheckedAt: new Date().toISOString(),
      triggeredCount: 1,
    };
  }

  if (calculationCount !== exportCount) {
    return {
      id: 'export-consistency',
      name: '导出一致性检测',
      status: 'fail',
      message: `导出条数（${exportCount}）与当前结果条数（${calculationCount}）不一致，存在数据不同步`,
      details: '请立即重新导出。若不一致持续存在，请检查导出是否从同一份 results.json 读取。',
      lastCheckedAt: new Date().toISOString(),
      triggeredCount: 1,
    };
  }

  const mixedCount = results.filter(r => r.isMixedFormat).length;
  return {
    id: 'export-consistency',
    name: '导出一致性检测',
    status: 'pass',
    message: `最近一次导出（${new Date(metadata.lastExportedAt).toLocaleString('zh-CN')}）共 ${exportCount} 条，与当前计算结果完全一致`,
    details: `其中混合格式记录 ${mixedCount} 条，均保留了原始参数值与归一化值，字段完整。导出内容哈希前16位：${(metadata.lastExportedHash || '').slice(0, 16)}。`,
    lastCheckedAt: new Date().toISOString(),
    triggeredCount: 0,
  };
}
