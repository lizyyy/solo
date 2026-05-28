import dayjs from 'dayjs';
import type { ReminderLog, ReminderType } from '@/types';

export class IdempotencyService {
  private readonly DEFAULT_COOLING_PERIOD_DAYS = 7;
  
  generateIdempotencyKey(
    bondCode: string,
    customerId: string,
    reminderType: ReminderType,
    date: string = dayjs().format('YYYY-MM-DD')
  ): string {
    return `${bondCode}_${customerId}_${reminderType}_${date}`;
  }
  
  checkIdempotency(
    idempotencyKey: string,
    existingLogs: ReminderLog[],
    coolingPeriodDays: number = this.DEFAULT_COOLING_PERIOD_DAYS
  ): {
    isDuplicate: boolean;
    existingLog: ReminderLog | null;
    coolingPeriodEnd: string | null;
    daysRemaining: number | null;
  } {
    const existingLog = existingLogs.find(log => log.idempotencyKey === idempotencyKey);
    
    if (existingLog) {
      const remindedDate = dayjs(existingLog.remindedAt);
      const now = dayjs();
      const diffDays = now.diff(remindedDate, 'day');
      
      if (diffDays < coolingPeriodDays) {
        const coolingEnd = remindedDate.add(coolingPeriodDays, 'day');
        const daysRemaining = coolingEnd.diff(now, 'day') + 1;
        
        return {
          isDuplicate: true,
          existingLog,
          coolingPeriodEnd: coolingEnd.format('YYYY-MM-DD'),
          daysRemaining,
        };
      }
    }
    
    return {
      isDuplicate: false,
      existingLog: null,
      coolingPeriodEnd: null,
      daysRemaining: null,
    };
  }
  
  dedupeReminders(
    pendingReminders: { bondCode: string; customerId: string; customerName: string; reminderType: ReminderType }[],
    existingLogs: ReminderLog[],
    date: string = dayjs().format('YYYY-MM-DD'),
    coolingPeriodDays: number = this.DEFAULT_COOLING_PERIOD_DAYS
  ): {
    toSend: { bondCode: string; customerId: string; customerName: string; reminderType: ReminderType }[];
    duplicates: {
      item: { bondCode: string; customerId: string; customerName: string; reminderType: ReminderType };
      existingLog: ReminderLog;
      coolingPeriodEnd: string;
      daysRemaining: number;
    }[];
  } {
    const toSend: typeof pendingReminders = [];
    const duplicates: {
      item: { bondCode: string; customerId: string; customerName: string; reminderType: ReminderType };
      existingLog: ReminderLog;
      coolingPeriodEnd: string;
      daysRemaining: number;
    }[] = [];
    
    const processedKeys = new Set<string>();
    
    for (const item of pendingReminders) {
      const key = this.generateIdempotencyKey(item.bondCode, item.customerId, item.reminderType, date);
      
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);
      
      const result = this.checkIdempotency(key, existingLogs, coolingPeriodDays);
      
      if (result.isDuplicate && result.existingLog && result.coolingPeriodEnd && result.daysRemaining !== null) {
        duplicates.push({
          item,
          existingLog: result.existingLog,
          coolingPeriodEnd: result.coolingPeriodEnd,
          daysRemaining: result.daysRemaining,
        });
      } else {
        toSend.push(item);
      }
    }
    
    return { toSend, duplicates };
  }
  
  getDedupeStatistics(
    toSendCount: number,
    duplicatesCount: number
  ): {
    total: number;
    toSendCount: number;
    duplicatesCount: number;
    dedupeRate: number;
    description: string;
  } {
    const total = toSendCount + duplicatesCount;
    const dedupeRate = total > 0 ? (duplicatesCount / total) * 100 : 0;
    
    return {
      total,
      toSendCount,
      duplicatesCount,
      dedupeRate,
      description: `共${total}条待发送，去重${duplicatesCount}条，实际发送${toSendCount}条，去重率${dedupeRate.toFixed(1)}%`,
    };
  }
}

export const idempotencyService = new IdempotencyService();
