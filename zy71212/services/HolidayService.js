const moment = require('moment');

class HolidayService {
  constructor() {
    this.holidays = new Set();
    this.workdays = new Set();
    this.initializeDefaultHolidays();
  }

  initializeDefaultHolidays() {
    const currentYear = moment().year();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    
    years.forEach(year => {
      this.addHoliday(`${year}-01-01`, '元旦');
      
      const springFestival = this.calculateSpringFestival(year);
      springFestival.forEach(date => this.addHoliday(date, '春节'));
      
      this.addHoliday(`${year}-04-04`, '清明节');
      this.addHoliday(`${year}-04-05`, '清明节');
      this.addHoliday(`${year}-04-06`, '清明节');
      
      this.addHoliday(`${year}-05-01`, '劳动节');
      this.addHoliday(`${year}-05-02`, '劳动节');
      this.addHoliday(`${year}-05-03`, '劳动节');
      this.addHoliday(`${year}-05-04`, '劳动节');
      this.addHoliday(`${year}-05-05`, '劳动节');
      
      const dragonBoat = this.calculateDragonBoatFestival(year);
      dragonBoat.forEach(date => this.addHoliday(date, '端午节'));
      
      const midAutumn = this.calculateMidAutumnFestival(year);
      midAutumn.forEach(date => this.addHoliday(date, '中秋节'));
      
      this.addHoliday(`${year}-10-01`, '国庆节');
      this.addHoliday(`${year}-10-02`, '国庆节');
      this.addHoliday(`${year}-10-03`, '国庆节');
      this.addHoliday(`${year}-10-04`, '国庆节');
      this.addHoliday(`${year}-10-05`, '国庆节');
      this.addHoliday(`${year}-10-06`, '国庆节');
      this.addHoliday(`${year}-10-07`, '国庆节');
    });
  }

  calculateSpringFestival(year) {
    const lunarNewYear = this.getLunarNewYearDate(year);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(moment(lunarNewYear).subtract(1, 'days').add(i, 'days').format('YYYY-MM-DD'));
    }
    return dates;
  }

  calculateDragonBoatFestival(year) {
    const date = this.getLunarDate(year, 5, 5);
    return [
      moment(date).subtract(1, 'days').format('YYYY-MM-DD'),
      date,
      moment(date).add(1, 'days').format('YYYY-MM-DD')
    ];
  }

  calculateMidAutumnFestival(year) {
    const date = this.getLunarDate(year, 8, 15);
    return [
      moment(date).subtract(1, 'days').format('YYYY-MM-DD'),
      date,
      moment(date).add(1, 'days').format('YYYY-MM-DD')
    ];
  }

  getLunarNewYearDate(year) {
    const lunarNewYearDates = {
      2023: '2023-01-22',
      2024: '2024-02-10',
      2025: '2025-01-29',
      2026: '2026-02-17',
      2027: '2027-02-06',
      2028: '2028-01-26',
      2029: '2029-02-13',
      2030: '2030-02-03'
    };
    return lunarNewYearDates[year] || `${year}-02-05`;
  }

  getLunarDate(year, month, day) {
    const lunarDates = {
      [`${year}-5-5`]: `${year}-06-10`,
      [`${year}-8-15`]: `${year}-09-17`
    };
    
    const key = `${year}-${month}-${day}`;
    if (lunarDates[key]) return lunarDates[key];
    
    const baseDate = moment(`${year}-${String(month).padStart(2, '0')}-01`);
    return baseDate.add(day - 1 + (month * 10), 'days').format('YYYY-MM-DD');
  }

  addHoliday(date, name = '') {
    const dateStr = moment(date).format('YYYY-MM-DD');
    this.holidays.add(dateStr);
    return true;
  }

  addWorkday(date) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    this.workdays.add(dateStr);
    return true;
  }

  removeHoliday(date) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    this.holidays.delete(dateStr);
    return true;
  }

  isHoliday(date) {
    const dateStr = moment(date).format('YYYY-MM-DD');
    
    if (this.workdays.has(dateStr)) {
      return false;
    }
    
    if (this.holidays.has(dateStr)) {
      return true;
    }
    
    const dayOfWeek = moment(date).day();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  isWorkday(date) {
    return !this.isHoliday(date);
  }

  addWorkdays(startDate, days) {
    let current = moment(startDate);
    let added = 0;
    
    while (added < days) {
      current = current.add(1, 'days');
      if (this.isWorkday(current)) {
        added++;
      }
    }
    
    return current.format('YYYY-MM-DD');
  }

  addCalendarDays(startDate, days) {
    return moment(startDate).add(days, 'days').format('YYYY-MM-DD');
  }

  calculateGraceEndDate(dueDate, graceDays, extendForHolidays = true) {
    const baseEndDate = this.addCalendarDays(dueDate, graceDays);
    
    if (!extendForHolidays) {
      return baseEndDate;
    }
    
    if (this.isHoliday(baseEndDate)) {
      let nextWorkday = moment(baseEndDate);
      while (this.isHoliday(nextWorkday)) {
        nextWorkday = nextWorkday.add(1, 'days');
      }
      return nextWorkday.format('YYYY-MM-DD');
    }
    
    return baseEndDate;
  }

  getHolidaysBetween(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    const holidays = [];
    
    let current = start.clone();
    while (current.isSameOrBefore(end, 'day')) {
      if (this.isHoliday(current)) {
        holidays.push(current.format('YYYY-MM-DD'));
      }
      current = current.add(1, 'days');
    }
    
    return holidays;
  }

  getWorkdaysBetween(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    let workdays = 0;
    
    let current = start.clone();
    while (current.isSameOrBefore(end, 'day')) {
      if (this.isWorkday(current)) {
        workdays++;
      }
      current = current.add(1, 'days');
    }
    
    return workdays;
  }

  getCalendarDaysBetween(startDate, endDate) {
    return moment(endDate).diff(moment(startDate), 'days') + 1;
  }

  getAllHolidays() {
    return Array.from(this.holidays).sort();
  }

  getAllWorkdays() {
    return Array.from(this.workdays).sort();
  }

  clearCustomHolidays() {
    this.holidays.clear();
    this.workdays.clear();
    this.initializeDefaultHolidays();
  }

  exportHolidays() {
    return {
      holidays: this.getAllHolidays(),
      workdays: this.getAllWorkdays()
    };
  }

  importHolidays(data) {
    if (data.holidays) {
      data.holidays.forEach(date => this.addHoliday(date));
    }
    if (data.workdays) {
      data.workdays.forEach(date => this.addWorkday(date));
    }
    return true;
  }
}

module.exports = HolidayService;
