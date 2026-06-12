export type TrackStatus = 'normal' | 'removed' | 'updated' | 'pending_review' | 'processing';

export type BatchStatus = 'processing' | 'normal' | 'pending_review' | 'supplemented' | 'completed';

export type SceneType = 'smooth' | 'mixed_tickets' | 'old_standard';

export type TicketType = 'free' | 'paid' | 'mixed';

export type AuthorizationStatus = 'valid' | 'expired' | 'pending';

export type StandardType = 'new' | 'old';

export interface SupplementRecord {
  id: string;
  photoRemark: string;
  sourcePhotoId: string;
  operator: string;
  timestamp: string;
  reason: string;
  beforeStatus: TrackStatus;
  beforeStandard: StandardType;
  afterStatus: TrackStatus;
  afterStandard: StandardType;
}

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
  supplementHistory?: SupplementRecord[];
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

export type HistoryAction = 'import' | 'correct' | 'rerun' | 'review' | 'supplement' | 'add_photo';

export interface HistoryDetail {
  originalRemark?: string;
  photoRemark?: string;
  reason?: string;
  sourcePhotoId?: string;
  fieldChanges?: {
    field: string;
    before: string;
    after: string;
  }[];
}

export interface HistoryRecord {
  id: string;
  targetId: string;
  targetType: 'batch' | 'track';
  action: HistoryAction;
  operator: string;
  beforeValue: string;
  afterValue: string;
  timestamp: string;
  detail?: HistoryDetail;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
