export type ComponentCategory = '竖梃' | '横梃' | '玻璃' | '连接件';
export type TimelineEventType = '送审表' | '备注' | '异常' | '复核' | '导入';
export type MaterialSource = '送审表' | '口头' | '后补';
export type RemarkType = '正式' | '后补' | '口头';
export type ConclusionStatus = '通过' | '有条件通过' | '不通过';
export type AnomalyType = '坐标偏移' | '材质错误' | '尺寸偏差';
export type AnomalySeverity = '严重' | '一般' | '轻微';
export type DiffKind = 'added' | 'changed' | 'removed';

export interface Component {
  id: string;
  name: string;
  category: ComponentCategory;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX?: number;
  rotationY?: number;
  sizeW: number;
  sizeH: number;
  sizeD: number;
  materialId?: string;
  isAnomaly?: boolean;
  zone?: string;
  floor?: number;
}

export interface MaterialRevision {
  id: string;
  version: '旧版' | '新版';
  reviewDate: string;
  reviewer: string;
  sourceFile: string;
  linkedEventId?: string;
}

export interface MaterialItem {
  id: string;
  revisionId: string;
  componentId?: string;
  materialName: string;
  submissionSpec: string;
  constructionSpec: string;
  isMismatch: boolean;
  source: MaterialSource;
  matchedRemarkId?: string;
}

export interface Remark {
  id: string;
  type: RemarkType;
  content: string;
  author: string;
  createdAt: string;
  reappliedAt?: string;
  linkedComponentId?: string;
  linkedMaterialId?: string;
  linkedTimelineEventId?: string;
  affectsConclusion: boolean;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  componentId: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  severity: AnomalySeverity;
  description: string;
  detectedAt: string;
  linkedTimelineEventId?: string;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description?: string;
  linkedObjectId?: string;
  operator: string;
}

export interface ReviewConclusion {
  id: string;
  timelineEventId: string;
  status: ConclusionStatus;
  description: string;
  generatedAt: string;
  affectedMaterialIds: string[];
  affectedRemarkIds: string[];
  affectedAnomalyIds: string[];
}

export interface Filters {
  eventTypes: TimelineEventType[];
  mismatchOnly: boolean;
  anomalyOnly: boolean;
}

export interface Snapshot {
  materialItems: MaterialItem[];
  remarks: Remark[];
  conclusions: ReviewConclusion[];
  activeRevisionId: string | null;
}

export interface InfluenceNode {
  id: string;
  kind: 'conclusion' | 'material' | 'remark' | 'anomaly';
  title: string;
  subtitle?: string;
  weight: number;
  status?: 'warning' | 'danger' | 'info' | 'ok';
  children?: InfluenceNode[];
}

export interface DiffItem {
  kind: DiffKind;
  section: string;
  field?: string;
  before?: string;
  after?: string;
  summary: string;
}

export interface ReviewContext {
  filteredMaterials: MaterialItem[];
  filteredComponents: Component[];
  filteredRemarks: Remark[];
  filteredAnomalies: Anomaly[];
  filteredTimelineEvents: TimelineEvent[];
  activeRevision: MaterialRevision | undefined;
  currentConclusion: ReviewConclusion | undefined;
  previousConclusion: ReviewConclusion | undefined;
  currentEvent: TimelineEvent | undefined;
  selectedComponent: Component | undefined;
  activeRevisionMaterials: MaterialItem[];
  materialMismatches: MaterialItem[];
  relatedTimelineEventIds: string[];
}

export interface ReportData {
  generatedAt: string;
  context: {
    selectedComponent: Component | undefined;
    activeRevision: MaterialRevision | undefined;
    currentEvent: TimelineEvent | undefined;
    filters: Filters;
  };
  conclusion: ReviewConclusion | undefined;
  previousConclusion: ReviewConclusion | undefined;
  materialMismatches: MaterialItem[];
  remarks: Remark[];
  historicalRemarks: Remark[];
  anomalies: Array<Anomaly & { componentName?: string; componentPosition?: { x: number; y: number; z: number } }>;
  influenceChain: InfluenceNode[];
  diffSinceLastRemark: DiffItem[];
  diffSinceLastReview: DiffItem[];
  snapshotBeforeLastRemark: Snapshot | null;
  snapshotCurrent: Snapshot;
  timelineSummary: string[];
  relevantTimelineEvents: TimelineEvent[];
}

export interface UIState {
  openRemarkModal: boolean;
  openDiffModal: boolean;
  previousSnapshot: Snapshot | null;
  currentSnapshot?: Snapshot | null;
  lastRemarkDiff?: DiffItem[];
  diffBeforeEventId: string | null;
  diffAfterEventId: string | null;
  defaultLinkedComponentId: string | null;
  defaultLinkedMaterialId: string | null;
}

export interface ReviewStoreState {
  timelineEvents: TimelineEvent[];
  currentEventId: string | null;

  components: Component[];
  selectedComponentId: string | null;
  cameraTarget: { x: number; y: number; z: number } | null;

  materialRevisions: MaterialRevision[];
  materialItems: MaterialItem[];
  activeRevisionId: string | null;

  remarks: Remark[];
  anomalies: Anomaly[];
  conclusions: ReviewConclusion[];

  filters: Filters;
  uiState: UIState;

  selectComponent: (id: string | null) => void;
  setCameraTarget: (pos: { x: number; y: number; z: number } | null) => void;
  gotoTimelineEvent: (id: string) => void;
  setActiveRevision: (id: string | null) => void;
  toggleFilterType: (type: TimelineEventType) => void;
  setMismatchOnly: (v: boolean) => void;
  setAnomalyOnly: (v: boolean) => void;
  openRemark: (opts?: { linkedComponentId?: string; linkedMaterialId?: string }) => void;
  closeRemark: () => void;
  addRemark: (remark: Omit<Remark, 'id' | 'createdAt'>) => void;
  openDiff: (beforeId: string, afterId: string) => void;
  closeDiff: () => void;
  takeSnapshot: () => void;
  runReview: () => ReviewConclusion;
  exportReport: () => ReportData;
  computeInfluenceChain: (conclusionId?: string) => InfluenceNode[];
  computeDiff: () => DiffItem[];
  loadMockData: () => void;
  flyToComponent: (id: string) => void;
  getReviewContext: () => ReviewContext;
}
