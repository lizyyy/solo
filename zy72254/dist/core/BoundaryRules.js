"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOUNDARY_RULES = void 0;
exports.normalizeName = normalizeName;
exports.detectConflicts = detectConflicts;
exports.checkDuplicateName = checkDuplicateName;
exports.checkOverlappingGeometry = checkOverlappingGeometry;
exports.resolveConflict = resolveConflict;
exports.mergeObstructions = mergeObstructions;
exports.markAsDuplicate = markAsDuplicate;
exports.rollbackMerge = rollbackMerge;
exports.requiresReview = requiresReview;
exports.canAutoResolve = canAutoResolve;
exports.explainConflict = explainConflict;
exports.getResolutionOptions = getResolutionOptions;
const types_1 = require("../types");
const ObstructionModel_1 = require("../models/ObstructionModel");
exports.BOUNDARY_RULES = {
    GEOMETRY_OVERLAP_THRESHOLD: 0.8,
    POSITION_PROXIMITY_THRESHOLD: 0.5,
    NAME_NORMALIZATION: {
        TRIM_SPACES: true,
        CASE_INSENSITIVE: true,
        REMOVE_SPECIAL_CHARS: true
    }
};
function normalizeName(name) {
    let normalized = name;
    if (exports.BOUNDARY_RULES.NAME_NORMALIZATION.TRIM_SPACES) {
        normalized = normalized.trim();
    }
    if (exports.BOUNDARY_RULES.NAME_NORMALIZATION.CASE_INSENSITIVE) {
        normalized = normalized.toLowerCase();
    }
    if (exports.BOUNDARY_RULES.NAME_NORMALIZATION.REMOVE_SPECIAL_CHARS) {
        normalized = normalized.replace(/[_\-\s]+/g, '');
    }
    return normalized;
}
function detectConflicts(obstructions, operator) {
    const conflicts = [];
    const updatedObstructions = [...obstructions];
    const now = Date.now();
    for (let i = 0; i < updatedObstructions.length; i++) {
        for (let j = i + 1; j < updatedObstructions.length; j++) {
            const a = updatedObstructions[i];
            const b = updatedObstructions[j];
            if (a.id === b.id)
                continue;
            if (a.status === types_1.ObstructionStatus.DUPLICATE || b.status === types_1.ObstructionStatus.DUPLICATE)
                continue;
            if (a.conflictInfo?.resolution || b.conflictInfo?.resolution)
                continue;
            const nameConflict = checkDuplicateName(a, b);
            const geometryConflict = checkOverlappingGeometry(a, b);
            if (nameConflict) {
                conflicts.push({
                    type: 'duplicate_name',
                    obstructionIds: [a.id, b.id],
                    details: nameConflict
                });
                const conflictInfo = {
                    conflictType: 'duplicate_name',
                    conflictingObstructionIds: [a.id, b.id],
                    detectedAt: now,
                    detectedBy: operator
                };
                updatedObstructions[i] = (0, ObstructionModel_1.setConflictInfo)(a, conflictInfo);
                updatedObstructions[j] = (0, ObstructionModel_1.setConflictInfo)(b, conflictInfo);
            }
            if (geometryConflict && !nameConflict) {
                conflicts.push({
                    type: 'overlapping_geometry',
                    obstructionIds: [a.id, b.id],
                    details: geometryConflict
                });
                const conflictInfo = {
                    conflictType: 'overlapping_geometry',
                    conflictingObstructionIds: [a.id, b.id],
                    detectedAt: now,
                    detectedBy: operator
                };
                updatedObstructions[i] = (0, ObstructionModel_1.setConflictInfo)(a, conflictInfo);
                updatedObstructions[j] = (0, ObstructionModel_1.setConflictInfo)(b, conflictInfo);
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
function checkDuplicateName(a, b) {
    const namesA = (0, ObstructionModel_1.getAllNames)(a);
    const namesB = (0, ObstructionModel_1.getAllNames)(b);
    const sharedNames = [];
    const normalizedMatches = [];
    for (const nameA of namesA) {
        const normA = normalizeName(nameA);
        for (const nameB of namesB) {
            const normB = normalizeName(nameB);
            if (normA === normB) {
                if (!sharedNames.includes(nameA))
                    sharedNames.push(nameA);
                if (!sharedNames.includes(nameB))
                    sharedNames.push(nameB);
                if (!normalizedMatches.includes(normA))
                    normalizedMatches.push(normA);
            }
        }
    }
    if (sharedNames.length > 0) {
        return { sharedNames, normalizedMatches };
    }
    return null;
}
function checkOverlappingGeometry(a, b) {
    const overlap = calculateBoundingBoxOverlap(a.boundingBox, b.boundingBox);
    const minArea = Math.min(calculateBoundingBoxArea(a.boundingBox), calculateBoundingBoxArea(b.boundingBox));
    if (minArea === 0)
        return null;
    const overlapRatio = overlap / minArea;
    if (overlapRatio >= exports.BOUNDARY_RULES.GEOMETRY_OVERLAP_THRESHOLD) {
        return { overlapArea: overlap, threshold: exports.BOUNDARY_RULES.GEOMETRY_OVERLAP_THRESHOLD };
    }
    const distance = calculate3DDistance(a.position, b.position);
    if (distance <= exports.BOUNDARY_RULES.POSITION_PROXIMITY_THRESHOLD) {
        return { overlapArea: overlap, threshold: exports.BOUNDARY_RULES.POSITION_PROXIMITY_THRESHOLD };
    }
    return null;
}
function resolveConflict(primary, secondary, resolution, operator, canonicalName) {
    const now = Date.now();
    let result = { ...primary };
    switch (resolution) {
        case types_1.ConflictResolution.KEEP_FIRST:
            result = {
                ...primary,
                conflictInfo: {
                    ...primary.conflictInfo,
                    resolution: types_1.ConflictResolution.KEEP_FIRST,
                    resolvedAt: now,
                    resolvedBy: operator,
                    resolutionNotes: '保留第一个，标记第二个为重复'
                }
            };
            result = (0, ObstructionModel_1.updateStatus)(result, types_1.ObstructionStatus.CONFIRMED, operator);
            break;
        case types_1.ConflictResolution.KEEP_SECOND:
            result = {
                ...secondary,
                id: primary.id,
                conflictInfo: {
                    ...secondary.conflictInfo,
                    resolution: types_1.ConflictResolution.KEEP_SECOND,
                    resolvedAt: now,
                    resolvedBy: operator,
                    resolutionNotes: '保留第二个，覆盖第一个'
                }
            };
            result = (0, ObstructionModel_1.updateStatus)(result, types_1.ObstructionStatus.CONFIRMED, operator);
            break;
        case types_1.ConflictResolution.MERGE:
            result = mergeObstructions(primary, secondary, operator, canonicalName);
            result = {
                ...result,
                conflictInfo: {
                    ...result.conflictInfo,
                    resolution: types_1.ConflictResolution.MERGE,
                    resolvedAt: now,
                    resolvedBy: operator,
                    resolutionNotes: canonicalName
                        ? `合并为"${canonicalName}"`
                        : '合并两个障碍物信息'
                }
            };
            result = (0, ObstructionModel_1.updateStatus)(result, types_1.ObstructionStatus.MERGED, operator);
            break;
        case types_1.ConflictResolution.MANUAL:
            result = {
                ...primary,
                conflictInfo: {
                    ...primary.conflictInfo,
                    resolution: types_1.ConflictResolution.MANUAL,
                    resolvedAt: now,
                    resolvedBy: operator,
                    resolutionNotes: '标记为待人工复核，暂不处理'
                }
            };
            result = (0, ObstructionModel_1.updateStatus)(result, types_1.ObstructionStatus.PENDING_REVIEW, operator);
            break;
    }
    return {
        primary: result,
        mergedIds: [secondary.id],
        conflictsResolved: 1
    };
}
function mergeObstructions(primary, secondary, operator, canonicalName) {
    let merged = { ...primary };
    for (const alias of secondary.aliases) {
        merged = (0, ObstructionModel_1.addAlias)(merged, alias.name, alias.source, operator);
    }
    for (const cadLayer of secondary.cadLayers) {
        merged = (0, ObstructionModel_1.addCADLayer)(merged, cadLayer);
    }
    for (const record of secondary.rangefinderRecords) {
        merged = (0, ObstructionModel_1.addRangefinderRecord)(merged, { ...record, obstructionId: merged.id });
    }
    const combinedGeometry = [...primary.geometry, ...secondary.geometry];
    merged.boundingBox = (0, ObstructionModel_1.calculateBoundingBox)(combinedGeometry);
    if (canonicalName) {
        merged = (0, ObstructionModel_1.setCanonicalName)(merged, canonicalName, operator);
    }
    merged.hazardLevel = ['high', 'medium', 'low'].find(level => primary.hazardLevel === level || secondary.hazardLevel === level) || 'medium';
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
function markAsDuplicate(obstruction, primaryId, operator) {
    let result = (0, ObstructionModel_1.updateStatus)(obstruction, types_1.ObstructionStatus.DUPLICATE, operator, `重复数据，已合并到 ${primaryId}`);
    result = (0, ObstructionModel_1.clearConflictInfo)(result);
    return result;
}
function rollbackMerge(mergedObstruction, originalPrimary, originalSecondary, operator) {
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
        primary: (0, ObstructionModel_1.clearConflictInfo)(restoredPrimary),
        secondary: (0, ObstructionModel_1.clearConflictInfo)(restoredSecondary)
    };
}
function requiresReview(obstruction) {
    return obstruction.status === types_1.ObstructionStatus.PENDING_REVIEW;
}
function canAutoResolve(conflict) {
    if (conflict.conflictType === 'duplicate_name') {
        return true;
    }
    return false;
}
function calculateBoundingBoxOverlap(a, b) {
    const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
    const overlapY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
    return overlapX * overlapY;
}
function calculateBoundingBoxArea(bbox) {
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    return width * height;
}
function calculate3DDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function explainConflict(conflict) {
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
function getResolutionOptions(conflict) {
    const options = [];
    if (conflict.conflictType === 'duplicate_name') {
        options.push({
            value: types_1.ConflictResolution.MERGE,
            label: '合并为一个',
            description: '将两个障碍物的信息合并，保留所有名称和数据'
        });
    }
    options.push({
        value: types_1.ConflictResolution.KEEP_FIRST,
        label: '保留第一个',
        description: '保留先导入的障碍物，标记第二个为重复'
    });
    options.push({
        value: types_1.ConflictResolution.KEEP_SECOND,
        label: '保留第二个',
        description: '保留后导入的障碍物，覆盖第一个'
    });
    options.push({
        value: types_1.ConflictResolution.MANUAL,
        label: '留待复核',
        description: '不自动处理，留给培训学员人工确认'
    });
    return options;
}
//# sourceMappingURL=BoundaryRules.js.map