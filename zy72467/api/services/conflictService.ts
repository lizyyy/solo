import type { ConflictRecord, RampRecord, SamplingRecord, FinalRecord } from '../../shared/types';
import { dataStore } from '../data/store';

const generateId = () => Math.random().toString(36).substring(2, 11);

export class ConflictService {
  detectAndCreateConflicts(rampRecords: RampRecord[], samplingRecords: SamplingRecord[]): ConflictRecord[] {
    const conflicts: ConflictRecord[] = [];

    rampRecords.forEach(ramp => {
      const sampling = samplingRecords.find(s => s.location === ramp.location);
      if (sampling) {
        const conflictFields = this.findConflictFields(ramp, sampling);
        if (conflictFields.length > 0) {
          const conflict: ConflictRecord = {
            id: generateId(),
            location: ramp.location,
            rampRecord: ramp,
            samplingRecord: sampling,
            conflictFields,
            status: 'pending',
          };
          conflicts.push(conflict);
          dataStore.addConflictRecord(conflict);
        }
      }
    });

    return conflicts;
  }

  private findConflictFields(ramp: RampRecord, sampling: SamplingRecord): string[] {
    const fields: string[] = [];

    if (ramp.residentOpinionSummary !== sampling.residentOpinionSummary) {
      fields.push('居民意见汇总');
    }
    if ((ramp.residentOpinionOriginal || '') !== (sampling.residentOpinionOriginal || '')) {
      fields.push('居民意见原文');
    }

    return fields;
  }

  getConflicts(): ConflictRecord[] {
    return dataStore.getConflictRecords();
  }

  resolveConflict(
    conflictId: string,
    resolution: 'keep_ramp' | 'keep_sampling' | 'merge',
    note: string,
    operator: string
  ): boolean {
    const conflict = dataStore.getConflictRecords().find(c => c.id === conflictId);
    if (!conflict) return false;

    dataStore.updateConflictRecord(conflictId, {
      status: 'resolved',
      resolution,
      resolvedBy: operator,
      resolvedAt: new Date().toISOString(),
      resolutionNote: note,
    });

    const finalRecord = dataStore.findFinalRecordByLocation(conflict.location);
    if (finalRecord) {
      let updates: Partial<FinalRecord> = { status: 'normal' };

      if (resolution === 'keep_ramp') {
        updates = {
          ...updates,
          residentOpinionOriginal: conflict.rampRecord.residentOpinionOriginal,
          residentOpinionSummary: conflict.rampRecord.residentOpinionSummary,
          hasOpinionOriginal: !!conflict.rampRecord.residentOpinionOriginal,
        };
      } else if (resolution === 'keep_sampling') {
        updates = {
          ...updates,
          residentOpinionOriginal: conflict.samplingRecord.residentOpinionOriginal,
          residentOpinionSummary: conflict.samplingRecord.residentOpinionSummary,
          hasOpinionOriginal: !!conflict.samplingRecord.residentOpinionOriginal,
        };
      }

      dataStore.updateFinalRecord(finalRecord.id, updates);
      dataStore.addModificationLog(finalRecord.id, {
        operator,
        action: `冲突复核完成：${this.getResolutionText(resolution)}`,
        afterChanges: { resolution, note },
      });
    }

    return true;
  }

  private getResolutionText(resolution: string): string {
    const map: Record<string, string> = {
      keep_ramp: '保留坡道记录',
      keep_sampling: '保留采样点记录',
      merge: '合并双方数据',
    };
    return map[resolution] || resolution;
  }
}

export const conflictService = new ConflictService();
