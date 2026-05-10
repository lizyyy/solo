const { format, parseISO, isValid } = require('date-fns');

function formatDate(date) {
  if (typeof date === 'string') {
    const parsed = parseISO(date);
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd');
    }
    return date;
  }
  return format(date, 'yyyy-MM-dd');
}

function isSameDate(date1, date2) {
  return formatDate(date1) === formatDate(date2);
}

function today() {
  return format(new Date(), 'yyyy-MM-dd');
}

function validateDateString(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateStr);
}

function parseDiversionChanges(changesStr) {
  if (!changesStr) return [];

  const changes = [];
  const parts = changesStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^([A-Za-z0-9]+):([A-Za-z0-9]+)(->([A-Za-z0-9]+)|@skip)?$/);

    if (match) {
      const [, lineCode, originalStopCode, , newStopCode] = match;
      changes.push({
        lineCode,
        originalStopCode,
        newStopCode: newStopCode || null,
        isSkipped: !newStopCode && trimmed.endsWith('@skip')
      });
    }
  }

  return changes;
}

module.exports = {
  formatDate,
  isSameDate,
  today,
  validateDateString,
  parseDiversionChanges
};
