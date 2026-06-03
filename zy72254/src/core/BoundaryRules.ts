import {
  Obstruction,
  ConflictInfo,
  ConflictResolution,
  ObstructionStatus,
  Point3D,
  BoundingBox
} from '../types';
import {
  setConflictInfo,
  clearConflictInfo,
  updateStatus,
  setCanonicalName,
  hasName,
  addAlias,
  addCADLayer,
  addRangefinderRecord,
  getAllNames,
  calculateBoundingBox
} from '../models/ObstructionModel';

export const BOUNDARY_RULES = {
  GEOMETRY_OVERLAP_THRESHOLD: 0.8,
  POSITION_PROXIMITY_THRESHOLD: 0.5,
  NAME_NORMALIZATION: {
    TRIM_SPACES: true,
    CASE_INSENSITIVE: true,
    REMOVE_SPECIAL_CHARS: true
  }
} as const;

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflicts: Array<{
    type: 'duplicate_name' | 'overlapping_geometry' | 'inconsistent_attributes';
    obstructionIds: [string, string];
    details: Record<string, unknown>;
  }>;
}

export interface MergeResult {
  primary: Obstruction;
  mergedIds: string[];
  conflictsResolved: number;
}

export interface RollbackResult {
  success: boolean;
  restoredObstruction: Obstruction | null;
  message: string;
}

export function normalizeName(name: string): string {
  let normalized = name;

  if (BOUNDARY_RULES.NAME_NORMALIZATION.TRIM_SPACES) {
    normalized = normalized.trim();
  }

  if (BOUNDARY_RULES.NAME_NORMALIZATION.CASE_INSENSITIVE) {
    normalized = normalized.toLowerCase();
  }

  if (BOUNDARY_RULES.NAME_NORMALIZATION.REMOVE_SPECIAL_CHARS) {
    normalized = normalized.replace(/[_\-\s]+/g, '');
  }

  return normalized;
}

export function detectConflicts(
  obstructions: Obstruction[],
  operator: string
): { updated: Obstruction[]; result: ConflictDetectionResult } {
  const conflicts: ConflictDetectionResult['conflicts'] = [];
  const updatedObstructions = [...obstructions];
  const now = Date.now();

  for (let i = 0; i < updatedObstructions.length; i++) {
    for (let j = i + 1; j < updatedObstructions.length; j++) {
      const a = updatedObstructions[i];
      const b = updatedObstructions[j];

      if (a.id === b.id) continue;
      if (a.status === ObstructionStatus.DUPLICATE || b.status === ObstructionStatus.DUPLICATE) continue;
      if (a.conflictInfo?.resolution || b.conflictInfo?.resolution) continue;

      const nameConflict = checkDuplicateName(a, b);
      const geometryConflict = checkOverlappingGeometry(a, b);

      if (nameConflict) {
        conflicts.push({
          type: 'duplicate_name',
          obstructionIds: [a.id, b.id],
          details: nameConflict
        });

        const conflictInfo: ConflictInfo = {
          conflictType: 'duplicate_name',
          conflictingObstructionIds: [a.id, b.id],
          detectedAt: now,
          detectedBy: operator
        };

        updatedObstructions[i] = setConflictInfo(a, conflictInfo);
        updatedObstructions[j] = setConflictInfo(b, conflictInfo);
      }

      if (geometryConflict && !nameConflict) {
        conflicts.push({
          type: 'overlapping_geometry',
          obstructionIds: [a.id, b.id],
          details: geometryConflict
        });

        const conflictInfo: ConflictInfo = {
          conflictType: 'overlapping_geometry',
          conflictingObstructionIds: [a.id, b.id],
          detectedAt: now,
          detectedBy: operator
        };

        updatedObstructions[i] = setConflictInfo(a, conflictInfo);
        updatedObstructions[j] = setConflictInfo(b, conflictInfo);
      }
    }
  }

  return {
    updated: updatedObstructions,
    result: {
      hasConflict: conflicts.length > 0,
      conflicts
    }
  };
}

