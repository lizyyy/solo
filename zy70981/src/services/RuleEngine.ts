import * as dayjs from 'dayjs';
import {
  DataSourceType,
  UnifiedRecord,
  LightAlarm,
  InspectionRecord,
  MaintenanceOrder,
  RuleResult,
  RuleType,
  ProcessedRecord
} from '../types';

export interface RuleContext {
  allRecords: UnifiedRecord[];
  sourceType: DataSourceType;
  batchId: string;
}

export interface IRule {
  type: RuleType;
  name: string;
  description: string;
  apply: (record: UnifiedRecord, context: RuleContext) => RuleResult;
}

export class SamePoleMultiLampRule implements IRule {
  type: RuleType = 'same_pole_multi_lamp';
  name = '同杆多灯聚合规则';
  description = '同一杆上的多个灯同时告警时进行聚合处理，避免重复派单';

  apply(record: UnifiedRecord, context: RuleContext): RuleResult {
    const { poleId, lampId } = this.extractIds(record, context.sourceType);
    
    if (!poleId) {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: false,
        message: '缺少杆号信息，无法验证同杆多灯规则',
        suggestion: '请补充完整的杆号(poleId)信息后重新提交'
      };
    }

    const samePoleRecords = context.allRecords.filter(r => {
      const { poleId: otherPoleId } = this.extractIds(r, context.sourceType);
      return otherPoleId === poleId && r !== record;
    });

    if (samePoleRecords.length === 0) {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: true,
        message: '该杆号暂无其他设备记录',
        details: { samePoleCount: 1, lampCount: 1 }
      };
    }

    const uniqueLamps = new Set<string>();
    uniqueLamps.add(lampId || 'unknown');
    samePoleRecords.forEach(r => {
      const { lampId: l } = this.extractIds(r, context.sourceType);
      if (l) uniqueLamps.add(l);
    });

    const details = {
      samePoleCount: samePoleRecords.length + 1,
      uniqueLampCount: uniqueLamps.size,
      lamps: Array.from(uniqueLamps)
    };

    if (uniqueLamps.size >= 3) {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: false,
        message: `该杆号(${poleId})下有${uniqueLamps.size}盏灯同时上报，疑似整杆故障或电源问题`,
        suggestion: '建议先排查电源或线路问题，再逐灯检修，已自动标记为待人工确认',
        details
      };
    }

    return {
      ruleType: this.type,
      ruleName: this.name,
      passed: true,
      message: `同杆另有${samePoleRecords.length}条记录，共${uniqueLamps.size}盏灯，属于正常范围`,
      details
    };
  }

  private extractIds(record: UnifiedRecord, sourceType: DataSourceType): { poleId: string; lampId?: string } {
    switch (sourceType) {
      case 'alarm':
        return { poleId: (record as LightAlarm).poleId, lampId: (record as LightAlarm).lampId };
      case 'inspection':
        return { poleId: (record as InspectionRecord).poleId, lampId: (record as InspectionRecord).lampId };
      case 'maintenance':
        return { poleId: (record as MaintenanceOrder).poleId, lampId: (record as MaintenanceOrder).lampId };
    }
  }
}

export class FalsePositiveFilterRule implements IRule {
  type: RuleType = 'false_positive_filter';
  name = '误报过滤规则';
  description = '过滤因网络波动、传感器干扰等原因产生的误报';

  private readonly FALSE_POSITIVE_TYPES = new Set([
    'communication_timeout',
    'signal_interrupt',
    '网络超时',
    '通信中断',
    '信号干扰'
  ]);

  private readonly LOW_CONFIDENCE_KEYWORDS = ['疑似', '可能', 'maybe', 'suspected'];

  apply(record: UnifiedRecord, context: RuleContext): RuleResult {
    if (context.sourceType !== 'alarm') {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: true,
        message: '非告警数据，跳过误报过滤'
      };
    }

    const alarm = record as LightAlarm;
    const alarmTypeLower = (alarm.alarmType || '').toLowerCase();
    const descriptionLower = (alarm.description || '').toLowerCase();

