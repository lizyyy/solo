export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Subtitle {
  id: number;
  project_id: number;
  sequence: number;
  start_time: string;
  end_time: string;
  start_seconds: number;
  end_seconds: number;
  original_text: string;
  current_text: string;
  speaker: string | null;
  is_reviewed: boolean | number;
  issues: string | null;
  created_at: string;
  updated_at: string;
}

export interface Term {
  id: number;
  project_id: number;
  term: string;
  replacement: string;
  category: string;
  is_sensitive: boolean | number;
  created_at: string;
}

export interface Speaker {
  id: number;
  project_id: number;
  name: string;
  alias: string;
  is_sensitive: boolean | number;
  created_at: string;
}

export interface DetectionResult {
  id: number;
  project_id: number;
  subtitle_id: number | null;
  issue_type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details: string | null;
  is_resolved: boolean | number;
  created_at: string;
  sequence?: number;
  current_text?: string;
}

export interface ProofreadRecord {
  id: number;
  project_id: number;
  subtitle_id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  created_at: string;
  sequence?: number;
  current_text?: string;
}

export interface SimilaritySuggestion {
  index: number;
  text: string;
  original: any;
  score: number;
}

export interface SimilarPair {
  index1: number;
  index2: number;
  sequence1: number;
  sequence2: number;
  text1: string;
  text2: string;
  similarity: number;
  suggestion: string;
}

export interface ProjectDetail extends Project {
  subtitles: Subtitle[];
  terms: Term[];
  speakers: Speaker[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface ImportResult {
  success: boolean;
  count: number;
}

export type TabType = 'editor' | 'issues' | 'terms' | 'speakers' | 'records';

export interface IssueGroup {
  type: string;
  typeName: string;
  results: DetectionResult[];
}