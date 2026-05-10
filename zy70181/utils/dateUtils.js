function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getToday() {
  return formatDate(new Date());
}

function daysBetween(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getOverdueDays(dueDate) {
  const days = daysBetween(dueDate, getToday());
  return days > 0 ? days : 0;
}

function addDays(dateStr, days) {
  const date = parseDate(dateStr) || new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function startOfMonth(dateStr) {
  const date = parseDate(dateStr) || new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function endOfMonth(dateStr) {
  const date = parseDate(dateStr) || new Date();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return formatDate(lastDay);
}

module.exports = {
  parseDate,
  formatDate,
  getToday,
  daysBetween,
  getOverdueDays,
  addDays,
  startOfMonth,
  endOfMonth
};
