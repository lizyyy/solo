import { CADLayer, CollisionPoint, ImportRecord, ReviewSession, Point3D, generateFingerprint, generateCollisionKey } from '../types';

export const detectCollisions = (layers: CADLayer[], existingLayers: CADLayer[], batchId: string): CollisionPoint[] => {
  const collisions: CollisionPoint[] = [];
  const collisionKeys = new Set<string>();
  const allLayers = [...existingLayers, ...layers];

  for (let i = 0; i < allLayers.length; i++) {
    for (let j = i + 1; j < allLayers.length; j++) {
      const isNewA = i >= existingLayers.length;
      const isNewB = j >= existingLayers.length;
      if (!isNewA && !isNewB) continue;

      const simulatedCollisions = simulateLayerCollisions(allLayers[i], allLayers[j], batchId);
      
      for (const col of simulatedCollisions) {
        const key = generateLogicalCollisionKey(col.position, allLayers[i], allLayers[j]);
        if (!collisionKeys.has(key)) {
          collisionKeys.add(key);
          collisions.push(col);
        }
      }
    }
  }

  return collisions;
};

const generateLogicalCollisionKey = (pos: Point3D, layerA: CADLayer, layerB: CADLayer): string => {
  const baseNames = [
    layerA.name.split(/[-_]/)[0],
    layerB.name.split(/[-_]/)[0],
  ].sort();
  return `${pos.x.toFixed(2)}:${pos.y.toFixed(2)}:${pos.z.toFixed(2)}:${baseNames.join(':')}`;
};

const simulateLayerCollisions = (layerA: CADLayer, layerB: CADLayer, batchId: string): CollisionPoint[] => {
  const collisions: CollisionPoint[] = [];
  const collisionPatterns = getCollisionPatterns(layerA, layerB);

  collisionPatterns.forEach((pattern, idx) => {
    const collision: CollisionPoint = {
      id: `col-${batchId}-${layerA.id}-${layerB.id}-${idx}`,
      position: pattern.position,
      layerIdA: layerA.id,
      layerIdB: layerB.id,
      severity: pattern.severity,
      originalCADDescription: pattern.originalCADDescription,
      detectedAt: new Date().toISOString(),
      detectionBatchId: batchId,
      isBoundary: pattern.isBoundary,
      boundaryReason: pattern.boundaryReason,
      status: 'pending',
    };
    collisions.push(collision);
  });

  return collisions;
};

const matchName = (layer: CADLayer, keywords: string[]): boolean => {
  const name = layer.name.toLowerCase();
  return keywords.some(k => name.includes(k.toLowerCase()));
};

const isStructureLayer = (l: CADLayer) => matchName(l, ['承重', '结构', '梁', '柱', '板']);
const isPipelineLayer = (l: CADLayer) => matchName(l, ['管线', '给排水', '给水', '排水', '水管', '喷淋', '消防']);
const isWallLayer = (l: CADLayer) => matchName(l, ['墙体', '剪力墙', '墙', '砌体', '隔墙']);
const isDoorWindowLayer = (l: CADLayer) => matchName(l, ['门窗', '门', '窗', '洞口', '开孔']);
const isHVACLayer = (l: CADLayer) => matchName(l, ['暖通', '风管', '空调', '通风']);
const isElectricLayer = (l: CADLayer) => matchName(l, ['电气', '桥架', '电缆', '强电', '弱电']);

const getCollisionPatterns = (layerA: CADLayer, layerB: CADLayer) => {
  const patterns: {
    position: Point3D;
    severity: 'warning' | 'error' | 'critical';
    originalCADDescription: string;
    isBoundary: boolean;
    boundaryReason?: string;
  }[] = [];

  if ((isStructureLayer(layerA) && isPipelineLayer(layerB)) ||
      (isStructureLayer(layerB) && isPipelineLayer(layerA))) {
    patterns.push({
      position: { x: 12.45, y: 8.32, z: 3.15 },
      severity: 'critical',
      originalCADDescription: '承重梁L-03与给排水管W-12交叉，净距仅15mm，违反GB50016-2014第6.1.5条',
      isBoundary: false,
    });
    patterns.push({
      position: { x: 12.48, y: 8.35, z: 3.18 },
      severity: 'warning',
      originalCADDescription: '同一交叉区域二次标注，施工队现场复核后补记录',
      isBoundary: true,
      boundaryReason: '容差边界：两检测点间距<50mm，属于同一碰撞区域的重复标注',
    });
  }

  if ((isWallLayer(layerA) && isDoorWindowLayer(layerB)) ||
      (isWallLayer(layerB) && isDoorWindowLayer(layerA))) {
    patterns.push({
      position: { x: 5.20, y: 15.80, z: 1.20 },
      severity: 'error',
      originalCADDescription: '剪力墙Q-07与门M-09开孔冲突，门洞边缘距暗柱仅80mm',
      isBoundary: false,
    });
  }

  if ((isHVACLayer(layerA) && isElectricLayer(layerB)) ||
      (isHVACLayer(layerB) && isElectricLayer(layerA))) {
    patterns.push({
      position: { x: 20.15, y: 3.65, z: 4.50 },
      severity: 'warning',
      originalCADDescription: '通风风管K-05与桥架CT-02平行敷设，净距200mm，满足规范但建议优化',
      isBoundary: true,
      boundaryReason: '规范边界：净距刚好达到GB50303-2015第12.2.1条最小值要求',
    });
  }

  return patterns;
};

let batchCounter = 0;

