const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

function parseAppleHealthDate(dateStr, timezoneStr = null) {
  if (!dateStr) return null;
  
  let parsed = dayjs(dateStr);
  
  if (!parsed.isValid()) {
    const formats = [
      'YYYY-MM-DD HH:mm:ss Z',
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DDTHH:mm:ssZ',
      'YYYY-MM-DDTHH:mm:ss',
    ];
    
    for (const format of formats) {
      parsed = dayjs(dateStr, format);
      if (parsed.isValid()) break;
    }
  }
  
  if (!parsed.isValid()) {
    console.warn(`Invalid date format: ${dateStr}`);
    return null;
  }
  
  return parsed;
}

function toDateString(date) {
  const d = dayjs(date);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

function toDateTimeString(date) {
  const d = dayjs(date);
  return d.isValid() ? d.toISOString() : null;
}

function getDateRange(startDate, endDate) {
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  
  const dates = [];
  let current = start.clone();
  
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  
  return dates;
}

function getHourOfDay(date) {
  return dayjs(date).hour();
}

function getWeekday(date) {
  return dayjs(date).day();
}

function isSameDay(date1, date2) {
  return dayjs(date1).isSame(dayjs(date2), 'day');
}

function formatDuration(minutes) {
  if (!minutes || minutes < 0) return '0h 0m';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) {
    return `${mins}m`;
  }
  
  return `${hours}h ${mins}m`;
}

function formatDistance(km) {
  if (!km || km < 0) return '0 km';
  
  if (km >= 1) {
    return `${km.toFixed(1)} km`;
  }
  
  const meters = Math.round(km * 1000);
  return `${meters} m`;
}

module.exports = {
  parseAppleHealthDate,
  toDateString,
  toDateTimeString,
  getDateRange,
  getHourOfDay,
  getWeekday,
  isSameDay,
  formatDuration,
  formatDistance,
};
