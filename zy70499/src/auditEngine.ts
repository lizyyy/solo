import {
  LaboratorySample,
  AuditRule,
  AuditContext,
  AuditRecord,
  AuditBatch,
  FailedItem,
  SummaryItem
} from './types';
import { getRuleByVersion, getLatestRule } from './rules';
import * as crypto from 'crypto';

function generateBatchId(): string {
  return `BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function correctSample(sample: LaboratorySample): LaboratorySample {
  const corrected = { ...sample };
  
  if (sample.gatewayError) {
    corrected.status = 'pending';
    delete corrected.gatewayError;
  }
  
  const pattern = /^LAB-\d{8}-\d{4}$/;
  if (!pattern.test(sample.sampleNo)) {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    corrected.sampleNo = `LAB-${dateStr}-${String(1000 + Math.floor(Math.random() * 9000)).padStart(4, '0')}`;
  }
  
  corrected.status = 'pending';
  
  return corrected;
}

export function auditSample(
  sample: LaboratorySample,
  rule: AuditRule,
  context: AuditContext
): AuditRecord {
  const checks = rule.checks.map(check => ({
    ruleId: check.id,
    ruleName: check.name,
    result: check.check(sample, context)
  }));
  
  const hasError = checks.some(c => c.result.severity === 'error' && !c.result.passed);
  const hasWarning = checks.some(c => c.result.severity === 'warning' && !c.result.passed);
  
  let overallStatus: 'success' | 'warning' | 'failed' = 'success';
  if (hasError) {
    overallStatus = 'failed';
  } else if (hasWarning) {
    overallStatus = 'warning';
  }
  
  const record: AuditRecord = {
    sampleId: sample.id,
    sampleNo: sample.sampleNo,
    checks,
    overallStatus,
    beforeData: { ...sample }
  };
  
  if (overallStatus !== 'success') {
    record.afterData = correctSample(sample);
  }
  
  return record;
}

export function auditBatch(
  samples: LaboratorySample[],
  ruleVersion?: string
): AuditBatch {
  const startTime = Date.now();
  const batchId = generateBatchId();
  const rule = ruleVersion ? getRuleByVersion(ruleVersion) : getLatestRule();
  
  if (!rule) {
    throw new Error(`未找到规则版本: ${ruleVersion}`);
  }
  
  const context: AuditContext = {
    batchId,
    ruleVersion: rule.version,
    auditTime: new Date().toISOString(),
    allSamples: samples
  };
  
  const records = samples.map(sample => auditSample(sample, rule, context));
  
  const successCount = records.filter(r => r.overallStatus === 'success').length;
  const warningCount = records.filter(r => r.overallStatus === 'warning').length;
  const failedCount = records.filter(r => r.overallStatus === 'failed').length;
  
  const failedItems: FailedItem[] = records
    .filter(r => r.overallStatus === 'failed')
    .map(record => {
      const sample = samples.find(s => s.id === record.sampleId)!;
      const errors = record.checks
        .filter(c => !c.result.passed)
        .map(c => ({
          ruleId: c.ruleId,
          ruleName: c.ruleName,
          message: c.result.message
        }));
      
      return {
        sampleId: record.sampleId,
        sampleNo: record.sampleNo,
        errors,
        rawData: sample,
        suggestion: generateSuggestion(errors, sample)
      };
    });
  
  const summaries: SummaryItem[] = records
    .filter(r => r.beforeData.gatewayError)
    .map(record => {
      const sample = samples.find(s => s.id === record.sampleId)!;
      return {
        sampleNo: record.sampleNo,
        exception: sample.gatewayError || '未知异常',
        correction: '已清除网关错误标记，样本状态重置为待检测，建议重新提交或人工复核',
        conclusion: '样本数据本身有效，仅为传输层问题，修正后可继续正常处理流程'
      };
    });
  
  const nextSteps = generateNextSteps(records, failedCount, warningCount);
  
  const endTime = Date.now();
  
  return {
    batchId,
    ruleVersion: rule.version,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    executionTimeMs: endTime - startTime,
    totalCount: samples.length,
    successCount,
    warningCount,
    failedCount,
    records,
    failedItems,
    nextSteps
  };
}

function generateSuggestion(errors: { ruleId: string; ruleName: string; message: string }[], sample: LaboratorySample): string {
  const suggestions: string[] = [];
  
  if (errors.some(e => e.ruleId === 'R001')) {
    suggestions.push('请修正样本编号格式为 LAB-YYYYMMDD-XXXX');
  }
  if (errors.some(e => e.ruleId === 'R002')) {
    suggestions.push('请删除重复提交记录，保留最新一条并确认数据一致性');
  }
  if (errors.some(e => e.ruleId === 'R005')) {
    suggestions.push('建议检查网络连接稳定性，重试提交并监控网关状态');
  }
  if (errors.some(e => e.ruleId === 'R004')) {
    suggestions.push('请补充至少一项检测项目后重新提交');
  }
  
  return suggestions.length > 0 ? suggestions.join('；') : '请联系技术支持人员进行人工复核';
}

function generateNextSteps(records: AuditRecord[], failedCount: number, warningCount: number): string[] {
  const steps: string[] = [];
  
  if (failedCount > 0) {
    steps.push(`优先处理 ${failedCount} 个失败样本，详见失败项目清单`);
  }
  
  const duplicateCount = records.filter(r =>
    r.checks.some(c => c.ruleId === 'R002' && !c.result.passed)
  ).length;
  if (duplicateCount > 0) {
    steps.push(`重点核查 ${duplicateCount} 例重复提交情况，确认是否为系统自动重试导致`);
  }
  
  const gatewayErrorCount = records.filter(r => r.beforeData.gatewayError).length;
  if (gatewayErrorCount > 0) {
    steps.push(`排查 ${gatewayErrorCount} 例网关错误原因，检查上游服务健康状态`);
  }
  
  if (warningCount > 0) {
    steps.push(`关注 ${warningCount} 个警告项，建议在24小时内完成人工复核`);
  }
  
  steps.push('所有修正后的样本需重新执行审计流程确认问题已解决');
  steps.push('定期统计失败类型，优化系统设计以降低同类问题复发');
  
  return steps;
}

export function queryRecordsByStatus(batch: AuditBatch, status: 'success' | 'warning' | 'failed'): AuditRecord[] {
  return batch.records.filter(r => r.overallStatus === status);
}

export function queryRecordsBySampleNo(batch: AuditBatch, sampleNo: string): AuditRecord | undefined {
  return batch.records.find(r => r.sampleNo === sampleNo);
}

export function queryRecordsByRuleId(batch: AuditBatch, ruleId: string): AuditRecord[] {
  return batch.records.filter(r => r.checks.some(c => c.ruleId === ruleId && !c.result.passed));
}
