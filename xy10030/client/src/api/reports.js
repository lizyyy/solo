import api from '../utils/api.js';

export function getStatistics() {
  return api.get('/reports/statistics');
}

export function getEventsReport(format = 'json') {
  return api.get('/reports/events', { params: { format } });
}

export function getRegistrationsReport(eventId = null, format = 'json') {
  const params = { format };
  if (eventId) params.eventId = eventId;
  return api.get('/reports/registrations', { params });
}

export function getLogsReport(params = {}, format = 'json') {
  return api.get('/reports/logs', { params: { ...params, format } });
}

export function downloadCSV(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
