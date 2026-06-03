import { db } from '../db';
import type { FloorSketch, Obstacle, SelfCheckResult, Conflict } from '../types';
import { generateId } from './conflictDetectionService';
import { detectAllConflicts } from './conflictDetectionService';

export async function checkDuplicateImports(sketches: FloorSketch[]): Promise<SelfCheckResult> {
  const hashMap = new Map<string, string[]>();

  for (const sketch of sketches) {
    if (!hashMap.has(sketch.fileHash)) {
      hashMap.set(sketch.fileHash, []);
    }
    hashMap.get(sketch.fileHash)!.push(sketch.name);
  }

  const duplicates = Array.from(hashMap.entries())
    .filter(([, names]) => names.length > 1)
    .map(([hash, names]) => ({ hash, names, count: names.length }));

  const result: SelfCheckResult = {
    id: generateId(),
    type: 'duplicate-import',
    status: duplicates.length === 0 ? 'pass' : 'warning',
    message: duplicates.length === 0
      ? '未检测到重复导入'
      : `检测到 ${duplicates.length} 个重复导入`,
    details: { duplicates },
    checkedAt: new Date(),
  };

  await db.selfCheckResults.add(result);
  return result;
}

export async function checkMultipleNames(obstacles: Obstacle[]): Promise<SelfCheckResult> {
  const conflicts = detectAllConflicts(obstacles);
  const duplicateNameConflicts = conflicts.filter(c => c.type === 'duplicate-name');

  const result: SelfCheckResult = {
    id: generateId(),
    type: 'multiple-names',
    status: duplicateNameConflicts.length === 0 ? 'pass' : 'warning',
    message: duplicateNameConflicts.length === 0
      ? '未检测到同一障碍物多名称'
      : `检测到 ${duplicateNameConflicts.length} 个障碍物多名称冲突`,
    details: {
      conflictCount: duplicateNameConflicts.length,
      conflicts: duplicateNameConflicts.map(c => ({
        id: c.id,
        obstacleIds: c.obstacleIds,
        names: c.evidence.sketchData?.currentName + ' / ' + c.evidence.pointCloudData?.currentName,
        overlapPercentage: c.evidence.overlapPercentage,
      })),
    },
    checkedAt: new Date(),
  };

  await db.selfCheckResults.add(result);
  return result;
}

export async function checkRecalculateConsistency(
  obstacles: Obstacle[],
  existingConflicts: Conflict[]
): Promise<SelfCheckResult> {
  const newConflicts = detectAllConflicts(obstacles);
  const existingPendingIds = new Set(
    existingConflicts.filter(c => c.status === 'pending').map(c => c.obstacleIds.sort().join('-'))
  );
  const newPendingIds = new Set(
    newConflicts.map(c => c.obstacleIds.sort().join('-'))
  );

  const missingConflicts = Array.from(existingPendingIds).filter(id => !newPendingIds.has(id));
  const newFoundConflicts = Array.from(newPendingIds).filter(id => !existingPendingIds.has(id));

  const isConsistent = missingConflicts.length === 0 && newFoundConflicts.length === 0;

  const result: SelfCheckResult = {
    id: generateId(),
    type: 'recalculate',
    status: isConsistent ? 'pass' : 'warning',
    message: isConsistent
      ? '补录重算结果一致'
      : `补录重算结果不一致: 消失 ${missingConflicts.length} 个, 新增 ${newFoundConflicts.length} 个`,
    details: {
      missingConflicts,
      newFoundConflicts,
      originalCount: existingPendingIds.size,
      recalculatedCount: newPendingIds.size,
    },
    checkedAt: new Date(),
  };

  await db.selfCheckResults.add(result);
  return result;
}

export async function checkExportConsistency(
  exportData: Record<string, unknown>,
  sourceData: {
    sketch: FloorSketch;
    obstacles: Obstacle[];
    conflicts: Conflict[];
  }
): Promise<SelfCheckResult> {
  const issues: string[] = [];

  const exportObstacles = exportData.obstacles as Obstacle[];
  if (exportObstacles.length !== sourceData.obstacles.length) {
    issues.push(`障碍物数量不一致: 导出 ${exportObstacles.length}, 实际 ${sourceData.obstacles.length}`);
  }

  const exportConflicts = exportData.conflicts as Conflict[];
  if (exportConflicts.length !== sourceData.conflicts.length) {
    issues.push(`冲突数量不一致: 导出 ${exportConflicts.length}, 实际 ${sourceData.conflicts.length}`);
  }

  const obstaclesWithMultipleNames = sourceData.obstacles.filter(o => o.nameHistory.length > 1);
  const exportObstaclesWithHistory = exportObstacles.filter(
    (o: Obstacle) => o.nameHistory && o.nameHistory.length > 1
  );

  if (obstaclesWithMultipleNames.length !== exportObstaclesWithHistory.length) {
    issues.push(`多名称障碍物记录不一致`);
  }

  const result: SelfCheckResult = {
    id: generateId(),
    type: 'export-consistency',
    status: issues.length === 0 ? 'pass' : 'fail',
    message: issues.length === 0 ? '导出数据一致' : `导出数据存在 ${issues.length} 处不一致`,
    details: { issues },
    checkedAt: new Date(),
  };

  await db.selfCheckResults.add(result);
  return result;
}

export async function runAllChecks(
  sketches: FloorSketch[],
  obstacles: Obstacle[],
  conflicts: Conflict[]
): Promise<SelfCheckResult[]> {
  const results: SelfCheckResult[] = [];

  results.push(await checkDuplicateImports(sketches));
  results.push(await checkMultipleNames(obstacles));
  results.push(await checkRecalculateConsistency(obstacles, conflicts));

  return results;
}

export async function getLatestCheckResults(): Promise<SelfCheckResult[]> {
  const types: SelfCheckResult['type'][] = ['duplicate-import', 'multiple-names', 'recalculate', 'export-consistency'];
  const results: SelfCheckResult[] = [];

  for (const type of types) {
    const latest = await db.selfCheckResults
      .where('type')
      .equals(type)
      .reverse()
      .first();

    if (latest) {
      results.push(latest);
    }
  }

  return results;
}
