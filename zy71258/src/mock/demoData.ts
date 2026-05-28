import type { 
  Gallery, LightSource, Artwork, SamplingPoint, 
  SamplingData, Exhibition, Risk 
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

const now = new Date().toISOString();

export const demoGallery: Gallery = {
  id: 'gallery-001',
  name: '主展厅A区',
  width: 12,
  height: 4,
  depth: 8,
  walls: [
    {
      id: 'wall-north',
      start: { x: -6, y: 0, z: -4 },
      end: { x: 6, y: 0, z: -4 },
      height: 4,
      thickness: 0.3,
      material: '混凝土',
      opacity: 1
    },
    {
      id: 'wall-south',
      start: { x: -6, y: 0, z: 4 },
      end: { x: 6, y: 0, z: 4 },
      height: 4,
      thickness: 0.3,
      material: '混凝土',
      opacity: 1
    },
    {
      id: 'wall-east',
      start: { x: 6, y: 0, z: -4 },
      end: { x: 6, y: 0, z: 4 },
      height: 4,
      thickness: 0.3,
      material: '混凝土',
      opacity: 1
    },
    {
      id: 'wall-west',
      start: { x: -6, y: 0, z: -4 },
      end: { x: -6, y: 0, z: 4 },
      height: 4,
      thickness: 0.3,
      material: '混凝土',
      opacity: 1
    },
    {
      id: 'wall-partition-1',
      start: { x: -2, y: 0, z: -1 },
      end: { x: 2, y: 0, z: -1 },
      height: 3,
      thickness: 0.2,
      material: '石膏板',
      opacity: 0.9
    }
  ],
  material: '白色乳胶漆',
  createdBy: '文保专员-张工',
  createdAt: now
};

export const demoLightSources: LightSource[] = [
  {
    id: 'light-001',
    galleryId: 'gallery-001',
    name: '轨道射灯1号',
    type: 'spot',
    power: 30,
    intensity: 2500,
    posX: -3,
    posY: 3.5,
    posZ: -2,
    angleX: -60,
    angleY: 0,
    angleZ: 0,
    beamAngle: 30,
    colorTemperature: 3200,
    calibrationCertNo: 'CAL-2024-001',
    calibrationDate: '2024-01-15',
    createdBy: '文保专员-张工',
    createdAt: now
  },
  {
    id: 'light-002',
    galleryId: 'gallery-001',
    name: '轨道射灯2号',
    type: 'spot',
    power: 30,
    intensity: 2800,
    posX: 0,
    posY: 3.5,
    posZ: -2,
    angleX: -60,
    angleY: 0,
    angleZ: 0,
    beamAngle: 30,
    colorTemperature: 3200,
    calibrationCertNo: 'CAL-2024-002',
    calibrationDate: '2024-01-15',
    createdBy: '文保专员-张工',
    createdAt: now
  },
  {
    id: 'light-003',
    galleryId: 'gallery-001',
    name: '轨道射灯3号',
    type: 'spot',
    power: 30,
    intensity: 2600,
    posX: 3,
    posY: 3.5,
    posZ: -2,
    angleX: -60,
    angleY: 0,
    angleZ: 0,
    beamAngle: 30,
    colorTemperature: 3200,
    calibrationCertNo: 'CAL-2024-003',
    calibrationDate: '2024-01-15',
    createdBy: '文保专员-张工',
    createdAt: now
  },
  {
    id: 'light-004',
    galleryId: 'gallery-001',
    name: '轨道射灯4号',
    type: 'spot',
    power: 50,
    intensity: 4500,
    posX: -4,
    posY: 3.5,
    posZ: 2,
    angleX: -70,
    angleY: 15,
    angleZ: 0,
    beamAngle: 25,
    colorTemperature: 4000,
    calibrationCertNo: 'CAL-2024-004',
    calibrationDate: '2024-02-20',
    createdBy: '文保专员-张工',
    createdAt: now
  }
];

export const demoArtworks: Artwork[] = [
  {
    id: 'artwork-001',
    galleryId: 'gallery-001',
    exhibitionId: 'exhibition-001',
    registrationNo: 'WH-2024-0001',
    name: '《山水长卷',
    lightResistanceGrade: 'ISO 15426 Grade 1',
    posX: -4,
    posY: 1.5,
    posZ: -3.8,
    width: 1.8,
    height: 1.2,
    protectionLevel: '一级',
    createdBy: '文保专员-张工',
    createdAt: now
  },
  {
    id: 'artwork-002',
    galleryId: 'gallery-001',
    exhibitionId: 'exhibition-001',
    registrationNo: 'WH-2024-0002',
    name: '《瓷器珍品',
    lightResistanceGrade: 'ISO 15426 Grade 3',
    posX: 0,
    posY: 1.2,
    posZ: -3.8,
    width: 0.6,
    height: 0.8,
    protectionLevel: '二级',
    createdBy: '文保专员-张工',
    createdAt: now
  },
  {
    id: 'artwork-003',
    galleryId: 'gallery-001',
    exhibitionId: 'exhibition-001',
    registrationNo: 'WH-2024-0003',
    name: '《丝绸织物》',
    lightResistanceGrade: 'ISO 15426 Grade 2',
    posX: 4,
    posY: 1.8,
    posZ: -3.8,
    width: 1.2,
    height: 1.5,
    protectionLevel: '一级',
    createdBy: '文保专员-张工',
    createdAt: now
  },
  {
    id: 'artwork-004',
    galleryId: 'gallery-001',
    exhibitionId: 'exhibition-001',
    registrationNo: 'WH-2024-0004',
    name: '《油画风景》',
    lightResistanceGrade: 'ISO 15426 Grade 2',
    posX: -4,
    posY: 1.5,
    posZ: 0.5,
    width: 1.5,
    height: 1.2,
    protectionLevel: '二级',
    createdBy: '文保专员-张工',
    createdAt: now
  },
  {
    id: 'artwork-005',
    galleryId: 'gallery-001',
    exhibitionId: 'exhibition-001',
    registrationNo: 'WH-2024-0005',
    name: '《青铜器》',
    lightResistanceGrade: 'ISO 15426 Grade 4',
    posX: 4,
    posY: 1.2,
    posZ: 0.5,
    width: 0.5,
    height: 0.6,
    protectionLevel: '三级',
    createdBy: '文保专员-张工',
    createdAt: now
  }
];

export const demoSamplingPoints: SamplingPoint[] = [
  { id: 'sp-001', galleryId: 'gallery-001', name: '采样点A1', posX: -4, posY: 1.5, posZ: -3.8 },
  { id: 'sp-002', galleryId: 'gallery-001', name: '采样点A2', posX: 0, posY: 1.2, posZ: -3.8 },
  { id: 'sp-003', galleryId: 'gallery-001', name: '采样点A3', posX: 4, posY: 1.8, posZ: -3.8 },
  { id: 'sp-004', galleryId: 'gallery-001', name: '采样点B1', posX: -4, posY: 1.5, posZ: 0.5 },
  { id: 'sp-005', galleryId: 'gallery-001', name: '采样点B2', posX: 4, posY: 1.2, posZ: 0.5 },
  { id: 'sp-006', galleryId: 'gallery-001', name: '环境点C1', posX: 0, posY: 1.0, posZ: 0 }
];

const generateSamplingDataForPoint = (pointId: string, values: number[], startDate: Date): SamplingData[] => {
  return values.map((value, index) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + index);
    return {
      id: uuidv4(),
      samplingPointId: pointId,
      measuredValue: value,
      measuredAt: date.toISOString(),
      instrumentId: 'INS-001',
      instrumentCalibrationStatus: 'valid' as const,
      measuredBy: '采样员-李工'
    };
  });
};

