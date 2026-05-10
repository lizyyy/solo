export interface Screening {
  id: string;
  hallNumber: string;
  movieName: string;
  startTime: string;
  endTime: string;
  date: string;
  audienceCount: number;
}

export interface CleaningTask {
  id: string;
  screeningId: string;
  hallNumber: string;
  movieName: string;
  screeningEndTime: string;
  nextScreeningStartTime: string | null;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assignedTo: string;
  startTime?: string;
  endTime?: string;
  qualityScore?: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface LostItem {
  id: string;
  cleaningTaskId: string;
  screeningId: string;
  hallNumber: string;
  itemName: string;
  description: string;
  foundLocation: string;
  foundBy: string;
  foundTime: string;
  status: 'held' | 'claimed' | 'disposed';
  claimant?: string;
  claimantContact?: string;
  claimedTime?: string;
  notes?: string;
  createdAt: string;
}

export interface EquipmentIssue {
  id: string;
  cleaningTaskId: string;
  screeningId: string;
  hallNumber: string;
  equipmentType: string;
  description: string;
  reportedBy: string;
  reportedTime: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'in_progress' | 'resolved' | 'escalated';
  resolvedBy?: string;
  resolvedTime?: string;
  resolutionNotes?: string;
  createdAt: string;
}

export interface DataState {
  screenings: Screening[];
  cleaningTasks: CleaningTask[];
  lostItems: LostItem[];
  equipmentIssues: EquipmentIssue[];
  lastExportAt?: string;
  lastExportHash?: string;
}

export type TabType = 'dashboard' | 'screenings' | 'cleaning' | 'lostItems' | 'equipment' | 'history';