export function checkDuplicateName(
  a: Obstruction,
  b: Obstruction
): { sharedNames: string[]; normalizedMatches: string[] } | null {
  const namesA = getAllNames(a);
  const namesB = getAllNames(b);

  const sharedNames: string[] = [];
  const normalizedMatches: string[] = [];

  for (const nameA of namesA) {
    const normA = normalizeName(nameA);
    for (const nameB of namesB) {
      const normB = normalizeName(nameB);

      if (normA === normB) {
        if (!sharedNames.includes(nameA)) sharedNames.push(nameA);
        if (!sharedNames.includes(nameB)) sharedNames.push(nameB);
        if (!normalizedMatches.includes(normA)) normalizedMatches.push(normA);
      }
    }
  }

  if (sharedNames.length > 0) {
    return { sharedNames, normalizedMatches };
  }

  return null;
}

export function checkOverlappingGeometry(
  a: Obstruction,
  b: Obstruction
): { overlapArea: number; threshold: number } | null {
  const overlap = calculateBoundingBoxOverlap(a.boundingBox, b.boundingBox);
  const minArea = Math.min(
    calculateBoundingBoxArea(a.boundingBox),
    calculateBoundingBoxArea(b.boundingBox)
  );

  if (minArea === 0) return null;

  const overlapRatio = overlap / minArea;

  if (overlapRatio >= BOUNDARY_RULES.GEOMETRY_OVERLAP_THRESHOLD) {
    return { overlapArea: overlap, threshold: BOUNDARY_RULES.GEOMETRY_OVERLAP_THRESHOLD };
  }

  const distance = calculate3DDistance(a.position, b.position);
  if (distance <= BOUNDARY_RULES.POSITION_PROXIMITY_THRESHOLD) {
    return { overlapArea: overlap, threshold: BOUNDARY_RULES.POSITION_PROXIMITY_THRESHOLD };
  }

  return null;
}

export function resolveConflict(
  primary: Obstruction,
  secondary: Obstruction,
  resolution: ConflictResolution,
  operator: string,
  canonicalName?: string
): MergeResult {
  const now = Date.now();
  let result: Obstruction = { ...primary };

  switch (resolution) {
    case ConflictResolution.KEEP_FIRST:
      result = {
        ...primary,
        conflictInfo: {
          ...primary.conflictInfo!,
          resolution: ConflictResolution.KEEP_FIRST,
          resolvedAt: now,
          resolvedBy: operator,
          resolutionNotes: '保留第一个，标记第二个为重复'
        }
      };
      result = updateStatus(result, ObstructionStatus.CONFIRMED, operator);
      break;

    case ConflictResolution.KEEP_SECOND:
      result = {
        ...secondary,
        id: primary.id,
        conflictInfo: {
          ...secondary.conflictInfo!,
          resolution: ConflictResolution.KEEP_SECOND,
          resolvedAt: now,
          resolvedBy: operator,
          resolutionNotes: '保留第二个，覆盖第一个'
        }
      };
      result = updateStatus(result, ObstructionStatus.CONFIRMED, operator);
      break;

    case ConflictResolution.MERGE:
      result = mergeObstructions(primary, secondary, operator, canonicalName);
      result = {
        ...result,
        conflictInfo: {
          ...result.conflictInfo!,
          resolution: ConflictResolution.MERGE,
          resolvedAt: now,
          resolvedBy: operator,
          resolutionNotes: canonicalName
            ? `合并为"${canonicalName}"`
            : '合并两个障碍物信息'
        }
      };
      result = updateStatus(result, ObstructionStatus.MERGED, operator);
      break;

    case ConflictResolution.MANUAL:
      result = {
        ...primary,
        conflictInfo: {
          ...primary.conflictInfo!,
          resolution: ConflictResolution.MANUAL,
          resolvedAt: now,
          resolvedBy: operator,
          resolutionNotes: '标记为待人工复核，暂不处理'
        }
      };
      result = updateStatus(result, ObstructionStatus.PENDING_REVIEW, operator);
      break;
  }

  return {
    primary: result,
    mergedIds: [secondary.id],
    conflictsResolved: 1
  };
}

