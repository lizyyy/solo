export interface WallZone {
  id?: number;
  name: string;
  code: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  difficultyRangeMin: number;
  difficultyRangeMax: number;
}

export interface Route {
  id?: number;
  name: string;
  code: string;
  color: string;
  difficulty: number;
  difficultyLabel: string;
  zoneCode: string;
  holdPositions: string;
  startPosition: string;
  endPosition: string;
  setDate: string;
  isChildrenRoute: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Hold {
  id?: number;
  code: string;
  name: string;
  type: string;
  color: string;
  position: string;
  x: number;
  y: number;
  installDate: string;
  maxUseCount: number;
  currentUseCount: number;
  lastInspectionDate: string;
  status: string;
  notes: string;
}

export interface WearRecord {
  id?: number;
  holdCode: string;
  recordDate: string;
  wearLevel: number;
  useCount: number;
  inspector: string;
  notes: string;
}

export interface Feedback {
  id?: number;
  memberId: string;
  memberName: string;
  routeCode: string;
  difficultyRating: number;
  enjoymentRating: number;
  comments: string;
  feedbackDate: string;
  hasIssues: boolean;
  issueDetails: string;
}

export interface Review {
  id?: number;
  reviewDate: string;
  reviewer: string;
  routeCode: string;
  holdCode: string;
  reviewType: string;
  findings: string;
  recommendations: string;
  priority: string;
  resolved: boolean;
  resolvedDate: string;
  resolver: string;
  resolutionNotes: string;
}

export interface RiskItem {
  id: string;
  type: 'difficulty_gap' | 'hold_expired' | 'children_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: string;
  affectedItems: string[];
  recommendations: string[];
  detectedAt: string;
}

export interface RiskReport {
  totalRisks: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: {
    difficulty_gap: number;
    hold_expired: number;
    children_conflict: number;
  };
  risks: RiskItem[];
  generatedAt: string;
}
