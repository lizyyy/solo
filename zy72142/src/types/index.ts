export type AnomalyType = 'expired_license' | 'timecode_mismatch' | 'duplicate_track';

export type LicenseStatus = 'valid' | 'expired' | 'pending';

export interface Track {
  id: string;
  title: string;
  artist: string;
  isrc: string;
  duration: number;
  timecode: string;
  licenseStatus: LicenseStatus;
  anomalyTypes: AnomalyType[];
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  version: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
}

export interface FilterOptions {
  search: string;
  status: 'all' | 'normal' | 'anomaly';
  anomalyType: AnomalyType | 'all';
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  expired_license: '授权过期',
  timecode_mismatch: '时码错位',
  duplicate_track: '重复曲目',
};

export const LICENSE_LABELS: Record<LicenseStatus, string> = {
  valid: '有效',
  expired: '过期',
  pending: '待确认',
};
