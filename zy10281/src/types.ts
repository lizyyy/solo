export type SignStatus = 'agree' | 'disagree' | 'pending' | 'withdrawn';
export type BusinessPhase = 'preparation' | 'signing' | 'publicity' | 'implementation' | 'completed';
export type ObjectionStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

export interface Resident {
  id: string;
  buildingId: string;
  roomNumber: string;
  floor: number;
  unit: string;
  name: string;
  phone: string;
  area: number;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignRecord {
  id: string;
  buildingId: string;
  residentId: string;
  versionId: string;
  status: SignStatus;
  signDate?: string;
  objectionReason?: string;
  objectionStatus?: ObjectionStatus;
  objectionHandler?: string;
  objectionHandleDate?: string;
  isDuplicate: boolean;
  isWithdrawnButCounted: boolean;
  handler: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostScheme {
  id: string;
  buildingId: string;
  versionId: string;
  name: string;
  description: string;
  totalCost: number;
  allocationMethod: 'area' | 'floor' | 'equal';
  floorCoefficients: Record<number, number>;
  paymentSchedule: string;
  createdBy: string;
  createdAt: string;
}

export interface PublicityComment {
  id: string;
  buildingId: string;
  versionId: string;
  content: string;
  commenter: string;
  commentDate: string;
  response?: string;
  responder?: string;
  responseDate?: string;
  isResolved: boolean;
}

export interface BuildingVersion {
  id: string;
  buildingId: string;
  versionNumber: number;
  versionName: string;
  description: string;
  isEffective: boolean;
  createdBy: string;
  createdAt: string;
  changeLog: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  totalHouseholds: number;
  totalFloors: number;
  units: string[];
  currentPhase: BusinessPhase;
  currentEffectiveVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressStats {
  totalHouseholds: number;
  signedCount: number;
  agreeCount: number;
  disagreeCount: number;
  pendingCount: number;
  agreeRate: number;
  signedRate: number;
  objectionCount: number;
  unresolvedObjectionCount: number;
}

export interface VersionComparison {
  version: BuildingVersion;
  signChanges: {
    resident: Resident;
    oldStatus?: SignStatus;
    newStatus: SignStatus;
  }[];
  costScheme?: CostScheme;
  comments: PublicityComment[];
}
