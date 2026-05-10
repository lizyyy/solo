import type { Course, Student, ScheduleItem, TransferRequest, ClassSummary, ExportData, ApiResponse } from './types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: '网络请求失败，请检查网络连接或稍后重试',
    };
  }
}

export const api = {
  getCourses: () => request<Course[]>('/courses'),
  getCourse: (id: string) => request<Course>(`/courses/${id}`),
  getStudents: () => request<Student[]>('/students'),
  getStudent: (id: string) => request<Student>(`/students/${id}`),
  getStudentSchedule: (studentId: string) => request<ScheduleItem[]>(`/students/${studentId}/schedule`),
  enroll: (studentId: string, courseId: string) => request(`/enrollments/enroll`, {
    method: 'POST',
    body: JSON.stringify({ studentId, courseId }),
  }),
  withdraw: (enrollmentId: string) => request(`/enrollments/withdraw/${enrollmentId}`, {
    method: 'POST',
  }),
  getTransferRequests: () => request<TransferRequest[]>('/transfers'),
  requestTransfer: (studentId: string, fromCourseId: string, toCourseId: string) => request('/transfers/request', {
    method: 'POST',
    body: JSON.stringify({ studentId, fromCourseId, toCourseId }),
  }),
  approveTransfer: (requestId: string) => request(`/transfers/approve/${requestId}`, {
    method: 'POST',
  }),
  rejectTransfer: (requestId: string, reason: string) => request(`/transfers/reject/${requestId}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  getClassSummary: () => request<ClassSummary[]>('/classes'),
  getExportData: () => request<ExportData[]>('/export'),
};
