export interface Member {
  id: string;
  name: string;
  gender: 'male' | 'female';
  voiceRange: {
    lowest: string;
    highest: string;
    preferred?: string;
  };
  attendance: {
    totalRehearsals: number;
    attendedRehearsals: number;
    rate: number;
  };
  isVeteran: boolean;
  seniority: number;
  notes?: string;
  preferredPart?: string;
  bindPartnerId?: string;
  bindPartnerName?: string;
}

export interface VoicePart {
  id: string;
  name: string;
  displayName: string;
  gender: 'male' | 'female' | 'mixed';
  range: {
    lowest: string;
    highest: string;
  };
  minMembers: number;
  maxMembers: number;
  idealMembers: number;
  requiredVeterans?: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Assignment {
  memberId: string;
  memberName: string;
  partId: string;
  partName: string;
  isManual: boolean;
  matchScore: number;
  conflicts: ConflictItem[];
  adjustedAt?: Date;
  adjustedBy?: string;
}

export interface ConflictItem {
  type: ConflictType;
  severity: 'warning' | 'error' | 'info';
  message: string;
  details?: Record<string, any>;
}

export type ConflictType = 
  | 'OVERCAPACITY'
  | 'UNDERCAPACITY'
  | 'VOICE_MISMATCH'
  | 'ABSENTEEISM'
  | 'PARTNER_SPLIT'
  | 'VETERAN_SHORTAGE'
  | 'MANUAL_OVERRIDE';

export interface AdjustmentRecord {
  id: string;
  timestamp: Date;
  memberId: string;
  memberName: string;
  oldPartId: string;
  oldPartName: string;
  newPartId: string;
  newPartName: string;
  reason: string;
  operator: string;
}

export interface AssignmentResult {
  assignments: Assignment[];
  conflicts: ConflictItem[];
  statistics: {
    totalMembers: number;
    assignedMembers: number;
    partsDistribution: Record<string, number>;
    averageMatchScore: number;
    conflictCount: Record<ConflictType, number>;
  };
}

export interface AttendanceRecord {
  memberId: string;
  memberName: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

export interface ImportData {
  members: Member[];
  voiceParts: VoicePart[];
  attendanceRecords: AttendanceRecord[];
  teacherNotes?: string;
  songName?: string;
  songDifficulty?: 'easy' | 'medium' | 'hard';
}

export type TabType = 'import' | 'result' | 'history' | 'report';

export const NOTE_TO_MIDI: Record<string, number> = {
  'C2': 36, 'D2': 38, 'E2': 40, 'F2': 41, 'G2': 43, 'A2': 45, 'B2': 47,
  'C3': 48, 'D3': 50, 'E3': 52, 'F3': 53, 'G3': 55, 'A3': 57, 'B3': 59,
  'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'B4': 71,
  'C5': 72, 'D5': 74, 'E5': 76, 'F5': 77, 'G5': 79, 'A5': 81, 'B5': 83,
  'C6': 84, 'D6': 86, 'E6': 88, 'F6': 89, 'G6': 91, 'A6': 93, 'B6': 95,
};

export const MIDI_TO_NOTE: Record<number, string> = {
  36: 'C2', 38: 'D2', 40: 'E2', 41: 'F2', 43: 'G2', 45: 'A2', 47: 'B2',
  48: 'C3', 50: 'D3', 52: 'E3', 53: 'F3', 55: 'G3', 57: 'A3', 59: 'B3',
  60: 'C4', 62: 'D4', 64: 'E4', 65: 'F4', 67: 'G4', 69: 'A4', 71: 'B4',
  72: 'C5', 74: 'D5', 76: 'E5', 77: 'F5', 79: 'G5', 81: 'A5', 83: 'B5',
  84: 'C6', 86: 'D6', 88: 'E6', 89: 'F6', 91: 'G6', 93: 'A6', 95: 'B6',
};
