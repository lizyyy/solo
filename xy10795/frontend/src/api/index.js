import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 10000
})

export const projectApi = {
    getProjects: () => api.get('/projects'),
    getProject: (id) => api.get(`/projects/${id}`),
    createProject: (data) => api.post('/projects', data),
    getMilestones: (projectId) => api.get(`/projects/${projectId}/milestones`),
    getRisks: (projectId) => api.get(`/projects/${projectId}/risks`),
    getWeeklyReports: (projectId) => api.get(`/projects/${projectId}/weekly-reports`)
}

export const milestoneApi = {
    create: (data) => api.post('/milestones', data),
    get: (id) => api.get(`/milestones/${id}`),
    getDelayReasons: (id) => api.get(`/milestones/${id}/delay-reasons`)
}

export const riskApi = {
    create: (data) => api.post('/risks', data),
    update: (id, data) => api.put(`/risks/${id}`, data)
}

export const weeklyReportApi = {
    create: (data) => api.post('/weekly-reports', data),
    get: (id) => api.get(`/weekly-reports/${id}`),
    update: (id, data) => api.put(`/weekly-reports/${id}`, data),
    addRisk: (data) => api.post('/report-risks', data),
    getSendRecords: (id) => api.get(`/weekly-reports/${id}/send-records`),
    send: (data) => api.post('/send-records', data)
}

export const delayReasonApi = {
    create: (data) => api.post('/delay-reasons', data),
    update: (id, data) => api.put(`/delay-reasons/${id}`, data)
}

export default api
