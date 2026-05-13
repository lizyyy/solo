export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StatusHistory {
  id: string;
  entityId: string;
  entityType: string;
  status: string;
  previousStatus?: string;
  operator: string;
  operatorId: string;
  remark?: string;
  createdAt: string;
}

export interface ChangeLog {
  id: string;
  entityId: string;
  entityType: string;
  field: string;
  oldValue: any;
  newValue: any;
  operator: string;
  operatorId: string;
  createdAt: string;
}

export type LineChangeStatus = 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEW' | 'REJECTED' | 'CANCELLED';
export type CheckStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REVIEWED';
export type KittingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'MISSING';
export type InspectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REWORK' | 'REVIEWED';

export interface LineChangePlan extends BaseEntity {
  planNo: string;
  line: string;
  productCode: string;
  productName: string;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status: LineChangeStatus;
  responsiblePerson: string;
  responsiblePersonId: string;
  remarks?: string;
}

export interface MoldInspectionItem {
  id: string;
  name: string;
  standard: string;
  result?: string;
  isPassed?: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export interface MoldInspection extends BaseEntity {
  planId: string;
  moldCode: string;
  moldName: string;
  items: MoldInspectionItem[];
  status: CheckStatus;
  checkedBy?: string;
  checkedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface MaterialItem {
  id: string;
  materialCode: string;
  materialName: string;
  requiredQty: number;
  actualQty: number;
  unit: string;
  location: string;
  status: KittingStatus;
  checkedBy?: string;
  checkedAt?: string;
}

export interface MaterialKitting extends BaseEntity {
  planId: string;
  items: MaterialItem[];
  status: KittingStatus;
  checkedBy?: string;
  checkedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface FirstArticleItem {
  id: string;
  name: string;
  standard: string;
  result?: string;
  isPassed?: boolean;
  measuredValue?: string;
  checkedBy?: string;
  checkedAt?: string;
}

export interface FirstArticleInspection extends BaseEntity {
  planId: string;
  serialNo: string;
  items: FirstArticleItem[];
  status: InspectionStatus;
  checkedBy?: string;
  checkedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PersonQualification {
  id: string;
  personId: string;
  personName: string;
  qualificationType: string;
  qualificationCode: string;
  validFrom: string;
  validTo: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED';
}

export interface MissingItem {
  id: string;
  planId: string;
  category: 'MOLD' | 'MATERIAL' | 'TOOL' | 'DOCUMENT' | 'OTHER';
  name: string;
  description: string;
  responsiblePerson: string;
  dueDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  resolvedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
  timestamp: string;
}

export interface IdempotentRequest {
  requestId: string;
  entityType: string;
  action: string;
  processed: boolean;
  result?: any;
  createdAt: string;
}
