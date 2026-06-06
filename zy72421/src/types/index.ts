export type TrackStatus = 'normal' | 'removed' | 'updated' | 'pending_review' | 'processing';

export type BatchStatus = 'processing' | 'normal' | 'pending_review' | 'supplemented' | 'completed';

export type SceneType = 'smooth' | 'mixed_tickets' | 'old_standard';

export type TicketType = 'free' | 'paid' | 'mixed';

export type AuthorizationStatus = 'valid' | 'expired' | 'pending';

export type StandardType = 'new' | 'old';

export interface Track {
  id: string;
  name: string;
  alias: string;
  status: TrackStatus;
  standard: StandardType;
  hasMixedTickets: boolean;
  ticketType: TicketType;
  authorization: AuthorizationStatus;
  remark?: string;
}

export interface Photo {
  id: string;
  url: string;
  remark: string;
  takenAt: string;
  hasOldStandard: boolean;
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  sceneType: SceneType;
  tracks: Track[];
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
  operator?: string;
}

export type HistoryAction = 'import' | 'correct' | 'rerun' | 'review' | 'supplement';

export interface HistoryRecord {
  id: string;
  targetId: string;
  targetType: 'batch' | 'track';
  action: HistoryAction;
  operator: string;
  beforeValue: string;
  afterValue: string;
  timestamp: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
