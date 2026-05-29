export interface Class {
  id: string;
  name: string;
  grade: string;
  createdAt: Date;
}

export interface Student {
  id: string;
  classId: string;
  name: string;
  studentNo?: string;
  createdAt: Date;
}

export interface Work {
  id: string;
  studentId: string;
  title: string;
  theme?: string;
  createdAt: Date;
}

export interface DataGaps {
  missingFields: string[];
  incomplete: boolean;
  warnings: string[];
  forcedImport: boolean;
}

export interface WorkVersion {
  id: string;
  workId: string;
  versionNumber: number;
  imageHash: string;
  imageDataUrl: string;
  width: number;
  height: number;
  hasTransparency: boolean;
  backgroundColor?: string;
  dataGaps: DataGaps;
  importedAt: Date;
  importedBy: string;
  excludedPixelCount: number;
  totalPixelCount: number;
}

export interface ColorSample {
  id: string;
  versionId: string;
  hex: string;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  hsl_h: number;
  hsl_s: number;
  hsl_l: number;
  lab_l: number;
  lab_a: number;
  lab_b: number;
  percentage: number;
  isBackground: boolean;
  isExtreme: boolean;
  pixelCount: number;
  clusterPixels?: Array<{ x: number; y: number }>;
}

export type IssueType = 'duplicate' | 'gray' | 'over_saturated';
export type IssueSeverity = 'low' | 'medium' | 'high';

export interface ColorIssue {
  id: string;
  versionId: string;
  type: IssueType;
  severity: IssueSeverity;
  colorHex: string;
  percentage: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  description: string;
  affectedPixels?: number;
}

export interface TeacherComment {
  id: string;
  versionId: string;
  content: string;
  overallScore: number;
  structuredTags: string[];
  createdAt: Date;
  teacherName: string;
}

export interface ColorAnalysisResult {
  dominantColors: ColorSample[];
  issues: ColorIssue[];
  overallScore: number;
  metrics: {
    colorEntropy: number;
    grayPercentage: number;
    overSaturatedPercentage: number;
    averageSaturation: number;
    colorVariety: number;
  };
}

export interface ClassOverviewStats {
  totalWorks: number;
  averageScore: number;
  issueRate: number;
  completionRate: number;
  issueDistribution: Record<IssueType, number>;
  topStudents: Array<{
    studentId: string;
    studentName: string;
    averageScore: number;
    workCount: number;
  }>;
  recentWorks: Array<{
    workId: string;
    studentName: string;
    title: string;
    score: number;
    importedAt: Date;
  }>;
}

export interface StudentComparisonData {
  studentId: string;
  studentName: string;
  works: Array<{
    workId: string;
    title: string;
    theme?: string;
    score: number;
    issues: number;
    dominantColors: string[];
  }>;
  averageScore: number;
  totalIssues: number;
  improvementTrend: number;
}

export interface ExportConfig {
  classId?: string;
  studentIds?: string[];
  startDate?: string;
  endDate?: string;
  fields: string[];
  format: 'xlsx' | 'csv';
  includeGaps: boolean;
  includeIssues: boolean;
  includeColors: boolean;
}

export const EXPORT_FIELDS = [
  { key: 'studentName', label: '学生姓名', required: true },
  { key: 'className', label: '班级', required: true },
  { key: 'workTitle', label: '作品标题', required: true },
  { key: 'theme', label: '主题', required: false },
  { key: 'importedAt', label: '导入时间', required: true },
  { key: 'versionNumber', label: '版本号', required: false },
  { key: 'overallScore', label: '综合评分', required: true },
  { key: 'dominantColors', label: '主色', required: false },
  { key: 'issueCount', label: '问题数量', required: false },
  { key: 'issueTypes', label: '问题类型', required: false },
  { key: 'teacherComment', label: '教师点评', required: false },
  { key: 'dataGaps', label: '数据缺口', required: false },
  { key: 'warnings', label: '警告信息', required: false },
] as const;

export type ExportFieldKey = (typeof EXPORT_FIELDS)[number]['key'];

export interface UploadedFile {
  file: File;
  preview: string;
  studentName?: string;
  theme?: string;
  className?: string;
}

export interface VersionDiff {
  version1: WorkVersion;
  version2: WorkVersion;
  colorChanges: Array<{
    hex: string;
    oldPercentage: number;
    newPercentage: number;
    change: 'added' | 'removed' | 'modified';
  }>;
  scoreChange: number;
  issueChanges: {
    added: ColorIssue[];
    removed: ColorIssue[];
    modified: ColorIssue[];
  };
  commentChange?: string;
}
