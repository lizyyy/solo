import { BoundaryReport, BoundarySample, NextAction } from '../types';

const statusDescriptions: Record<string, string> = {
  pending_ta: '待学生助教复核',
  ta_verified: '学生助教已确认',
  pending_coach: '待竞赛教练唐老师复核',
  coach_verified: '唐老师已确认',
  resolved: '已解决',
  dismissed: '已驳回',
};

const nextActionDescriptions: Record<NextAction, string> = {
  find_ta: '请联系学生助教补充材料或复核',
  find_coach: '请联系竞赛教练唐老师进行最终确认',
  collect_more_data: '需要收集更多现场数据补充完整',
  resolve: '可以标记为已解决',
  dismiss: '可以驳回该样本',
};

export function formatBoundaryReport(report: BoundaryReport): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push('排队论窗口配置 - 边界样本报告');
  lines.push(`报告编号: ${report.reportId}`);
  lines.push(`生成时间: ${report.generatedAt.toLocaleString('zh-CN')}`);
  lines.push('='.repeat(80));
  lines.push('');
  
  lines.push('【统计概览】');
  lines.push(`  总样本数: ${report.statistics.total}`);
  lines.push(`  待学生助教: ${report.statistics.pendingTa}`);
  lines.push(`  待唐老师: ${report.statistics.pendingCoach}`);
  lines.push(`  已确认: ${report.statistics.verified}`);
  lines.push(`  已解决: ${report.statistics.resolved}`);
  lines.push('');
  
  if (report.boundarySamples.length === 0) {
    lines.push('暂无边界样本');
    return lines.join('\n');
  }
  
  lines.push('【边界样本详情】');
  lines.push('-'.repeat(80));
  
  for (const sample of report.boundarySamples) {
    lines.push(formatSingleSample(sample));
    lines.push('-'.repeat(80));
  }
  
  lines.push('');
  lines.push('【报告说明】');
  lines.push('  - 负数样本被旧表当成缺失时，请先联系学生助教复核数据');
  lines.push('  - 涉及排队溢出、临时关窗等特殊情况，请唐老师最终确认');
  lines.push('  - 补录问卷原始行后，报告将自动更新');
  
  return lines.join('\n');
}

function formatSingleSample(sample: BoundarySample): string {
  const lines: string[] = [];
  
  lines.push(`样本ID: ${sample.sampleId}`);
  lines.push(`状态: ${statusDescriptions[sample.status] || sample.status}`);
  lines.push(`创建时间: ${sample.createdAt.toLocaleString('zh-CN')}`);
  lines.push(`更新时间: ${sample.updatedAt.toLocaleString('zh-CN')}`);
  lines.push('');
  
  lines.push('> 负数样本信息:');
  lines.push(`  检测来源: ${sample.negativeSample.detectedBy === 'old_table' ? '旧表系统' : '系统检测'}`);
  lines.push(`  异常原因: ${sample.negativeSample.reason}`);
  lines.push(`  异常值: ${sample.negativeSample.value}`);
  lines.push(`  是否标记为缺失: ${sample.negativeSample.isMarkedAsMissing ? '是 ⚠️' : '否'}`);
  lines.push('');
  
  if (sample.manualCounterExample) {
    lines.push('> 手算反例（主流程证据）:');
    lines.push(`  窗口号: ${sample.manualCounterExample.windowNumber}`);
    lines.push(`  时间: ${sample.manualCounterExample.timestamp.toLocaleString('zh-CN')}`);
    lines.push(`  到达人数: ${sample.manualCounterExample.arrivalCount}`);
    lines.push(`  服务时间: ${sample.manualCounterExample.serviceTime}分钟`);
    lines.push(`  等待时间: ${sample.manualCounterExample.waitTime}分钟`);
    if (sample.manualCounterExample.mainProcessEvidence) {
      lines.push(`  主流程证据: ${sample.manualCounterExample.mainProcessEvidence}`);
    }
    lines.push('');
  }
  
  if (sample.questionnaireRow) {
    lines.push('> 问卷原始行（现场说法）:');
    lines.push(`  窗口号: ${sample.questionnaireRow.windowNumber}`);
    lines.push(`  时间: ${sample.questionnaireRow.timestamp.toLocaleString('zh-CN')}`);
    lines.push(`  现场说法: ${sample.questionnaireRow.onSiteStatement}`);
    lines.push(`  证人: ${sample.questionnaireRow.witnessName}`);
    lines.push(`  午休: ${sample.questionnaireRow.hasBreak ? '是' : '否'}`);
    lines.push(`  临时关窗: ${sample.questionnaireRow.isTemporaryClosed ? '是 ⚠️' : '否'}`);
    lines.push(`  排队溢出: ${sample.questionnaireRow.queueOverflow ? '是 ⚠️' : '否'}`);
    lines.push(`  实际等待时间: ${sample.questionnaireRow.actualWaitTime}分钟`);
    lines.push(`  实际到达人数: ${sample.questionnaireRow.actualArrivalCount}人`);
    lines.push('');
  }
  
  lines.push(`> 为什么留下: ${sample.whyKept}`);
  lines.push('');
  
  if (sample.missingMaterials.length > 0) {
    lines.push('> 还缺什么材料:');
    for (const material of sample.missingMaterials) {
      lines.push(`  ⭕ ${material}`);
    }
    lines.push('');
  }
  
  lines.push(`> 下一步: ${nextActionDescriptions[sample.nextAction]}`);
  
  if (sample.assignee) {
    lines.push(`> 当前负责人: ${sample.assignee}`);
  }
  
  if (sample.taReviewNotes) {
    lines.push(`> 学生助教备注: ${sample.taReviewNotes}`);
  }
  
  if (sample.coachReviewNotes) {
    lines.push(`> 唐老师备注: ${sample.coachReviewNotes}`);
  }
  
  return lines.join('\n');
}

