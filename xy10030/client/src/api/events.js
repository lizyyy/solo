import { get, post, put, del } from '../utils/api.js';
import { generateRequestId } from '../utils/requestId.js';

export function getEvents(params = {}) {
  return get('/events', params);
}

export function getEventById(id) {
  return get(`/events/${id}`);
}

export function createEvent(data) {
  return post('/events', data, { 'X-Request-Id': generateRequestId() });
}

export function updateEvent(id, data) {
  return put(`/events/${id}`, data, { 'X-Request-Id': generateRequestId() });
}

export function cancelEvent(id, version, reason = '') {
  return del(`/events/${id}`, { version, reason }, { 'X-Request-Id': generateRequestId() });
}

export function getEventRegistrations(id, params = {}) {
  return get(`/events/${id}/registrations`, params);
}

export function getEventHistory(id) {
  return get(`/events/${id}/history`);
}