export const importLayersWithDeduplication = (
  session: ReviewSession,
  newLayers: Omit<CADLayer, 'id' | 'importedAt' | 'importBatchId'>[],
  fileName: string
): {
  updatedSession: ReviewSession;
  importRecord: ImportRecord;
  stats: {
    added: number;
    skipped: number;
    collisions: number;
  };
} => {
  batchCounter++;
  const batchId = `batch-${Date.now()}-${batchCounter}`;
  const existingFingerprints = new Set(
    session.layers.map(l => generateFingerprint({
      name: l.name,
      source: l.source,
      originalNote: l.originalNote,
      color: l.color,
      visible: l.visible,
    }))
  );

  const addedLayers: CADLayer[] = [];
  let skipped = 0;

  newLayers.forEach((layerData, idx) => {
    const fingerprint = generateFingerprint(layerData);
    if (existingFingerprints.has(fingerprint)) {
      skipped++;
    } else {
      addedLayers.push({
        ...layerData,
        id: `layer-${batchId}-${idx}`,
        importedAt: new Date().toISOString(),
        importBatchId: batchId,
      });
      existingFingerprints.add(fingerprint);
    }
  });

  const allLayers = [...session.layers, ...addedLayers];
  const newCollisions = detectCollisions(addedLayers, session.layers, batchId);

  const dedupedCollisions = deduplicateCollisions(session.collisions, newCollisions, allLayers);
  const mergedCollisions = mergeWithManualNotesPreserved(session.collisions, dedupedCollisions);

  const importRecord: ImportRecord = {
    batchId,
    fileName,
    importedAt: new Date().toISOString(),
    layerCount: addedLayers.length,
    collisionCount: dedupedCollisions.length,
    layerFingerprints: addedLayers.map(l => generateFingerprint({
      name: l.name,
      source: l.source,
      originalNote: l.originalNote,
      color: l.color,
      visible: l.visible,
    })),
  };

  return {
    updatedSession: {
      ...session,
      layers: allLayers,
      collisions: mergedCollisions,
      importHistory: [...session.importHistory, importRecord],
      updatedAt: new Date().toISOString(),
    },
    importRecord,
    stats: {
      added: addedLayers.length,
      skipped,
      collisions: dedupedCollisions.length,
    },
  };
};

const getLayerBaseName = (layerId: string, allLayers: CADLayer[]): string => {
  const layer = allLayers.find(l => l.id === layerId);
  if (!layer) return layerId;
  const name = layer.name.split(/[-_]/)[0];
  return name;
};

const deduplicateCollisions = (
  existing: CollisionPoint[],
  incoming: CollisionPoint[],
  existingLayers: CADLayer[]
): CollisionPoint[] => {
  const existingLogicalKeys = new Set(
    existing.map(c => {
      const baseA = getLayerBaseName(c.layerIdA, existingLayers);
      const baseB = getLayerBaseName(c.layerIdB, existingLayers);
      const sorted = [baseA, baseB].sort();
      return `${c.position.x.toFixed(2)}:${c.position.y.toFixed(2)}:${c.position.z.toFixed(2)}:${sorted.join(':')}`;
    })
  );

  const allLayers = existingLayers;

  return incoming.map(col => {
    const baseA = getLayerBaseName(col.layerIdA, allLayers);
    const baseB = getLayerBaseName(col.layerIdB, allLayers);
    const sorted = [baseA, baseB].sort();
    const logicalKey = `${col.position.x.toFixed(2)}:${col.position.y.toFixed(2)}:${col.position.z.toFixed(2)}:${sorted.join(':')}`;

    if (existingLogicalKeys.has(logicalKey)) {
      const original = existing.find(e => {
        const eA = getLayerBaseName(e.layerIdA, existingLayers);
        const eB = getLayerBaseName(e.layerIdB, existingLayers);
        const eSorted = [eA, eB].sort();
        const eKey = `${e.position.x.toFixed(2)}:${e.position.y.toFixed(2)}:${e.position.z.toFixed(2)}:${eSorted.join(':')}`;
        return eKey === logicalKey;
      });
      if (original) {
        return {
          ...col,
          duplicateOf: original.id,
          status: 'ignored' as const,
        };
      }
    }
    return col;
  });
};

const mergeWithManualNotesPreserved = (
  existing: CollisionPoint[],
  incoming: CollisionPoint[]
): CollisionPoint[] => {
  const merged = [...existing];
  const existingById = new Map(existing.map(c => [c.id, c]));

  incoming.forEach(col => {
    if (col.duplicateOf && existingById.has(col.duplicateOf)) {
      const original = existingById.get(col.duplicateOf)!;
      if (original.manualNote) {
        col.manualNote = original.manualNote;
        col.noteUpdatedAt = original.noteUpdatedAt;
      }
    }
    merged.push(col);
  });

  return merged;
};

export const updateManualNote = (
  session: ReviewSession,
  collisionId: string,
  note: string
): ReviewSession => {
  return {
    ...session,
    collisions: session.collisions.map(c =>
      c.id === collisionId
        ? { ...c, manualNote: note, noteUpdatedAt: new Date().toISOString() }
        : c
    ),
    updatedAt: new Date().toISOString(),
  };
};

export const attachScreenshot = (
  session: ReviewSession,
  collisionId: string,
  screenshotData: string
): ReviewSession => {
  return {
    ...session,
    collisions: session.collisions.map(c =>
      c.id === collisionId
        ? { ...c, screenshot: screenshotData }
        : c
    ),
    updatedAt: new Date().toISOString(),
  };
};
