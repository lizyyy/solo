const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function parseTime(timeStr) {
  const match = timeStr.match(TIME_REGEX);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM`);
  }
  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
    totalMinutes: parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
  };
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const { totalMinutes } = parseTime(timeStr);
  return totalMinutes;
}

function minutesToTime(minutes) {
  return formatTime(minutes);
}

function addMinutes(timeStr, minutes) {
  const total = timeToMinutes(timeStr) + minutes;
  return formatTime(total);
}

function subtractMinutes(timeStr, minutes) {
  const total = timeToMinutes(timeStr) - minutes;
  return formatTime(Math.max(0, total));
}

function isTimeBetween(timeStr, startStr, endStr) {
  const time = timeToMinutes(timeStr);
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);
  return time >= start && time <= end;
}

function timeDiffMinutes(timeStr1, timeStr2) {
  return timeToMinutes(timeStr1) - timeToMinutes(timeStr2);
}

function getDayOfWeek(date = new Date()) {
  return date.getDay() || 7;
}

function timeOverlaps(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return !(e1 <= s2 || e2 <= s1);
}

function getOverlapMinutes(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  
  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);
  
  if (overlapEnd <= overlapStart) return 0;
  return overlapEnd - overlapStart;
}

module.exports = {
  parseTime,
  formatTime,
  timeToMinutes,
  minutesToTime,
  addMinutes,
  subtractMinutes,
  isTimeBetween,
  timeDiffMinutes,
  getDayOfWeek,
  timeOverlaps,
  getOverlapMinutes
};
