import HolidayRepository from '../repositories/HolidayRepository';
import { addDays, differenceInDays, parseISO, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

class HolidayService {
  calculateExpectedArrivalDate(tradeDate: string): string {
    const date = parseISO(tradeDate);
    let expected = addDays(date, 1);
    let attempts = 0;
    while (
      (HolidayRepository.isHoliday(format(expected, 'yyyy-MM-dd')) ||
       HolidayRepository.isWeekend(format(expected, 'yyyy-MM-dd'))) &&
      attempts < 10
    ) {
      expected = addDays(expected, 1);
      attempts++;
    }
    return format(expected, 'yyyy-MM-dd');
  }

  calculateAdjustedDate(baseDate: string, daysToAdd: number): string {
    const date = parseISO(baseDate);
    let result = addDays(date, daysToAdd);
    let attempts = 0;
    while (
      (HolidayRepository.isHoliday(format(result, 'yyyy-MM-dd')) ||
       HolidayRepository.isWeekend(format(result, 'yyyy-MM-dd'))) &&
      attempts < 10
    ) {
      result = addDays(result, 1);
      attempts++;
    }
    return format(result, 'yyyy-MM-dd');
  }

  isDateManualModified(expectedDate: string, actualDate: string): boolean {
    return expectedDate !== actualDate;
  }

  detectT1ToT2Modification(expectedDate: string, actualDate: string): boolean {
    if (expectedDate === actualDate) return false;
    
    const expected = parseISO(expectedDate);
    const actual = parseISO(actualDate);
    const diffDays = differenceInDays(actual, expected);
    
    return diffDays >= 1;
  }

  getHolidayExplanation(startDate: string, endDate: string): string {
    const holidays = HolidayRepository.findByDateRange(startDate, endDate);
    if (holidays.length === 0) {
      return '';
    }
    
    const explanations = holidays.map(h => {
      const date = parseISO(h.date);
      const dayOfWeek = format(date, 'EEEE', { locale: zhCN });
      return `${h.date}（${dayOfWeek}）${h.name}`;
    });
    
    return `节假日顺延：${explanations.join('、')}`;
  }

  getHolidays() {
    return HolidayRepository.findAll();
  }

  addHoliday(date: string, name: string, type: 'weekend' | 'public_holiday') {
    return HolidayRepository.create(date, name, type);
  }

  calculateWorkingDays(startDate: string, endDate: string): number {
    let workingDays = 0;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const diff = differenceInDays(end, start);
    
    for (let i = 0; i <= diff; i++) {
      const current = addDays(start, i);
      const currentStr = format(current, 'yyyy-MM-dd');
      if (!HolidayRepository.isHoliday(currentStr) && !HolidayRepository.isWeekend(currentStr)) {
        workingDays++;
      }
    }
    
    return workingDays;
  }
}

export default new HolidayService();
