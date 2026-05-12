import { v4 as uuidv4 } from 'uuid';
import { HistoryEntry, SurveyStatus, SurveyRecord } from '../types';

export class HistoryManager {
  static createEntry(
    action: string,
    toStatus: SurveyStatus,
    actor: 'system' | string = 'system',
    options: {
      fromStatus?: SurveyStatus;
      reason?: string;
      details?: Record<string, any>;
    } = {}
  ): HistoryEntry {
    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action,
      actor,
      fromStatus: options.fromStatus,
      toStatus,
      reason: options.reason,
      details: options.details
    };
  }

  static addToRecord(
    record: SurveyRecord,
    action: string,
    toStatus: SurveyStatus,
    actor: 'system' | string = 'system',
    options: {
      reason?: string;
      details?: Record<string, any>;
    } = {}
  ): SurveyRecord {
    const entry = this.createEntry(
      action,
      toStatus,
      actor,
      {
        fromStatus: record.status,
        reason: options.reason,
        details: options.details
      }
    );

    return {
      ...record,
      status: toStatus,
      history: [...record.history, entry]
    };
  }

  static getLastEntry(record: SurveyRecord): HistoryEntry | undefined {
    return record.history[record.history.length - 1];
  }

  static getHistoryByActor(
    record: SurveyRecord,
    actor: string
  ): HistoryEntry[] {
    return record.history.filter(h => h.actor === actor);
  }

  static getStatusChanges(record: SurveyRecord): { from: SurveyStatus | undefined; to: SurveyStatus; timestamp: string }[] {
    return record.history
      .filter(h => h.fromStatus !== undefined && h.fromStatus !== h.toStatus)
      .map(h => ({
        from: h.fromStatus,
        to: h.toStatus,
        timestamp: h.timestamp
      }));
  }

  static formatHistory(history: HistoryEntry[]): string[] {
    return history.map(entry => {
      const time = new Date(entry.timestamp).toLocaleString('zh-CN');
      const actor = entry.actor === 'system' ? '系统' : entry.actor;
      const from = entry.fromStatus ? `${entry.fromStatus} → ` : '';
      let line = `[${time}] ${actor} - ${entry.action}: ${from}${entry.toStatus}`;
      if (entry.reason) {
        line += ` (原因: ${entry.reason})`;
      }
      return line;
    });
  }
}
