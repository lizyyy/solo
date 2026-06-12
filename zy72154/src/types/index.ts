export type ReviewStatus = 'pending' | 'confirmed' | 'need_verify' | 'on_site';

export type MatchConfidence = 'high' | 'medium' | 'low';

export type AnomalyType = 
  | 'empty_value' 
  | 'duplicate' 
  | 'capacity_overload' 
  | 'time_conflict' 
  | 'data_mismatch'
  | 'boundary_case';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export type DataSourceType = 'gis' | 'feedback' | 'inspection';

export interface GISPoint {
  id: string;
  lamp_id: string;
  address: string;
  longitude: number;
  latitude: number;
  power_rating: number;
  operating_hours: string;
  district: string;
  street: string;
  raw_data: Record<string, any>;
  created_at: Date;
}

export interface ResidentFeedback {
  id: string;
  feedback_id: string;
  lamp_id: string;
  address: string;
  description: string;
  reporter: string;
  phone: string;
  feedback_time: string;
  old_format_note?: string;
  raw_note: string;
  created_at: Date;
}

export interface InspectionRecord {
  id: string;
  record_id: string;
  lamp_id: string;
  address: string;
  inspector: string;
  inspection_time: string;
  photo_urls: string[];
  status: string;
  manual_note: string;
  created_at: Date;
}

export type MatchMethod = 'lamp_id' | 'address' | 'coordinate' | 'unmatched';

export interface MergedRecord {
  id: string;
  lamp_id: string;
  gis_point_id?: string;
  feedback_id?: string;
  inspection_id?: string;
  address: string;
  longitude?: number;
  latitude?: number;
  match_confidence: MatchConfidence;
  match_score: number;
  match_method: MatchMethod;
  review_status: ReviewStatus;
  review_note: string;
  merged_at: Date;
  reviewed_at?: Date;
}

export interface AuditLog {
  id: string;
  record_id: string;
  action: string;
  old_value: string;
  new_value: string;
  note: string;
  detail: string;
  created_at: Date;
}

export interface Anomaly {
  id: string;
  merged_record_id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  human_readable: string;
  detected_at: Date;
}

export interface ImportFile {
  id: string;
  name: string;
  type: DataSourceType;
  size: number;
  uploaded_at: Date;
  record_count: number;
}

export interface MatchResult {
  mergedRecord: MergedRecord;
  gisPoint?: GISPoint;
  feedback?: ResidentFeedback;
  inspection?: InspectionRecord;
  anomalies: Anomaly[];
  auditLogs: AuditLog[];
}
