export type EvidenceStatus = 'pending' | 'processing' | 'manager_review' | 'completed';

export type SceneType = 'smooth' | 'missing_city' | 'old_caliber';

export type Operator = '阿梅' | '店长' | '系统';

export type Resolution = 'confirm' | 'reject' | null;

export interface EvidencePack {
  id: string;
  title: string;
  status: EvidenceStatus;
  sceneType: SceneType;
  contractScreenshotUrl: string;
  authorizedCities: string[];
  missingCity?: string;
  hasConflict: boolean;
  currentStep: number;
  trackAliasId?: string;
  verificationOrderId?: string;
  createdAt: string;
}

export interface TrackAlias {
  id: string;
  oldName: string;
  newName: string;
  caliberNote: string;
  effectiveDate: string;
}

export interface VerificationOrder {
  id: string;
  evidencePackId: string;
  trackName: string;
  hours: number;
  status: 'draft' | 'confirmed';
  sourceNote?: string;
  updatedAt: string;
}

export interface OperationLog {
  id: string;
  evidencePackId: string;
  operator: Operator;
  action: string;
  detail: string;
  createdAt: string;
}

export interface ConflictItem {
  id: string;
  evidencePackId: string;
  contractContent: string;
  aliasContent: string;
  difference: string;
  resolved: boolean;
  resolution: Resolution;
}

export interface AppState {
  evidencePacks: EvidencePack[];
  trackAliases: TrackAlias[];
  verificationOrders: VerificationOrder[];
  operationLogs: OperationLog[];
  conflictItems: ConflictItem[];
  currentRole: Operator;
}
