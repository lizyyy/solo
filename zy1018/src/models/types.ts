export type ObjectType = 
  | 'table'
  | 'display_rack'
  | 'cashier_desk'
  | 'power_outlet'
  | 'power_cable'
  | 'entrance'
  | 'exit'
  | 'safety_aisle'
  | 'feature_wall';

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BoothObject {
  id: string;
  type: ObjectType;
  name: string;
  position: Vector3D;
  rotation: number;
  dimensions: Vector3D;
  color: ColorRGB;
  userData?: Record<string, unknown>;
}

export interface FloorSettings {
  width: number;
  depth: number;
  gridSize: number;
  showGrid: boolean;
  showAxes: boolean;
}

export interface AisleSettings {
  minWidth: number;
  color: ColorRGB;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  floor: FloorSettings;
  mainAisle: AisleSettings;
  featureWall: {
    position: Vector3D;
    width: number;
  };
  objects: BoothObject[];
}

export type CheckSeverity = 'error' | 'warning' | 'info';

export interface CheckResult {
  id: string;
  rule: string;
  severity: CheckSeverity;
  message: string;
  objectIds?: string[];
  suggestions?: string[];
}

export interface CheckReport {
  planId: string;
  planName: string;
  generatedAt: number;
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  objectSummary: {
    type: ObjectType;
    count: number;
    items: Array<{
      name: string;
      position: Vector3D;
      dimensions: Vector3D;
    }>;
  }[];
  checks: CheckResult[];
}
