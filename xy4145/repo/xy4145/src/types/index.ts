export interface BoreholeRaw {
  boreholeId: string;
  x: number;
  y: number;
  groundElevation: number;
  waterLevel?: number;
}

export interface LayerRaw {
  boreholeId: string;
  layerIndex: number;
  topDepth: number;
  bottomDepth: number;
  soilType: string;
  soilCode?: string;
  description?: string;
  hasSample?: boolean;
  sampleId?: string;
  isContaminated?: boolean;
  contaminantType?: string;
  contaminantLevel?: number;
}

export interface Borehole {
  id: string;
  x: number;
  y: number;
  groundElevation: number;
  waterLevel?: number;
  layers: Layer[];
  totalDepth: number;
}

export interface Layer {
  id: string;
  boreholeId: string;
  layerIndex: number;
  topDepth: number;
  bottomDepth: number;
  thickness: number;
  soilType: string;
  soilCode: string;
  description: string;
  hasSample: boolean;
  sampleId?: string;
  isContaminated: boolean;
  contaminantType?: string;
  contaminantLevel?: number;
  mark?: LayerMark;
}

export type MarkType = 'none' | 'suspicious' | 'confirmed' | 'danger';

export interface LayerMark {
  type: MarkType;
  note?: string;
  timestamp: number;
}

export interface StratumSurface {
  id: string;
  soilType: string;
  soilCode: string;
  points: SurfacePoint[];
  triangles: Triangle[];
}

export interface SurfacePoint {
  x: number;
  y: number;
  elevation: number;
  boreholeId?: string;
}

export interface Triangle {
  indices: [number, number, number];
}

export interface ValidationIssue {
  type: 'gap' | 'inversion' | 'missing_sample' | 'depth_discontinuity';
  severity: 'warning' | 'error';
  boreholeId: string;
  layerIndex?: number;
  message: string;
  details: Record<string, number | string | undefined>;
}

export interface AppState {
  boreholes: Borehole[];
  surfaces: StratumSurface[];
  selectedLayerId: string | null;
  validationIssues: ValidationIssue[];
  showBoreholes: boolean;
  showSurfaces: boolean;
  showWaterLevel: boolean;
  showGrid: boolean;
}

export interface SoilColorConfig {
  [key: string]: {
    color: string;
    name: string;
  };
}
