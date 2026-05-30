export enum TrackStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELIVERED = 'delivered',
  ARCHIVED = 'archived',
}

export enum FileStatus {
  UPLOADED = 'uploaded',
  PENDING_VALIDATION = 'pending_validation',
  VALID = 'valid',
  INVALID = 'invalid',
  SUPERSEDED = 'superseded',
  ARCHIVED = 'archived',
}

export enum DeliveryStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DELIVERED = 'delivered',
  ACKNOWLEDGED = 'acknowledged',
}

export enum EntityType {
  TRACK = 'track',
  MASTER_FILE = 'master_file',
  COVER_ART = 'cover_art',
  PLATFORM_SPEC = 'platform_spec',
  DELIVERY_REPORT = 'delivery_report',
}

export enum AnomalyType {
  MASTER_VERSION_CONFLICT = 'master_version_conflict',
  SPEC_MISMATCH = 'spec_mismatch',
  COVER_OVERWRITE = 'cover_overwrite',
  DEADLINE_RISK = 'deadline_risk',
  PAYMENT_RISK = 'payment_risk',
  ROSTER_RISK = 'roster_risk',
  MISSING_METADATA = 'missing_metadata',
  FORMAT_MISMATCH = 'format_mismatch',
}

export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AnomalyStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

export enum Platform {
  SPOTIFY = 'spotify',
  APPLE_MUSIC = 'apple_music',
  TIDAL = 'tidal',
  QQ_MUSIC = 'qq_music',
  NETEASE = 'netease',
  BILIBILI = 'bilibili',
  DOUYIN = 'douyin',
  KUAISHOU = 'kuaishou',
  BANDCAMP = 'bandcamp',
  SOUNDCLOUD = 'soundcloud',
}

export enum AudioFormat {
  WAV = 'wav',
  FLAC = 'flac',
  AIFF = 'aiff',
  MP3 = 'mp3',
  AAC = 'aac',
}

export enum ImageFormat {
  JPG = 'jpg',
  PNG = 'png',
  TIFF = 'tiff',
  WEBP = 'webp',
}
