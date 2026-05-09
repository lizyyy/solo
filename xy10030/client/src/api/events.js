import api from '../utils/api.js';
import { generateRequestId } from '../utils/requestId.js';

export function getEvents(params = {}) {
  return api.get('/events', { params });
}

export function getEventById(id) {
  return api.get(`/events/${id}`);
}

export function createEvent(data) {
  return api.post('/events', data, {
    headers: { 'X-Request-Id': generateRequestId() }
  });
}

export function updateEvent(id, data) {
  return api.put(`/events/${id}`, data, {
    headers: { 'X-Request-Id': generateRequestId() }
  });
}

export function cancelEvent(id, version, reason = '') {
  return api.delete(`/events/${id}`, {
    data: { version, reason },
    headers: { 'X-Request-Id': generateRequestId() }
  });
}

export function getEventRegistrations(id, params = {}) {
  return api.get(`/events/${id}/registrations`, { params });
}

export function getEventHistory(id) {
  return api.get(`/events/${id}/history`);
}
