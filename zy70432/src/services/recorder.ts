import { SearchKeywordReport, PlaybackResult, PlaybackRecord, FailureType, FieldError } from '../types';
import { recordStore, auditStore } from '../store';
import { generateRecordHash, validateSearchKeywordReport } from '../utils/validation';

export class MockRecorderService {
  submitRecord(record: SearchKeywordReport, operator: string): {
    status: 'success' | 'failure' | 'reused' | 'conflict';
    recordId?: string;
    errors?: FieldError[];
    message: string;
  } {
    const errors = validateSearchKeywordReport(record);
    const recordHash = generateRecordHash(record);

    if (errors.length > 0) {
      auditStore.add({
        recordHash,
        recordId: '',
        action: 'submit',
        operator,
        details: `验证失败: ${errors.map(e => e.message).join(', ')}`,
        needsConfirmation: false,
        confirmed: false
      });

      return {
        status: 'failure',
        errors,
        message: '记录验证失败'
      };
    }

    const existingRecord = recordStore.getByHash(recordHash);
    
    if (existingRecord) {
      const isConflict = existingRecord.downloadUrl !== record.downloadUrl ||
                         existingRecord.submittedBy !== record.submittedBy;

      if (isConflict) {
        auditStore.add({
          recordHash,
          recordId: existingRecord.id || '',
          action: 'conflict',
          operator,
          details: `与已有记录ID: ${existingRecord.id} 发生冲突`,
          needsConfirmation: true,
          confirmed: false
        });

        return {
          status: 'conflict',
          recordId: existingRecord.id,
          message: '检测到冲突：相同内容但下载链接或提交人不同，需要人工确认'
        };
      } else {
        auditStore.add({
          recordHash,
          recordId: existingRecord.id || '',
          action: 'reuse',
          operator,
          details: `复用已有记录ID: ${existingRecord.id}`,
          needsConfirmation: false,
          confirmed: false
        });

        return {
          status: 'reused',
          recordId: existingRecord.id,
          message: '复用已有记录结论'
        };
      }
    }

    const recordId = recordStore.add(record, recordHash);
    
    auditStore.add({
      recordHash,
      recordId,
      action: 'submit',
      operator,
      details: '新记录提交成功',
      needsConfirmation: false,
      confirmed: false
    });

    return {
      status: 'success',
      recordId,
      message: '记录提交成功'
    };
  }

  submitBatch(records: SearchKeywordReport[], operator: string): {
    total: number;
    success: number;
    reused: number;
    conflict: number;
    failure: number;
    results: PlaybackRecord[];
  } {
    const results: PlaybackRecord[] = [];
    
    for (const record of records) {
      const result = this.submitRecord(record, operator);
      
      const playbackRecord: PlaybackRecord = {
        originalRecord: record,
        status: result.status,
        errors: result.errors,
        existingRecordId: result.recordId,
        message: result.message
      };
      
      results.push(playbackRecord);
    }

    const grouped = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      reused: results.filter(r => r.status === 'reused').length,
      conflict: results.filter(r => r.status === 'conflict').length,
      failure: results.filter(r => r.status === 'failure').length,
      results
    };

    return grouped;
  }

  playback(sessionId: string, records: SearchKeywordReport[], operator: string): PlaybackResult {
    const batchResult = this.submitBatch(records, operator);
    
    const groupedFailures = {} as Record<FailureType, PlaybackRecord[]>;
    
    for (const result of batchResult.results) {
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          if (!groupedFailures[error.failureType]) {
            groupedFailures[error.failureType] = [];
          }
          groupedFailures[error.failureType].push(result);
        }
      }
    }

    return {
      sessionId,
      totalRecords: batchResult.total,
      successCount: batchResult.success + batchResult.reused,
      failureCount: batchResult.failure + batchResult.conflict,
      results: batchResult.results,
      groupedFailures
    };
  }

  queryByFailureType(failureType: FailureType): PlaybackRecord[] {
    const allRecords = recordStore.getAll();
    const results: PlaybackRecord[] = [];

    for (const record of allRecords) {
      const errors = validateSearchKeywordReport(record);
      const matchingErrors = errors.filter(e => e.failureType === failureType);
      
      if (matchingErrors.length > 0) {
        results.push({
          originalRecord: record,
          status: 'failure',
          errors: matchingErrors
        });
      }
    }

    return results;
  }

  getAllFailedRecords(): { records: PlaybackRecord[]; groupedByFailure: Record<FailureType, PlaybackRecord[]> } {
    const allRecords = recordStore.getAll();
    const groupedByFailure = {} as Record<FailureType, PlaybackRecord[]>;

    for (const record of allRecords) {
      const errors = validateSearchKeywordReport(record);
      
      if (errors.length > 0) {
        const playbackRecord: PlaybackRecord = {
          originalRecord: record,
          status: 'failure',
          errors
        };

        for (const error of errors) {
          if (!groupedByFailure[error.failureType]) {
            groupedByFailure[error.failureType] = [];
          }
          groupedByFailure[error.failureType].push(playbackRecord);
        }
      }
    }

    const records = Object.values(groupedByFailure).flat();
    return { records, groupedByFailure };
  }
}

export const mockRecorderService = new MockRecorderService();
