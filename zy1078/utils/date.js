import moment from 'moment';

export function parseDate(dateStr) {
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'DD-MM-YYYY',
    'DD/MM/YYYY',
    'MM-DD-YYYY',
    'MM/DD/YYYY',
    'YYYY.MM.DD'
  ];
  
  for (const format of formats) {
    const m = moment(dateStr, format, true);
    if (m.isValid()) {
      return m;
    }
  }
  
  return null;
}

export function formatDate(date) {
  return moment(date).format('YYYY-MM-DD');
}

export function getWeekNumber(date) {
  const m = moment(date);
  return {
    year: m.isoWeekYear(),
    week: m.isoWeek()
  };
}

export function getMonthNumber(date) {
  const m = moment(date);
  return {
    year: m.year(),
    month: m.month() + 1
  };
}

export function getWeekRange(year, week) {
  const start = moment().isoWeekYear(year).isoWeek(week).startOf('isoWeek');
  const end = moment().isoWeekYear(year).isoWeek(week).endOf('isoWeek');
  return { start, end };
}

export function getMonthRange(year, month) {
  const start = moment({ year, month: month - 1 }).startOf('month');
  const end = moment({ year, month: month - 1 }).endOf('month');
  return { start, end };
}

export function daysBetween(date1, date2) {
  return moment(date1).diff(moment(date2), 'days');
}

export function isDateInRange(date, start, end) {
  const m = moment(date);
  return m.isSameOrAfter(start) && m.isSameOrBefore(end);
}

export function getDaysAgo(n, reference = moment()) {
  return moment(reference).subtract(n, 'days');
}

export function getWeeksAgo(n, reference = moment()) {
  return moment(reference).subtract(n, 'weeks');
}
