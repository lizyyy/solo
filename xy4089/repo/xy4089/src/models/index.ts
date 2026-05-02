import { v4 as uuidv4 } from 'uuid';
import {
  Vector3,
  Truss,
  HoistPoint,
  Equipment,
  StageBoundary,
  Project,
  ProjectSettings,
  TrajectoryPoint,
} from './types';

export * from './types';

export function createVector3(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}

export function cloneVector3(v: Vector3): Vector3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function addVectors(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function multiplyVectorScalar(v: Vector3, scalar: number): Vector3 {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

export function vectorDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function vectorLength(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vectorNormalize(v: Vector3): Vector3 {
  const len = vectorLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function vectorsEqual(a: Vector3, b: Vector3, epsilon = 0.0001): boolean {
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.z - b.z) < epsilon
  );
}

const DEFAULT_TRUSS_WEIGHTS: Record<string, number> = {
  box: 12,
  triangular: 8,
  ladder: 6,
};

export function createTruss(options: Partial<Truss> = {}): Truss {
  const type = options.type || 'box';
  const length = options.length || 6;
  const width = options.width || 0.5;
  const height = options.height || 0.5;
  
  return {
    id: options.id || uuidv4(),
    name: options.name || `桁架 ${length}m`,
    type,
    length,
    width,
    height,
    weightPerMeter: options.weightPerMeter ?? DEFAULT_TRUSS_WEIGHTS[type] || 10,
    position: options.position ? cloneVector3(options.position) : createVector3(),
    rotation: options.rotation ? cloneVector3(options.rotation) : createVector3(),
    color: options.color || '#4a90d9',
  };
}

export function createHoistPoint(options: Partial<HoistPoint> = {}): HoistPoint {
  return {
    id: options.id || uuidv4(),
    name: options.name || '吊点',
    position: options.position ? cloneVector3(options.position) : createVector3(0, 6, 0),
    maxLoad: options.maxLoad ?? 500,
    currentLoad: options.currentLoad ?? 0,
    trussId: options.trussId,
    trussLocalPosition: options.trussLocalPosition ? cloneVector3(options.trussLocalPosition) : undefined,
    color: options.color || '#ff9800',
  };
}

const DEFAULT_EQUIPMENT_WEIGHTS: Record<string, number> = {
  light: 15,
  speaker: 25,
  led: 10,
  generic: 5,
};

const DEFAULT_EQUIPMENT_DIMENSIONS: Record<string, Vector3> = {
  light: { x: 0.4, y: 0.6, z: 0.3 },
  speaker: { x: 0.5, y: 1.0, z: 0.4 },
  led: { x: 0.3, y: 0.3, z: 0.15 },
  generic: { x: 0.3, y: 0.3, z: 0.3 },
};

export function createEquipment(options: Partial<Equipment> = {}): Equipment {
  const type = options.type || 'generic';
  
  return {
    id: options.id || uuidv4(),
    name: options.name || `设备`,
    type,
    weight: options.weight ?? DEFAULT_EQUIPMENT_WEIGHTS[type] || 5,
    dimensions: options.dimensions 
      ? cloneVector3(options.dimensions) 
      : cloneVector3(DEFAULT_EQUIPMENT_DIMENSIONS[type] || { x: 0.3, y: 0.3, z: 0.3 }),
    position: options.position ? cloneVector3(options.position) : createVector3(),
    rotation: options.rotation ? cloneVector3(options.rotation) : createVector3(),
    trussId: options.trussId,
    trussLocalPosition: options.trussLocalPosition ? cloneVector3(options.trussLocalPosition) : undefined,
    color: options.color || getEquipmentDefaultColor(type),
    trajectory: options.trajectory?.map(t => ({ ...t, position: cloneVector3(t.position) })),
  };
}

function getEquipmentDefaultColor(type: string): string {
  const colors: Record<string, string> = {
    light: '#ffeb3b',
    speaker: '#9c27b0',
    led: '#00bcd4',
    generic: '#607d8b',
  };
  return colors[type] || '#607d8b';
}

export function createTrajectoryPoint(
  time: number,
  position: Vector3,
  speed = 0,
  acceleration = 0
): TrajectoryPoint {
  return {
    time,
    position: cloneVector3(position),
    speed,
    acceleration,
  };
}

export function createStageBoundary(options: Partial<StageBoundary> = {}): StageBoundary {
  const type = options.type || 'custom';
  const defaultVertices = getDefaultBoundaryVertices(type);
  
  return {
    id: options.id || uuidv4(),
    name: options.name || '边界',
    type,
    vertices: options.vertices?.map(v => cloneVector3(v)) || defaultVertices,
    color: options.color || getBoundaryDefaultColor(type),
  };
}

function getDefaultBoundaryVertices(type: string): Vector3[] {
  switch (type) {
    case 'floor':
      return [
        { x: -10, y: 0, z: -10 },
        { x: 10, y: 0, z: -10 },
        { x: 10, y: 0, z: 10 },
        { x: -10, y: 0, z: 10 },
      ];
    case 'ceiling':
      return [
        { x: -10, y: 8, z: -10 },
        { x: 10, y: 8, z: -10 },
        { x: 10, y: 8, z: 10 },
        { x: -10, y: 8, z: 10 },
      ];
    case 'proscenium':
      return [
        { x: -6, y: 0, z: 0 },
        { x: 6, y: 0, z: 0 },
        { x: 6, y: 6, z: 0 },
        { x: -6, y: 6, z: 0 },
      ];
    default:
      return [
        { x: -5, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
        { x: 5, y: 5, z: 0 },
        { x: -5, y: 5, z: 0 },
      ];
  }
}

function getBoundaryDefaultColor(type: string): string {
  const colors: Record<string, string> = {
    proscenium: '#f44336',
    curtain: '#e91e63',
    wall: '#795548',
    ceiling: '#607d8b',
    floor: '#4caf50',
    custom: '#9e9e9e',
  };
  return colors[type] || '#9e9e9e';
}

export function createDefaultProjectSettings(): ProjectSettings {
  return {
    gravity: 9.81,
    safetyFactor: 1.5,
    dynamicImpactFactorBase: 1.2,
    maxUnbalanceRatio: 0.2,
    coordinateSystem: {
      origin: { x: 0, y: 0, z: 0 },
      unit: 'meters',
    },
  };
}

export function createProject(options: Partial<Project> = {}): Project {
  const now = Date.now();
  
  return {
    id: options.id || uuidv4(),
    name: options.name || '新项目',
    description: options.description || '',
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
    trusses: options.trusses?.map(t => ({ ...t, position: cloneVector3(t.position), rotation: cloneVector3(t.rotation) })) || [],
    hoistPoints: options.hoistPoints?.map(h => ({ 
      ...h, 
      position: cloneVector3(h.position),
      trussLocalPosition: h.trussLocalPosition ? cloneVector3(h.trussLocalPosition) : undefined,
    })) || [],
    equipment: options.equipment?.map(e => ({ 
      ...e, 
      position: cloneVector3(e.position), 
      rotation: cloneVector3(e.rotation),
      trussLocalPosition: e.trussLocalPosition ? cloneVector3(e.trussLocalPosition) : undefined,
      trajectory: e.trajectory?.map(t => ({ ...t, position: cloneVector3(t.position) })),
    })) || [],
    boundaries: options.boundaries?.map(b => ({
      ...b,
      vertices: b.vertices.map(v => cloneVector3(v)),
    })) || [],
    settings: options.settings ? { ...options.settings, coordinateSystem: { ...options.settings.coordinateSystem, origin: cloneVector3(options.settings.coordinateSystem.origin) } } : createDefaultProjectSettings(),
  };
}

export function cloneProject(project: Project): Project {
  return createProject(project);
}

export function getTrussCenter(truss: Truss): Vector3 {
  return addVectors(truss.position, createVector3(0, truss.height / 2, 0));
}

export function getTrussWeight(truss: Truss): number {
  return truss.weightPerMeter * truss.length;
}

export function getEquipmentBoundingBox(equipment: Equipment): { min: Vector3; max: Vector3 } {
  const halfDim = multiplyVectorScalar(equipment.dimensions, 0.5);
  return {
    min: subtractVectors(equipment.position, halfDim),
    max: addVectors(equipment.position, halfDim),
  };
}
