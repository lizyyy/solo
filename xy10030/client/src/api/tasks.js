import api from '../utils/api.js';

export function getFailedTasks(params = {}) {
  return api.get('/tasks', { params });
}

export function getFailedTaskById(id) {
  return api.get(`/tasks/${id}`);
}

export function retryTask(id) {
  return api.post(`/tasks/${id}/retry`);
}

export function retryAllTasks() {
  return api.post('/tasks/retry-all');
}
