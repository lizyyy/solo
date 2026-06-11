export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface CADLayer {
  id: string;
  name: string;
  source: string;
  originalNote: string;
  color: string;
  visible: boolean;
  importedAt: string;
  importBatchId: string;
}

export interface CollisionPoint {
  id: string;
  position: Point3D;
  layerIdA: string;
  layerIdB: string;
  severity: 'warning' | 'error' | 'critical';
  originalCADDescription: string;
  screenshot?: string;
  manualNote?: string;
  noteUpdatedAt?: string;
  detectedAt: string;
  detectionBatchId: string;
  isBoundary: boolean;
  boundaryReason?: string;
  duplicateOf?: string;
  status: 'pending' | 'resolved' | 'ignored';
}

export interface ImportRecord {
  batchId: string;
  fileName: string;
  importedAt: string;
  layerCount: number;
  collisionCount: number;
  layerFingerprints: string[];
}

export interface ReviewSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  layers: CADLayer[];
  collisions: CollisionPoint[];
  importHistory: ImportRecord[];
  supplementaryNote?: string;
}

export const generateFingerprint = (layer: Omit<CADLayer, 'id' | 'importedAt' | 'importBatchId'>): string => {
  return `${layer.name}:${layer.source}:${layer.originalNote}`;
};

export const generateCollisionKey = (pos: Point3D, layerA: string, layerB: string): string => {
  const sortedLayers = [layerA, layerB].sort();
  return `${pos.x.toFixed(2)}:${pos.y.toFixed(2)}:${pos.z.toFixed(2)}:${sortedLayers.join(':')}`;
};
