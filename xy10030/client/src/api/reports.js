import { get } from '../utils/api.js';

export function getStatistics() {
  return get('/reports/statistics');
}

export function getEventsReport(format = 'json') {
  return get('/reports/events', { format });
}

export function getRegistrationsReport(eventId = null, format = 'json') {
  const params = { format };
  if (eventId) params.eventId = eventId;
  return get('/reports/registrations', params);
}

export function getLogsReport(params = {}, format = 'json') {
  return get('/reports/logs', { ...params, format });
}

export function downloadCSV(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
