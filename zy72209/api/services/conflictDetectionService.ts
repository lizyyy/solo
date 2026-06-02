import type { CreditRecord, ConflictEvidence, ScreenshotData } from '../../shared/types';
import { unifiedResultRepository } from '../repositories/unifiedResultRepository';

class ConflictDetectionService {
  private fieldLabels: Record<string, string> = {
    exDividendDate: '除权日',
    shareRatio: '配售比例',
    totalShares: '总股数'
  };

  private fieldSources: Record<string, { custodian: string; screenshot: string }> = {
    exDividendDate: {
      custodian: '托管确认页第2页第1行',
      screenshot: '除权日截图标题栏'
    },
    shareRatio: {
      custodian: '托管确认页第3页第2行',
      screenshot: '除权日截图右上角数据区'
    },
    totalShares: {
      custodian: '托管确认页第5页合计行',
      screenshot: '除权日截图表格末行'
    }
  };

  detectConflicts(
    custodianData: CreditRecord['custodianData'],
    screenshotData: ScreenshotData
  ): { hasConflict: boolean; conflicts: ConflictEvidence[] } {
    const conflicts: ConflictEvidence[] = [];
    const fieldsToCheck: (keyof typeof custodianData)[] = ['exDividendDate', 'shareRatio', 'totalShares'];

    fieldsToCheck.forEach(field => {
      const custodianValue = custodianData[field];
      const screenshotValue = screenshotData[field];
      
      if (custodianValue !== screenshotValue) {
        conflicts.push({
          field: field as string,
          fieldLabel: this.fieldLabels[field] || field,
          custodianValue,
          screenshotValue,
          custodianSource: this.fieldSources[field]?.custodian || '托管确认页',
          screenshotSource: this.fieldSources[field]?.screenshot || '除权日截图'
        });
      }
    });

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  async applyScreenshotData(
    recordId: string,
    screenshotData: ScreenshotData,
    operator: string
  ): Promise<CreditRecord | undefined> {
    const record = unifiedResultRepository.getRecordById(recordId);
    if (!record) return undefined;

    const { hasConflict, conflicts } = this.detectConflicts(
      record.custodianData,
      screenshotData
    );

    const updates: Partial<CreditRecord> = {
      screenshotData,
      hasConflict,
      conflictFields: hasConflict ? conflicts.map(c => c.field) : undefined,
      conflictEvidence: hasConflict ? conflicts : undefined,
      status: hasConflict ? 'conflict' : (record.nameConsistent ? 'imported' : 'abnormal'),
      operator
    };

    unifiedResultRepository.addOperationLog({
      recordId,
      operationType: 'screenshot_upload',
      operator,
      operationTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      remark: hasConflict 
        ? `上传除权日截图，检测到${conflicts.length}处冲突：${conflicts.map(c => c.fieldLabel).join('、')}`
        : '上传除权日截图，数据一致无冲突'
    });

    return unifiedResultRepository.updateRecord(recordId, updates);
  }

  async resolveConflict(
    recordId: string,
    resolution: 'confirm_custodian' | 'reject_use_screenshot',
    remark: string,
    operator: string
  ): Promise<CreditRecord | undefined> {
    const record = unifiedResultRepository.getRecordById(recordId);
    if (!record) return undefined;

    const updates: Partial<CreditRecord> = {
      hasConflict: false,
      status: record.nameConsistent ? 'resolved' : 'abnormal',
      reviewStatus: 'pending',
      conflictResolution: {
        resolution,
        operator,
        time: new Date().toISOString().replace('T', ' ').substring(0, 19),
        remark
      },
      operator
    };

    if (resolution === 'reject_use_screenshot' && record.screenshotData) {
      const custodianUpdates: Partial<CreditRecord['custodianData']> = {};
      record.conflictFields?.forEach(field => {
        const evidence = record.conflictEvidence?.find(e => e.field === field);
        if (evidence) {
          (custodianUpdates as any)[field] = evidence.screenshotValue;
        }
      });
      
      if (Object.keys(custodianUpdates).length > 0) {
        updates.custodianData = {
          ...record.custodianData,
          ...custodianUpdates
        };
      }
    }

    unifiedResultRepository.addOperationLog({
      recordId,
      operationType: 'conflict_resolve',
      operator,
      operationTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      remark: `${resolution === 'confirm_custodian' ? '确认托管数据' : '驳回，以截图为准'}。${remark}`
    });

    return unifiedResultRepository.updateRecord(recordId, updates);
  }
}

export const conflictDetectionService = new ConflictDetectionService();