    if (this.FALSE_POSITIVE_TYPES.has(alarmTypeLower) || 
        this.FALSE_POSITIVE_TYPES.has(alarm.alarmType)) {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: false,
        message: `告警类型"${alarm.alarmType}"属于常见通信误报，建议观察5分钟后确认`,
        suggestion: '如5分钟内自动恢复则无需处理，持续告警请安排现场检查',
        details: { isCommunicationError: true }
      };
    }

    if (alarm.alarmLevel === 'low') {
      const hasLowConfidence = this.LOW_CONFIDENCE_KEYWORDS.some(
        k => alarmTypeLower.includes(k) || descriptionLower.includes(k)
      );
      
      if (hasLowConfidence) {
        return {
          ruleType: this.type,
          ruleName: this.name,
          passed: false,
          message: '低级告警且描述含不确定性词汇，标记为待确认',
          suggestion: '请补充现场照片或再次确认告警真实性',
          details: { lowConfidence: true, lowLevel: true }
        };
      }
    }

    const alarmTime = dayjs(alarm.alarmTime);
    if (alarmTime.isValid()) {
      const duration = dayjs().diff(alarmTime, 'minute');
      if (duration < 5) {
        return {
          ruleType: this.type,
          ruleName: this.name,
          passed: true,
          message: `告警发生于${duration}分钟前，建议持续观察`,
          details: { minutesSinceAlarm: duration }
        };
      }
    }

    return {
      ruleType: this.type,
      ruleName: this.name,
      passed: true,
      message: '未发现明显误报特征'
    };
  }
}

export class RepairRetestRule implements IRule {
  type: RuleType = 'repair_retest';
  name = '修复复测规则';
  description = '检查维修后是否有复测记录，确保维修质量';

  apply(record: UnifiedRecord, context: RuleContext): RuleResult {
    if (context.sourceType !== 'maintenance') {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: true,
        message: '非维修单数据，跳过复测检查'
      };
    }

    const maintenance = record as MaintenanceOrder;

    if (maintenance.status !== 'completed') {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: true,
        message: `维修单状态为"${maintenance.status}"，无需复测检查`
      };
    }

    const issues = [
      !maintenance.afterPhotos || maintenance.afterPhotos.length === 0,
      !maintenance.repairTime,
      !maintenance.repairer,
      maintenance.materials && maintenance.materials.length === 0
    ];

    const missingFields: string[] = [];
    if (!maintenance.afterPhotos || maintenance.afterPhotos.length === 0) {
      missingFields.push('维修后照片');
    }
    if (!maintenance.repairTime) {
      missingFields.push('维修完成时间');
    }
    if (!maintenance.repairer) {
      missingFields.push('维修人员');
    }

    if (missingFields.length > 0) {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: false,
        message: `已完成的维修单缺少: ${missingFields.join('、')}`,
        suggestion: '请补充维修凭证信息，确保维修记录完整可追溯',
        details: { missingFields }
      };
    }

    if (maintenance.cost !== undefined && maintenance.cost > 0) {
      if (!maintenance.materials || maintenance.materials.length === 0) {
        return {
          ruleType: this.type,
          ruleName: this.name,
          passed: false,
          message: '有费用产生但未记录使用材料',
          suggestion: '请补充耗材明细，便于成本核算',
          details: { cost: maintenance.cost, hasMaterials: false }
        };
      }
    }

    return {
      ruleType: this.type,
      ruleName: this.name,
      passed: true,
      message: '维修单信息完整，符合验收标准'
    };
  }
}

export class DataValidationRule implements IRule {
  type: RuleType = 'data_validation';
  name = '数据校验规则';
  description = '基本字段完整性和格式校验';

  apply(record: UnifiedRecord, context: RuleContext): RuleResult {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    switch (context.sourceType) {
      case 'alarm':
        const alarm = record as LightAlarm;
        if (!alarm.poleId) missingFields.push('杆号(poleId)');
        if (!alarm.lampId) missingFields.push('灯号(lampId)');
        if (!alarm.alarmTime) missingFields.push('告警时间(alarmTime)');
        if (!alarm.alarmType) missingFields.push('告警类型(alarmType)');
        if (!alarm.location) missingFields.push('位置(location)');
        
        if (alarm.alarmTime && !dayjs(alarm.alarmTime).isValid()) {
          invalidFields.push('告警时间格式不正确');
        }
        break;

      case 'inspection':
        const inspection = record as InspectionRecord;
        if (!inspection.poleId) missingFields.push('杆号(poleId)');
        if (!inspection.inspector) missingFields.push('巡查员(inspector)');
        if (!inspection.inspectionTime) missingFields.push('巡查时间(inspectionTime)');
        if (!inspection.status) missingFields.push('状态(status)');
        if (!inspection.location) missingFields.push('位置(location)');
        
        if (inspection.inspectionTime && !dayjs(inspection.inspectionTime).isValid()) {
          invalidFields.push('巡查时间格式不正确');
        }
        break;

      case 'maintenance':
        const maintenance = record as MaintenanceOrder;
        if (!maintenance.poleId) missingFields.push('杆号(poleId)');
        if (!maintenance.reporter) missingFields.push('报修人(reporter)');
        if (!maintenance.reportTime) missingFields.push('报修时间(reportTime)');
        if (!maintenance.repairType) missingFields.push('维修类型(repairType)');
        if (!maintenance.status) missingFields.push('状态(status)');
        if (!maintenance.location) missingFields.push('位置(location)');
        
        if (maintenance.reportTime && !dayjs(maintenance.reportTime).isValid()) {
          invalidFields.push('报修时间格式不正确');
        }
        if (maintenance.repairTime && !dayjs(maintenance.repairTime).isValid()) {
          invalidFields.push('维修时间格式不正确');
        }
        break;
    }

    if (missingFields.length > 0 || invalidFields.length > 0) {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: false,
        message: [
          missingFields.length > 0 ? `缺少必填字段: ${missingFields.join('、')}` : '',
          invalidFields.length > 0 ? `格式错误: ${invalidFields.join('、')}` : ''
        ].filter(Boolean).join('; '),
        suggestion: '请对照数据字典补充完整信息后重新提交',
        details: { missingFields, invalidFields }
      };
    }

