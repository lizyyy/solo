import { Obstruction, CADLayerInfo, ImportSummary, Coordinate, Point3D } from '../types';
import { createObstruction, addCADLayer, hasName, addAlias } from '../models/ObstructionModel';
import { normalizeName } from './BoundaryRules';

export interface RawCADLayer {
  layerName: string;
  originalName: string;
  color?: string;
  lineType?: string;
  geometry: Coordinate[];
  position?: Point3D;
  isOnEvacuationRoute?: boolean;
  hazardLevel?: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface ImportSession {
  id: string;
  source: string;
  importTimestamp: number;
  operator: string;
  processedLayers: Set<string>;
  existingObstructions: Map<string, Obstruction>;
}

export function createImportSession(
  source: string,
  operator: string,
  existingObstructions: Obstruction[] = []
): ImportSession {
  const existingMap = new Map<string, Obstruction>();
  for (const obs of existingObstructions) {
    existingMap.set(obs.id, obs);
  }

  return {
    id: `import_${Date.now()}`,
    source,
    importTimestamp: Date.now(),
    operator,
    processedLayers: new Set<string>(),
    existingObstructions: existingMap
  };
}

export function findMatchingObstruction(
  rawLayer: RawCADLayer,
  existingObstructions: Obstruction[]
): Obstruction | null {
  const normalizedLayerName = normalizeName(rawLayer.layerName);

  for (const obs of existingObstructions) {
    if (hasName(obs, rawLayer.layerName)) {
      return obs;
    }

    for (const alias of obs.aliases) {
      if (normalizeName(alias.name) === normalizedLayerName) {
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

export function importCADLayer(
  rawLayer: RawCADLayer,
  session: ImportSession,
  autoMerge = false
): { obstruction: Obstruction; action: 'created' | 'updated' | 'skipped'; reason?: string } {
  const layerKey = `${session.source}:${rawLayer.layerName}`;

  if (session.processedLayers.has(layerKey)) {
    const existing = Array.from(session.existingObstructions.values()).find(obs =>
      obs.cadLayers.some(l => l.layerName === rawLayer.layerName && l.importSource === session.source)
    );
    if (existing) {
      return { obstruction: existing, action: 'skipped', reason: '同一批次重复导入，已跳过' };
    }
  }

  const existingObstructions = Array.from(session.existingObstructions.values());
  const matchingObstruction = autoMerge ? findMatchingObstruction(rawLayer, existingObstructions) : null;

  const cadLayerInfo: CADLayerInfo = {
    layerName: rawLayer.layerName,
    originalName: rawLayer.originalName,
    color: rawLayer.color,
    lineType: rawLayer.lineType,
    importTimestamp: session.importTimestamp,
    importSource: session.source
  };

  if (matchingObstruction) {
    const needsUpdate = !matchingObstruction.cadLayers.some(
      l => l.layerName === cadLayerInfo.layerName && l.importSource === cadLayerInfo.importSource
    );

    if (needsUpdate) {
      let updated = addCADLayer(matchingObstruction, cadLayerInfo);

      if (!hasName(updated, rawLayer.layerName)) {
        updated = addAlias(updated, rawLayer.layerName, 'cad', session.operator);
      }

      session.existingObstructions.set(updated.id, updated);
      session.processedLayers.add(layerKey);

      return { obstruction: updated, action: 'updated' };
    } else {
      session.processedLayers.add(layerKey);
      return { obstruction: matchingObstruction, action: 'skipped', reason: 'CAD图层已存在，未修改' };
    }
  }

  const position = rawLayer.position ?? calculateCenterPoint(rawLayer.geometry);

  const newObstruction = createObstruction({
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

export function batchImportCADLayers(
  rawLayers: RawCADLayer[],
  session: ImportSession,
  autoMerge = false
): {
  obstructions: Obstruction[];
  summary: ImportSummary;
  actions: Array<{ layerName: string; action: string; reason?: string; obstructionId: string }>;
} {
  const summary: ImportSummary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    conflicts: 0,
    totalProcessed: rawLayers.length
  };

  const actions: Array<{ layerName: string; action: string; reason?: string; obstructionId: string }> = [];

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

export function reimportSameLayers(
  rawLayers: RawCADLayer[],
  existingObstructions: Obstruction[],
  operator: string,
  source: string
): {
  obstructions: Obstruction[];
  summary: ImportSummary;
  message: string;
} {
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

function calculateCenterPoint(geometry: Coordinate[]): Point3D {
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

export function getImportSourceIdentifier(source: string, timestamp: number): string {
  return `${source}_${timestamp}`;
}

export function isLayerFromImport(
  cadLayer: CADLayerInfo,
  source: string,
  importTimestamp?: number
): boolean {
  if (cadLayer.importSource !== source) return false;
  if (importTimestamp !== undefined && cadLayer.importTimestamp !== importTimestamp) return false;
  return true;
}
