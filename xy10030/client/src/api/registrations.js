import { get, post, put, del } from '../utils/api.js';
import { generateRequestId } from '../utils/requestId.js';

export function getRegistrations(params = {}) {
  return get('/registrations', params);
}

export function getRegistrationById(id) {
  return get(`/registrations/${id}`);
}

export function createRegistration(eventId, data) {
  const requestId = generateRequestId();
  return post(`/registrations/event/${eventId}`, data, { 'X-Request-Id': requestId });
}

export function updateRegistration(id, data) {
  return put(`/registrations/${id}`, data, { 'X-Request-Id': generateRequestId() });
}

export function cancelRegistration(id, version, reason = '') {
  return del(`/registrations/${id}`, { version, reason }, { 'X-Request-Id': generateRequestId() });
}

export function getRegistrationHistory(id) {
  return get(`/registrations/${id}/history`);
}
