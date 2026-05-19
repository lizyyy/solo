import { DataCategory, CriticalValueRecord } from '../models/CriticalValueRecord';

export interface ClassificationResult {
  category: DataCategory;
  reason: string;
  supplementRequirements?: string;
  blockReason?: string;
  followUpAction: string;
}

export class ClassificationService {
  classifyRecord(record: Partial<CriticalValueRecord>): ClassificationResult {
    const issues: string[] = [];
    const missingFields: string[] = [];

    if (!record.patientId) missingFields.push('患者ID');
    if (!record.patientName) missingFields.push('患者姓名');
    if (!record.department) missingFields.push('科室');
    if (!record.testItem) missingFields.push('检验项目');
    if (!record.testValue) missingFields.push('检验值');
    if (!record.testTime) missingFields.push('检验时间');

    if (missingFields.length > 0) {
      return {
        category: DataCategory.PENDING_SUPPLEMENT,
        reason: '关键信息缺失',
        supplementRequirements: `请补充以下信息：${missingFields.join('、')}`,
        followUpAction: '通知检验科夜班组补充缺失信息，补充后重新提交'
      };
    }

    if (!this.isValidTestValue(record.testValue, record.referenceRange)) {
      issues.push('检验值格式异常');
    }

    if (!this.isWithinBusinessHours(record.testTime)) {
      issues.push('非工作时间报告需特殊处理');
    }

    if (this.isHighRiskItem(record.testItem) && !record.doctorConfirmer) {
      issues.push('高风险项目缺少医生确认人');
    }

    if (this.shouldBlock(record)) {
      return {
        category: DataCategory.BLOCKED,
        reason: '数据存在严重问题，已拦截',
        blockReason: issues.join('；'),
        followUpAction: '转入人工审核流程，由值班组长确认处理方式'
      };
    }

    if (issues.length > 0) {
      return {
        category: DataCategory.PENDING_SUPPLEMENT,
        reason: `存在${issues.length}个待确认问题`,
        supplementRequirements: issues.join('；'),
        followUpAction: '通知相关人员确认问题并补充信息'
      };
    }

    return {
      category: DataCategory.NORMAL,
      reason: '数据完整且符合规范',
      followUpAction: '自动进入短信通知和电话回告流程'
    };
  }

  private isValidTestValue(value: string, referenceRange?: string): boolean {
    if (!value) return false;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    return true;
  }

  private isWithinBusinessHours(testTime: Date): boolean {
    const hour = testTime.getHours();
    return hour >= 8 && hour < 18;
  }

  private isHighRiskItem(testItem: string): boolean {
    const highRiskItems = [
      '血钾', '血钙', '血糖', '血气分析', '心肌酶谱',
      '肌钙蛋白', '凝血功能', '血小板计数', '白细胞计数'
    ];
    return highRiskItems.some(item => testItem.includes(item));
  }

  private shouldBlock(record: Partial<CriticalValueRecord>): boolean {
    if (record.testValue) {
      const value = parseFloat(record.testValue);
      if (record.testItem.includes('血钾')) {
        if (value < 2.5 || value > 6.5) return true;
      }
      if (record.testItem.includes('血糖')) {
        if (value < 2.2 || value > 22.2) return true;
      }
    }
    return false;
  }

  getCategoryDescription(category: DataCategory): string {
    const descriptions = {
      [DataCategory.NORMAL]: '数据完整规范，可自动处理',
      [DataCategory.PENDING_SUPPLEMENT]: '信息不全或存在疑问，需补充后继续处理',
      [DataCategory.BLOCKED]: '存在严重风险或异常，需人工审核确认'
    };
    return descriptions[category];
  }
}
