export type PointStatus = 'normal' | 'pending' | 'abnormal';

export type DataSource = 
  | '点位表导入' 
  | '现场照片' 
  | '方案备注' 
  | '手改坐标' 
  | 'GIS底图补录'
  | '剧场灯位安全网';

export interface LightPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  status: PointStatus;
  source: DataSource;
  sourceRow: string;
  remark: string;
  suggestion: string;
  createTime: string;
  updateTime: string;
  metadata?: {
    originalX?: number;
    originalY?: number;
    originalZ?: number;
    photoUrl?: string;
    modifiedBy?: string;
  };
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export interface Project {
  id: string;
  name: string;
  createTime: string;
  updateTime: string;
  lightPoints: LightPoint[];
  cameraState: CameraState;
}

export interface ExportReport {
  projectName: string;
  exportTime: string;
  summary: {
    total: number;
    normal: number;
    pending: number;
    abnormal: number;
  };
  details: LightPoint[];
}
