import { BoundaryReport, BoundarySample, NextAction, ReviewLogEntry } from '../types';

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

const logActionLabels: Record<ReviewLogEntry['action'], string> = {
  detected: '检测到负数样本',
  created: '创建边界样本',
  ta_review: '学生助教复核',
  coach_review: '唐老师复核',
  supplement: '补录数据',
  dismissed: '驳回',
  resolved: '解决',
  reopened: '重新打开',
};

export function formatBoundaryReport(report: BoundaryReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('排队论窗口配置 - 边界样本报告');
  lines.push(`报告编号: ${report.reportId}`);
  lines.push(`生成时间: ${report.generatedAt.toLocaleString('zh-CN')}`);
  lines.push(`数据基于: ${report.boundarySamples.length} 条同一份最新状态`);
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
    lines.push('暂无边界样本（总样本数: 0）');
    lines.push('');
    lines.push('  提示：');
    lines.push('  1. 使用 queue-config import 导入手算反例数据');
    lines.push('  2. 系统会自动检测负数样本并创建边界样本');
    lines.push('  3. 再运行 queue-config report 即可查看报告');
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
  lines.push('  - 补录问卷原始行后，报告将自动更新（基于同一份持久化数据）');
  lines.push('  - 原始负数证据会被保留，不会提前归入正常结果；人工复核后才更新');

  return lines.join('\n');
}

function formatOriginalCorrectedDelta(sample: BoundarySample): string[] {
  const lines: string[] = [];
  const orig = sample.originalNegativeValues;
  const hasOrig = orig?.waitTime !== undefined || orig?.arrivalCount !== undefined;
  if (!hasOrig) return lines;

  lines.push('');
  lines.push('> 原始负数值 ↔ 修正后对比（保留原始说法，不归入正常）:');
  if (orig.waitTime !== undefined) {
    const corrected =
      sample.dataResolution?.finalWaitTime ??
      sample.questionnaireRow?.actualWaitTime ??
      sample.manualCounterExample?.waitTime;
    lines.push(
      `  等待时间: 原始负数=${orig.waitTime}分钟  →  修正后=${corrected !== undefined ? corrected + '分钟' : '(未确定)'}`
    );
  }
  if (orig.arrivalCount !== undefined) {
    const corrected =
      sample.dataResolution?.finalArrivalCount ??
      sample.questionnaireRow?.actualArrivalCount ??
      sample.manualCounterExample?.arrivalCount;
    lines.push(
      `  到达人数: 原始负数=${orig.arrivalCount}人  →  修正后=${corrected !== undefined ? corrected + '人' : '(未确定)'}`
    );
  }
  return lines;
}

function formatReviewHistory(sample: BoundarySample): string[] {
  const lines: string[] = [];
  if (!sample.reviewLog || sample.reviewLog.length === 0) return lines;

  lines.push('');
  lines.push('> 复核历史记录（按时间顺序，基于同一条样本的完整轨迹）:');
  for (const log of sample.reviewLog) {
    const actionLabel = logActionLabels[log.action] || log.action;
    const statusPart =
      log.statusBefore && log.statusAfter
        ? `  [${statusDescriptions[log.statusBefore] || log.statusBefore} → ${statusDescriptions[log.statusAfter] || log.statusAfter}]`
        : '';
    lines.push(`  - ${new Date(log.timestamp).toLocaleString('zh-CN')}  ${log.operator}执行【${actionLabel}】${statusPart}`);
    if (log.notes) lines.push(`      备注: ${log.notes}`);
    if (log.reason) lines.push(`      原因: ${log.reason}`);
    if (log.rawStatementAdded) lines.push(`      ☑ 补录了现场说法（问卷原始行）`);
    if (log.correctedWaitTime !== undefined || log.correctedArrivalCount !== undefined) {
      const parts: string[] = [];
      if (log.correctedWaitTime !== undefined) parts.push(`等待时间=${log.correctedWaitTime}分钟`);
      if (log.correctedArrivalCount !== undefined) parts.push(`到达人数=${log.correctedArrivalCount}人`);
      lines.push(`      录入值: ${parts.join('，')}`);
    }
  }
  return lines;
}

