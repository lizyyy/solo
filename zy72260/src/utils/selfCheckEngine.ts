import {
  SelfCheckItem,
  SelfCheckType,
  Route,
  PointCloudLog,
  SafetyRadiusTable,
  ConflictRecord,
  ExportRecord,
} from '@/types';
import { db } from '@/db';

export function createInitialSelfChecks(): SelfCheckItem[] {
  const checks: Array<Omit<SelfCheckItem, 'id' | 'checkTime'>> = [
    {
      type: 'duplicate_import',
      status: 'not_run',
      title: '重复导入检测',
      message: '检查当前导入的文件是否与历史记录重复',
      details: {},
    },
    {
      type: 'length_not_recalculated',
      status: 'not_run',
      title: '补录路线长度重算检测',
      message: '检查补录路线是否已重新计算长度',
      details: {},
    },
    {
      type: 'supplementary_recalc',
      status: 'not_run',
      title: '补录后全线重算检测',
      message: '检查补录后是否已重新执行全线长度计算',
      details: {},
    },
    {
      type: 'export_consistency',
      status: 'not_run',
      title: '导出一致性检测',
      message: '检查当前数据状态与历史导出是否一致',
      details: {},
    },
  ];

  return checks.map((c, idx) => ({
    ...c,
    id: `check_${Date.now()}_${idx}`,
  }));
}

export async function runDuplicateImportCheck(
  fileHash: string,
  type: 'point_cloud' | 'safety_radius',
  currentFilename: string
): Promise<SelfCheckItem> {
  const history = await db.importHistory
    .where('[type+fileHash]')
    .equals([type, fileHash])
    .reverse()
    .sortBy('importTime');

  const previousImports = history.filter(
    (h) => h.importTime !== history[0]?.importTime
  );

  const baseCheck: Omit<SelfCheckItem, 'id' | 'checkTime'> = {
    type: 'duplicate_import',
    status: previousImports.length > 0 ? 'warning' : 'pass',
    title: '重复导入检测',
    message: previousImports.length > 0
      ? `检测到该文件已导入过 ${previousImports.length} 次，请确认是否确实需要重复导入`
      : '未检测到重复导入',
    details: {
      fileHash,
      type,
      currentFilename,
      previousImports: previousImports.map((h) => ({
        filename: h.filename,
        importTime: h.importTime,
        operator: h.operator,
      })),
    },
  };

  return {
    ...baseCheck,
    id: `check_duplicate_${type}_${Date.now()}`,
    checkTime: new Date().toISOString(),
  };
}

export function runLengthNotRecalculatedCheck(
  routes: Route[]
): SelfCheckItem {
  const supplementaryRoutes = routes.filter((r) => r.isSupplementary);
  const notRecalculated = supplementaryRoutes.filter(
    (r) => !r.lengthRecalculated && r.reviewStatus === 'pending'
  );

  const hasIssues = notRecalculated.length > 0;

  const baseCheck: Omit<SelfCheckItem, 'id' | 'checkTime'> = {
    type: 'length_not_recalculated',
    status: hasIssues ? 'pending_review' : 'pass',
    title: '补录路线长度重算检测',
    message: hasIssues
      ? `有 ${notRecalculated.length} 条补录路线长度未重新计算，已标记【待客户复核】，请转展陈客户确认`
      : '所有补录路线长度均已重新计算',
    details: {
      supplementaryCount: supplementaryRoutes.length,
      notRecalculatedCount: notRecalculated.length,
      notRecalculatedRoutes: notRecalculated.map((r) => ({
        routeId: r.id,
        reportedLength: r.reportedLength,
        calculatedLength: r.calculatedLength,
        diff: r.reportedLength !== undefined
          ? Math.abs(r.calculatedLength - r.reportedLength)
          : null,
        reviewStatus: r.reviewStatus,
      })),
    },
  };

  return {
    ...baseCheck,
    id: `check_length_${Date.now()}`,
    checkTime: new Date().toISOString(),
  };
}

