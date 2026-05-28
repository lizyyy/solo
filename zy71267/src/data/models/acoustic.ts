export type DisplayParameter = 'reverberationTime' | 'soundPressureLevel' | 'clarity';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HallModel {
  id: string;
  name: string;
  dimensions: { width: number; height: number; depth: number };
  center: Vec3;
}

export interface MaterialFace {
  id: string;
  hallId: string;
  surfaceName: string;
  vertices: Vec3[];
  materialType: string;
}

export interface AbsorptionData {
  faceId: string;
  frequency_125Hz: number;
  frequency_250Hz: number;
  frequency_500Hz: number;
  frequency_1kHz: number;
  frequency_2kHz: number;
  frequency_4kHz: number;
}

export interface SoundSource {
  id: string;
  position: Vec3;
  type: 'omnidirectional' | 'directional';
  power_dB: number;
  name: string;
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  position: Vec3;
  isVip: boolean;
  area: string;
}

export interface AcousticReading {
  seatId: string;
  reverberationTime: number;
  soundPressureLevel: number;
  clarity: number;
  definition: number;
}

export interface ReflectionPoint {
  rayId: string;
  sequence: number;
  position: Vec3;
  surfaceId: string;
  incidenceAngle: number;
}

export interface RayPath {
  id: string;
  sourceId: string;
  order: number;
  energy: number;
  travelTime: number;
  points: Vec3[];
  color: [number, number, number];
}

export interface AcousticDataset {
  hall: HallModel;
  materialFaces: MaterialFace[];
  absorptionData: AbsorptionData[];
  soundSources: SoundSource[];
  seats: Seat[];
  acousticReadings: AcousticReading[];
  rayPaths: RayPath[];
  reportSummary: {
    projectName: string;
    date: string;
    avgRT60: number;
    avgSPL: number;
    avgClarity: number;
    recommendations: string[];
  };
}

export interface RayFilterOptions {
  minOrder: number;
  maxOrder: number;
  minEnergy: number;
  showOnlySelectedSeat: boolean;
}

export const DISPLAY_PARAM_LABELS: Record<DisplayParameter, string> = {
  reverberationTime: '混响时间 (RT60)',
  soundPressureLevel: '声压级 (SPL)',
  clarity: '清晰度 (C80)',
};

export const DISPLAY_PARAM_UNITS: Record<DisplayParameter, string> = {
  reverberationTime: 's',
  soundPressureLevel: 'dB',
  clarity: 'dB',
};
