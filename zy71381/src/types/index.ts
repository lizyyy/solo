export type DependencyStatus =
  | 'pending_parse'
  | 'parsing'
  | 'parsed_normal'
  | 'parsed_dirty'
  | 'pending_review'
  | 'reviewing'
  | 'approved'
  | 'blocked'
  | 'waiver_pending'
  | 'waiver_approved'
  | 'waiver_rejected'
  | 'in_report';

export type RiskLevel = 'critical' | 'warning' | 'safe' | 'unknown';

export type DirtyType =
  | 'license_missing'
  | 'version_conflict'
  | 'format_error'
  | 'transitive_missing'
  | 'repo_url_missing'
  | 'repo_missing';

export type FileType = 'package_json' | 'pom_xml' | 'requirements_txt' | 'go_mod' | 'other';

export type ParseStatus = 'pending' | 'success' | 'failed';

export type WaiverStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type ReportStatus = 'draft' | 'final';

export type ReportFormat = 'json' | 'csv' | 'pdf' | 'markdown';

export type BlockReasonType =
  | 'license_missing'
  | 'license_high_risk'
  | 'license_conflict'
  | 'transitive_dependency'
  | 'waiver_expired'
  | 'waiver_rejected'
  | 'security_risk'
  | 'deprecated'
  | 'end_of_life'
  | 'outdated_version'
  | 'dual_license'
  | 'dirty_data';

export type LicenseCategory = 'permissive' | 'copyleft' | 'agpl' | 'proprietary' | 'public_domain';

export interface BlockReason {
  type: BlockReasonType;
  detail?: string;
}

export interface StatusHistoryItem {
  status: DependencyStatus;
  timestamp: number;
  operator: string;
  notes?: string;
}

export interface WaiverStatusHistory {
  status: WaiverStatus;
  timestamp: number;
  operator: string;
  notes?: string;
}

export const STATUS_TRANSITIONS: Record<DependencyStatus, DependencyStatus[]> = {
  pending_parse: ['parsing'],
  parsing: ['parsed_normal', 'parsed_dirty'],
  parsed_normal: ['pending_review', 'approved', 'blocked'],
  parsed_dirty: ['pending_review'],
  pending_review: ['reviewing', 'approved', 'blocked', 'waiver_pending'],
  reviewing: ['approved', 'blocked', 'waiver_pending'],
  approved: ['in_report', 'blocked'],
  blocked: ['waiver_pending', 'approved'],
  waiver_pending: ['waiver_approved', 'waiver_rejected'],
  waiver_approved: ['approved', 'in_report', 'blocked'],
  waiver_rejected: ['blocked', 'waiver_pending'],
  in_report: ['approved', 'blocked'],
};

export function isValidStatusTransition(
  from: DependencyStatus,
  to: DependencyStatus
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const DEPENDENCY_STATUS_LABELS: Record<DependencyStatus, string> = {
  pending_parse: '待解析',
  parsing: '解析中',
  parsed_normal: '解析完成-正常',
  parsed_dirty: '解析完成-脏数据',
  pending_review: '待审查',
  reviewing: '审查中',
  approved: '已通过',
  blocked: '已拦截',
  waiver_pending: '豁免申请中',
  waiver_approved: '豁免已通过',
  waiver_rejected: '豁免已驳回',
  in_report: '已纳入报告',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  critical: '高危',
  warning: '中危',
  safe: '低危',
  unknown: '未知',
};

export const DIRTY_TYPE_LABELS: Record<DirtyType, string> = {
  license_missing: '许可证缺失',
  version_conflict: '版本冲突',
  format_error: '格式错误',
  transitive_missing: '传递依赖漏算',
  repo_url_missing: '仓库地址缺失',
  repo_missing: '仓库地址缺失',
};

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  package_json: 'NPM (package.json)',
  pom_xml: 'Maven (pom.xml)',
  requirements_txt: 'Python (requirements.txt)',
  go_mod: 'Go Modules (go.mod)',
  other: '其他格式',
};

export const WAIVER_STATUS_LABELS: Record<WaiverStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  expired: '已过期',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: '草稿',
  final: '正式发布',
};

export const BLOCK_REASON_LABELS: Record<BlockReasonType, string> = {
  license_missing: '许可证缺失',
  license_high_risk: '许可证风险过高',
  license_conflict: '许可证冲突',
  transitive_dependency: '传递依赖需要确认',
  waiver_expired: '豁免已过期',
  waiver_rejected: '豁免已驳回',
  security_risk: '存在安全风险',
  deprecated: '包已废弃',
  end_of_life: '已停止维护',
  outdated_version: '版本过旧',
  dual_license: '双许可证待选择',
  dirty_data: '脏数据待修复',
};

export const LICENSE_CATEGORY_LABELS: Record<LicenseCategory, string> = {
  permissive: '宽松型',
  copyleft: '弱Copyleft',
  agpl: '强Copyleft',
  proprietary: '专有',
  public_domain: '公有领域',
};

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  lastExportHash?: string;
}

export interface DependencyFile {
  id: string;
  projectId: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  fileContent: string;
  uploadTime: number;
  parseStatus: ParseStatus;
  parseError?: string;
  parsedAt?: number;
  parsedCount?: number;
}

