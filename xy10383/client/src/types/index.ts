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
  conversionDate?: string;
  createdAt: string;
  updatedAt: string;
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
  timestamp: string;
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
  vacationStart?: string;
  vacationEnd?: string;
  stats: {
    pending: number;
    following: number;
    converted: number;
    rejected: number;
    total: number;
  };
  loadPercentage?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface IFollowUpRecord {
  id: string;
  leadId: string;
  salesId: string;
  salesName: string;
  status: string;
  notes: string;
  followUpDate: string;
  nextFollowUpDate?: string;
  createdAt: string;
}

export interface IDashboardStats {
  totalLeads: number;
  pendingLeads: number;
  assignedLeads: number;
  followingLeads: number;
  convertedLeads: number;
  rejectedLeads: number;
  needsReviewLeads: number;
  duplicateLeads: number;
  conversionRate: string;
  salesStats: ISalesPerson[];
}

export interface IImportResult {
  created: number;
  duplicates: number;
  needsReview: number;
  details: {
    created: ILead[];
    duplicates: { lead: ILead; existingLead: ILead; reason: string }[];
    needsReview: ILead[];
  };
}
