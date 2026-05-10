import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data?.error || error.message);
    return Promise.reject(error);
  }
);

export const consultantsApi = {
  getAll: () => api.get('/consultants').then(res => res.data)
};

export const coursesApi = {
  getAll: () => api.get('/courses').then(res => res.data)
};

export const promotionsApi = {
  getAll: () => api.get('/promotions').then(res => res.data)
};

export const bookingsApi = {
  getAll: (params?: { consultant_id?: number; course_id?: number; status?: string }) =>
    api.get('/bookings', { params }).then(res => res.data),
  getDetail: (id: number) => api.get(`/bookings/${id}`).then(res => res.data),
  create: (data: any) => api.post('/bookings', data).then(res => res.data),
  checkIn: (id: number, notes?: string) =>
    api.put(`/bookings/${id}/checkin`, { notes }).then(res => res.data),
  markNoShow: (id: number, reason?: string) =>
    api.put(`/bookings/${id}/noshow`, { reason }).then(res => res.data),
  addFeedback: (id: number, satisfaction: number, feedbackText?: string) =>
    api.put(`/bookings/${id}/feedback`, { satisfaction, feedback_text: feedbackText }).then(res => res.data),
  addFollowUp: (id: number, data: { consultant_id: number; follow_up_type: string; content: string; next_follow_up_date?: string }) =>
    api.post(`/bookings/${id}/followup`, data).then(res => res.data),
  enroll: (id: number, data: { promotion_id?: number; amount?: number; notes?: string }) =>
    api.put(`/bookings/${id}/enroll`, data).then(res => res.data),
  markLost: (id: number, lostReason?: string) =>
    api.put(`/bookings/${id}/lost`, { lost_reason: lostReason }).then(res => res.data),
  reactivate: (id: number, data?: { new_booking_date?: string; new_consultant_id?: number; new_course_id?: number }) =>
    api.put(`/bookings/${id}/reactivate`, data || {}).then(res => res.data)
};

export const statisticsApi = {
  get: () => api.get('/statistics').then(res => res.data)
};

export const exportApi = {
  download: () => {
    window.open('/api/export', '_blank');
  }
};
