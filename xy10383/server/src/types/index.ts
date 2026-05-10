export enum LeadStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  FOLLOWING = 'following',
  CONVERTED = 'converted',
  REJECTED = 'rejected',
  NEEDS_REVIEW = 'needs_review'
}

export enum CustomerLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum AssignmentReason {
  REGION_MATCH = '地区匹配',
  PRODUCT_MATCH = '产品兴趣匹配',
  LOAD_BALANCE = '负载均衡',
  CUSTOMER_LEVEL = '客户等级优先级',
  FALLBACK = '默认分配',
  OVERLOAD = '销售超负载',
  VACATION = '销售休假',
  UNKNOWN_REGION = '地区未知待复核'
}

export interface ILead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  position?: string;
  region?: string;
  productInterest: string[];
  customerLevel: CustomerLevel;
  source: string;
  status: LeadStatus;
  assignedTo?: string;
  assignmentHistory: IAssignmentRecord[];
  duplicateOf?: string;
  isDuplicate: boolean;
  followUpStatus?: string;
  conversionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  assignmentReason?: AssignmentReason;
  assignmentDetails?: string;
  notes?: string;
}

export interface IAssignmentRecord {
  id: string;
  salesId: string;
  salesName: string;
  reason: AssignmentReason;
  details: string;
  timestamp: Date;
  isReassignment: boolean;
  previousSalesId?: string;
}

export interface ISalesPerson {
  id: string;
  name: string;
  email: string;
  phone: string;
  regions: string[];
  productExpertise: string[];
  maxLoad: number;
  currentLoad: number;
  isOnVacation: boolean;
  vacationStart?: Date;
  vacationEnd?: Date;
  stats: {
    pending: number;
    following: number;
    converted: number;
    rejected: number;
    total: number;
  };
}

export interface IAssignmentRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: {
    regions?: string[];
    products?: string[];
    customerLevels?: CustomerLevel[];
  };
  actions: {
    assignTo?: string[];
    autoAssign: boolean;
    needsReview: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssignmentResult {
  leadId: string;
  salesPerson: ISalesPerson | null;
  reason: AssignmentReason;
  details: string;
  success: boolean;
  isDuplicate?: boolean;
  duplicateLeadId?: string;
}

export interface IFollowUpRecord {
  id: string;
  leadId: string;
  salesId: string;
  salesName: string;
  status: string;
  notes: string;
  followUpDate: Date;
  nextFollowUpDate?: Date;
  createdAt: Date;
}

export interface IExportLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  position: string;
  region: string;
  productInterest: string;
  customerLevel: string;
  source: string;
  status: string;
  assignedTo: string;
  assignmentReason: string;
  assignmentDetails: string;
  followUpStatus: string;
  isDuplicate: string;
  duplicateOf: string;
  createdAt: string;
}
