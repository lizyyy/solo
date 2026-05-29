export type LicenseStatus = 'active' | 'expiring' | 'expired' | 'incomplete';

export type LicenseType = 'perpetual' | 'annual' | 'single-use' | 'custom';

export type CredentialType = 'invoice' | 'receipt' | 'email' | 'contract' | 'other';

export type Platform = 'spotify' | 'netease' | 'apple' | 'tencent' | 'youtube' | 'other';

export type EntityType = 'samplePack' | 'track' | 'credential';

export type ActionType = 'create' | 'update' | 'delete' | 'link' | 'unlink';

export type RiskType = 'expiry' | 'multi-use' | 'missing-credential' | 'other';

export type Severity = 'error' | 'warning' | 'info';

export interface SamplePack {
  id: string;
  name: string;
  vendor: string;
  purchaseDate: string;
  licenseType: LicenseType;
  expiryDate?: string;
  price?: number;
  notes?: string;
  status: LicenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Credential {
  id: string;
  samplePackId: string;
  type: CredentialType;
  fileName: string;
  fileUrl?: string;
  description?: string;
  uploadedAt: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  bpm?: number;
  genre?: string;
  projectPath?: string;
  samplePackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformLink {
  id: string;
  trackId: string;
  platform: Platform;
  url: string;
  publishedAt?: string;
}

export interface HistoryRecord {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: ActionType;
  beforeData?: Record<string, unknown>;
  afterData: Record<string, unknown>;
  operator: string;
  timestamp: string;
  notes?: string;
}

export interface RiskAlert {
  id: string;
  type: RiskType;
  severity: Severity;
  title: string;
  message: string;
  relatedEntityId: string;
  relatedEntityType: EntityType;
}

export interface AppState {
  samplePacks: SamplePack[];
  credentials: Credential[];
  tracks: Track[];
  platformLinks: PlatformLink[];
  history: HistoryRecord[];
  risks: RiskAlert[];
}

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  perpetual: '永久授权',
  annual: '年度授权',
  'single-use': '单曲授权',
  custom: '自定义',
};

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  invoice: '正式发票',
  receipt: '订单收据',
  email: '邮件确认',
  contract: '合同协议',
  other: '其他凭证',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  spotify: 'Spotify',
  netease: '网易云音乐',
  apple: 'Apple Music',
  tencent: 'QQ音乐',
  youtube: 'YouTube',
  other: '其他平台',
};

export const STATUS_LABELS: Record<LicenseStatus, string> = {
  active: '授权有效',
  expiring: '即将到期',
  expired: '已过期',
  incomplete: '资料不全',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  link: '关联',
  unlink: '取消关联',
};
