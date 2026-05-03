export class DateUtils {
  static parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`无效的日期格式: ${dateStr}`);
    }
    return date;
  }

  static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static isValidDate(dateStr: string): boolean {
    try {
      const date = this.parseDate(dateStr);
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  }

  static getDaysBetween(startDate: string, endDate: string): number {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  static generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    
    const current = new Date(start);
    while (current <= end) {
      dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  static addDays(dateStr: string, days: number): string {
    const date = this.parseDate(dateStr);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }

  static isDateRangeContinuous(dates: string[]): { isContinuous: boolean; gaps: string[] } {
    if (dates.length <= 1) {
      return { isContinuous: true, gaps: [] };
    }

    const sortedDates = [...dates].sort();
    const gaps: string[] = [];

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = this.parseDate(sortedDates[i - 1]);
      const currentDate = this.parseDate(sortedDates[i]);
      
      const expectedNextDate = new Date(prevDate);
      expectedNextDate.setDate(expectedNextDate.getDate() + 1);
      
      while (expectedNextDate < currentDate) {
        gaps.push(this.formatDate(expectedNextDate));
        expectedNextDate.setDate(expectedNextDate.getDate() + 1);
      }
    }

    return { isContinuous: gaps.length === 0, gaps };
  }

  static getDateFromDateTime(dateTimeStr: string): string {
    const date = this.parseDate(dateTimeStr);
    return this.formatDate(date);
  }

  static isSameDay(date1: string, date2: string): boolean {
    const d1 = this.parseDate(date1);
    const d2 = this.parseDate(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  static compareDates(date1: string, date2: string): number {
    const d1 = this.parseDate(date1);
    const d2 = this.parseDate(date2);
    return d1.getTime() - d2.getTime();
  }

  static getMinDate(dates: string[]): string | null {
    if (dates.length === 0) return null;
    const sorted = [...dates].sort((a, b) => this.compareDates(a, b));
    return sorted[0];
  }

  static getMaxDate(dates: string[]): string | null {
    if (dates.length === 0) return null;
    const sorted = [...dates].sort((a, b) => this.compareDates(a, b));
    return sorted[sorted.length - 1];
  }
}
