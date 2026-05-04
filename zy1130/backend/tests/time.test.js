const {
  parseTime,
  formatTime,
  timeToMinutes,
  minutesToTime,
  isTimeInWindow,
  isTimeOverlap
} = require('../src/utils/time');

describe('Time Utils', () => {
  describe('parseTime', () => {
    test('should parse HH:MM format correctly', () => {
      expect(parseTime('08:30')).toEqual({ hours: 8, minutes: 30 });
      expect(parseTime('14:05')).toEqual({ hours: 14, minutes: 5 });
      expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    test('should handle single digit hours and minutes', () => {
      expect(parseTime('9:5')).toEqual({ hours: 9, minutes: 5 });
      expect(parseTime('0:0')).toEqual({ hours: 0, minutes: 0 });
    });

    test('should return null for invalid format', () => {
      expect(parseTime(null)).toBeNull();
      expect(parseTime(undefined)).toBeNull();
      expect(parseTime('')).toBeNull();
      expect(parseTime('invalid')).toBeNull();
      expect(parseTime('25:00')).toBeNull();
      expect(parseTime('12:60')).toBeNull();
    });
  });

  describe('formatTime', () => {
    test('should format hours and minutes to HH:MM', () => {
      expect(formatTime(8, 30)).toBe('08:30');
      expect(formatTime(14, 5)).toBe('14:05');
      expect(formatTime(0, 0)).toBe('00:00');
      expect(formatTime(23, 59)).toBe('23:59');
    });
  });

  describe('timeToMinutes', () => {
    test('should convert time string to minutes since midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('08:00')).toBe(480);
      expect(timeToMinutes('08:30')).toBe(510);
      expect(timeToMinutes('12:00')).toBe(720);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    test('should return null for invalid time', () => {
      expect(timeToMinutes(null)).toBeNull();
      expect(timeToMinutes('invalid')).toBeNull();
    });
  });

  describe('minutesToTime', () => {
    test('should convert minutes to time string', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(480)).toBe('08:00');
      expect(minutesToTime(510)).toBe('08:30');
      expect(minutesToTime(720)).toBe('12:00');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    test('should handle minutes exceeding one day', () => {
      expect(minutesToTime(1440)).toBe('24:00');
      expect(minutesToTime(1500)).toBe('25:00');
    });
  });

  describe('isTimeInWindow', () => {
    test('should check if time is within window', () => {
      expect(isTimeInWindow('09:00', '08:00', '10:00')).toBe(true);
      expect(isTimeInWindow('08:00', '08:00', '10:00')).toBe(true);
      expect(isTimeInWindow('10:00', '08:00', '10:00')).toBe(true);
      expect(isTimeInWindow('07:59', '08:00', '10:00')).toBe(false);
      expect(isTimeInWindow('10:01', '08:00', '10:00')).toBe(false);
    });

    test('should handle null inputs', () => {
      expect(isTimeInWindow(null, '08:00', '10:00')).toBe(false);
      expect(isTimeInWindow('09:00', null, '10:00')).toBe(false);
      expect(isTimeInWindow('09:00', '08:00', null)).toBe(false);
    });
  });

  describe('isTimeOverlap', () => {
    test('should check if time windows overlap', () => {
      expect(isTimeOverlap('08:00', '10:00', '09:00', '11:00')).toBe(true);
      expect(isTimeOverlap('08:00', '10:00', '08:00', '09:00')).toBe(true);
      expect(isTimeOverlap('08:00', '10:00', '09:00', '10:00')).toBe(true);
      expect(isTimeOverlap('08:00', '09:00', '09:00', '10:00')).toBe(true);
      expect(isTimeOverlap('08:00', '08:59', '09:00', '10:00')).toBe(false);
      expect(isTimeOverlap('10:00', '11:00', '08:00', '09:00')).toBe(false);
    });

    test('should handle null inputs', () => {
      expect(isTimeOverlap(null, '10:00', '09:00', '11:00')).toBe(false);
      expect(isTimeOverlap('08:00', null, '09:00', '11:00')).toBe(false);
    });
  });
});
