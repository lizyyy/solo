import { Parser } from 'json2csv';
import { Operation, RiskLevel, OperationStatus } from '../types';
import { getAllOperationsForExport, getRiskLevelDescription, getStatusDescription } from './operationService';

interface ExportRecord {
  操作单号: string;
  操作标题: string;
  操作描述: string;
  操作对象: string;
  对象类型: string;
  风险等级: string;
  风险说明: string;
  当前状态: string;
  状态说明: string;
  执行人ID: string;
  执行人姓名: string;
  复核人ID: string;
  复核人姓名: string;
  计划执行时间: string;
  实际开始时间: string;
  完成时间: string;
  执行耗时: string;
  操作结果: string;
  错误信息: string;
  是否有修正记录: string;
  修正次数: number;
  创建时间: string;
  最后更新时间: string;
}

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function calculateDuration(start: Date | null, end: Date | null): string {
  if (!start || !end) return '-';
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  
  if (diffMins > 60) {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}小时${mins}分${diffSecs}秒`;
  }
  return `${diffMins}分${diffSecs}秒`;
}

function transformOperationForExport(op: Operation): ExportRecord {
  return {
    操作单号: op.operationNo,
    操作标题: op.title,
    操作描述: op.description,
    操作对象: op.resourceObject,
    对象类型: op.resourceType,
    风险等级: op.riskLevel,
    风险说明: getRiskLevelDescription(op.riskLevel),
    当前状态: op.status,
    状态说明: getStatusDescription(op.status),
    执行人ID: op.executorId,
    执行人姓名: op.executorName,
    复核人ID: op.reviewerId || '-',
    复核人姓名: op.reviewerName || '-',
    计划执行时间: formatDate(op.planExecuteTime),
    实际开始时间: formatDate(op.actualExecuteTime),
    完成时间: formatDate(op.completeTime),
    执行耗时: calculateDuration(op.actualExecuteTime, op.completeTime),
    操作结果: op.operationResult || '-',
    错误信息: op.errorMessage || '-',
    是否有修正记录: op.correctionHistory.length > 0 ? '是' : '否',
    修正次数: op.correctionHistory.length,
    创建时间: formatDate(op.createdAt),
    最后更新时间: formatDate(op.updatedAt)
  };
}

export async function exportToCSV(filter: { startDate?: string; endDate?: string } = {}): Promise<string> {
  const operations = await getAllOperationsForExport(filter);
  const records = operations.map(transformOperationForExport);
  
  const parser = new Parser<ExportRecord>({
    encoding: 'utf-8',
    withBOM: true
  });
  
  return parser.parse(records);
}

export async function exportToJSON(filter: { startDate?: string; endDate?: string } = {}): Promise<string> {
  const operations = await getAllOperationsForExport(filter);
  const records = operations.map(op => ({
    ...transformOperationForExport(op),
    原始请求数据: op.rawInput,
    修正记录: op.correctionHistory.map(c => ({
      修正人: c.correctorName,
      修正原因: c.correctionReason,
      修正时间: formatDate(c.createdAt),
      原始数据: c.originalData,
      修正后数据: c.correctedData
    }))
  }));
  
  return JSON.stringify(records, null, 2);
}

export function generateStatistics(operations: Operation[]) {
  const total = operations.length;
  const success = operations.filter(o => o.status === OperationStatus.SUCCESS).length;
  const failed = operations.filter(o => o.status === OperationStatus.FAILED).length;
  const aborted = operations.filter(o => o.status === OperationStatus.ABORTED).length;
  const inProgress = operations.filter(o => 
    [OperationStatus.CREATED, OperationStatus.CONFIRMED, 
     OperationStatus.LOCKED, OperationStatus.EXECUTING,
     OperationStatus.NEEDS_MANUAL_CORRECTION].includes(o.status)
  ).length;
  
  const riskLevelStats = {
    [RiskLevel.LOW]: operations.filter(o => o.riskLevel === RiskLevel.LOW).length,
    [RiskLevel.MEDIUM]: operations.filter(o => o.riskLevel === RiskLevel.MEDIUM).length,
    [RiskLevel.HIGH]: operations.filter(o => o.riskLevel === RiskLevel.HIGH).length,
    [RiskLevel.CRITICAL]: operations.filter(o => o.riskLevel === RiskLevel.CRITICAL).length
  };
  
  const operationsWithCorrections = operations.filter(o => o.correctionHistory.length > 0).length;
  
  return {
    总操作数: total,
    成功数: success,
    失败数: failed,
    中止数: aborted,
    进行中数: inProgress,
    成功率: total > 0 ? `${((success / total) * 100).toFixed(2)}%` : '0%',
    风险等级分布: riskLevelStats,
    有修正记录数: operationsWithCorrections,
    修正率: total > 0 ? `${((operationsWithCorrections / total) * 100).toFixed(2)}%` : '0%'
  };
}

export async function exportStatisticsReport(filter: { startDate?: string; endDate?: string } = {}): Promise<string> {
  const operations = await getAllOperationsForExport(filter);
  const stats = generateStatistics(operations);
  
  const dateRange = filter.startDate && filter.endDate
    ? `${filter.startDate} 至 ${filter.endDate}`
    : '全部时间';
  
  const report = `
=============================================================================
                    运维操作双人确认系统 - 统计报告
                    报告时间: ${new Date().toLocaleString('zh-CN')}
                    统计范围: ${dateRange}
=============================================================================

一、总体统计
─────────────────────────────────────────────────────────────────────────────
  总操作数: ${stats.总操作数} 次
  成功: ${stats.成功数} 次 (${stats.成功率})
  失败: ${stats.失败数} 次
  中止: ${stats.中止数} 次
  进行中: ${stats.进行中数} 次

二、风险等级分布
─────────────────────────────────────────────────────────────────────────────
  低风险: ${stats.风险等级分布.low} 次
  中风险: ${stats.风险等级分布.medium} 次
  高风险: ${stats.风险等级分布.high} 次
  高危: ${stats.风险等级分布.critical} 次

三、人工修正统计
─────────────────────────────────────────────────────────────────────────────
  有修正记录: ${stats.有修正记录数} 次 (${stats.修正率})

=============================================================================
                              报告结束
=============================================================================
  `;
  
  return report;
}
