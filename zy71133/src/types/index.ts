export interface Point3D {
  x: number;
  y: number;
  z: number;
  color?: number;
}

export interface PointCloudData {
  id: string;
  name: string;
  points: Point3D[];
  createdAt: Date;
}

export interface BoundaryVertex {
  x: number;
  z: number;
}

export interface Boundary {
  id: string;
  name: string;
  vertices: BoundaryVertex[];
  baseHeight: number;
  materialId: string;
  volume?: number;
  surfaceArea?: number;
  weight?: number;
}

export interface Material {
  id: string;
  name: string;
  density: number;
  color: string;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface Batch {
  id: string;
  name: string;
  timestamp: Date;
  boundaries: Boundary[];
  cameraState: CameraState;
  baseHeight: number;
}

export interface ReportBoundaryData {
  name: string;
  volume: number;
  weight: number;
  material: string;
  baseHeight: number;
}

export interface ReportData {
  id: string;
  batchId: string;
  batchName: string;
  generatedAt: Date;
  totalVolume: number;
  totalWeight: number;
  boundaries: ReportBoundaryData[];
  screenshot?: string;
}

export type ToolMode = 'select' | 'draw' | 'edit';

export interface DragState {
  boundaryId: string;
  vertexIndex: number;
}

export interface AppState {
  pointCloud: PointCloudData | null;
  boundaries: Boundary[];
  selectedBoundaryId: string | null;
  activeBatchId: string | null;
  batches: Batch[];
  materials: Material[];
  toolMode: ToolMode;
  baseHeight: number;
  isDrawing: boolean;
  drawingVertices: BoundaryVertex[];
  cameraState: CameraState;
  showReportModal: boolean;
  dragState: DragState | null;
  compareBatchIds: string[];
}

export interface AppActions {
  setPointCloud: (pointCloud: PointCloudData | null) => void;
  addBoundary: (boundary: Boundary) => void;
  updateBoundary: (id: string, boundary: Partial<Boundary>) => void;
  deleteBoundary: (id: string) => void;
  setSelectedBoundaryId: (id: string | null) => void;
  setToolMode: (mode: ToolMode) => void;
  setBaseHeight: (height: number) => void;
  setIsDrawing: (isDrawing: boolean) => void;
  addDrawingVertex: (vertex: BoundaryVertex) => void;
  clearDrawingVertices: () => void;
  setCameraState: (state: CameraState) => void;
  saveBatch: (name: string) => void;
  loadBatch: (id: string) => void;
  deleteBatch: (id: string) => void;
  resetState: () => void;
  setShowReportModal: (show: boolean) => void;
  calculateVolumes: () => void;
  loadSampleData: () => void;
  setDragState: (dragState: DragState | null) => void;
  updateVertex: (boundaryId: string, vertexIndex: number, newPos: BoundaryVertex) => void;
  toggleCompareBatch: (batchId: string) => void;
  clearCompareBatches: () => void;
}
