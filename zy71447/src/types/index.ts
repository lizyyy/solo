export type InstrumentName = '古琴' | '琵琶' | '提琴';

export type BandType = 'low' | 'mid' | 'high';

export type RiskType = 'section_occlusion' | 'band_mismatch' | 'hotspot_missing';

export type Severity = 'low' | 'medium' | 'high';

export type Axis = 'x' | 'y' | 'z';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface MaterialGroup {
  id: string;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
}

export interface SectionLine {
  id: string;
  axis: Axis;
  position: number;
  label: string;
}

export interface InstrumentModel {
  id: string;
  name: InstrumentName;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  centerPoint: Point3D;
  materialGroups: MaterialGroup[];
  sectionReferences: SectionLine[];
  dataVersion: string;
  description: string;
}

export interface ResonanceCavity {
  id: string;
  instrumentId: string;
  name: string;
  boundary: Point3D[];
  material: string;
  thickness: number;
  volume: number;
  color: string;
}

export interface FrequencySample {
  id: string;
  instrumentId: string;
  position: Point3D;
  frequency: number;
  responseIntensity: number;
  band: BandType;
  dataSource: string;
  measurementDate: string;
}

export interface Hotspot {
  id: string;
  instrumentId: string;
  name: string;
  description: string;
  position: Point3D;
  category: 'structure' | 'acoustics' | 'craftsmanship';
  importance: number;
}

export interface RiskItem {
  id: string;
  type: RiskType;
  instrumentId: string;
  description: string;
  severity: Severity;
  rawDataSnapshot: Record<string, unknown>;
  businessInterpretation: string;
  detectedAt: string;
}

export interface BusinessExplanation {
  featureKey: 'section_cut' | 'band_switch' | 'hotspot_annotation';
  explanation: string;
  ruleBasis: string;
}

export interface ReportBatch {
  id: string;
  batchNo: string;
  date: string;
  instrumentType: InstrumentName;
  risks: RiskItem[];
  generatedAt: string;
  dataVersion: string;
  fileName: string;
  reviewer: string;
}

export interface SectionParams {
  axis: Axis;
  position: number;
  showCutSurface: boolean;
  highlightMaterial: string | null;
  showInternal: boolean;
}

export interface BandConfig {
  key: BandType;
  label: string;
  minFreq: number;
  maxFreq: number;
  color: string;
}

export interface InstrumentDataBundle {
  instrument: InstrumentModel;
  cavities: ResonanceCavity[];
  samples: FrequencySample[];
  hotspots: Hotspot[];
}

export const BAND_CONFIGS: BandConfig[] = [
  { key: 'low', label: '低频', minFreq: 80, maxFreq: 250, color: '#1E88E5' },
  { key: 'mid', label: '中频', minFreq: 250, maxFreq: 2000, color: '#43A047' },
  { key: 'high', label: '高频', minFreq: 2000, maxFreq: 8000, color: '#E53935' },
];

export const BUSINESS_EXPLANATIONS: BusinessExplanation[] = [
  {
    featureKey: 'section_cut',
    explanation: '剖面切割以乐器中心线为基准，保证对称结构完整展示',
    ruleBasis: '切割阈值30%，超过则提示遮挡风险',
  },
  {
    featureKey: 'band_switch',
    explanation: '频段划分参照声学标准，低频80-250Hz、中频250-2000Hz、高频2000-8000Hz',
    ruleBasis: '偏差超过15%则提示频段标错风险',
  },
  {
    featureKey: 'hotspot_annotation',
    explanation: '热点位置依据乐器设计图纸，误差控制在2mm以内',
    ruleBasis: '落在剖面外则提示讲解点丢失风险',
  },
];

export const RISK_TYPE_LABELS: Record<RiskType, string> = {
  section_occlusion: '剖面遮挡',
  band_mismatch: '频段标错',
  hotspot_missing: '讲解点丢失',
};
