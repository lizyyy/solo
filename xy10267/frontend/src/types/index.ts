export type Skill = 
  | 'cleaning'
  | 'cooking'
  | 'childcare'
  | 'eldercare'
  | 'petcare'
  | 'laundry'
  | 'ironing'
  | 'organizing';

export const SKILL_LABELS: Record<Skill, string> = {
  cleaning: '日常保洁',
  cooking: '做饭',
  childcare: '育儿',
  eldercare: '老人看护',
  petcare: '宠物照料',
  laundry: '洗衣服',
  ironing: '熨烫',
  organizing: '收纳整理'
};

export type Taboo = 
  | 'no_dogs'
  | 'no_cats'
  | 'no_smoking'
  | 'no_alcohol'
  | 'no_pork'
  | 'no_night_work';

export const TABOO_LABELS: Record<Taboo, string> = {
  no_dogs: '不接触狗',
  no_cats: '不接触猫',
  no_smoking: '不在吸烟环境工作',
  no_alcohol: '不接触酒精',
  no_pork: '不接触猪肉',
  no_night_work: '不做夜班'
};

export type OrderStatus = 
  | 'pending_dispatch'
  | 'dispatched'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'reassigned';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_dispatch: '待派单',
  dispatched: '已派单',
  in_progress: '服务中',
  completed: '已完成',
  cancelled: '已取消',
  reassigned: '已转派'
};

export type AssignmentStatus = 
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: '待确认',
  accepted: '已接受',
  rejected: '已拒绝',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消'
};

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface Aunt {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  skills: Skill[];
  taboos: Taboo[];
  location: Location;
  rating: number;
  experienceYears: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  location: Location;
  taboos: Taboo[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  skillsRequired: Skill[];
  startTime: string;
  endTime: string;
  durationHours: number;
  location: Location;
  customerTaboos: Taboo[];
  specialRequirements?: string;
  status: OrderStatus;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  orderId: string;
  auntId: string;
  status: AssignmentStatus;
  matchedSkills: Skill[];
  distanceKm: number;
  tabooConflicts: Taboo[];
  score: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Leave {
  id: string;
  auntId: string;
  startTime: string;
  endTime: string;
  reason: string;
  isApproved: boolean;
  affectedOrders: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  entityType: 'order' | 'assignment' | 'aunt' | 'leave';
  entityId: string;
  action: string;
  description: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  timestamp: string;
}

export interface DispatchCandidate {
  aunt: Aunt;
  score: number;
  distanceKm: number;
  matchedSkills: Skill[];
  tabooConflicts: Taboo[];
  reasons: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
