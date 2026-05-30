export type VoicePart = 'soprano' | 'alto' | 'tenor' | 'bass';

export const VOICE_PARTS: VoicePart[] = ['soprano', 'alto', 'tenor', 'bass'];

export const VOICE_PART_LABELS: Record<VoicePart, string> = {
  soprano: '女高音',
  alto: '女低音',
  tenor: '男高音',
  bass: '男低音',
};

export interface Member {
  id: string;
  name: string;
  voicePart: VoicePart;
  isSectionLeader: boolean;
  isSubstitute: boolean;
  experienceLevel: number;
  attendanceRate: number;
  canLead: boolean;
  preferredPosition?: { row: number; col: number };
}

export interface LeaveRequest {
  id: string;
  memberId: string;
  requestDate: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_more_info';
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SubstituteRecommendation {
  id: string;
  leaveRequestId: string;
  substituteId: string;
  score: number;
  reasons: string[];
  status: 'pending' | 'selected' | 'rejected';
}

export interface Position {
  row: number;
  col: number;
}

export interface StandingPosition {
  memberId: string;
  position: Position;
}

export interface StandingVersion {
  id: string;
  name: string;
  date: string;
  positions: StandingPosition[];
  createdAt: string;
  createdBy: string;
  isActive: boolean;
  conflicts: Conflict[];
}

export interface Conflict {
  id: string;
  type: 'duplicate_substitute' | 'voice_imbalance' | 'position_conflict' | 'no_leader';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedItems: string[];
  resolution?: string;
}

export interface RehearsalReport {
  id: string;
  date: string;
  leaveRequests: LeaveRequest[];
  substituteAssignments: SubstituteRecommendation[];
  standingVersion: StandingVersion;
  summary: {
    totalMembers: number;
    absentMembers: number;
    presentMembers: number;
    substitutesUsed: number;
    voicePartBalance: Record<VoicePart, { planned: number; actual: number; leaders: number }>;
  };
  issues: Conflict[];
  exportedAt: string;
  dataHash: string;
}

export interface AppState {
  members: Member[];
  leaveRequests: LeaveRequest[];
  substituteRecommendations: SubstituteRecommendation[];
  standingVersions: StandingVersion[];
  reports: RehearsalReport[];
}
