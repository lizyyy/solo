import {
  DataSourceType,
  UnifiedRecord,
  LightAlarm,
  InspectionRecord,
  MaintenanceOrder,
  ProcessedRecord,
  BatchProcessResult,
  RuleType,
  RuleResult
} from '../types';
import { ruleEngine, RuleContext } from './RuleEngine';
import { batchManager } from './BatchManager';

export class DataProcessor {
  processBatch(
    records: UnifiedRecord[],
    sourceType: DataSourceType,
    batchId: string,
    fileHash: string
  ): BatchProcessResult {
    const ruleContext: RuleContext = {
      allRecords: records,
      sourceType,
      batchId
    };

    const processedRecords: ProcessedRecord[] = records.map(record => 
      this.processSingleRecord(record, ruleContext)
    );

    const normal = processedRecords.filter(r => r.status === 'normal' && !r.isDuplicate);
    const pending = processedRecords.filter(r => r.status === 'pending');
    const failed = processedRecords.filter(r => r.status === 'failed');
    const duplicates = processedRecords.filter(r => r.isDuplicate);

    const ruleBreakdown = this.calculateRuleBreakdown(processedRecords);
    const boundaryCases = this.extractBoundaryCases(processedRecords, sourceType);

    const nonDuplicateRecords = processedRecords.filter(r => !r.isDuplicate);
    batchManager.registerBatch(batchId, sourceType, nonDuplicateRecords.map(r => r.originalData), fileHash);

    return {
      batchId,
      processedAt: new Date().toISOString(),
      sourceType,
      summary: {
        total: records.length,
        normal: normal.length,
        pending: pending.length,
        failed: failed.length,
        duplicates: duplicates.length
      },
      categories: {
        normal,
        pending,
        failed
      },
      ruleBreakdown,
      boundaryCases
    };
  }

  private processSingleRecord(
    record: UnifiedRecord,
    context: RuleContext
  ): ProcessedRecord {
    const duplicateCheck = batchManager.checkDuplicate(record, context.sourceType);
    const ruleResults = ruleEngine.applyAllRules(record, context);
    const { status, suggestion } = ruleEngine.determineStatus(ruleResults);

    const unifiedData = this.extractUnifiedData(record, context.sourceType);
    const originalId = this.getOriginalId(record, context.sourceType);

    return {
      originalId,
      sourceType: context.sourceType,
      status: duplicateCheck.isDuplicate ? 'normal' : status,
      originalData: record,
      unifiedData,
      ruleResults,
      finalSuggestion: duplicateCheck.isDuplicate 
        ? `该记录为重复数据，已存在于批次 ${duplicateCheck.duplicateOf}，本次不重复处理`
        : suggestion,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateOf: duplicateCheck.duplicateOf
    };
  }

  private extractUnifiedData(record: UnifiedRecord, sourceType: DataSourceType): ProcessedRecord['unifiedData'] {
    switch (sourceType) {
      case 'alarm':
        const alarm = record as LightAlarm;
        return {
          poleId: alarm.poleId,
          lampId: alarm.lampId,
          location: alarm.location,
          time: alarm.alarmTime,
          type: alarm.alarmType
        };
      case 'inspection':
        const inspection = record as InspectionRecord;
        return {
          poleId: inspection.poleId,
          lampId: inspection.lampId,
          location: inspection.location,
          time: inspection.inspectionTime,
          type: `巡查-${inspection.status}`
        };
      case 'maintenance':
        const maintenance = record as MaintenanceOrder;
        return {
          poleId: maintenance.poleId,
          lampId: maintenance.lampId,
          location: maintenance.location,
          time: maintenance.reportTime,
          type: maintenance.repairType
        };
    }
  }

  private getOriginalId(record: UnifiedRecord, sourceType: DataSourceType): string {
    switch (sourceType) {
      case 'alarm':
        return (record as LightAlarm).alarmId;
      case 'inspection':
        return (record as InspectionRecord).inspectionId;
      case 'maintenance':
        return (record as MaintenanceOrder).orderId;
    }
  }

