import type { FinalRecord, SelfCheckResult } from '../../shared/types';
import { dataStore } from '../data/store';

export class SelfCheckService {
  runSelfCheck(): SelfCheckResult {
    const records = dataStore.getFinalRecords();

    return {
      duplicateImports: this.checkDuplicateImports(records),
      missingOpinionOriginal: this.checkMissingOpinionOriginal(records),
      recalculationNeeded: this.checkRecalculationNeeded(records),
      exportConsistency: this.checkExportConsistency(records),
    };
  }

  private checkDuplicateImports(records: FinalRecord[]): FinalRecord[] {
    const locationMap = new Map<string, FinalRecord[]>();
    records.forEach(r => {
      const existing = locationMap.get(r.location) || [];
      existing.push(r);
      locationMap.set(r.location, existing);
    });

    const duplicates: FinalRecord[] = [];
    locationMap.forEach((group) => {
      if (group.length > 1) {
        duplicates.push(...group.slice(1));
      }
    });

    return duplicates;
  }

  private checkMissingOpinionOriginal(records: FinalRecord[]): FinalRecord[] {
    return records.filter(r => !r.hasOpinionOriginal);
  }

  private checkRecalculationNeeded(records: FinalRecord[]): FinalRecord[] {
    return records.filter(r => {
      const hasRamp = r.source === 'ramp' || r.source === 'merged';
      const hasSampling = r.source === 'sampling' || r.source === 'merged';
      return (r.rampData && !hasSampling) || (r.samplingData && !hasRamp);
    });
  }

  private checkExportConsistency(records: FinalRecord[]) {
    const mismatches: Array<{
      recordId: string;
      field: string;
      pageValue: any;
      exportValue: any;
    }> = [];

    records.forEach(record => {
      const exportRecord = this.buildExportRecord(record);
      const fieldsToCheck = ['location', 'status', 'residentOpinionSummary', 'hasOpinionOriginal'];
      
      fieldsToCheck.forEach(field => {
        const pageValue = (record as any)[field];
        const exportValue = (exportRecord as any)[field];
        if (JSON.stringify(pageValue) !== JSON.stringify(exportValue)) {
          mismatches.push({
            recordId: record.id,
            field,
            pageValue,
            exportValue,
          });
        }
      });
    });

    return {
      isConsistent: mismatches.length === 0,
      mismatches,
    };
  }

  private buildExportRecord(record: FinalRecord) {
    return {
      id: record.id,
      location: record.location,
      status: record.status,
      source: record.source,
      residentOpinionOriginal: record.residentOpinionOriginal,
      residentOpinionSummary: record.residentOpinionSummary,
      hasOpinionOriginal: record.hasOpinionOriginal,
      lastModified: record.lastModified,
      modifiedBy: record.modifiedBy,
    };
  }

  resolveOpinionMissing(recordId: string, opinionOriginal: string, operator: string): boolean {
    const record = dataStore.getFinalRecordById(recordId);
    if (!record) return false;

    dataStore.updateFinalRecord(recordId, {
      residentOpinionOriginal: opinionOriginal,
      hasOpinionOriginal: true,
      status: record.status === 'pending_review' ? 'normal' : record.status,
    });

    dataStore.addModificationLog(recordId, {
      operator,
      action: '补全居民意见原文，状态更新为正常',
      afterChanges: { residentOpinionOriginal: opinionOriginal, hasOpinionOriginal: true },
    });

    return true;
  }
}

export const selfCheckService = new SelfCheckService();
