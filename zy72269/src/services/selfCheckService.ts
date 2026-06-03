import type { InspectionTask, SelfCheckReport, SelfCheckOptions } from '@/types';
import { generateUUID } from '@/utils/coordinate';
import { findDuplicates, compareMarks } from '@/utils/comparison';
import { detectZAxisAbnormalities } from '@/utils/coordinate';
import { recalculatePath } from './pathReplayService';
import { verifyExportConsistency } from '@/utils/exporter';

export async function runAllChecks(
  task: InspectionTask,
  options: SelfCheckOptions = {}
): Promise<SelfCheckReport[]> {
  const reports: SelfCheckReport[] = [];

  if (options.checkDuplicateImport !== false) {
    reports.push(await checkDuplicateImport(task));
  }

  if (options.checkZAxis !== false) {
    reports.push(await checkZAxisDirection(task));
  }

  if (options.runRecalculation !== false) {
    reports.push(await runRecalculation(task));
  }

  if (options.checkExportConsistency !== false) {
    reports.push(await checkExportConsistency(task));
  }

  return reports;
}

export async function checkDuplicateImport(task: InspectionTask): Promise<SelfCheckReport> {
  const now = new Date().toISOString();
  const duplicates = findDuplicates(task.marks);

  if (duplicates.length > 0) {
    return {
      id: generateUUID(),
      taskId: task.id,
      checkType: 'duplicate_import',
      result: 'warning',
      details: `发现 ${duplicates.length} 条重复记录，序号分别为: ${duplicates.map(d => d.sequenceNo).join(', ')}`,
      rawDataSnapshot: {
        duplicates: duplicates.map(d => ({
          sequenceNo: d.sequenceNo,
          coordinates: [d.x, d.y, d.z]
        }))
      },
      executedAt: now
    };
  }

  return {
    id: generateUUID(),
    taskId: task.id,
    checkType: 'duplicate_import',
    result: 'pass',
    details: `共 ${task.marks.length} 条记录，未发现重复导入`,
    rawDataSnapshot: { markCount: task.marks.length },
    executedAt: now
  };
}

export async function checkZAxisDirection(task: InspectionTask): Promise<SelfCheckReport> {
  const now = new Date().toISOString();
  const abnormalities = detectZAxisAbnormalities(task.marks);

  if (abnormalities.length > 0) {
    return {
      id: generateUUID(),
      taskId: task.id,
      checkType: 'z_axis_check',
      result: 'warning',
      details: `检测到 ${abnormalities.length} 条Z轴方向可能按旧习惯写反的记录，已标记待现场复核`,
      rawDataSnapshot: {
        abnormalities: abnormalities.map(a => ({
          sequenceNo: task.marks.find(m => m.id === a.markId)?.sequenceNo,
          detectedZ: a.detectedZ,
          expectedZ: a.expectedZ,
          reason: a.reason
        }))
      },
      executedAt: now
    };
  }

  return {
    id: generateUUID(),
    taskId: task.id,
    checkType: 'z_axis_check',
    result: 'pass',
    details: `Z轴方向检查通过，所有 ${task.marks.length} 条记录符合新标准（向上为正）`,
    rawDataSnapshot: { markCount: task.marks.length },
    executedAt: now
  };
}

export async function runRecalculation(task: InspectionTask): Promise<SelfCheckReport> {
  const now = new Date().toISOString();

  try {
    const result = recalculatePath(task.marks);

    const originalLength = task.marks.length > 1
      ? task.marks.reduce((sum, m, i, arr) => {
          if (i === 0) return 0;
          const prev = arr[i - 1];
          return sum + Math.sqrt(Math.pow(m.x - prev.x, 2) + Math.pow(m.y - prev.y, 2) + Math.pow(m.z - prev.z, 2));
        }, 0)
      : 0;

    const diff = Math.abs(result.totalLength - originalLength);

    if (diff > 0.1) {
      return {
        id: generateUUID(),
        taskId: task.id,
        checkType: 'recalculation',
        result: 'warning',
        details: `补录后重算完成，路径总长 ${result.totalLength.toFixed(2)}m，原始计算 ${originalLength.toFixed(2)}m，差异 ${diff.toFixed(3)}m`,
        rawDataSnapshot: {
          recalculatedLength: result.totalLength,
          originalLength,
          difference: diff,
          obstacleCount: result.obstacleCount,
          pointCount: result.points.length
        },
        executedAt: now
      };
    }

    return {
      id: generateUUID(),
      taskId: task.id,
      checkType: 'recalculation',
      result: 'pass',
      details: `补录后重算完成，路径总长 ${result.totalLength.toFixed(2)}m，共 ${result.points.length} 个路径点，${result.obstacleCount} 处障碍物`,
      rawDataSnapshot: {
        totalLength: result.totalLength,
        pointCount: result.points.length,
        obstacleCount: result.obstacleCount
      },
      executedAt: now
    };
  } catch (error) {
    return {
      id: generateUUID(),
      taskId: task.id,
      checkType: 'recalculation',
      result: 'fail',
      details: `重算过程中出现错误: ${error instanceof Error ? error.message : '未知错误'}`,
      rawDataSnapshot: { error: String(error) },
      executedAt: now
    };
  }
}

export async function checkExportConsistency(task: InspectionTask): Promise<SelfCheckReport> {
  const now = new Date().toISOString();

  try {
    const exportData = JSON.parse(JSON.stringify(task));
    const verification = verifyExportConsistency(exportData, task);

    if (!verification.consistent) {
      return {
        id: generateUUID(),
        taskId: task.id,
        checkType: 'export_consistency',
        result: 'fail',
        details: `导出一致性检查失败: ${verification.differences.join('; ')}`,
        rawDataSnapshot: { differences: verification.differences },
        executedAt: now
      };
    }

    return {
      id: generateUUID(),
      taskId: task.id,
      checkType: 'export_consistency',
      result: 'pass',
      details: `导出一致性检查通过，共 ${task.marks.length} 条标记、${task.conflicts.length} 条冲突记录、${task.abnormalities.length} 条异常记录可完整导出`,
      rawDataSnapshot: {
        markCount: task.marks.length,
        conflictCount: task.conflicts.length,
        abnormalityCount: task.abnormalities.length,
        sketchCount: task.sketches.length
      },
      executedAt: now
    };
  } catch (error) {
    return {
      id: generateUUID(),
      taskId: task.id,
      checkType: 'export_consistency',
      result: 'fail',
      details: `导出一致性检查过程中出现错误: ${error instanceof Error ? error.message : '未知错误'}`,
      rawDataSnapshot: { error: String(error) },
      executedAt: now
    };
  }
}

export function getCheckResultLabel(result: string): string {
  const labels: Record<string, string> = {
    pass: '通过',
    fail: '未通过',
    warning: '警告'
  };
  return labels[result] || result;
}

export function getCheckTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    duplicate_import: '重复导入检查',
    z_axis_check: 'Z轴方向检查',
    recalculation: '补录后重算',
    export_consistency: '导出一致性检查'
  };
  return labels[type] || type;
}

export function hasCriticalFailures(reports: SelfCheckReport[]): boolean {
  return reports.some(r => r.result === 'fail');
}