function formatResolution(sample: BoundarySample): string[] {
  const lines: string[] = [];
  if (!sample.dataResolution) return lines;

  lines.push('');
  lines.push('> 最终处理结果（唐老师确认后归档，不进正常统计）:');
  if (sample.dataResolution.finalWaitTime !== undefined)
    lines.push(`  最终等待时间: ${sample.dataResolution.finalWaitTime}分钟`);
  if (sample.dataResolution.finalArrivalCount !== undefined)
    lines.push(`  最终到达人数: ${sample.dataResolution.finalArrivalCount}人`);
  if (sample.dataResolution.resolutionReason)
    lines.push(`  处理原因: ${sample.dataResolution.resolutionReason}`);
  if (sample.dataResolution.nextContactPerson)
    lines.push(`  后续找谁: ${sample.dataResolution.nextContactPerson}`);
  if (sample.dataResolution.resolvedBy)
    lines.push(`  处理人: ${sample.dataResolution.resolvedBy}  @ ${new Date(sample.dataResolution.resolvedAt!).toLocaleString('zh-CN')}`);
  return lines;
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
  lines.push(`  是否标记为缺失: ${sample.negativeSample.isMarkedAsMissing ? '是 ⚠️（旧表当成缺失，待学生助教先复核）' : '否'}`);
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
  } else {
    lines.push('> 还缺什么材料: ✅ 材料齐全');
    lines.push('');
  }

  lines.push(`> 下一步: ${nextActionDescriptions[sample.nextAction]}`);
  if (sample.assignee) {
    lines.push(`> 当前负责人: ${sample.assignee}`);
  }

  lines.push(...formatOriginalCorrectedDelta(sample));

  if (sample.taReviewNotes) {
    lines.push('');
    lines.push(`> 学生助教备注: ${sample.taReviewNotes}`);
  }
  if (sample.coachReviewNotes) {
    lines.push(`> 唐老师备注: ${sample.coachReviewNotes}`);
  }

  lines.push(...formatResolution(sample));
  lines.push(...formatReviewHistory(sample));

  return lines.join('\n');
}

