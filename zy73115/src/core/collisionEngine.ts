import { CADLayer, CollisionPoint, ImportRecord, ReviewSession, Point3D, generateFingerprint, generateCollisionKey } from '../types';

export const detectCollisions = (layers: CADLayer[], batchId: string): CollisionPoint[] => {
  const collisions: CollisionPoint[] = [];
  const collisionKeys = new Set<string>();

  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      const simulatedCollisions = simulateLayerCollisions(layers[i], layers[j], batchId);
      
      for (const col of simulatedCollisions) {
        const key = generateCollisionKey(col.position, col.layerIdA, col.layerIdB);
        if (!collisionKeys.has(key)) {
          collisionKeys.add(key);
          collisions.push(col);
        }
      }
    }
  }

  return collisions;
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

const getCollisionPatterns = (layerA: CADLayer, layerB: CADLayer) => {
  const patterns: {
    position: Point3D;
    severity: 'warning' | 'error' | 'critical';
    originalCADDescription: string;
    isBoundary: boolean;
    boundaryReason?: string;
  }[] = [];

  if (layerA.name.includes('承重') && layerB.name.includes('管线')) {
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

  if (layerA.name.includes('墙体') && layerB.name.includes('门窗')) {
    patterns.push({
      position: { x: 5.20, y: 15.80, z: 1.20 },
      severity: 'error',
      originalCADDescription: '剪力墙Q-07与门M-09开孔冲突，门洞边缘距暗柱仅80mm',
      isBoundary: false,
    });
  }

  if (layerA.name.includes('暖通') && layerB.name.includes('电气')) {
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
  const newCollisions = detectCollisions(addedLayers, batchId);

  const dedupedCollisions = deduplicateCollisions(session.collisions, newCollisions);
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

const deduplicateCollisions = (
  existing: CollisionPoint[],
  incoming: CollisionPoint[]
): CollisionPoint[] => {
  const existingKeys = new Set(existing.map(c => generateCollisionKey(c.position, c.layerIdA, c.layerIdB)));

  return incoming.map(col => {
    const key = generateCollisionKey(col.position, col.layerIdA, col.layerIdB);
    if (existingKeys.has(key)) {
      const original = existing.find(e => generateCollisionKey(e.position, e.layerIdA, e.layerIdB) === key)!;
      return {
        ...col,
        duplicateOf: original.id,
        status: 'ignored' as const,
      };
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
      return;
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
