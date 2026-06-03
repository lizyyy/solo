import db from '../utils/database';
import { Holiday, HolidayType } from '../models';

class HolidayRepository {
  findAll(): Holiday[] {
    const stmt = db.prepare(`
      SELECT date, name, type FROM holidays ORDER BY date
    `);
    return stmt.all() as Holiday[];
  }

  findByDate(date: string): Holiday | undefined {
    const stmt = db.prepare(`
      SELECT date, name, type FROM holidays WHERE date = ?
    `);
    return stmt.get(date) as Holiday | undefined;
  }

  findByDateRange(startDate: string, endDate: string): Holiday[] {
    const stmt = db.prepare(`
      SELECT date, name, type FROM holidays 
      WHERE date >= ? AND date <= ? 
      ORDER BY date
    `);
    return stmt.all(startDate, endDate) as Holiday[];
  }

  create(date: string, name: string, type: HolidayType): Holiday {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO holidays (date, name, type) VALUES (?, ?, ?)
    `);
    stmt.run(date, name, type);
    return this.findByDate(date)!;
  }

  isHoliday(date: string): boolean {
    const holiday = this.findByDate(date);
    return !!holiday;
  }

  isWeekend(dateStr: string): boolean {
    const date = new Date(dateStr);
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  countHolidaysInRange(startDate: string, endDate: string): number {
    const holidays = this.findByDateRange(startDate, endDate);
    return holidays.length;
  }
}

export default new HolidayRepository();