  private calculateRuleBreakdown(records: ProcessedRecord[]): BatchProcessResult['ruleBreakdown'] {
    const breakdown: BatchProcessResult['ruleBreakdown'] = {};
    
    const allRuleTypes = new Set<RuleType>();
    records.forEach(r => {
      r.ruleResults.forEach(rr => allRuleTypes.add(rr.ruleType));
    });

    allRuleTypes.forEach(ruleType => {
      const ruleResults = records.flatMap(r => 
        r.ruleResults.filter(rr => rr.ruleType === ruleType)
      );
      
      if (ruleResults.length > 0) {
        const firstResult = ruleResults[0];
        breakdown[ruleType] = {
          name: firstResult.ruleName,
          triggered: ruleResults.length,
          passed: ruleResults.filter(r => r.passed).length,
          failed: ruleResults.filter(r => !r.passed).length
        };
      }
    });

    return breakdown;
  }

  private extractBoundaryCases(
    records: ProcessedRecord[],
    sourceType: DataSourceType
  ): BatchProcessResult['boundaryCases'] {
    const boundaryCases: BatchProcessResult['boundaryCases'] = [];

    const samePoleMultiLamp = records.filter(r => 
      r.ruleResults.some(rr => 
        rr.ruleType === 'same_pole_multi_lamp' && 
        rr.details && rr.details.uniqueLampCount >= 3
      )
    );

    if (samePoleMultiLamp.length > 0) {
      boundaryCases.push({
        description: '同杆多灯边界：同一杆号下3盏及以上灯同时上报，疑似整杆电源或线路问题，建议先排查主干线',
        records: samePoleMultiLamp
      });
    }

    const falsePositives = records.filter(r =>
      r.ruleResults.some(rr => rr.ruleType === 'false_positive_filter' && !rr.passed)
    );

    if (falsePositives.length > 0) {
      boundaryCases.push({
        description: '误报过滤边界：通信类告警或低置信度告警，建议观察5分钟后自动恢复或人工确认',
        records: falsePositives
      });
    }

    const missingProof = records.filter(r =>
      r.ruleResults.some(rr => rr.ruleType === 'repair_retest' && !rr.passed)
    );

    if (missingProof.length > 0) {
      boundaryCases.push({
        description: '修复复测边界：已完成维修单缺少凭证材料（照片/时间/人员/耗材），需补全后才能验收',
        records: missingProof
      });
    }

    const duplicates = records.filter(r => r.isDuplicate);
    if (duplicates.length > 0) {
      boundaryCases.push({
        description: '重复提交边界：该批记录与历史批次重复，已自动跳过不重复处理',
        records: duplicates
      });
    }

    const dataErrors = records.filter(r =>
      r.ruleResults.some(rr => rr.ruleType === 'data_validation' && !rr.passed)
    );

    if (dataErrors.length > 0) {
      boundaryCases.push({
        description: '数据格式边界：存在必填字段缺失或格式错误，需对照数据字典修正后重新导入',
        records: dataErrors
      });
    }

    return boundaryCases;
  }

  generateExplanation(record: ProcessedRecord): string {
    const lines: string[] = [];
    lines.push(`记录编号: ${record.originalId}`);
    lines.push(`数据类型: ${this.translateSourceType(record.sourceType)}`);
    lines.push(`处理结果: ${this.translateStatus(record.status)}`);
    lines.push('');
    
    if (record.isDuplicate) {
      lines.push(`⚠️ 该记录为重复数据`);
      lines.push(`   来源批次: ${record.duplicateOf}`);
      lines.push(`   处理方式: 不重复生效`);
      return lines.join('\n');
    }

    lines.push('规则执行明细:');
    record.ruleResults.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      lines.push(`  ${index + 1}. ${icon} ${result.ruleName}`);
      lines.push(`     ${result.message}`);
      if (!result.passed && result.suggestion) {
        lines.push(`     建议: ${result.suggestion}`);
      }
    });

    lines.push('');
    lines.push(`最终建议: ${record.finalSuggestion}`);

    return lines.join('\n');
  }

  private translateSourceType(type: DataSourceType): string {
    const map: Record<DataSourceType, string> = {
      alarm: '路灯告警',
      inspection: '人工巡查',
      maintenance: '维修反馈'
    };
    return map[type] || type;
  }

  private translateStatus(status: ProcessedRecord['status']): string {
    const map: Record<ProcessedRecord['status'], string> = {
      normal: '正常放行',
      pending: '待人工确认',
      failed: '退回补材料'
    };
    return map[status] || status;
  }
}

export const dataProcessor = new DataProcessor();
