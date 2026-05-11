import request from '@/utils/request';

export const dashboardApi = {
  getSummary: () => request.get('/reports/dashboard')
};

export const boothApi = {
  getAll: (params) => request.get('/booths', { params }),
  getById: (id) => request.get(`/booths/${id}`),
  create: (data) => request.post('/booths', data),
  update: (id, data) => request.put(`/booths/${id}`, data),
  delete: (id) => request.delete(`/booths/${id}`),
  checkAvailability: (data) => request.post('/booths/check-availability', data)
};

export const merchantApi = {
  getAll: (params) => request.get('/merchants', { params }),
  getById: (id) => request.get(`/merchants/${id}`),
  create: (data) => request.post('/merchants', data),
  update: (id, data) => request.put(`/merchants/${id}`, data),
  delete: (id) => request.delete(`/merchants/${id}`)
};

export const scheduleApi = {
  getAll: (params) => request.get('/schedules', { params }),
  getById: (id) => request.get(`/schedules/${id}`),
  create: (data) => request.post('/schedules', data),
  update: (id, data) => request.put(`/schedules/${id}`, data),
  delete: (id) => request.delete(`/schedules/${id}`)
};

export const applicationApi = {
  getAll: (params) => request.get('/applications', { params }),
  getById: (id) => request.get(`/applications/${id}`),
  create: (data) => request.post('/applications', data),
  update: (id, data) => request.put(`/applications/${id}`, data),
  approve: (id, data) => request.post(`/applications/${id}/approve`, data),
  reject: (id, data) => request.post(`/applications/${id}/reject`, data),
  confirmAdmission: (id) => request.post(`/applications/${id}/admission`),
  cancel: (id) => request.post(`/applications/${id}/cancel`)
};

export const depositApi = {
  getAll: (params) => request.get('/deposits', { params }),
  getById: (id) => request.get(`/deposits/${id}`),
  getSummary: () => request.get('/deposits/summary'),
  confirmPayment: (id, data) => request.post(`/deposits/${id}/confirm`, data)
};

export const electricityApi = {
  getAll: (params) => request.get('/electricity', { params }),
  getRisky: () => request.get('/electricity/risky'),
  getById: (id) => request.get(`/electricity/${id}`),
  approve: (id, data) => request.post(`/electricity/${id}/approve`, data),
  reject: (id, data) => request.post(`/electricity/${id}/reject`, data)
};

export const acceptanceApi = {
  getAll: (params) => request.get('/acceptance', { params }),
  getById: (id) => request.get(`/acceptance/${id}`),
  createAdmission: (data) => request.post('/acceptance/admission', data),
  createWithdrawal: (data) => request.post('/acceptance/withdrawal', data),
  refundDeposit: (data) => request.post('/acceptance/refund', data)
};

export const reportApi = {
  getBoothCalendar: (params) => request.get('/reports/booth-calendar', { params }),
  getIncomeReport: (params) => request.get('/reports/income', { params }),
  getDeductionReport: (params) => request.get('/reports/deduction-details', { params }),
  getOccupancyReport: (params) => request.get('/reports/occupancy-rate', { params }),
  getElectricityRisk: () => request.get('/reports/electricity-risk'),
  getDepositFlow: (params) => request.get('/reports/deposit-flow', { params })
};