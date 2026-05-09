export type TreeStatus = 'healthy' | 'needs_trimming' | 'diseased' | 'trimmed';

export type ComplaintType = 'shading' | 'disease' | 'resident';

export type WorkOrderStatus = 'pending' | 'processing' | 'completed';

export interface TreeRecord {
  id: string;
  treeNo: string;
  location: string;
  building: string;
  species: string;
  height: number;
  crownDiameter: number;
  plantingDate: string;
  status: TreeStatus;
  shadingLevel: number;
  hasDisease: boolean;
  diseaseDescription?: string;
  lastTrimDate?: string;
  description?: string;
}

export interface ComplaintRecord {
  id: string;
  treeId: string;
  type: ComplaintType;
  description: string;
  complainant: string;
  contact: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolution?: string;
}

export interface WorkOrder {
  id: string;
  treeId: string;
  complaintIds: string[];
  priority: number;
  shadingScore: number;
  diseaseScore: number;
  complaintScore: number;
  totalScore: number;
  status: WorkOrderStatus;
  createdAt: string;
  assignedTo?: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  isPublic: boolean;
  publicAt?: string;
}

export interface AppState {
  trees: TreeRecord[];
  complaints: ComplaintRecord[];
  workOrders: WorkOrder[];
}
