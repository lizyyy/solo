import api from '../utils/api.js';
import { generateRequestId } from '../utils/requestId.js';

export function getRegistrations(params = {}) {
  return api.get('/registrations', { params });
}

export function getRegistrationById(id) {
  return api.get(`/registrations/${id}`);
}

export function createRegistration(eventId, data) {
  const requestId = generateRequestId();
  return api.post(`/registrations/event/${eventId}`, data, {
    headers: { 'X-Request-Id': requestId }
  });
}

export function updateRegistration(id, data) {
  return api.put(`/registrations/${id}`, data, {
    headers: { 'X-Request-Id': generateRequestId() }
  });
}

export function cancelRegistration(id, version, reason = '') {
  return api.delete(`/registrations/${id}`, {
    data: { version, reason },
    headers: { 'X-Request-Id': generateRequestId() }
  });
}

export function getRegistrationHistory(id) {
  return api.get(`/registrations/${id}/history`);
}
