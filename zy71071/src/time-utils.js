const { DateTime, Settings, Zone } = require('luxon');
const { TIME_UNITS } = require('./constants');

Settings.defaultZone = 'UTC';

const COMMON_TIMEZONES = {
  'Asia/Shanghai': ['CST', 'China Standard Time', 'Beijing', 'Shanghai'],
  'Asia/Hong_Kong': ['HKT', 'Hong Kong'],
  'Asia/Tokyo': ['JST', 'Japan'],
  'America/New_York': ['EST', 'EDT', 'Eastern'],
  'America/Los_Angeles': ['PST', 'PDT', 'Pacific'],
  'Europe/London': ['GMT', 'BST', 'London'],
  'Europe/Paris': ['CET', 'CEST', 'Paris'],
  'UTC': ['UTC', 'GMT', 'Zulu']
};

function normalizeTimezone(tzString) {
  if (!tzString) return 'UTC';
  
  tzString = tzString.trim();
  
  try {
    const zone = new Zone(tzString);
    if (zone.isValid) return tzString;
  } catch (e) {}
  
  for (const [ianaName, aliases] of Object.entries(COMMON_TIMEZONES)) {
    if (aliases.some(alias => tzString.toLowerCase().includes(alias.toLowerCase()))) {
      return ianaName;
    }
  }
  
  return 'UTC';
}

function parseICalDate(dateString, timezone = 'UTC', isAllDay = false) {
  if (!dateString) return null;
  
  const normalizedTz = normalizeTimezone(timezone);
  
  if (dateString.endsWith('Z')) {
    const dt = DateTime.fromISO(dateString, { zone: 'UTC' });
    return dt.setZone(normalizedTz);
  }
  
  if (dateString.length === 8) {
    const dt = DateTime.fromFormat(dateString, 'yyyyMMdd', { zone: normalizedTz });
    return isAllDay ? dt.startOf('day') : dt;
  }
  
  if (dateString.length === 15 && dateString.includes('T')) {
    const dt = DateTime.fromFormat(dateString, "yyyyMMdd'T'HHmmss", { zone: normalizedTz });
    return dt;
  }
  
  const dt = DateTime.fromISO(dateString, { zone: normalizedTz });
  if (dt.isValid) return dt;
  
  return DateTime.fromISO(dateString, { zone: 'UTC' }).setZone(normalizedTz);
}

function convertToTimezone(dateTime, targetTimezone) {
  if (!dateTime || !DateTime.isDateTime(dateTime)) return null;
  const normalizedTz = normalizeTimezone(targetTimezone);
  return dateTime.setZone(normalizedTz);
}

function normalizeToUTC(dateTime) {
  if (!dateTime) return null;
  return DateTime.isDateTime(dateTime) ? dateTime.toUTC() : null;
}

function isAllDayEvent(startDate, endDate) {
  if (!startDate || !endDate) return false;
  
  const start = DateTime.isDateTime(startDate) ? startDate : DateTime.fromISO(startDate);
  const end = DateTime.isDateTime(endDate) ? endDate : DateTime.fromISO(endDate);
  
  const startMidnight = start.startOf('day');
  const endMidnight = end.startOf('day');
  const dayDiff = endMidnight.diff(startMidnight, 'days').days;
  
  const isStartExact = start.hour === 0 && start.minute === 0 && start.second === 0;
  const isEndExact = end.hour === 0 && end.minute === 0 && end.second === 0;
  const isOneDayDuration = dayDiff === 1 && isStartExact && isEndExact;
  const isMultiDayFullDays = dayDiff >= 1 && isStartExact && isEndExact;
  
  return isOneDayDuration || isMultiDayFullDays;
}

function isCrossDayEvent(startDate, endDate, timezone = 'UTC') {
  if (!startDate || !endDate) return false;
  
  const normalizedTz = normalizeTimezone(timezone);
  const start = convertToTimezone(DateTime.isDateTime(startDate) ? startDate : DateTime.fromISO(startDate), normalizedTz);
  const end = convertToTimezone(DateTime.isDateTime(endDate) ? endDate : DateTime.fromISO(endDate), normalizedTz);
  
  if (!start || !end || !start.isValid || !end.isValid) return false;
  
  const startDay = start.startOf('day');
  const endDay = end.startOf('day');
  
  return startDay < endDay;
}

function formatDateTime(dateTime, timezone = 'UTC', format = 'full') {
  if (!dateTime) return 'N/A';
  
  const dt = convertToTimezone(
    DateTime.isDateTime(dateTime) ? dateTime : DateTime.fromISO(dateTime),
    timezone
  );
  
  if (!dt || !dt.isValid) return 'Invalid Date';
  
  switch (format) {
    case 'short':
      return dt.toFormat('yyyy-MM-dd HH:mm');
    case 'date':
      return dt.toFormat('yyyy-MM-dd');
    case 'time':
      return dt.toFormat('HH:mm');
    case 'full':
    default:
      return dt.toFormat("yyyy-MM-dd HH:mm:ss (ZZZZ)");
  }
}

function getOverlapMinutes(start1, end1, start2, end2) {
  const s1 = DateTime.isDateTime(start1) ? start1.toMillis() : new Date(start1).getTime();
  const e1 = DateTime.isDateTime(end1) ? end1.toMillis() : new Date(end1).getTime();
  const s2 = DateTime.isDateTime(start2) ? start2.toMillis() : new Date(start2).getTime();
  const e2 = DateTime.isDateTime(end2) ? end2.toMillis() : new Date(end2).getTime();
  
  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);
  
  if (overlapStart >= overlapEnd) return 0;
  
  return Math.round((overlapEnd - overlapStart) / TIME_UNITS.MINUTE);
}

function isTimeInRange(time, rangeStart, rangeEnd) {
  const t = DateTime.isDateTime(time) ? time.toMillis() : new Date(time).getTime();
  const s = DateTime.isDateTime(rangeStart) ? rangeStart.toMillis() : new Date(rangeStart).getTime();
  const e = DateTime.isDateTime(rangeEnd) ? rangeEnd.toMillis() : new Date(rangeEnd).getTime();
  
  return t >= s && t <= e;
}

function generateTimeSlots(startDate, endDate, intervalMinutes = 30, timezone = 'UTC') {
  const slots = [];
  const normalizedTz = normalizeTimezone(timezone);
  
  let current = convertToTimezone(
    DateTime.isDateTime(startDate) ? startDate : DateTime.fromISO(startDate),
    normalizedTz
  );
  const end = convertToTimezone(
    DateTime.isDateTime(endDate) ? endDate : DateTime.fromISO(endDate),
    normalizedTz
  );
  
  while (current < end) {
    const slotEnd = current.plus({ minutes: intervalMinutes });
    slots.push({
      start: current,
      end: slotEnd > end ? end : slotEnd
    });
    current = slotEnd;
  }
  
  return slots;
}

module.exports = {
  normalizeTimezone,
  parseICalDate,
  convertToTimezone,
  normalizeToUTC,
  isAllDayEvent,
  isCrossDayEvent,
  formatDateTime,
  getOverlapMinutes,
  isTimeInRange,
  generateTimeSlots,
  DateTime
};
