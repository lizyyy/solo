import type {
  AcceptanceRecord,
  ConflictPoint,
  CalculationMeta,
} from '../../shared/types.js';
import { dataStore } from '../data/unifiedStore.js';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

export class RecordService {
  getAllRecords(): AcceptanceRecord[] {
    return dataStore.getAllRecords();
  }

  getRecordById(id: string): AcceptanceRecord | undefined {
    return dataStore.getRecordById(id);
  }

  importRedLineRemark(data: {
    redLineNo: string;
    communityName: string;
    communityNameOld?: string;
    redLineRemark: string;
    operator: string;
  }): AcceptanceRecord {
    const hasNameIssue = !!data.communityNameOld && data.communityNameOld !== data.communityName;
    const record = dataStore.addRecord({
      redLineNo: data.redLineNo,
      communityName: data.communityName,
      communityNameOld: data.communityNameOld,
      redLineRemark: data.redLineRemark,
      gridInspection: '',
      status: 'pending_review',
      hasConflict: false,
      hasNameIssue,
      nameReviewStatus: hasNameIssue ? 'pending' : undefined,
      streetSummary: '',
      importTime: new Date().toISOString(),
      operator: data.operator,
      conflictPoints: [],
    });
    return record;
  }

  submitGridInspection(
    id: string,
    gridInspection: string,
    operator: string
  ): AcceptanceRecord | undefined {
    const record = dataStore.getRecordById(id);
    if (!record) return undefined;

    const conflictPoints = this.detectConflicts(record, gridInspection);
    const hasConflict = conflictPoints.length > 0;

    const calculationMeta: CalculationMeta = {
      paramVersion: 'v2.1.0',
      decisionReason: hasConflict
        ? '检测到数据不一致，已标记冲突待人工复核，系统不自动覆盖任何一方数据'
        : '双方数据一致，无需人工介入',
      calculationTime: new Date().toISOString(),
      algorithm: 'conflict_detector_v2.1',
    };

    const updated = dataStore.updateRecord(id, {
      gridInspection,
      reviewTime: new Date().toISOString(),
      status: 'pending_summary',
      hasConflict,
      conflictStatus: hasConflict ? 'pending' : undefined,
      conflictPoints,
      calculationMeta,
    });

    dataStore.addLog(
      id,
      'review',
      operator,
      `提交网格员巡查表，${hasConflict ? `检测到${conflictPoints.length}处冲突` : '无冲突'}`
    );

    return updated;
  }

  private detectConflicts(record: AcceptanceRecord, gridInspection: string): ConflictPoint[] {
    const points: ConflictPoint[] = [];
    const redLines = record.redLineRemark.split('\n').map((s) => s.trim());
    const gridLines = gridInspection.split('\n').map((s) => s.trim());

    const redNameLine = redLines.find((l) => l.includes('小区名称') || l.includes('阳光') || l.includes('翠苑') || l.includes('锦绣') || l.includes('和平'));
    const gridNameLine = gridLines.find((l) => l.includes('小区名称'));
    
    if (record.communityNameOld && record.hasNameIssue) {
      points.push({
        field: '小区名称',
        redLineValue: record.communityName,
        gridValue: record.communityNameOld,
        description: `红线图标注为「${record.communityName}」，疑似旧名称为「${record.communityNameOld}」，请复核确认`,
      });
    }

    const redQualityLine = redLines.find((l) => l.includes('破损') || l.includes('质量') || l.includes('注意'));
    const gridQualityLine = gridLines.find((l) => l.includes('下沉') || l.includes('裂缝') || l.includes('平整'));
    
    if (redQualityLine && gridQualityLine) {
      const redHasIssue = redQualityLine.includes('破损') || redQualityLine.includes('问题');
      const gridHasIssue = gridQualityLine.includes('下沉') || gridQualityLine.includes('裂缝');
      if (redHasIssue !== gridHasIssue || (redHasIssue && gridHasIssue && redQualityLine !== gridQualityLine)) {
        points.push({
          field: '恢复质量描述',
          redLineValue: redQualityLine,
          gridValue: gridQualityLine,
          description: '红线图备注与网格员巡查表对现场质量描述存在差异，请人工核对',
        });
      }
    }

    return points;
  }

  confirmConflict(id: string, resolution: string, operator: string): AcceptanceRecord | undefined {
    const updated = dataStore.updateRecord(id, {
      conflictStatus: 'confirmed',
      conflictResolution: resolution,
    });
    if (updated) {
      dataStore.addLog(id, 'conflict_confirm', operator, `确认冲突：${resolution}`);
    }
    return updated;
  }

  rejectConflict(id: string, resolution: string, operator: string): AcceptanceRecord | undefined {
    const updated = dataStore.updateRecord(id, {
      conflictStatus: 'rejected',
      conflictResolution: resolution,
    });
    if (updated) {
      dataStore.addLog(id, 'conflict_reject', operator, `驳回冲突：${resolution}`);
    }
    return updated;
  }

  confirmNameIssue(id: string, confirmedName: string, operator: string): AcceptanceRecord | undefined {
    const updated = dataStore.updateRecord(id, {
      nameReviewStatus: 'confirmed',
      communityName: confirmedName,
    });
    if (updated) {
      dataStore.addLog(id, 'name_confirm', operator, `确认小区名称为：${confirmedName}`);
    }
    return updated;
  }

  updateStreetSummary(id: string, summary: string, operator: string): AcceptanceRecord | undefined {
    const updated = dataStore.updateRecord(id, {
      streetSummary: summary,
      summaryTime: new Date().toISOString(),
      status: 'completed',
    });
    if (updated) {
      dataStore.addLog(id, 'summary_update', operator, '更新街道会看摘要，流程完成');
    }
    return updated;
  }

  recalculateAfterSupplement(id: string): AcceptanceRecord | undefined {
    const record = dataStore.getRecordById(id);
    if (!record) return undefined;

    const calculationMeta: CalculationMeta = {
      paramVersion: 'v2.1.0',
      decisionReason: '补录数据后触发重算，采用最新参数版本，保留历史计算轨迹供对比',
      calculationTime: new Date().toISOString(),
      algorithm: 'standard_recalculator_v2.1',
    };

    return dataStore.updateRecord(id, { calculationMeta });
  }
}

export const recordService = new RecordService();
