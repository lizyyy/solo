const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

class DateUtils {
  static format(date, format = 'YYYY-MM-DD HH:mm:ss') {
    return dayjs(date).format(format);
  }

  static toUtc(date) {
    return dayjs(date).utc().toDate();
  }

  static fromUtc(date) {
    return dayjs.utc(date).toDate();
  }

  static isBefore(date1, date2) {
    return dayjs(date1).isBefore(date2);
  }

  static isAfter(date1, date2) {
    return dayjs(date1).isAfter(date2);
  }

  static addDays(date, days) {
    return dayjs(date).add(days, 'day').toDate();
  }

  static addHours(date, hours) {
    return dayjs(date).add(hours, 'hour').toDate();
  }

  static diffInDays(date1, date2) {
    return dayjs(date1).diff(dayjs(date2), 'day');
  }

  static diffInHours(date1, date2) {
    return dayjs(date1).diff(dayjs(date2), 'hour');
  }

  static startOfDay(date) {
    return dayjs(date).startOf('day').toDate();
  }

  static endOfDay(date) {
    return dayjs(date).endOf('day').toDate();
  }

  static isBetween(date, start, end) {
    return dayjs(date).isBetween(start, end, null, '[]');
  }

  static formatRange(startDate, endDate) {
    const start = dayjs(startDate).format('YYYY-MM-DD');
    const end = dayjs(endDate).format('YYYY-MM-DD');
    return `${start} ~ ${end}`;
  }
}

module.exports = DateUtils;