export function mergeObstructions(
  primary: Obstruction,
  secondary: Obstruction,
  operator: string,
  canonicalName?: string
): Obstruction {
  let merged = { ...primary };

  for (const alias of secondary.aliases) {
    merged = addAlias(merged, alias.name, alias.source, operator);
  }

  for (const cadLayer of secondary.cadLayers) {
    merged = addCADLayer(merged, cadLayer);
  }

  for (const record of secondary.rangefinderRecords) {
    merged = addRangefinderRecord(merged, { ...record, obstructionId: merged.id });
  }

  const combinedGeometry = [...primary.geometry, ...secondary.geometry];
  merged.boundingBox = calculateBoundingBox(combinedGeometry);

  if (canonicalName) {
    merged = setCanonicalName(merged, canonicalName, operator);
  }

  merged.hazardLevel = (['high', 'medium', 'low'] as const).find(
    level => primary.hazardLevel === level || secondary.hazardLevel === level
  ) || 'medium';

  merged.isOnEvacuationRoute = primary.isOnEvacuationRoute || secondary.isOnEvacuationRoute;

  const mergedNotes = [
    primary.notes,
    secondary.notes,
    `[自动合并] 与障碍物 ${secondary.id} 合并`
  ].filter(Boolean).join('; ');

  merged.notes = mergedNotes;
  merged.updatedAt = Date.now();

  return merged;
}

export function markAsDuplicate(
  obstruction: Obstruction,
  primaryId: string,
  operator: string
): Obstruction {
  let result = updateStatus(
    obstruction,
    ObstructionStatus.DUPLICATE,
    operator,
    `重复数据，已合并到 ${primaryId}`
  );
  result = clearConflictInfo(result);
  return result;
}

export function rollbackMerge(
  mergedObstruction: Obstruction,
  originalPrimary: Obstruction,
  originalSecondary: Obstruction,
  operator: string
): { primary: Obstruction; secondary: Obstruction } {
  const restoredPrimary = {
    ...originalPrimary,
    updatedAt: Date.now(),
    notes: `${originalPrimary.notes || ''}; [回滚] 撤销与 ${originalSecondary.id} 的合并`
  };

  const restoredSecondary = {
    ...originalSecondary,
    updatedAt: Date.now(),
    notes: `${originalSecondary.notes || ''}; [回滚] 撤销与 ${originalPrimary.id} 的合并`
  };

  return {
    primary: clearConflictInfo(restoredPrimary),
    secondary: clearConflictInfo(restoredSecondary)
  };
}

export function requiresReview(obstruction: Obstruction): boolean {
  return obstruction.status === ObstructionStatus.PENDING_REVIEW;
}

export function canAutoResolve(conflict: ConflictInfo): boolean {
  if (conflict.conflictType === 'duplicate_name') {
    return true;
  }
  return false;
}

function calculateBoundingBoxOverlap(a: BoundingBox, b: BoundingBox): number {
  const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const overlapY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return overlapX * overlapY;
}

function calculateBoundingBoxArea(bbox: BoundingBox): number {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  return width * height;
}

function calculate3DDistance(a: Point3D, b: Point3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function explainConflict(conflict: ConflictInfo): string {
  switch (conflict.conflictType) {
    case 'duplicate_name':
      return '同一障碍物被标记了两个名称，需要培训学员复核确认';
    case 'overlapping_geometry':
      return '两个障碍物位置高度重合，可能是同一物体';
    case 'inconsistent_attributes':
      return '同一障碍物的属性信息不一致';
    default:
      return '存在未知冲突';
  }
}

export function getResolutionOptions(conflict: ConflictInfo): Array<{
  value: ConflictResolution;
  label: string;
  description: string;
}> {
  const options: Array<{
    value: ConflictResolution;
    label: string;
    description: string;
  }> = [];

  if (conflict.conflictType === 'duplicate_name') {
    options.push({
      value: ConflictResolution.MERGE,
      label: '合并为一个',
      description: '将两个障碍物的信息合并，保留所有名称和数据'
    });
  }

  options.push({
    value: ConflictResolution.KEEP_FIRST,
    label: '保留第一个',
    description: '保留先导入的障碍物，标记第二个为重复'
  });

  options.push({
    value: ConflictResolution.KEEP_SECOND,
    label: '保留第二个',
    description: '保留后导入的障碍物，覆盖第一个'
  });

  options.push({
    value: ConflictResolution.MANUAL,
    label: '留待复核',
    description: '不自动处理，留给培训学员人工确认'
  });

  return options;
}
