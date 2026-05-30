export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface UVPoint {
  u: number;
  v: number;
}

export type MaterialType = 'surface' | 'boundary' | 'sample';
export type MaterialStatus = 'raw' | 'processed';
export type DataSource = 'imported' | 'generated' | 'edited';

export interface DataMaterial {
  id: string;
  name: string;
  type: MaterialType;
  status: MaterialStatus;
  source: DataSource;
  importedAt: number;
  importedBy?: string;
  equation?: string;
  points?: Point3D[];
  uvRange?: { u: [number, number]; v: [number, number] };
  sampleDensity?: number;
  metadata: Record<string, any>;
}

export interface SurfaceData {
  materials: DataMaterial[];
  vertices: Point3D[];
  normals: Vector3D[];
  uvs: UVPoint[];
  indices: number[];
  boundaryPoints?: Point3D[];
  samplePoints?: Point3D[];
}

export interface SliceParams {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

export interface FilterRange {
  x?: [number, number];
  y?: [number, number];
  z?: [number, number];
}

export type ProjectionPlane = 'xy' | 'xz' | 'yz';

export interface ViewState {
  showSurface: boolean;
  showNormals: boolean;
  showBoundary: boolean;
  showSamples: boolean;
  showProjection: boolean;
  projectionPlane: ProjectionPlane;
  normalLength: number;
  normalDensity: number;
  sliceParams: SliceParams;
  highlightReversedNormals: boolean;
}
