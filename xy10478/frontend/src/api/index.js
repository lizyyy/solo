const BASE_URL = '/api';

const request = async (url, options = {}) => {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }
  
  return data;
};

export const api = {
  getCourses: () => request('/courses'),
  createCourse: (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  
  getAssignments: (courseId) => {
    const url = courseId ? `/assignments?courseId=${courseId}` : '/assignments';
    return request(url);
  },
  createAssignment: (data) => request('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  
  getStudents: (courseId) => {
    const url = courseId ? `/students?courseId=${courseId}` : '/students';
    return request(url);
  },
  createStudent: (data) => request('/students', { method: 'POST', body: JSON.stringify(data) }),
  
  getAssistants: () => request('/assistants'),
  createAssistant: (data) => request('/assistants', { method: 'POST', body: JSON.stringify(data) }),
  
  getSubmissions: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const url = params ? `/submissions?${params}` : '/submissions';
    return request(url);
  },
  createSubmission: (data) => request('/submissions', { method: 'POST', body: JSON.stringify(data) }),
  getSubmissionDetail: (id) => request(`/submissions/${id}`),
  assignSubmission: (id) => request(`/submissions/${id}/assign`, { method: 'POST' }),
  autoAssignAll: () => request('/submissions/auto-assign', { method: 'POST' }),
  resubmit: (id, content) => request(`/submissions/${id}/resubmit`, { 
    method: 'POST', 
    body: JSON.stringify({ content }) 
  }),
  
  submitGrading: (data) => request('/grading', { method: 'POST', body: JSON.stringify(data) }),
  
  getAssistantEfficiency: () => request('/reports/assistant-efficiency'),
  getScoreDistribution: (assignmentId) => request(`/reports/score-distribution/${assignmentId}`),
  
  getTeacherView: (courseId) => request(`/teacher-view/${courseId}`),
  
  getOverdue: () => request('/alerts/overdue'),
  getStatistics: () => request('/statistics')
};
