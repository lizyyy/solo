import { get } from '../utils/api.js';

export function getLogs(params = {}) {
  return get('/logs', params);
}

export function getLogById(id) {
  return get(`/logs/${id}`);
}
