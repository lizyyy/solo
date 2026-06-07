import type { RampRecord, SamplingRecord, FinalRecord, ImportResult, ModificationLog } from '../../shared/types';
import { dataStore } from '../data/store';
import { conflictService } from './conflictService';

const generateId = () => Math.random().toString(36).substring(2, 11);
const now = () => new Date().toISOString();

export class ImportService {
  importRampRecords(records: Omit<RampRecord, 'id' | 'importTime' | 'importedBy'>[], operator: string): ImportResult {
    let success = 0;
    let duplicates = 0;
    let anomalies = 0;
    const resultRecords: FinalRecord[] = [];

    records.forEach((record, index) => {
      const existing = dataStore.findFinalRecordByLocation(record.location);
      
      if (existing && existing.source === 'ramp') {
        duplicates++;
        return;
      }

      const rampRecord: RampRecord = {
        ...record,
        id: generateId(),
        importTime: now(),
        importedBy: operator,
      };

      const hasOpinionOriginal = !!record.residentOpinionOriginal;
      const status: FinalRecord['status'] = hasOpinionOriginal ? 'normal' : 'pending_review';

      if (!hasOpinionOriginal) {
        anomalies++;
      }

      const modificationHistory: ModificationLog[] = [
        {
          id: generateId(),
          timestamp: now(),
          operator,
          action: '导入无障碍坡道记录',
          afterChanges: { ...rampRecord },
        },
      ];

      if (!hasOpinionOriginal) {
        modificationHistory.push({
          id: generateId(),
          timestamp: now(),
          operator: '系统',
          action: '检测到居民意见缺少原文，标记待复核',
        });
      }

      if (existing) {
        const finalRecord: FinalRecord = {
          id: existing.id,
          source: 'merged',
          location: record.location,
          status: 'normal',
          rampData: rampRecord,
          samplingData: existing.samplingData,
          residentOpinionOriginal: record.residentOpinionOriginal,
          residentOpinionSummary: record.residentOpinionSummary,
          hasOpinionOriginal,
          lastModified: now(),
          modifiedBy: operator,
          modificationHistory: [
            ...existing.modificationHistory,
            ...modificationHistory,
          ],
        };

        const samplingRecords: SamplingRecord[] = existing.samplingData ? [existing.samplingData] : [];
        conflictService.detectAndCreateConflicts([rampRecord], samplingRecords);

        dataStore.updateFinalRecord(existing.id, finalRecord);
        resultRecords.push(finalRecord);
      } else {
        const finalRecord: FinalRecord = {
          id: generateId(),
          source: 'ramp',
          location: record.location,
          status,
          rampData: rampRecord,
          residentOpinionOriginal: record.residentOpinionOriginal,
          residentOpinionSummary: record.residentOpinionSummary,
          hasOpinionOriginal,
          lastModified: now(),
          modifiedBy: operator,
          modificationHistory,
        };

        dataStore.addFinalRecord(finalRecord);
        resultRecords.push(finalRecord);
      }

      success++;
    });

    return { success, duplicates, anomalies, records: resultRecords };
  }

  importSamplingRecords(records: Omit<SamplingRecord, 'id' | 'importTime' | 'importedBy'>[], operator: string): ImportResult {
    let success = 0;
    let duplicates = 0;
    let anomalies = 0;
    const resultRecords: FinalRecord[] = [];

    records.forEach((record) => {
      const existing = dataStore.findFinalRecordByLocation(record.location);

      if (existing && existing.source === 'sampling') {
        duplicates++;
        return;
      }

      const samplingRecord: SamplingRecord = {
        ...record,
        id: generateId(),
        importTime: now(),
        importedBy: operator,
      };

      const hasOpinionOriginal = !!record.residentOpinionOriginal;
      const status: FinalRecord['status'] = hasOpinionOriginal ? 'normal' : 'pending_review';

      if (!hasOpinionOriginal) {
        anomalies++;
      }

      const modificationHistory: ModificationLog[] = [
        {
          id: generateId(),
          timestamp: now(),
          operator,
          action: '补录夜间采样点数据',
          afterChanges: { ...samplingRecord },
        },
      ];

      if (!hasOpinionOriginal) {
        modificationHistory.push({
          id: generateId(),
          timestamp: now(),
          operator: '系统',
          action: '检测到居民意见缺少原文，标记待复核',
        });
      }

      if (existing) {
        const rampRecords: RampRecord[] = existing.rampData ? [existing.rampData] : [];
        const newConflicts = conflictService.detectAndCreateConflicts(rampRecords, [samplingRecord]);
        const hasConflict = newConflicts.length > 0;

        const finalRecord: FinalRecord = {
          id: existing.id,
          source: 'merged',
          location: record.location,
          status: hasConflict ? 'conflict' : (hasOpinionOriginal ? 'normal' : 'pending_review'),
          rampData: existing.rampData,
          samplingData: samplingRecord,
          residentOpinionOriginal: existing.residentOpinionOriginal || record.residentOpinionOriginal,
          residentOpinionSummary: existing.residentOpinionSummary || record.residentOpinionSummary,
          hasOpinionOriginal: existing.hasOpinionOriginal || hasOpinionOriginal,
          lastModified: now(),
          modifiedBy: operator,
          modificationHistory: [
            ...existing.modificationHistory,
            ...modificationHistory,
            ...(hasConflict ? [{
              id: generateId(),
              timestamp: now(),
              operator: '系统',
              action: '检测到数据冲突，待复核',
            }] : []),
          ],
        };

        dataStore.updateFinalRecord(existing.id, finalRecord);
        resultRecords.push(finalRecord);
      } else {
        const finalRecord: FinalRecord = {
          id: generateId(),
          source: 'sampling',
          location: record.location,
          status,
          samplingData: samplingRecord,
          residentOpinionOriginal: record.residentOpinionOriginal,
          residentOpinionSummary: record.residentOpinionSummary,
          hasOpinionOriginal,
          lastModified: now(),
          modifiedBy: operator,
          modificationHistory,
        };

        dataStore.addFinalRecord(finalRecord);
        resultRecords.push(finalRecord);
      }

      success++;
    });

    return { success, duplicates, anomalies, records: resultRecords };
  }
}

export const importService = new ImportService();
