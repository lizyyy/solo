import type {
  Student, Teacher, Group, MeetingPoint,
  AttendanceRecord, AttendanceStatus,
  LeaveRequest, LeaveStatus,
  GroupChange, ApiError,
  DashboardData, AbsentAlert, ExportReport,
} from './types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw data as ApiError;
  }

  return data as T;
}

export const api = {
  getDashboard: () => request<DashboardData>('/dashboard'),

  getStudents: () => request<Student[]>('/students'),
  getStudent: (id: string) => request<Student>(`/students/${id}`),
  assignStudentToGroup: (studentId: string, groupId: string | null) =>
    request<Student>(`/students/${studentId}/group`, {
      method: 'PUT',
      body: JSON.stringify({ groupId }),
    }),
  importStudents: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}/students/import`, {
      method: 'POST',
      body: formData,
    }).then(res => res.json());
  },

  getTeachers: () => request<Teacher[]>('/teachers'),

  getGroups: () => request<Group[]>('/groups'),
  createGroup: (name: string, teacherId?: string) =>
    request<Group>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, teacherId }),
    }),

  getMeetingPoints: () => request<MeetingPoint[]>('/meeting-points'),
  createMeetingPoint: (data: { name: string; location?: string; description?: string; orderIndex?: number }) =>
    request<MeetingPoint>('/meeting-points', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recordAttendance: (data: {
    studentId: string;
    meetingPointId: string;
    status: AttendanceStatus;
    operatorId?: string;
    notes?: string;
  }) => request<AttendanceRecord>('/attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getAttendanceRecords: (meetingPointId?: string) =>
    request<AttendanceRecord[]>(`/attendance${meetingPointId ? `?meetingPointId=${meetingPointId}` : ''}`),

  requestLeave: (data: { studentId: string; meetingPointId: string; reason: string; requestedBy?: string }) =>
    request<LeaveRequest>('/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLeaves: (status?: LeaveStatus) =>
    request<LeaveRequest[]>(`/leaves${status ? `?status=${status}` : ''}`),
  approveLeave: (id: string, approved: boolean) =>
    request<LeaveRequest>(`/leaves/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approved }),
    }),

  changeGroup: (data: { studentId: string; newGroupId: string | null; reason: string; operatorId?: string }) =>
    request<GroupChange>('/group-changes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getGroupChanges: (studentId?: string) =>
    request<GroupChange[]>(`/group-changes${studentId ? `?studentId=${studentId}` : ''}`),

  getAbsentAlerts: () => request<AbsentAlert[]>('/alerts/absent'),

  getReport: () => request<ExportReport>('/export/report'),
  downloadCSV: () => {
    window.location.href = `${API_BASE}/export/csv`;
  },
  downloadGroupChangesCSV: () => {
    window.location.href = `${API_BASE}/export/group-changes-csv`;
  },
};
