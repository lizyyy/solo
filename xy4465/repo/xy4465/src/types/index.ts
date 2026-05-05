export interface Route {
  id: string;
  name: string;
  difficulty: string;
  zone: string;
  color: string;
  setter: string;
  setDate: string;
  estimatedGrade?: string;
  active: boolean;
  holdCount?: number;
  tags?: string[];
}

export interface MemberFlow {
  id: string;
  memberId: string;
  memberName: string;
  checkInTime: string;
  checkOutTime: string;
  zone: string;
  activityType: string;
}

export interface Ascent {
  id: string;
  routeId: string;
  memberId: string;
  memberName: string;
  timestamp: string;
  success: boolean;
  attempts: number;
  style: string;
  notes?: string;
  coachRating?: string;
}

export interface IncidentNote {
  id: string;
  type: 'injury' | 'complaint' | 'observation';
  routeId?: string;
  memberId?: string;
  memberName?: string;
  timestamp: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'investigating' | 'resolved';
  assignee?: string;
  resolution?: string;
  resolutionDate?: string;
}

export interface RouteStats {
  routeId: string;
  totalAttempts: number;
  successfulAscents: number;
  successRate: number;
  popularTimeSlots: TimeSlotData[];
  congestionRisk: 'low' | 'medium' | 'high';
  avgAttemptsPerSuccess: number;
  uniqueClimbers: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  avgSessionTime?: number;
}

export interface TimeSlotData {
  hour: number;
  count: number;
  percentage: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  routeId?: string;
  message: string;
  details: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  acknowledged: boolean;
}

export interface CoachNote {
  id: string;
  routeId: string;
  coachName: string;
  timestamp: string;
  content: string;
  category: 'observation' | 'suggestion' | 'grade_adjustment' | 'safety';
  attachedImageUrls?: string[];
}

export interface GradeOverride {
  id: string;
  routeId: string;
  originalGrade: string;
  newGrade: string;
  reason: string;
  coachName: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerName?: string;
  reviewDate?: string;
}

export interface FilterOptions {
  difficulties: string[];
  zones: string[];
  dateRange: {
    start: string;
    end: string;
  };
  searchText: string;
  sortBy: 'name' | 'difficulty' | 'successRate' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

export interface AppData {
  routes: Route[];
  memberFlows: MemberFlow[];
  ascents: Ascent[];
  incidentNotes: IncidentNote[];
  coachNotes: CoachNote[];
  gradeOverrides: GradeOverride[];
  alerts: Alert[];
  lastUpdated: string;
}

export interface ImportResult {
  success: boolean;
  type: string;
  recordsCount: number;
  errors: string[];
  warnings: string[];
}

export interface ExportOptions {
  includeRoutes: boolean;
  includeStats: boolean;
  includeNotes: boolean;
  includeAlerts: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export type DifficultyLevel = 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10+';

export type Zone = '新手区' | '进阶区' | '抱石区' | '难度墙' | '训练区' | '少儿区';

export const DIFFICULTY_ORDER: DifficultyLevel[] = [
  'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10+'
];

export const ZONES: Zone[] = [
  '新手区', '进阶区', '抱石区', '难度墙', '训练区', '少儿区'
];
