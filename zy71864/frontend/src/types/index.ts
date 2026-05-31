export interface QuestionBank {
  id: number;
  question_no: string;
  content: string;
  standard_answer: string;
  recurrence_formula?: string;
  version: number;
  created_at: string;
  created_by?: string;
  is_active: boolean;
  parent_id?: number;
}

export interface EquivalentAnswer {
  id: number;
  question_bank_id: number;
  answer_expression: string;
  description?: string;
  created_at: string;
}

export interface EvaluationRecord {
  id: number;
  student_id: string;
  student_name: string;
  question_no: string;
  student_answer: string;
  score?: number;
  evaluation_time: string;
  batch_id?: string;
  remark?: string;
}

export interface FilterCondition {
  id: number;
  user_id: string;
  condition_name?: string;
  condition_json: Record<string, any>;
  created_at: string;
  is_current: boolean;
}

export type DiagnosisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DiagnosisBatch {
  id: number;
  batch_hash: string;
  batch_name: string;
  material_count: number;
  status: DiagnosisStatus;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  filter_condition_id?: number;
  is_reused?: boolean;
}

export type DiagnosisType = 'correct' | 'format_error' | 'type_mismatch' | 
  'wrong_common_difference' | 'wrong_common_ratio' | 'wrong_coefficient' | 
  'wrong_constant' | 'calculation_error' | 'incorrect';

export interface DiagnosisResult {
  id: number;
  batch_id: number;
  question_bank_id?: number;
  evaluation_record_id: number;
  diagnosis_type: DiagnosisType;
  is_correct: boolean;
  is_equivalent: boolean;
  matched_equivalent_id?: number;
  error_type?: string;
  human_readable_error?: string;
  suggestion?: string;
  next_action?: string;
  contact_person?: string;
  created_at: string;
  question?: QuestionBank;
  evaluation_record?: EvaluationRecord;
  matched_equivalent?: EquivalentAnswer;
}

export interface DiagnosisRequest {
  batch_name: string;
  evaluation_record_ids: number[];
  filter_condition_id?: number;
}

export interface DiagnosisSummary {
  total_records: number;
  successfully_diagnosed: number;
  diagnostic_errors: number;
  correct_count: number;
  equivalent_count: number;
  incorrect_count: number;
  accuracy_rate: number;
  error_type_distribution: Record<string, number>;
  errors: Array<{
    record_id: number;
    student_name: string;
    question_no: string;
    error: string;
  }>;
}

export interface BatchDiagnosisResponse {
  batch: DiagnosisBatch;
  results: DiagnosisResult[];
  summary: DiagnosisSummary;
}

export interface ErrorResponse {
  error_code: string;
  message: string;
  suggestion?: string;
  contact_person?: string;
  details?: Record<string, any>;
}

export interface ExportRequest {
  batch_id: number;
  filter_condition_id?: number;
  format?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
