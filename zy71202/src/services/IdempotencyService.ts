import dayjs from 'dayjs';
import type { ReminderLog, ReminderType } from '@/types';

export class IdempotencyService {
  private readonly DEFAULT_COOLING_PERIOD_DAYS = 7;
  
  generateIdempotencyKey(
    bondCode: string,
    customerId: string,
    reminderType: ReminderType
  ): string {
    return `${bondCode}_${customerId}_${reminderType}`;
  }
  
  checkIdempotency(
    bondCode: string,
    customerId: string,
    reminderType: ReminderType,
    existingLogs: ReminderLog[],
    coolingPeriodDays: number = this.DEFAULT_COOLING_PERIOD_DAYS
  ): {
    isDuplicate: boolean;
    existingLog: ReminderLog | null;
    coolingPeriodEnd: string | null;
    daysRemaining: number | null;
  } {
    const idempotencyKey = this.generateIdempotencyKey(bondCode, customerId, reminderType);
    
    const matchingLogs = existingLogs.filter(log => {
      const logKey = this.extractBaseKey(log.idempotencyKey);
      return logKey === idempotencyKey;
    });
    
    if (matchingLogs.length > 0) {
      const latestLog = matchingLogs.reduce((latest, log) => {
        return dayjs(log.remindedAt).isAfter(dayjs(latest.remindedAt)) ? log : latest;
      });
      
      const remindedDate = dayjs(latestLog.remindedAt);
      const now = dayjs();
      const diffDays = now.diff(remindedDate, 'day');
      
      if (diffDays < coolingPeriodDays) {
        const coolingEnd = remindedDate.add(coolingPeriodDays, 'day');
        const daysRemaining = coolingEnd.diff(now, 'day') + 1;
        
        return {
          isDuplicate: true,
          existingLog: latestLog,
          coolingPeriodEnd: coolingEnd.format('YYYY-MM-DD'),
          daysRemaining: Math.max(0, daysRemaining),
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
  
  private extractBaseKey(fullKey: string): string {
    const parts = fullKey.split('_');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join('_');
    }
    return fullKey;
  }
  
  dedupeReminders(
    pendingReminders: { bondCode: string; customerId: string; customerName: string; reminderType: ReminderType }[],
    existingLogs: ReminderLog[],
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
      const key = this.generateIdempotencyKey(item.bondCode, item.customerId, item.reminderType);
      
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);
      
      const result = this.checkIdempotency(
        item.bondCode,
        item.customerId,
        item.reminderType,
        existingLogs,
        coolingPeriodDays
      );
      
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
