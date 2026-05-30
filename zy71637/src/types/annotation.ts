export type AnnotationType = 'point' | 'time_range' | 'price_range' | 'area';

export interface AnnotationTag {
  id: string;
  name: string;
  color: string;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  title: string;
  content: string;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  tags: string[];
  author: string;
  createdAt: number;
  updatedAt: number;
  relatedCubeIds: string[];
  relatedAnomalyIds: string[];
  tagId: string;
  snapshotIndex: number;
  timestamp: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'overview' | 'anomaly_analysis' | 'timeline' | 'annotation' | 'custom';
  visible: boolean;
  order: number;
}

export interface ReportConfig {
  title: string;
  author: string;
  dateRange: {
    start: number;
    end: number;
  };
  includeAnomalies: boolean;
  includeAnnotations: boolean;
  includeScreenshots: boolean;
  templateId: string;
}

export interface GeneratedReport {
  id: string;
  title: string;
  author: string;
  createdAt: number;
  content: string;
  htmlContent?: string;
  config: ReportConfig;
  summary: {
    totalAnomalies: number;
    highSeverity: number;
    annotationsCount: number;
    timeRange: string;
  };
}

export const ANNOTATION_TYPE_NAMES: Record<AnnotationType, string> = {
  point: '时间点标注',
  time_range: '时间区间',
  price_range: '价格区间',
  area: '区域标注',
};

export const DEFAULT_TAGS: AnnotationTag[] = [
  { id: 'tag-1', name: '盘口坍塌', color: '#ff4757' },
  { id: 'tag-2', name: '流动性枯竭', color: '#ff6b81' },
  { id: 'tag-3', name: '大单吃货', color: '#2ed573' },
  { id: 'tag-4', name: '砸盘', color: '#ff4757' },
  { id: 'tag-5', name: '拉盘', color: '#2ed573' },
  { id: 'tag-6', name: '震荡', color: '#ffa502' },
  { id: 'tag-7', name: '假突破', color: '#a55eea' },
  { id: 'tag-8', name: '真突破', color: '#1e90ff' },
  { id: 'tag-9', name: '策略入场', color: '#2ed573' },
  { id: 'tag-10', name: '策略止损', color: '#ff4757' },
];