export function runSupplementaryRecalcCheck(
  routes: Route[],
  lastSupplementaryTime?: string,
  lastRouteCalcTime?: string
): SelfCheckItem {
  const supplementaryRoutes = routes.filter((r) => r.isSupplementary);
  const hasSupplementary = supplementaryRoutes.length > 0;

  let status: SelfCheckItem['status'] = 'pass';
  let message = '无需重算（无补录路线）';

  if (hasSupplementary) {
    if (!lastSupplementaryTime || !lastRouteCalcTime) {
      status = 'fail';
      message = '检测到补录路线，但尚未执行全线重算，请点击"一键重算"';
    } else {
      const supplementaryDate = new Date(lastSupplementaryTime);
      const calcDate = new Date(lastRouteCalcTime);
      
      if (calcDate < supplementaryDate) {
        status = 'fail';
        message = '补录操作在最后一次重算之后，请重新执行全线重算';
      } else {
        status = 'pass';
        message = '补录后已执行全线重算';
      }
    }
  }

  const baseCheck: Omit<SelfCheckItem, 'id' | 'checkTime'> = {
    type: 'supplementary_recalc',
    status,
    title: '补录后全线重算检测',
    message,
    details: {
      hasSupplementary,
      supplementaryCount: supplementaryRoutes.length,
      lastSupplementaryTime,
      lastRouteCalcTime,
      needRecalc: status === 'fail',
    },
  };

  return {
    ...baseCheck,
    id: `check_supplementary_${Date.now()}`,
    checkTime: new Date().toISOString(),
  };
}

export async function runExportConsistencyCheck(
  pointCloudLog: PointCloudLog | null,
  safetyRadiusTable: SafetyRadiusTable | null,
  routes: Route[],
  conflicts: ConflictRecord[],
  exportHistory: ExportRecord[]
): Promise<SelfCheckItem> {
  const differences: Array<{
    type: string;
    field: string;
    description: string;
  }> = [];

  if (exportHistory.length === 0) {
    const baseCheck: Omit<SelfCheckItem, 'id' | 'checkTime'> = {
      type: 'export_consistency',
      status: 'pass',
      title: '导出一致性检测',
      message: '首次导出，无历史数据可对比',
      details: {
        isFirstExport: true,
        differences: [],
      },
    };

    return {
      ...baseCheck,
      id: `check_export_${Date.now()}`,
      checkTime: new Date().toISOString(),
    };
  }

  const lastExport = exportHistory[0];
  const currentTotalLength = routes.reduce((sum, r) => sum + r.calculatedLength, 0);
  const currentExhibitCount = pointCloudLog?.exhibits.length || 0;
  const currentPendingConflicts = conflicts.filter((c) => c.status === 'pending').length;
  const currentPendingReviews = routes.filter(
    (r) => r.reviewStatus === 'pending'
  ).length;

  if (Math.abs(currentTotalLength - lastExport.routeLength) > 0.01) {
    differences.push({
      type: 'length',
      field: 'totalRouteLength',
      description: `动线总长度变更：${lastExport.routeLength.toFixed(2)}m → ${currentTotalLength.toFixed(2)}m`,
    });
  }

  if (currentExhibitCount !== lastExport.exhibitCount) {
    differences.push({
      type: 'exhibit',
      field: 'exhibitCount',
      description: `展柜数量变更：${lastExport.exhibitCount} → ${currentExhibitCount}`,
    });
  }

  if (currentPendingConflicts !== lastExport.conflictCount) {
    differences.push({
      type: 'status',
      field: 'pendingConflicts',
      description: `待处理冲突数量变更：${lastExport.conflictCount} → ${currentPendingConflicts}`,
    });
  }

  if (currentPendingReviews !== lastExport.pendingReviewCount) {
    differences.push({
      type: 'status',
      field: 'pendingReviews',
      description: `待复核数量变更：${lastExport.pendingReviewCount} → ${currentPendingReviews}`,
    });
  }

  if (safetyRadiusTable && lastExport.dataHash) {
    const currentHash = await calculateDataHash(
      pointCloudLog,
      safetyRadiusTable,
      routes,
      conflicts
    );
    if (currentHash !== lastExport.dataHash) {
      differences.push({
        type: 'data',
        field: 'dataHash',
        description: '数据内容已变更，与上一次导出不一致',
      });
    }
  }

  const hasDifferences = differences.length > 0;

  const baseCheck: Omit<SelfCheckItem, 'id' | 'checkTime'> = {
    type: 'export_consistency',
    status: hasDifferences ? 'warning' : 'pass',
    title: '导出一致性检测',
    message: hasDifferences
      ? `检测到 ${differences.length} 项与上一次导出不一致，请确认变更`
      : '与上一次导出内容一致',
    details: {
      lastExportVersion: lastExport.version,
      lastExportTime: lastExport.exportTime,
      differences,
      current: {
        totalLength: currentTotalLength,
        exhibitCount: currentExhibitCount,
        pendingConflicts: currentPendingConflicts,
        pendingReviews: currentPendingReviews,
      },
      previous: {
        totalLength: lastExport.routeLength,
        exhibitCount: lastExport.exhibitCount,
        pendingConflicts: lastExport.conflictCount,
        pendingReviews: lastExport.pendingReviewCount,
      },
    },
  };

  return {
    ...baseCheck,
    id: `check_export_${Date.now()}`,
    checkTime: new Date().toISOString(),
  };
}