    return {
      ruleType: this.type,
      ruleName: this.name,
      passed: true,
      message: '数据格式校验通过'
    };
  }
}

export class DuplicateCheckRule implements IRule {
  type: RuleType = 'duplicate_check';
  name = '重复记录检查规则';
  description = '检查同一批次内是否存在重复记录';

  apply(record: UnifiedRecord, context: RuleContext): RuleResult {
    const recordKey = this.generateRecordKey(record, context.sourceType);
    const duplicates = context.allRecords.filter(r => 
      this.generateRecordKey(r, context.sourceType) === recordKey && r !== record
    );

    if (duplicates.length > 0) {
      return {
        ruleType: this.type,
        ruleName: this.name,
        passed: false,
        message: `本批次内存在${duplicates.length}条相同记录`,
        suggestion: '请检查数据来源，去重后重新提交',
        details: { duplicateCount: duplicates.length }
      };
    }

    return {
      ruleType: this.type,
      ruleName: this.name,
      passed: true,
      message: '本批次内无重复记录'
    };
  }

  private generateRecordKey(record: UnifiedRecord, sourceType: DataSourceType): string {
    switch (sourceType) {
      case 'alarm':
        const a = record as LightAlarm;
        return `${a.poleId}_${a.lampId}_${a.alarmTime}_${a.alarmType}`;
      case 'inspection':
        const i = record as InspectionRecord;
        return `${i.poleId}_${i.inspector}_${i.inspectionTime}`;
      case 'maintenance':
        const m = record as MaintenanceOrder;
        return `${m.poleId}_${m.reporter}_${m.reportTime}_${m.repairType}`;
    }
  }
}

export class RuleEngine {
  private rules: IRule[];

  constructor() {
    this.rules = [
      new DataValidationRule(),
      new DuplicateCheckRule(),
      new SamePoleMultiLampRule(),
      new FalsePositiveFilterRule(),
      new RepairRetestRule()
    ];
  }

  applyAllRules(record: UnifiedRecord, context: RuleContext): RuleResult[] {
    return this.rules.map(rule => rule.apply(record, context));
  }

  determineStatus(ruleResults: RuleResult[]): {
    status: ProcessedRecord['status'];
    suggestion: string;
  } {
    const failedRules = ruleResults.filter(r => !r.passed);
    const criticalFailures = failedRules.filter(r => r.ruleType === 'data_validation');
    
    if (criticalFailures.length > 0) {
      return {
        status: 'failed',
        suggestion: criticalFailures.map(r => r.suggestion).filter(Boolean).join('; ') || '数据校验失败，需重新提交'
      };
    }

    if (failedRules.length > 0) {
      const hasPendingRule = failedRules.some(r => 
        ['false_positive_filter', 'same_pole_multi_lamp'].includes(r.ruleType)
      );
      
      if (hasPendingRule) {
        return {
          status: 'pending',
          suggestion: failedRules.map(r => r.suggestion).filter(Boolean).join('; ') || '需人工确认后继续处理'
        };
      }

      return {
        status: 'failed',
        suggestion: failedRules.map(r => r.suggestion).filter(Boolean).join('; ') || '存在未通过的规则检查'
      };
    }

    return {
      status: 'normal',
      suggestion: '所有规则校验通过，可正常处理'
    };
  }

  getRuleDescriptions(): Array<{
    type: RuleType;
    name: string;
    description: string;
  }> {
    return this.rules.map(r => ({
      type: r.type,
      name: r.name,
      description: r.description
    }));
  }
}

export const ruleEngine = new RuleEngine();
