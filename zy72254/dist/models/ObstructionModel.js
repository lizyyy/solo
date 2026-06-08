"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObstruction = createObstruction;
exports.addAlias = addAlias;
exports.addCADLayer = addCADLayer;
exports.addRangefinderRecord = addRangefinderRecord;
exports.setCanonicalName = setCanonicalName;
exports.updateStatus = updateStatus;
exports.setConflictInfo = setConflictInfo;
exports.clearConflictInfo = clearConflictInfo;
exports.calculateBoundingBox = calculateBoundingBox;
exports.getAllNames = getAllNames;
exports.hasName = hasName;
const types_1 = require("../types");
const idGenerator_1 = require("../utils/idGenerator");
function createObstruction(params) {
    const now = Date.now();
    const boundingBox = calculateBoundingBox(params.geometry);
    const aliases = [{
            name: params.name,
            source: params.nameSource,
            timestamp: now,
            operator: params.operator
        }];
    const cadLayers = params.cadLayer ? [params.cadLayer] : [];
    return {
        id: (0, idGenerator_1.generateObstructionId)(),
        canonicalName: null,
        aliases,
        position: params.position,
        boundingBox,
        geometry: params.geometry,
        cadLayers,
        rangefinderRecords: [],
        status: types_1.ObstructionStatus.PENDING_REVIEW,
        createdAt: now,
        updatedAt: now,
        isOnEvacuationRoute: params.isOnEvacuationRoute ?? false,
        hazardLevel: params.hazardLevel ?? 'medium',
        notes: params.notes
    };
}
function addAlias(obstruction, name, source, operator) {
    const now = Date.now();
    const exists = obstruction.aliases.some(a => a.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        return obstruction;
    }
    return {
        ...obstruction,
        aliases: [
            ...obstruction.aliases,
            { name, source, timestamp: now, operator }
        ],
        updatedAt: now
    };
}
function addCADLayer(obstruction, cadLayer) {
    const exists = obstruction.cadLayers.some(l => l.layerName === cadLayer.layerName && l.importSource === cadLayer.importSource);
    if (exists) {
        return obstruction;
    }
    return {
        ...obstruction,
        cadLayers: [...obstruction.cadLayers, cadLayer],
        updatedAt: Date.now()
    };
}
function addRangefinderRecord(obstruction, record) {
    const exists = obstruction.rangefinderRecords.some(r => r.id === record.id);
    if (exists) {
        return obstruction;
    }
    return {
        ...obstruction,
        rangefinderRecords: [...obstruction.rangefinderRecords, record],
        updatedAt: Date.now()
    };
}
function setCanonicalName(obstruction, canonicalName, operator) {
    const now = Date.now();
    const hasAlias = obstruction.aliases.some(a => a.name.toLowerCase() === canonicalName.toLowerCase());
    const updatedAliases = hasAlias
        ? obstruction.aliases
        : [...obstruction.aliases, {
                name: canonicalName,
                source: 'manual',
                timestamp: now,
                operator
            }];
    return {
        ...obstruction,
        canonicalName,
        aliases: updatedAliases,
        updatedAt: now
    };
}
function updateStatus(obstruction, status, operator, notes) {
    return {
        ...obstruction,
        status,
        notes: notes ?? obstruction.notes,
        updatedAt: Date.now()
    };
}
function setConflictInfo(obstruction, conflictInfo) {
    const newStatus = obstruction.status === types_1.ObstructionStatus.CONFIRMED ||
        obstruction.status === types_1.ObstructionStatus.MERGED
        ? obstruction.status
        : types_1.ObstructionStatus.PENDING_REVIEW;
    return {
        ...obstruction,
        conflictInfo,
        status: newStatus,
        updatedAt: Date.now()
    };
}
function clearConflictInfo(obstruction) {
    const { conflictInfo, ...rest } = obstruction;
    return {
        ...rest,
        updatedAt: Date.now()
    };
}
function calculateBoundingBox(geometry) {
    if (geometry.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let hasZ = false;
    for (const point of geometry) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        if ('z' in point) {
            hasZ = true;
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
        }
    }
    const bbox = { minX, maxX, minY, maxY };
    if (hasZ) {
        bbox.minZ = minZ;
        bbox.maxZ = maxZ;
    }
    return bbox;
}
function getAllNames(obstruction) {
    const names = [];
    if (obstruction.canonicalName) {
        names.push(obstruction.canonicalName);
    }
    for (const alias of obstruction.aliases) {
        if (!names.includes(alias.name)) {
            names.push(alias.name);
        }
    }
    return names;
}
function hasName(obstruction, name) {
    const lowerName = name.toLowerCase();
    return getAllNames(obstruction).some(n => n.toLowerCase() === lowerName);
}
//# sourceMappingURL=ObstructionModel.js.map