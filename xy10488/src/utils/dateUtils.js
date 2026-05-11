const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

function daysInPeriod(startDate, endDate) {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  return end.diff(start, 'day') + 1;
}

function isDateInRange(date, start, end) {
  const d = dayjs(date);
  return d.isSameOrAfter(start) && d.isSameOrBefore(end);
}

function getOverlapDays(period1Start, period1End, period2Start, period2End) {
  const start = dayjs(period1Start).isAfter(period2Start) ? period1Start : period2Start;
  const end = dayjs(period1End).isBefore(period2End) ? period1End : period2End;
  
  if (dayjs(start).isAfter(end)) return 0;
  return daysInPeriod(start, end);
}

function getMonthPeriod(year, month) {
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const end = start.endOf('month');
  return {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD')
  };
}

module.exports = {
  dayjs,
  daysInPeriod,
  isDateInRange,
  getOverlapDays,
  getMonthPeriod
};
