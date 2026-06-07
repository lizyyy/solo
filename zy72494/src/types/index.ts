export interface RedlineRemark {
  id: string;
  code: string;
  areaName: string;
  location: string;
  hasPetArea: boolean;
  rampCount: number;
  remark: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  importedBy: string;
  importedAt: string;
  currentVersion: number;
  inspectionId?: string;
}

export interface RedlineVersion {
  id: string;
  remarkId: string;
  version: number;
  data: Partial<RedlineRemark>;
  changedBy: string;
  changedAt: string;
  changeReason: string;
}

export interface Inspection {
  id: string;
  inspector: string;
  inspectionDate: string;
  areaName: string;
  petAreaComplaints: number;
  rampIssues: string[];
  photos: string[];
  remarks: string;
  redlineRemarkId?: string;
}

export type ComplaintStatus = 
  | 'pending' 
  | 'reviewing' 
  | 'pending_traffic_review' 
  | 'rectifying' 
  | 'completed';

export type ComplaintType = 'pet_area' | 'ramp' | 'other';

export interface Complaint {
  id: string;
  code: string;
  title: string;
  type: ComplaintType;
  redlineRemarkId: string;
  inspectionId?: string;
  status: ComplaintStatus;
  currentScore: number;
  previousScore?: number;
  assignee: 'zhoujie' | 'traffic' | 'grid';
  createdAt: string;
  updatedAt: string;
  rampSupplementNote?: string;
  trafficReviewNote?: string;
}

export interface CalculationParams {
  version: string;
  rampWeight: number;
  complaintWeight: number;
  areaSizeFactor: number;
  populationDensity: number;
}

export interface ScoreCalculation {
  id: string;
  complaintId: string;
  score: number;
  modelVersion: string;
  params: CalculationParams;
  tradeOffReason: string;
  calculatedAt: string;
  calculatedBy: string;
}

export interface RectificationSuggestion {
  id: string;
  content: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  requiredMaterials: string[];
  handler: string;
}

export interface Report {
  id: string;
  complaintId: string;
  generatedAt: string;
  generatedBy: string;
  suggestions: RectificationSuggestion[];
  materialList: string[];
  nextHandler: 'traffic' | 'zhoujie' | 'grid';
  notes: string;
}

export interface ImportPreview {
  total: number;
  newItems: number;
  updatedItems: number;
  skippedItems: number;
  duplicates: Array<{ code: string; existing: RedlineRemark; incoming: Partial<RedlineRemark> }>;
}

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: '待处理',
  reviewing: '审核中',
  pending_traffic_review: '待交通协管复核',
  rectifying: '整改中',
  completed: '已完成',
};

export const STATUS_COLORS: Record<ComplaintStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-blue-100 text-blue-800',
  pending_traffic_review: 'bg-orange-100 text-orange-800',
  rectifying: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
};

export const TYPE_LABELS: Record<ComplaintType, string> = {
  pet_area: '宠物活动区',
  ramp: '坡道问题',
  other: '其他',
};

export const ASSIGNEE_LABELS: Record<string, string> = {
  zhoujie: '社区书记周姐',
  traffic: '交通协管',
  grid: '网格员',
};