export interface DirtyDataRecord {
  dirtyType: DirtyType;
  description: string;
  fixed: boolean;
  fixedAt?: number;
  fixedBy?: string;
  fixNotes?: string;
  rawData?: Record<string, unknown>;
  detectedAt?: number;
}

export interface StatusLog {
  id: string;
  dependencyId: string;
  fromStatus: DependencyStatus;
  toStatus: DependencyStatus;
  operator: string;
  reason: string;
  timestamp: number;
}

export interface Dependency {
  id: string;
  projectId: string;
  fileId: string;
  parentId?: string;
  packageName: string;
  packageVersion: string;
  license: string | string[];
  licenseSelected?: string | null;
  licenseMatched: boolean;
  repoUrl?: string | null;
  homepage?: string;
  isDirect: boolean;
  depth: number;
  transitiveDependencies: string[];
  status: DependencyStatus;
  riskLevel: RiskLevel;
  riskScore?: number;
  riskFactors?: string[];
  blockReason?: string;
  blockReasons?: BlockReason[];
  reviewNotes?: string;
  dirtyData?: DirtyDataRecord;
  waiverId?: string;
  sourceFile?: string;
  importMethod?: string;
  statusHistory?: StatusHistoryItem[];
  createdAt: number;
  updatedAt: number;
  statusLogs?: StatusLog[];
}

export interface LicenseDefinition {
  id: string;
  spdxId: string;
  fullName: string;
  shortName: string;
  name: string;
  category: LicenseCategory;
  riskLevel: RiskLevel;
  description: string;
  obligations: string[];
  conditions: string[];
  permissions: string[];
  restrictions: string[];
  forbidden: string[];
  url?: string;
  isCopyleft: boolean;
  isCustom?: boolean;
  copyleftStrength?: 'strong' | 'weak' | 'network';
  createdAt?: number;
  updatedAt?: number;
}

export interface WaiverHistory {
  id: string;
  waiverId: string;
  previousExpiryDate: number;
  newExpiryDate: number;
  extendedBy: string;
  extendedAt: number;
  reason: string;
}

export interface Waiver {
  id: string;
  dependencyId: string;
  projectId: string;
  applicant: string;
  approver?: string | null;
  reason: string;
  justification: string;
  effectiveDate: number;
  expiryDate: number;
  expireDate?: number;
  status: WaiverStatus;
  approvalNotes?: string | null;
  approvalDate?: number | null;
  approvedAt?: number;
  createdAt: number;
  updatedAt: number;
  rejectionReason?: string;
  notes?: string;
  statusHistory?: WaiverStatusHistory[];
  history?: WaiverHistory[];
}

export interface ReportStats {
  total: number;
  directCount: number;
  transitiveCount: number;
  waiverCount: number;
  riskBreakdown: {
    critical: number;
    warning: number;
    safe: number;
    unknown: number;
  };
  licenseBreakdown: Record<string, number>;
}

export interface ComplianceResult {
  passed: boolean;
  summary: string;
  details?: string[];
}

export interface ReportDependency {
  packageName: string;
  packageVersion: string;
  license: string | string[];
  riskLevel: RiskLevel;
  status: DependencyStatus;
  waiverId?: string;
}

export type VerificationStatus = 'pending' | 'verified' | 'failed';

export interface ComplianceReport {
  id: string;
  projectId: string;
  title: string;
  notes?: string;
  reportVersion: string;
  version: number;
  generatedAt: number;
  generatedBy: string;
  status: ReportStatus;
  totalDependencies: number;
  safeCount: number;
  warningCount: number;
  criticalCount: number;
  unknownCount: number;
  waiverCount: number;
  dirtyCount: number;
  contentHash: string;
  exportHash?: string;
  verificationStatus: VerificationStatus;
  verificationHash?: string;
  verificationTime?: number;
  stats: ReportStats;
  complianceResult: ComplianceResult;
  dependencies: ReportDependency[];
  entries?: ReportEntry[];
}

export interface ReportEntry {
  id: string;
  reportId: string;
  dependencyId: string;
  packageName: string;
  packageVersion: string;
  license: string;
  riskLevel: RiskLevel;
  status: DependencyStatus;
  waiverId?: string;
  notes?: string;
}

export interface ExportRecord {
  id: string;
  reportId: string;
  format: ReportFormat;
  exportedAt: number;
  exportedBy: string;
  exportHash: string;
  filePath?: string;
  recordCount: number;
}

export interface ParseError {
  type: DirtyType;
  line?: number;
  packageName?: string;
  message: string;
}

export interface ParserResult {
  dependencies: Omit<
    Dependency,
    | 'id'
    | 'projectId'
    | 'fileId'
    | 'status'
    | 'riskLevel'
    | 'createdAt'
    | 'updatedAt'
    | 'statusLogs'
  >[];
  errors: ParseError[];
}

export interface LicenseMatchResult {
  license: LicenseDefinition | null;
  confidence: number;
  isDual: boolean;
  alternatives?: LicenseDefinition[];
}

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
  suggestions: string[];
  score?: number;
  factors?: string[];
  blockReasons?: BlockReason[];
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: number;
  operator: string;
  details?: Record<string, unknown>;
}

export function getCurrentUser(): string {
  return localStorage.getItem('licenseWall_user') || '当前用户';
}
