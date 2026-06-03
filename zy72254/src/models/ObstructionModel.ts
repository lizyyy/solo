import {
  Obstruction,
  ObstructionStatus,
  Point3D,
  BoundingBox,
  Coordinate,
  CADLayerInfo,
  RangefinderRecord,
  ObstructionAlias,
  ConflictInfo
} from '../types';
import { generateObstructionId } from '../utils/idGenerator';

export function createObstruction(params: {
  name: string;
  nameSource: 'cad' | 'rangefinder' | 'manual';
  position: Point3D;
  geometry: Coordinate[];
  operator: string;
  cadLayer?: CADLayerInfo;
  isOnEvacuationRoute?: boolean;
  hazardLevel?: 'low' | 'medium' | 'high';
  notes?: string;
}): Obstruction {
  const now = Date.now();
  const boundingBox = calculateBoundingBox(params.geometry);

  const aliases: ObstructionAlias[] = [{
    name: params.name,
    source: params.nameSource,
    timestamp: now,
    operator: params.operator
  }];

  const cadLayers: CADLayerInfo[] = params.cadLayer ? [params.cadLayer] : [];

  return {
    id: generateObstructionId(),
    canonicalName: null,
    aliases,
    position: params.position,
    boundingBox,
    geometry: params.geometry,
    cadLayers,
    rangefinderRecords: [],
    status: ObstructionStatus.PENDING_REVIEW,
    createdAt: now,
    updatedAt: now,
    isOnEvacuationRoute: params.isOnEvacuationRoute ?? false,
    hazardLevel: params.hazardLevel ?? 'medium',
    notes: params.notes
  };
}

export function addAlias(
  obstruction: Obstruction,
  name: string,
  source: 'cad' | 'rangefinder' | 'manual',
  operator: string
): Obstruction {
  const now = Date.now();

  const exists = obstruction.aliases.some(
    a => a.name.toLowerCase() === name.toLowerCase()
  );

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

export function addCADLayer(
  obstruction: Obstruction,
  cadLayer: CADLayerInfo
): Obstruction {
  const exists = obstruction.cadLayers.some(
    l => l.layerName === cadLayer.layerName && l.importSource === cadLayer.importSource
  );

  if (exists) {
    return obstruction;
  }

  return {
    ...obstruction,
    cadLayers: [...obstruction.cadLayers, cadLayer],
    updatedAt: Date.now()
  };
}

export function addRangefinderRecord(
  obstruction: Obstruction,
  record: RangefinderRecord
): Obstruction {
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

export function setCanonicalName(
  obstruction: Obstruction,
  canonicalName: string,
  operator: string
): Obstruction {
  const now = Date.now();

  const hasAlias = obstruction.aliases.some(
    a => a.name.toLowerCase() === canonicalName.toLowerCase()
  );

  const updatedAliases = hasAlias
    ? obstruction.aliases
    : [...obstruction.aliases, {
        name: canonicalName,
        source: 'manual' as const,
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

export function updateStatus(
  obstruction: Obstruction,
  status: ObstructionStatus,
  operator: string,
  notes?: string
): Obstruction {
  return {
    ...obstruction,
    status,
    notes: notes ?? obstruction.notes,
    updatedAt: Date.now()
  };
}

export function setConflictInfo(
  obstruction: Obstruction,
  conflictInfo: ConflictInfo
): Obstruction {
  const newStatus = obstruction.status === ObstructionStatus.CONFIRMED || 
                    obstruction.status === ObstructionStatus.MERGED
    ? obstruction.status
    : ObstructionStatus.PENDING_REVIEW;
  
  return {
    ...obstruction,
    conflictInfo,
    status: newStatus,
    updatedAt: Date.now()
  };
}

export function clearConflictInfo(obstruction: Obstruction): Obstruction {
  const { conflictInfo, ...rest } = obstruction;
  return {
    ...rest,
    updatedAt: Date.now()
  };
}

export function calculateBoundingBox(geometry: Coordinate[]): BoundingBox {
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

  const bbox: BoundingBox = { minX, maxX, minY, maxY };

  if (hasZ) {
    bbox.minZ = minZ;
    bbox.maxZ = maxZ;
  }

  return bbox;
}

export function getAllNames(obstruction: Obstruction): string[] {
  const names: string[] = [];
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

export function hasName(obstruction: Obstruction, name: string): boolean {
  const lowerName = name.toLowerCase();
  return getAllNames(obstruction).some(n => n.toLowerCase() === lowerName);
}
