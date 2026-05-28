import { db, saveDatabase, generateId } from '../db/init';
import type { BalanceRecord } from '../../shared/types';

export class BalanceRepository {
  static findAll(period?: string): BalanceRecord[] {
    let records = [...db.balanceRecord];
    if (period) {
      records = records.filter(b => b.period === period);
    }
    return records
      .map(b => {
        const subject = db.accountSubject.find(s => s.id === b.subjectId);
        return {
          ...b,
          subjectCode: subject?.code,
          subjectName: subject?.name,
        };
      })
      .sort((a, b) => (a.subjectCode || '').localeCompare(b.subjectCode || ''));
  }

  static findBySubjectAndPeriod(subjectId: string, period: string): BalanceRecord | null {
    const record = db.balanceRecord.find(b => b.subjectId === subjectId && b.period === period);
    if (!record) return null;
    const subject = db.accountSubject.find(s => s.id === subjectId);
    return {
      ...record,
      subjectCode: subject?.code,
      subjectName: subject?.name,
    };
  }

  static upsert(data: Omit<BalanceRecord, 'id' | 'subjectCode' | 'subjectName'>): BalanceRecord {
    const existingIndex = db.balanceRecord.findIndex(
      b => b.subjectId === data.subjectId && b.period === data.period
    );

    if (existingIndex !== -1) {
      db.balanceRecord[existingIndex] = {
        ...db.balanceRecord[existingIndex],
        ...data,
      };
      saveDatabase();
      return this.findBySubjectAndPeriod(data.subjectId, data.period)!;
    } else {
      const id = generateId('bal');
      const record: BalanceRecord = {
        ...data,
        id,
      };
      db.balanceRecord.push(record);
      saveDatabase();
      return this.findBySubjectAndPeriod(data.subjectId, data.period)!;
    }
  }

  static getAvailablePeriods(): string[] {
    const periods = new Set(db.balanceRecord.map(b => b.period));
    return Array.from(periods).sort((a, b) => b.localeCompare(a));
  }
}