const startDate = new Date('2024-03-01');

export const demoSamplingData: SamplingData[] = [
  ...generateSamplingDataForPoint('sp-001', [52, 48, 55, 51, 49, 53, 47, 50, 54, 52], startDate),
  ...generateSamplingDataForPoint('sp-002', [180, 175, 185, 178, 182, 176, 180, 179, 183, 181], startDate),
  ...generateSamplingDataForPoint('sp-003', [120, 118, 125, 122, 119, 121, 123, 120, 124, 122], startDate),
  ...generateSamplingDataForPoint('sp-004', [220, 215, 225, 218, 222, 216, 220, 219, 223, 221], startDate),
  ...generateSamplingDataForPoint('sp-005', [80, 78, 85, 82, 79, 81, 83, 80, 84, 82], startDate),
  ...generateSamplingDataForPoint('sp-006', [100, 98, 105, 102, 99, 101, 103, 100, 104, 102], startDate)
];

export const demoExhibition: Exhibition = {
  id: 'exhibition-001',
  name: '2024春季艺术展',
  startDate: '2024-03-01',
  endDate: '2024-06-30',
  dailyOpenHours: 8,
  approvalNo: 'WH-APP-2024-003',
  responsiblePerson: '策展人-王主任',
  status: 'ongoing',
  createdBy: '文保专员-张工',
  createdAt: now
};

export const demoRisks: Risk[] = [
  {
    id: 'risk-001',
    type: 'over_illumination',
    severity: 'high',
    status: 'detected',
    description: '《山水长卷》照度超过ISO 15426 Grade 1 作品照度超过限值50lux，实测52lux',
    posX: -4,
    posY: 1.5,
    posZ: -3.8,
    artworkId: 'artwork-001',
    measuredValue: 52,
    threshold: 50,
    exceedRatio: 4,
    evidence: {
      samplingDataRef: 'sp-001',
      notes: '靠近射灯角度需要调整'
    },
    detectedAt: now
  },
  {
    id: 'risk-002',
    type: 'cumulative_leak',
    severity: 'medium',
    status: 'detected',
    description: '《山水长卷》累计曝光计算存在3天采样数据缺失',
    posX: -4,
    posY: 1.5,
    posZ: -3.8,
    artworkId: 'artwork-001',
    measuredValue: 416,
    threshold: 400,
    exceedRatio: 4,
    evidence: {
      notes: '3月5日、3月12日、3月19日无采样数据'
    },
    detectedAt: now
  },
  {
    id: 'risk-003',
    type: 'light_penetration',
    severity: 'critical',
    status: 'detected',
    description: '轨道射灯4号光线穿透隔墙，影响隔墙另一侧作品',
    posX: -4,
    posY: 1.5,
    posZ: 0.5,
    artworkId: 'artwork-004',
    lightSourceId: 'light-004',
    measuredValue: 220,
    threshold: 200,
    exceedRatio: 10,
    evidence: {
      notes: '隔墙为非承重石膏板，光线从隔墙上方溢出'
    },
    detectedAt: now
  }
];
