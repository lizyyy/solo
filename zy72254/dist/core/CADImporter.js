"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImportSession = createImportSession;
exports.findMatchingObstruction = findMatchingObstruction;
exports.importCADLayer = importCADLayer;
exports.batchImportCADLayers = batchImportCADLayers;
exports.reimportSameLayers = reimportSameLayers;
exports.getImportSourceIdentifier = getImportSourceIdentifier;
exports.isLayerFromImport = isLayerFromImport;
const ObstructionModel_1 = require("../models/ObstructionModel");
const BoundaryRules_1 = require("./BoundaryRules");
function createImportSession(source, operator, existingObstructions = []) {
    const existingMap = new Map();
    for (const obs of existingObstructions) {
        existingMap.set(obs.id, obs);
    }
    return {
        id: `import_${Date.now()}`,
        source,
        importTimestamp: Date.now(),
        operator,
        processedLayers: new Set(),
        existingObstructions: existingMap
    };
}
function findMatchingObstruction(rawLayer, existingObstructions) {
    const normalizedLayerName = (0, BoundaryRules_1.normalizeName)(rawLayer.layerName);
    for (const obs of existingObstructions) {
        if ((0, ObstructionModel_1.hasName)(obs, rawLayer.layerName)) {
            return obs;
        }
        for (const alias of obs.aliases) {
            if ((0, BoundaryRules_1.normalizeName)(alias.name) === normalizedLayerName) {
                return obs;
            }
        }
        for (const cadLayer of obs.cadLayers) {
            if (cadLayer.layerName === rawLayer.layerName &&
                cadLayer.importSource === rawLayer.originalName) {
                return obs;
            }
        }
    }
    return null;
}
function importCADLayer(rawLayer, session, autoMerge = false) {
    const layerKey = `${session.source}:${rawLayer.layerName}`;
    if (session.processedLayers.has(layerKey)) {
        const existing = Array.from(session.existingObstructions.values()).find(obs => obs.cadLayers.some(l => l.layerName === rawLayer.layerName && l.importSource === session.source));
        if (existing) {
            return { obstruction: existing, action: 'skipped', reason: '同一批次重复导入，已跳过' };
        }
    }
    const existingObstructions = Array.from(session.existingObstructions.values());
    const matchingObstruction = autoMerge ? findMatchingObstruction(rawLayer, existingObstructions) : null;
    const cadLayerInfo = {
        layerName: rawLayer.layerName,
        originalName: rawLayer.originalName,
        color: rawLayer.color,
        lineType: rawLayer.lineType,
        importTimestamp: session.importTimestamp,
        importSource: session.source
    };
    if (matchingObstruction) {
        const needsUpdate = !matchingObstruction.cadLayers.some(l => l.layerName === cadLayerInfo.layerName && l.importSource === cadLayerInfo.importSource);
        if (needsUpdate) {
            let updated = (0, ObstructionModel_1.addCADLayer)(matchingObstruction, cadLayerInfo);
            if (!(0, ObstructionModel_1.hasName)(updated, rawLayer.layerName)) {
                updated = (0, ObstructionModel_1.addAlias)(updated, rawLayer.layerName, 'cad', session.operator);
            }
            session.existingObstructions.set(updated.id, updated);
            session.processedLayers.add(layerKey);
            return { obstruction: updated, action: 'updated' };
        }
        else {
            session.processedLayers.add(layerKey);
            return { obstruction: matchingObstruction, action: 'skipped', reason: 'CAD图层已存在，未修改' };
        }
    }
    const position = rawLayer.position ?? calculateCenterPoint(rawLayer.geometry);
    const newObstruction = (0, ObstructionModel_1.createObstruction)({
        name: rawLayer.layerName,
        nameSource: 'cad',
        position,
        geometry: rawLayer.geometry,
        operator: session.operator,
        cadLayer: cadLayerInfo,
        isOnEvacuationRoute: rawLayer.isOnEvacuationRoute,
        hazardLevel: rawLayer.hazardLevel,
        notes: rawLayer.notes
    });
    session.existingObstructions.set(newObstruction.id, newObstruction);
    session.processedLayers.add(layerKey);
    return { obstruction: newObstruction, action: 'created' };
}
function batchImportCADLayers(rawLayers, session, autoMerge = false) {
    const summary = {
        imported: 0,
        updated: 0,
        skipped: 0,
        conflicts: 0,
        totalProcessed: rawLayers.length
    };
    const actions = [];
    for (const rawLayer of rawLayers) {
        const result = importCADLayer(rawLayer, session, autoMerge);
        actions.push({
            layerName: rawLayer.layerName,
            action: result.action,
            reason: result.reason,
            obstructionId: result.obstruction.id
        });
        switch (result.action) {
            case 'created':
                summary.imported++;
                break;
            case 'updated':
                summary.updated++;
                break;
            case 'skipped':
                summary.skipped++;
                break;
        }
    }
    const obstructions = Array.from(session.existingObstructions.values());
    return { obstructions, summary, actions };
}
function reimportSameLayers(rawLayers, existingObstructions, operator, source) {
    const session = createImportSession(source, operator, existingObstructions);
    const result = batchImportCADLayers(rawLayers, session, true);
    const message = result.summary.skipped > 0
        ? `重复导入${rawLayers.length}个图层，已跳过${result.summary.skipped}个已存在的图层，未造成数量翻倍`
        : `导入完成，无重复数据`;
    return {
        ...result,
        message
    };
}
function calculateCenterPoint(geometry) {
    if (geometry.length === 0) {
        return { x: 0, y: 0, z: 0 };
    }
    let sumX = 0, sumY = 0, sumZ = 0;
    let hasZ = false;
    for (const point of geometry) {
        sumX += point.x;
        sumY += point.y;
        if ('z' in point) {
            sumZ += point.z;
            hasZ = true;
        }
    }
    const count = geometry.length;
    return {
        x: sumX / count,
        y: sumY / count,
        z: hasZ ? sumZ / count : 0
    };
}
function getImportSourceIdentifier(source, timestamp) {
    return `${source}_${timestamp}`;
}
function isLayerFromImport(cadLayer, source, importTimestamp) {
    if (cadLayer.importSource !== source)
        return false;
    if (importTimestamp !== undefined && cadLayer.importTimestamp !== importTimestamp)
        return false;
    return true;
}
//# sourceMappingURL=CADImporter.js.map