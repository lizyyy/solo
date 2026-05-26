function generateBatchNo() {
  const date = new Date();
  const prefix = 'BATCH';
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${random}`;
}

function generateRecordNo() {
  const date = new Date();
  const prefix = 'REC';
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}${timeStr}-${random}`;
}

function formatDateTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  generateBatchNo,
  generateRecordNo,
  formatDateTime
};
