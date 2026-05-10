const dayjs = require('dayjs');

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const d = dayjs(dateStr);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

function normalizeDateTime(dtStr) {
  if (!dtStr) return null;
  const d = dayjs(dtStr);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : null;
}

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

function generateId(...parts) {
  return parts.map(p => String(p || '').trim().toLowerCase()).join('|');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD');
}

function formatDateTime(dtStr) {
  if (!dtStr) return '-';
  return dayjs(dtStr).format('YYYY-MM-DD HH:mm');
}

module.exports = {
  normalizeDate,
  normalizeDateTime,
  parseAmount,
  generateId,
  formatDate,
  formatDateTime
};
