import { dataStore } from '../store/data-store';
import { ScheduleRecord, ImportResult, MaterialSource, UserMessage } from '../types';
import { createWarningMessage, createInfoMessage } from '../utils/messages';

export interface ScheduleImportInput {
  sessionDate: Date;
  performerId: string;
  performerName: string;
  locationId: string;
  locationName: string;
  trackName: string;
  isConsumed: boolean;
  isLeave: boolean;
  consumedHours: number;
  source: MaterialSource;
}

export class ScheduleImportService {
  importSchedule(inputs: ScheduleImportInput[]): ImportResult<ScheduleRecord> {
    const batchId = dataStore.generateBatchId();
    const imported: ScheduleRecord[] = [];
    const reused: ScheduleRecord[] = [];
    const duplicates: ScheduleRecord[] = [];
    const errors: UserMessage[] = [];
    const warnings: UserMessage[] = [];

    for (const input of inputs) {
      const existingDuplicates = dataStore.findDuplicateScheduleRecords(input);

      if (existingDuplicates.length > 0) {
        duplicates.push(...existingDuplicates);
        warnings.push(
          createWarningMessage(
            `${input.performerName} 在 ${input.sessionDate.toLocaleDateString()} ${input.locationName} 的"${input.trackName}"排班已存在`,
            '如确需重复导入，请手动确认后再操作'
          )
        );
        continue;
      }

      const record: ScheduleRecord = {
        id: dataStore.generateId(),
        sessionDate: input.sessionDate,
        performerId: input.performerId,
        performerName: input.performerName,
        locationId: input.locationId,
        locationName: input.locationName,
        trackName: input.trackName.trim(),
        isConsumed: input.isConsumed,
        isLeave: input.isLeave,
        consumedHours: input.consumedHours,
        source: input.source,
        importBatchId: batchId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      dataStore.saveScheduleRecord(record);
      imported.push(record);
    }

    if (imported.length > 0) {
      warnings.push(
        createInfoMessage(`成功导入 ${imported.length} 条排班记录`)
      );
    }

    if (duplicates.length > 0) {
      warnings.push(
        createWarningMessage(
          `检测到 ${duplicates.length} 条重复排班记录已跳过`,
          '请核对导入材料，确认是否有误'
        )
      );
    }

    return {
      success: errors.length === 0,
      imported,
      reused,
      duplicates,
      errors,
      warnings,
      batchId,
    };
  }

  recalculateConsumedHours(batchId: string): { updated: ScheduleRecord[]; messages: string[] } {
    const records = dataStore.getScheduleRecordsByBatch(batchId);
    const updated: ScheduleRecord[] = [];
    const messages: string[] = [];

    for (const record of records) {
      const shouldBeConsumed = !record.isLeave && record.consumedHours > 0;

      if (record.isConsumed !== shouldBeConsumed) {
        const updatedRecord = {
          ...record,
          isConsumed: shouldBeConsumed,
          consumedHours: record.isLeave ? 0 : record.consumedHours,
          updatedAt: new Date(),
        };
        dataStore.saveScheduleRecord(updatedRecord);
        updated.push(updatedRecord);

        if (record.isLeave && record.isConsumed) {
          messages.push(
            `${record.performerName} 在 ${record.sessionDate.toLocaleDateString()} 的请假课时已更正为未消耗`
          );
        }
      }
    }

    return { updated, messages };
  }
}

export const scheduleImportService = new ScheduleImportService();
