import { get, all, run } from '../database';
import { AuditBatch, AuditResult } from '../types';
import { createObjectCsvWriter } from 'csv-writer';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function generateReportSummary(batchId: string): Promise<{
  summary: string;
  nextSteps: string;
  beforeAfterComparison: Array<{
    recordId: number;
    originalLineNo: number;
    recordType: string;
    before: any;
    after?: any;
    status: string;
  }>;
}> {
  const batch = await get<AuditBatch>('SELECT * FROM audit_batches WHERE batchId = ?', [batchId]);
  const results = await all<AuditResult>('SELECT * FROM audit_results WHERE batchId = ?', [batchId]);

  const beforeAfterComparison = results.map(result => ({
    recordId: result.recordId,
    originalLineNo: result.originalLineNo,
    recordType: result.recordType,
    before: JSON.parse(result.beforeData),
    after: result.afterData ? JSON.parse(result.afterData) : undefined,
    status: result.status,
  }));

  const anomalyCount = results.filter(r => r.status === 'warning' || r.status === 'failed').length;
  const timeAnomalies = results.filter(r => r.errorCode === 'TIME_ANOMALY').length;
  const remarkCount = results.filter(r => r.errorCode === 'HAS_MANUAL_REMARK').length;

  const summary = `
审计批次 ${batchId} 报告摘要
========================================
执行时间: ${batch?.startTime} 至 ${batch?.endTime}
耗时: ${batch?.executionTimeMs}ms
总计处理: ${batch?.totalCount} 条记录
- 成功: ${batch?.successCount} 条
- 警告: ${batch?.warningCount} 条
- 失败: ${batch?.failedCount} 条

异常详情:
- 时间顺序异常: ${timeAnomalies} 条
- 含人工备注需复核: ${remarkCount} 条
========================================
  `.trim();

  let nextSteps = '';
  if (timeAnomalies > 0) {
    nextSteps += '1. 优先复核时间顺序异常的证书签发记录，确认是否为系统bug或人为录入错误\n';
  }
  if (remarkCount > 0) {
    nextSteps += '2. 与班车预约申请人沟通，确认人工备注中的特殊需求\n';
  }
  if (anomalyCount === 0) {
    nextSteps += '1. 本次审计未发现异常，可按正常流程归档\n';
  }
  nextSteps += '3. 将异常样本导出并分享给相关同事进行二次复核\n';
  nextSteps += '4. 建议每周进行一次定期审计，及时发现潜在问题';

  await run(
    'UPDATE audit_batches SET reportSummary = ?, nextSteps = ? WHERE batchId = ?',
    [summary, nextSteps, batchId]
  );

  return { summary, nextSteps, beforeAfterComparison };
}

export async function exportAnomaliesToCsv(batchId: string, outputPath?: string): Promise<string> {
  const anomalies = await all<AuditResult>(
    'SELECT * FROM audit_results WHERE batchId = ? AND (status = ? OR status = ?) ORDER BY originalLineNo',
    [batchId, 'warning', 'failed']
  );

  if (!outputPath) {
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    outputPath = path.join(exportDir, `${batchId}-anomalies-${Date.now()}.csv`);
  }

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'originalLineNo', title: '原始行号' },
      { id: 'recordType', title: '记录类型' },
      { id: 'status', title: '状态' },
      { id: 'errorCode', title: '错误码' },
      { id: 'errorMessage', title: '错误信息' },
      { id: 'beforeData', title: '处理前数据' },
      { id: 'remarks', title: '备注' },
      { id: 'executedAt', title: '执行时间' },
    ],
  });

  await csvWriter.writeRecords(anomalies.map(a => ({
    ...a,
    beforeData: a.beforeData.substring(0, 200) + (a.beforeData.length > 200 ? '...' : ''),
  })));

  return outputPath;
}

export async function exportFullReportToExcel(batchId: string, outputPath?: string): Promise<string> {
  const batch = await get<AuditBatch>('SELECT * FROM audit_batches WHERE batchId = ?', [batchId]);
  const results = await all<AuditResult>('SELECT * FROM audit_results WHERE batchId = ? ORDER BY originalLineNo', [batchId]);

  if (!outputPath) {
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    outputPath = path.join(exportDir, `${batchId}-full-report-${Date.now()}.xlsx`);
  }

  const summaryData = [
    { '项目': '批次ID', '值': batch?.batchId },
    { '项目': '开始时间', '值': batch?.startTime },
    { '项目': '结束时间', '值': batch?.endTime },
    { '项目': '执行耗时(ms)', '值': batch?.executionTimeMs },
    { '项目': '总记录数', '值': batch?.totalCount },
    { '项目': '成功数', '值': batch?.successCount },
    { '项目': '警告数', '值': batch?.warningCount },
    { '项目': '失败数', '值': batch?.failedCount },
    { '项目': '整体状态', '值': batch?.status },
  ];

  const detailData = results.map(r => ({
    '原始行号': r.originalLineNo,
    '记录类型': r.recordType,
    '状态': r.status,
    '错误码': r.errorCode || '',
    '错误信息': r.errorMessage || '',
    '处理前': r.beforeData,
    '处理后': r.afterData || '',
    '备注': r.remarks || '',
    '执行时间': r.executedAt,
  }));

  const wb = XLSX.utils.book_new();
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  const detailWs = XLSX.utils.json_to_sheet(detailData);

  XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');
  XLSX.utils.book_append_sheet(wb, detailWs, '明细');

  XLSX.writeFile(wb, outputPath);

  return outputPath;
}

export async function getAnomalyRecords(batchId: string): Promise<AuditResult[]> {
  return await all<AuditResult>(
    'SELECT * FROM audit_results WHERE batchId = ? AND (status = ? OR status = ?) ORDER BY originalLineNo',
    [batchId, 'warning', 'failed']
  );
}
