import { PesticideInfo } from '@/types';

export const PESTICIDE_INFO: Record<string, PesticideInfo> = {
  herbicide: {
    id: 'herbicide',
    name: '除草剂',
    toxicity: 'high',
    driftRisk: 0.8,
    maxAllowedConcentration: 0.05,
  },
  insecticide: {
    id: 'insecticide',
    name: '杀虫剂',
    toxicity: 'medium',
    driftRisk: 0.6,
    maxAllowedConcentration: 0.1,
  },
  fungicide: {
    id: 'fungicide',
    name: '杀菌剂',
    toxicity: 'medium',
    driftRisk: 0.5,
    maxAllowedConcentration: 0.15,
  },
  organic: {
    id: 'organic',
    name: '有机药剂',
    toxicity: 'low',
    driftRisk: 0.3,
    maxAllowedConcentration: 0.3,
  },
};

export const WIND_SPEED_UNITS = {
  m_s: { label: 'm/s', factor: 1 },
  km_h: { label: 'km/h', factor: 3.6 },
  mph: { label: 'mph', factor: 2.237 },
};

export const MAX_PARTICLES = 1500;
export const PARTICLE_LIFETIME = 8;
export const GRAVITY = -9.8;

export const COLORS = {
  orchard: '#2d5a27',
  orchardGrid: '#3d7a37',
  adjacentField: '#8b7355',
  adjacentFieldAlt: '#9b8365',
  canal: '#4da6ff',
  canalDeep: '#1e90ff',
  sprinkler: '#ff6b35',
  particle: 'rgba(200, 230, 200',
  bufferWarning: 'rgba(255, 140, 0, 0.3)',
  bufferDanger: 'rgba(220, 38, 38, 0.4)',
  tree: '#1a4d2e',
  treeTrunk: '#8b4513',
  ground: '#3d5a3d',
};

export const CAMERA_POSITIONS = {
  default: { position: [20, 20, 20] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  top: { position: [0, 50, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  front: { position: [0, 15, 35] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  side: { position: [35, 15, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
};