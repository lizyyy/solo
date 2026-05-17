function now() {
  return new Date().toISOString();
}

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr) {
  return dateStr ? dateStr.split('T')[0] : '';
}

module.exports = {
  now,
  addDays,
  isExpired,
  formatDate
};