export async function runAllSelfChecks(
  pointCloudLog: PointCloudLog | null,
  safetyRadiusTable: SafetyRadiusTable | null,
  routes: Route[],
  conflicts: ConflictRecord[],
  exports: ExportRecord[],
  workflow: {
    lastSupplementaryTime?: string;
    lastRouteCalcTime?: string;
  }
): Promise<SelfCheckItem[]> {
  const checks: SelfCheckItem[] = [];

  if (pointCloudLog) {
    checks.push(
      await runDuplicateImportCheck(
        pointCloudLog.fileHash,
        'point_cloud',
        pointCloudLog.filename
      )
    );
  }

  if (safetyRadiusTable) {
    checks.push(
      await runDuplicateImportCheck(
        md5(safetyRadiusTable.rawContent),
        'safety_radius',
        safetyRadiusTable.filename
      )
    );
  }

  checks.push(runLengthNotRecalculatedCheck(routes));
  checks.push(
    runSupplementaryRecalcCheck(
      routes,
      workflow.lastSupplementaryTime,
      workflow.lastRouteCalcTime
    )
  );
  checks.push(
    await runExportConsistencyCheck(
      pointCloudLog,
      safetyRadiusTable,
      routes,
      conflicts,
      exports
    )
  );

  await Promise.all(checks.map((c) => db.selfCheckLogs.put(c)));

  return checks;
}

async function calculateDataHash(
  pointCloudLog: PointCloudLog | null,
  safetyRadiusTable: SafetyRadiusTable | null,
  routes: Route[],
  conflicts: ConflictRecord[]
): Promise<string> {
  const data = {
    pointCloud: pointCloudLog?.exhibits.map((e) => ({
      id: e.exhibitId,
      radius: e.safetyRadius || e.pointCloudRadius,
    })),
    routes: routes.map((r) => ({
      id: r.id,
      length: r.calculatedLength,
      status: r.reviewStatus,
    })),
    conflicts: conflicts.map((c) => ({
      id: c.id,
      status: c.status,
      decision: c.decision,
    })),
  };
  
  return md5(JSON.stringify(data));
}

function md5(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export function getPendingReviewsCount(routes: Route[]): number {
  return routes.filter((r) => r.reviewStatus === 'pending').length;
}

export function hasPendingReviews(routes: Route[]): boolean {
  return routes.some((r) => r.reviewStatus === 'pending');
}

export function getSelfCheckSummary(checks: SelfCheckItem[]): {
  total: number;
  pass: number;
  warning: number;
  fail: number;
  pendingReview: number;
  notRun: number;
} {
  const summary = {
    total: checks.length,
    pass: 0,
    warning: 0,
    fail: 0,
    pendingReview: 0,
    notRun: 0,
  };

  for (const check of checks) {
    summary[check.status]++;
  }

  return summary;
}
