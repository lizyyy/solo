function formatDate(date) {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function now() {
  return new Date();
}

module.exports = {
  formatDate,
  addDays,
  addHours,
  daysBetween,
  now
};
