export interface Project {
  id: string;
  name: string;
  folderPath: string;
  description?: string;
  status: 'pending' | 'scanning' | 'analyzing' | 'processing' | 'exporting' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface FileEntry {
  id: string;
  projectId: string;
  fileName: string;
  filePath: string;
  fileType: 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'other';
  fileSize: number;
  mimeType?: string;
  status: 'pending' | 'analyzing' | 'analyzed' | 'processing' | 'processed' | 'error';
  sensitiveCount: number;
  confirmedCount: number;
  ignoredCount: number;
  maskOutputPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensitiveRule {
  id: string;
  name: string;
  category: string;
  pattern: string;
  description?: string;
  isActive: boolean;
  isBuiltin: boolean;
  priority: number;
  createdAt: string;
}

export interface SensitiveHit {
  id: string;
  fileId: string;
  ruleId?: string;
  ruleName: string;
  category: string;
  matchedText: string;
  replacementText?: string;
  contextBefore?: string;
  contextAfter?: string;
  lineNumber?: number;
  startOffset: number;
  endOffset: number;
  status: 'pending' | 'confirmed' | 'ignored' | 'processed';
  confidence: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportRecord {
  id: string;
  projectId: string;
  outputPath: string;
  fileCount: number;
  maskCount: number;
  manifestPath?: string;
  riskReportPath?: string;
  createdAt: string;
}

export interface ManifestEntry {
  fileName: string;
  originalPath: string;
  outputPath: string;
  fileSize: number;
  fileType: string;
  sensitiveCount: number;
  confirmedCount: number;
  ignoredCount: number;
  maskingApplied: boolean;
  hash?: string;
}

export interface RiskReport {
  projectName: string;
  exportTime: string;
  totalFiles: number;
  filesWithSensitiveData: number;
  totalSensitiveHits: number;
  confirmedHits: number;
  ignoredHits: number;
  processedHits: number;
  categoryBreakdown: Record<string, number>;
  fileDetails: {
    fileName: string;
    sensitiveCount: number;
    confirmedCount: number;
    ignoredCount: number;
    categories: string[];
  }[];
}

export interface AnalysisResult {
  fileId: string;
  hits: SensitiveHit[];
  totalHits: number;
  categories: string[];
}

export interface ProcessingResult {
  fileId: string;
  outputPath: string;
  success: boolean;
  hitsProcessed: number;
  error?: string;
}

export type CategoryType = 'contact' | 'identity' | 'organization' | 'finance' | 'location' | 'other';

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  contact: '联系方式',
  identity: '身份信息',
  organization: '组织机构',
  finance: '金融信息',
  location: '地理位置',
  other: '其他',
};

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  contact: '#e74c3c',
  identity: '#9b59b6',
  organization: '#3498db',
  finance: '#f39c12',
  location: '#1abc9c',
  other: '#95a5a6',
};
