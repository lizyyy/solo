import axios from 'axios';
import { Student, Attendance, ExamScore, RetakeRecord, Certificate, StatusHistory, Statistics } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export const studentApi = {
  getAll: () => api.get<Student[]>('/students'),
  getById: (id: string) => api.get<Student>(`/students/${id}`),
  create: (data: Partial<Student>) => api.post<Student>('/students', data),
  update: (id: string, data: Partial<Student>) => api.put<Student>(`/students/${id}`, data)
};

export const attendanceApi = {
  getAll: () => api.get<Attendance[]>('/attendance'),
  getByStudentId: (studentId: string) => api.get<Attendance[]>(`/attendance/student/${studentId}`),
  create: (data: Partial<Attendance>) => api.post<Attendance>('/attendance', data),
  update: (id: string, data: Partial<Attendance>) => api.put<Attendance>(`/attendance/${id}`, data)
};

export const examScoreApi = {
  getAll: () => api.get<ExamScore[]>('/exam-scores'),
  getByStudentId: (studentId: string) => api.get<ExamScore[]>(`/exam-scores/student/${studentId}`),
  create: (data: Partial<ExamScore>) => api.post<ExamScore>('/exam-scores', data),
  update: (id: string, data: Partial<ExamScore>) => api.put<ExamScore>(`/exam-scores/${id}`, data)
};

export const retakeRecordApi = {
  getAll: () => api.get<RetakeRecord[]>('/retake-records'),
  getByStudentId: (studentId: string) => api.get<RetakeRecord[]>(`/retake-records/student/${studentId}`),
  create: (data: Partial<RetakeRecord>) => api.post<RetakeRecord>('/retake-records', data),
  update: (id: string, data: Partial<RetakeRecord>) => api.put<RetakeRecord>(`/retake-records/${id}`, data)
};

export const certificateApi = {
  getAll: () => api.get<Certificate[]>('/certificates'),
  getById: (id: string) => api.get<Certificate>(`/certificates/${id}`),
  getByStudentId: (studentId: string) => api.get<Certificate>(`/certificates/student/${studentId}`),
  create: (data: Partial<Certificate>) => api.post<Certificate>('/certificates', data),
  update: (id: string, data: Partial<Certificate>) => api.put<Certificate>(`/certificates/${id}`, data),
  revoke: (id: string, reason: string, operator: string) => 
    api.post<Certificate>(`/certificates/${id}/revoke`, { reason, operator }),
  recheck: (id: string, operator: string) => 
    api.post<Certificate>(`/certificates/${id}/recheck`, { operator })
};

export const historyApi = {
  getAll: (params?: { entityType?: string; entityId?: string }) => 
    api.get<StatusHistory[]>('/history', { params })
};

export const statisticsApi = {
  get: () => api.get<Statistics>('/statistics')
};

export const exportApi = {
  certificates: (params?: any) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/export/certificates?${query}`, '_blank');
  },
  history: (params?: any) => {
    const query = new URLSearchParams(params).toString();
    window.open(`/api/export/history?${query}`, '_blank');
  }
};

export default api;