export function generateHTMLReport(report: BoundaryReport): string {
  const sampleCards = report.boundarySamples
    .map((sample) => {
      const orig = sample.originalNegativeValues;
      const hasOrigDelta = orig?.waitTime !== undefined || orig?.arrivalCount !== undefined;
      const hist = sample.reviewLog || [];
      const resolved = sample.dataResolution;

      return `
      <div class="sample-card" id="sample-${sample.sampleId}">
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
              <strong>是否标记为缺失:</strong> ${sample.negativeSample.isMarkedAsMissing ? '是 ⚠️（旧表当成缺失，待学生助教先复核）' : '否'}
            </div>
          </div>

          ${sample.manualCounterExample ? `
          <div class="section">
            <div class="section-title">手算反例（主流程证据）</div>
            <div>窗口号: ${sample.manualCounterExample.windowNumber} | 时间: ${new Date(sample.manualCounterExample.timestamp).toLocaleString('zh-CN')}</div>
            <div>到达人数: ${sample.manualCounterExample.arrivalCount} | 等待时间: ${sample.manualCounterExample.waitTime}分钟</div>
            ${sample.manualCounterExample.mainProcessEvidence ? `<div class="evidence-box">主流程证据: ${sample.manualCounterExample.mainProcessEvidence}</div>` : ''}
          </div>` : ''}

          ${sample.questionnaireRow ? `
          <div class="section">
            <div class="section-title">问卷原始行（现场说法）</div>
            <div class="evidence-box" style="background: #e8f5e9; border-left-color: #4caf50;">
              <strong>现场说法:</strong> ${sample.questionnaireRow.onSiteStatement}<br>
              <strong>证人:</strong> ${sample.questionnaireRow.witnessName}
            </div>
            <div>临时关窗: ${sample.questionnaireRow.isTemporaryClosed ? '是 ⚠️' : '否'} | 排队溢出: ${sample.questionnaireRow.queueOverflow ? '是 ⚠️' : '否'}</div>
          </div>` : ''}

          <div class="section"><div class="section-title">为什么留下</div><div>${sample.whyKept}</div></div>

          ${sample.missingMaterials.length > 0 ? `
          <div class="section">
            <div class="section-title">还缺什么材料</div>
            ${sample.missingMaterials.map((m) => `<div class="missing-item">⭕ ${m}</div>`).join('')}
          </div>` : `<div class="section"><div class="section-title">还缺什么材料</div><div style="color: #4caf50;">✅ 材料齐全</div></div>`}

          <div class="next-action">
            <strong>下一步:</strong> ${nextActionDescriptions[sample.nextAction]}
            ${sample.assignee ? `<div class="assignee">当前负责人: ${sample.assignee}</div>` : ''}
          </div>

          ${hasOrigDelta ? `
          <div class="section">
            <div class="section-title">原始负数值 ↔ 修正后（保留原始说法，不归入正常）</div>
            <table class="delta-table">
              <tr><th>指标</th><th>原始负数</th><th>修正后</th></tr>
              ${orig.waitTime !== undefined ? `<tr><td>等待时间</td><td class="neg">${orig.waitTime}分钟</td><td>${resolved?.finalWaitTime ?? sample.questionnaireRow?.actualWaitTime ?? sample.manualCounterExample?.waitTime ?? '未确定'}分钟</td></tr>` : ''}
              ${orig.arrivalCount !== undefined ? `<tr><td>到达人数</td><td class="neg">${orig.arrivalCount}人</td><td>${resolved?.finalArrivalCount ?? sample.questionnaireRow?.actualArrivalCount ?? sample.manualCounterExample?.arrivalCount ?? '未确定'}人</td></tr>` : ''}
            </table>
          </div>` : ''}

          ${resolved ? `
          <div class="section">
            <div class="section-title">最终处理结果</div>
            <div class="evidence-box" style="background: #f1f8e9; border-left-color: #7cb342;">
              ${resolved.finalWaitTime !== undefined ? `<div><strong>最终等待时间:</strong> ${resolved.finalWaitTime}分钟</div>` : ''}
              ${resolved.finalArrivalCount !== undefined ? `<div><strong>最终到达人数:</strong> ${resolved.finalArrivalCount}人</div>` : ''}
              ${resolved.resolutionReason ? `<div><strong>处理原因:</strong> ${resolved.resolutionReason}</div>` : ''}
              ${resolved.nextContactPerson ? `<div><strong>后续找谁:</strong> ${resolved.nextContactPerson}</div>` : ''}
              ${resolved.resolvedBy ? `<div><strong>处理人:</strong> ${resolved.resolvedBy}</div>` : ''}
            </div>
          </div>` : ''}

          ${sample.taReviewNotes ? `<div class="section"><div class="section-title">学生助教备注</div><div>${sample.taReviewNotes}</div></div>` : ''}
          ${sample.coachReviewNotes ? `<div class="section"><div class="section-title">唐老师备注</div><div>${sample.coachReviewNotes}</div></div>` : ''}

          ${hist.length > 0 ? `
          <div class="section">
            <div class="section-title">复核历史（完整轨迹）</div>
            <div class="timeline">
              ${hist.map((log) => `
                <div class="timeline-item">
                  <div class="timeline-time">${new Date(log.timestamp).toLocaleString('zh-CN')}</div>
                  <div class="timeline-body">
                    <strong>${log.operator}</strong> 执行【${logActionLabels[log.action] || log.action}】
                    ${log.statusBefore && log.statusAfter ? `<span class="badge">${statusDescriptions[log.statusBefore]} → ${statusDescriptions[log.statusAfter]}</span>` : ''}
                    ${log.notes ? `<div class="muted">备注: ${log.notes}</div>` : ''}
                    ${log.reason ? `<div class="muted">原因: ${log.reason}</div>` : ''}
                    ${log.rawStatementAdded ? `<div style="color:#2e7d32;">☑ 补录了现场说法（问卷原始行）</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>`;
    })
    .join('');

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
    .delta-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .delta-table th, .delta-table td { border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left; }
    .delta-table th { background: #f5f5f5; }
    .delta-table .neg { color: #c62828; font-weight: bold; }
    .timeline { border-left: 2px solid #e0e0e0; padding-left: 20px; margin-top: 10px; }
    .timeline-item { position: relative; padding-bottom: 15px; }
    .timeline-item::before { content: ''; position: absolute; left: -27px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #667eea; border: 2px solid white; box-shadow: 0 0 0 2px #667eea; }
    .timeline-time { font-size: 12px; color: #999; }
    .timeline-body { margin-top: 4px; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 6px; }
    .muted { color: #666; font-size: 13px; margin-top: 4px; }
    .empty { text-align: center; padding: 60px 20px; color: #999; }
    .empty .tip-box { background: #fafafa; border: 1px dashed #ccc; padding: 20px; border-radius: 8px; margin-top: 15px; text-align: left; }
  </style>
</head>
<body>
  <div class="container">
    <h1>排队论窗口配置 - 边界样本报告</h1>
    <p style="color: #666; margin-bottom: 20px;">
      报告编号: ${report.reportId} | 生成时间: ${report.generatedAt.toLocaleString('zh-CN')} |
      数据条数: ${report.boundarySamples.length}（基于同一份最新状态）
    </p>

    <div class="stats">
      <div class="stat-card"><div class="number">${report.statistics.total}</div><div class="label">总样本数</div></div>
      <div class="stat-card"><div class="number">${report.statistics.pendingTa}</div><div class="label">待学生助教</div></div>
      <div class="stat-card"><div class="number">${report.statistics.pendingCoach}</div><div class="label">待唐老师</div></div>
      <div class="stat-card"><div class="number">${report.statistics.verified}</div><div class="label">已确认</div></div>
      <div class="stat-card"><div class="number">${report.statistics.resolved}</div><div class="label">已解决</div></div>
    </div>

    <h2 style="margin: 30px 0 20px; color: #333;">边界样本详情</h2>

    ${report.boundarySamples.length === 0
      ? `<div class="empty">
          <div style="font-size: 48px;">📭</div>
          <h3 style="margin: 10px 0;">暂无边界样本（总样本数: 0）</h3>
          <div class="tip-box">
            <strong>使用步骤：</strong>
            <ol style="margin: 10px 0 0 20px; line-height: 1.8;">
              <li>运行 <code>queue-config import</code> 导入手算反例数据</li>
              <li>系统自动检测负数样本并创建边界样本</li>
              <li>运行 <code>queue-config report</code> 查看报告</li>
            </ol>
          </div>
        </div>`
      : sampleCards}
  </div>
</body>
</html>`;
}

export function saveReportToFile(
  report: BoundaryReport,
  filePath: string,
  format: 'txt' | 'html' = 'txt'
): void {
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = format === 'html' ? generateHTMLReport(report) : formatBoundaryReport(report);
  fs.writeFileSync(filePath, content, 'utf-8');
}
