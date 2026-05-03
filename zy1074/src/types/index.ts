export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  text: string;
}

export interface Chapter {
  id: string;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  title: string;
}

export interface AdPoint {
  id: string;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  description: string;
}

export interface ProjectConfig {
  maxSubtitleLength?: number;
  maxSilenceGap?: number;
  minChapterCoverage?: number;
  sensitiveWords?: string[];
  chapterTitlePattern?: string;
}

export interface ValidationError {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fileName: string;
  startTime?: number;
  endTime?: number;
  startTimeStr?: string;
  endTimeStr?: string;
  cueId?: string;
  details?: Record<string, any>;
}

export interface ValidationResult {
  fileName: string;
  errors: ValidationError[];
  passed: boolean;
  warningCount: number;
  errorCount: number;
}

export interface ProjectValidationResult {
  projectPath: string;
  timestamp: string;
  overallStatus: 'passed' | 'failed' | 'warning';
  results: {
    subtitles: ValidationResult[];
    chapters: ValidationResult | null;
    adPoints: ValidationResult | null;
  };
  summary: {
    totalErrors: number;
    totalWarnings: number;
    totalInfos: number;
  };
}

export interface FixSuggestion {
  error: ValidationError;
  suggestion: string;
  steps: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface Report {
  markdown: string;
  json: string;
  html: string;
}

export interface ProjectFiles {
  subtitles: Array<{
    path: string;
    format: 'srt' | 'vtt';
  }>;
  chapters: string | null;
  adPoints: string | null;
  config: ProjectConfig;
  deliveryFiles: string[];
}
