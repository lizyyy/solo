import axios from 'axios';
import type {
  QuestionBank,
  EquivalentAnswer,
  EvaluationRecord,
  DiagnosisBatch,
  DiagnosisResult,
  FilterCondition,
  DiagnosisRequest,
  BatchDiagnosisResponse,
  ErrorResponse,
  ExportRequest,
} from '@/types';

const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data) {
      const errData = error.response.data as ErrorResponse;
      return Promise.reject(errData);
    }
    return Promise.reject({
      error_code: 'NETWORK_ERROR',
      message: '网络连接失败，请检查网络后重试',
      suggestion: '请检查网络连接或联系系统管理员',
      contact_person: '系统管理员',
    });
  }
);

export const questionApi = {
  list: (params?: { skip?: number; limit?: number; question_no?: string }) =>
    api.get<QuestionBank[]>('/questions', { params }),

  get: (id: number) =>
    api.get<QuestionBank>(`/questions/${id}`),

  getByNo: (question_no: string) =>
    api.get<QuestionBank>(`/questions/no/${question_no}`),

  getVersions: (question_no: string) =>
    api.get<QuestionBank[]>(`/questions/${question_no}/versions`),

  getVersion: (question_no: string, version: number) =>
    api.get<QuestionBank>(`/questions/${question_no}/versions/${version}`),

  create: (data: Partial<QuestionBank>) =>
    api.post<QuestionBank>('/questions', data),

  update: (id: number, data: Partial<QuestionBank>) =>
    api.put<QuestionBank>(`/questions/${id}`, data),

  addEquivalentAnswer: (data: Partial<EquivalentAnswer>) =>
    api.post<EquivalentAnswer>('/questions/equivalent-answers', data),

  getEquivalentAnswers: (question_id: number) =>
    api.get<EquivalentAnswer[]>(`/questions/${question_id}/equivalent-answers`),
};

export const evaluationApi = {
  list: (params?: { skip?: number; limit?: number; student_id?: string; question_no?: string; batch_id?: string }) =>
    api.get<EvaluationRecord[]>('/evaluation-records', { params }),

  get: (id: number) =>
    api.get<EvaluationRecord>(`/evaluation-records/${id}`),

  create: (data: Partial<EvaluationRecord>) =>
    api.post<EvaluationRecord>('/evaluation-records', data),

  createBatch: (data: Partial<EvaluationRecord>[]) =>
    api.post<EvaluationRecord[]>('/evaluation-records/batch', data),

  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<EvaluationRecord[]>('/evaluation-records/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const diagnosisApi = {
  listBatches: (params?: { skip?: number; limit?: number; status?: string }) =>
    api.get<DiagnosisBatch[]>('/diagnosis/batches', { params }),

  getBatch: (id: number) =>
    api.get<DiagnosisBatch>(`/diagnosis/batches/${id}`),

  getBatchResults: (id: number, params?: { skip?: number; limit?: number; diagnosis_type?: string; is_correct?: boolean }) =>
    api.get<DiagnosisResult[]>(`/diagnosis/batches/${id}/results`, { params }),

  run: (data: DiagnosisRequest) =>
    api.post<BatchDiagnosisResponse>('/diagnosis/run', data),

  export: (data: ExportRequest) =>
    api.post('/diagnosis/export', data, {
      responseType: 'blob',
    }),
};

export const filterApi = {
  list: (user_id: string, params?: { skip?: number; limit?: number }) =>
    api.get<FilterCondition[]>('/filter-conditions', { params: { user_id, ...params } }),

  getCurrent: (user_id: string) =>
    api.get<FilterCondition | null>('/filter-conditions/current', { params: { user_id } }),

  get: (id: number) =>
    api.get<FilterCondition>(`/filter-conditions/${id}`),

  save: (data: Partial<FilterCondition>) =>
    api.post<FilterCondition>('/filter-conditions', data),

  setCurrent: (id: number) =>
    api.put<FilterCondition>(`/filter-conditions/${id}/set-current`),
};

export default api;
