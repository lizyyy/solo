export type PointStatus = 'pass' | 'confirm' | 'legacy';

export type PointSource = '点位表' | '现场照片' | 'GIS底图' | '手改坐标';

export interface PointLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  source: PointSource;
  sourceDetail: string;
  gisNote: string;
  status: PointStatus;
  processNote: string;
  originalSource: string;
  processTime: string;
  handModifiedCoord: string;
  photoRef: string;
}

export interface Scheme {
  id: string;
  name: string;
  version: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  cameraState: { position: [number, number, number]; target: [number, number, number] };
  filterState: { status: PointStatus[]; source: string[] };
}

export interface SchemePoint {
  schemeId: string;
  pointId: string;
  overrideNote: string;
  overrideCoord: string;
}

export interface AnomalyRecord {
  id: string;
  pointId: string;
  type: string;
  description: string;
  sourceLine: string;
  processNote: string;
  processTime: string;
  resolved: boolean;
}

export const STATUS_LABELS: Record<PointStatus, string> = {
  pass: '顺利通过',
  confirm: '人工确认',
  legacy: '旧口径',
};

export const STATUS_COLORS: Record<PointStatus, string> = {
  pass: '#16c79a',
  confirm: '#f5a623',
  legacy: '#e94560',
};