export function generateHTMLReport(report: BoundaryReport): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>排队论窗口配置 - 边界样本报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4a90d9; padding-bottom: 10px; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card .number { font-size: 32px; font-weight: bold; }
    .stat-card .label { font-size: 14px; opacity: 0.9; }
    .sample-card { border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
    .sample-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
    .sample-id { font-weight: bold; color: #333; }
    .status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-pending_ta { background: #fff3cd; color: #856404; }
    .status-pending_coach { background: #cce5ff; color: #004085; }
    .status-coach_verified { background: #d4edda; color: #155724; }
    .status-dismissed { background: #f8d7da; color: #721c24; }
    .sample-body { padding: 20px; }
    .section { margin-bottom: 15px; }
    .section-title { font-weight: 600; color: #4a90d9; margin-bottom: 8px; }
    .evidence-box { background: #fff8e1; border-left: 4px solid #ff9800; padding: 10px 15px; margin: 10px 0; }
    .missing-item { color: #e65100; }
    .next-action { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 10px 15px; font-weight: 500; }
    .assignee { display: inline-block; background: #4a90d9; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>排队论窗口配置 - 边界样本报告</h1>
    <p style="color: #666; margin-bottom: 20px;">报告编号: ${report.reportId} | 生成时间: ${report.generatedAt.toLocaleString('zh-CN')}</p>
    
    <div class="stats">
      <div class="stat-card"><div class="number">${report.statistics.total}</div><div class="label">总样本数</div></div>
      <div class="stat-card"><div class="number">${report.statistics.pendingTa}</div><div class="label">待学生助教</div></div>
      <div class="stat-card"><div class="number">${report.statistics.pendingCoach}</div><div class="label">待唐老师</div></div>
      <div class="stat-card"><div class="number">${report.statistics.verified}</div><div class="label">已确认</div></div>
      <div class="stat-card"><div class="number">${report.statistics.resolved}</div><div class="label">已解决</div></div>
    </div>
    
    <h2 style="margin: 30px 0 20px; color: #333;">边界样本详情</h2>
    
    ${report.boundarySamples.map(sample => `
      <div class="sample-card">
        <div class="sample-header">
          <span class="sample-id">样本: ${sample.sampleId}</span>
          <span class="status status-${sample.status}">${statusDescriptions[sample.status] || sample.status}</span>
        </div>
        <div class="sample-body">
          <div class="section">
            <div class="section-title">负数样本信息</div>
            <div class="evidence-box">
              <strong>异常原因:</strong> ${sample.negativeSample.reason}<br>
              <strong>检测来源:</strong> ${sample.negativeSample.detectedBy === 'old_table' ? '旧表系统' : '系统检测'}<br>
              <strong>是否标记为缺失:</strong> ${sample.negativeSample.isMarkedAsMissing ? '是 ⚠️' : '否'}
            </div>
          </div>
          
          ${sample.manualCounterExample ? `
          <div class="section">
            <div class="section-title">手算反例（主流程证据）</div>
            <div>窗口号: ${sample.manualCounterExample.windowNumber} | 时间: ${sample.manualCounterExample.timestamp.toLocaleString('zh-CN')}</div>
            <div>到达人数: ${sample.manualCounterExample.arrivalCount} | 等待时间: ${sample.manualCounterExample.waitTime}分钟</div>
            ${sample.manualCounterExample.mainProcessEvidence ? `<div class="evidence-box">主流程证据: ${sample.manualCounterExample.mainProcessEvidence}</div>` : ''}
          </div>
          ` : ''}
          
          ${sample.questionnaireRow ? `
          <div class="section">
            <div class="section-title">问卷原始行（现场说法）</div>
            <div class="evidence-box" style="background: #e8f5e9; border-left-color: #4caf50;">
              <strong>现场说法:</strong> ${sample.questionnaireRow.onSiteStatement}<br>
              <strong>证人:</strong> ${sample.questionnaireRow.witnessName}
            </div>
            <div>临时关窗: ${sample.questionnaireRow.isTemporaryClosed ? '是 ⚠️' : '否'} | 排队溢出: ${sample.questionnaireRow.queueOverflow ? '是 ⚠️' : '否'}</div>
          </div>
          ` : ''}
          
          <div class="section">
            <div class="section-title">为什么留下</div>
            <div>${sample.whyKept}</div>
          </div>
          
          ${sample.missingMaterials.length > 0 ? `
          <div class="section">
            <div class="section-title">还缺什么材料</div>
            ${sample.missingMaterials.map(m => `<div class="missing-item">⭕ ${m}</div>`).join('')}
          </div>
          ` : ''}
          
          <div class="next-action">
            <strong>下一步:</strong> ${nextActionDescriptions[sample.nextAction]}
            ${sample.assignee ? `<div class="assignee">当前负责人: ${sample.assignee}</div>` : ''}
          </div>
          
          ${sample.taReviewNotes ? `<div class="section"><div class="section-title">学生助教备注</div><div>${sample.taReviewNotes}</div></div>` : ''}
          ${sample.coachReviewNotes ? `<div class="section"><div class="section-title">唐老师备注</div><div>${sample.coachReviewNotes}</div></div>` : ''}
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
}

export function saveReportToFile(report: BoundaryReport, filePath: string, format: 'txt' | 'html' = 'txt'): void {
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const content = format === 'html' ? generateHTMLReport(report) : formatBoundaryReport(report);
  fs.writeFileSync(filePath, content, 'utf-8');
}
