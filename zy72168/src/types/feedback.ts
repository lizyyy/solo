export type FeedbackType = 'complaint' | 'meeting' | 'onsite' | 'import';
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'verify';

export interface ConflictEvidence {
  meetingContent?: string;
  systemContent?: string;
  suggestedActions: string[];
}

export interface Feedback {
  id: string;
  pointId: string;
  type: FeedbackType;
  title: string;
  content: string;
  source: string;
  reporter: string;
  reportTime: string;
  timePeriod: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  hasConflict: boolean;
  conflictWith?: string;
  conflictEvidence?: ConflictEvidence;
  hasEmptyValue: boolean;
  emptyFields?: string[];
  isBoundary: boolean;
  status: FeedbackStatus;
  createdAt: string;
}

export interface DuplicateGroup {
  groupId: string;
  primary: Feedback;
  duplicates: Feedback[];
}

export type ConflictDecision = 'accept_meeting' | 'accept_system' | 'custom';
