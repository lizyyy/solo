import { get, post } from '../utils/api.js';

export function getFailedTasks(params = {}) {
  return get('/tasks', params);
}

export function getFailedTaskById(id) {
  return get(`/tasks/${id}`);
}

export function retryTask(id) {
  return post(`/tasks/${id}/retry`);
}

export function retryAllTasks() {
  return post('/tasks/retry-all');
}
