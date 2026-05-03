import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import {
  ValidationResult,
  ValidationIssue,
  PackageAnalysis,
} from '../types';

export class ReportGenerator {
  private result: ValidationResult;
  private outputDir: string;

  constructor(result: ValidationResult, outputDir: string) {
    this.result = result;
    this.outputDir = outputDir;
  }

  async generateAll(): Promise<{
    issuesCsv: string;
    reviewReport: string;
    timelineHtml: string;
  }> {
    await fs.promises.mkdir(this.outputDir, { recursive: true });

    const issuesCsv = await this.generateIssuesCsv();
    const reviewReport = await this.generateReviewReport();
    const timelineHtml = await this.generateTimelineHtml();

    return {
      issuesCsv,
      reviewReport,
      timelineHtml,
    };
  }

  private async generateIssuesCsv(): Promise<string> {
    const issues = this.result.issues;

    const records = issues.map((issue, index) => ({
      id: index + 1,
      rule_id: issue.ruleId,
      severity: issue.severity.toUpperCase(),
      message: issue.message,
      location: issue.location || '',
      details: issue.details || '',
    }));

    const csvContent = stringify(records, {
      header: true,
      columns: [
        { key: 'id', header: '#' },
        { key: 'severity', header: 'SEVERITY' },
        { key: 'rule_id', header: 'RULE_ID' },
        { key: 'message', header: 'MESSAGE' },
        { key: 'location', header: 'LOCATION' },
        { key: 'details', header: 'DETAILS' },
      ],
    });

    const outputPath = path.join(this.outputDir, 'issues.csv');
    await fs.promises.writeFile(outputPath, csvContent, 'utf-8');

    return outputPath;
  }

  private async generateReviewReport(): Promise<string> {
    const mdContent = this.buildReviewReport();
    const outputPath = path.join(this.outputDir, 'review_report.md');
    await fs.promises.writeFile(outputPath, mdContent, 'utf-8');
    return outputPath;
  }

  private buildReviewReport(): string {
    const { summary, issues, metadata, analysis } = this.result;

    let md = `# HLS 交付包预检报告\n\n`;

    md += `## 基本信息\n\n`;
    md += `- **包名称**: ${metadata.packageName}\n`;
    md += `- **处理时间**: ${metadata.processedAt.toISOString()}\n`;
    md += `- **执行耗时**: ${metadata.duration.toFixed(2)}ms\n\n`;

    md += `## 检查概要\n\n`;
    md += `| 级别 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 错误 | ${summary.errors} |\n`;
    md += `| 警告 | ${summary.warnings} |\n`;
    md += `| 信息 | ${summary.infos} |\n`;
    md += `| **总计** | **${summary.total}** |\n\n`;

    if (summary.errors > 0) {
      md += `### :x: 错误 (${summary.errors})\n\n`;
      issues
        .filter((i) => i.severity === 'error')
        .forEach((issue) => {
          md += `**${issue.ruleId}**: ${issue.message}\n\n`;
          if (issue.location) {
            md += `> 位置: ${issue.location}\n\n`;
          }
          if (issue.details) {
            md += `> 详情: ${issue.details}\n\n`;
          }
        });
    }

    if (summary.warnings > 0) {
      md += `### :warning: 警告 (${summary.warnings})\n\n`;
      issues
        .filter((i) => i.severity === 'warning')
        .forEach((issue) => {
          md += `**${issue.ruleId}**: ${issue.message}\n\n`;
          if (issue.location) {
            md += `> 位置: ${issue.location}\n\n`;
          }
          if (issue.details) {
            md += `> 详情: ${issue.details}\n\n`;
          }
        });
    }

    if (summary.infos > 0) {
      md += `### :information_source: 信息 (${summary.infos})\n\n`;
      issues
        .filter((i) => i.severity === 'info')
        .forEach((issue) => {
          md += `**${issue.ruleId}**: ${issue.message}\n\n`;
        });
    }

    md += `---\n\n`;
    md += `## 包分析\n\n`;

    md += `### Variant 信息\n\n`;
    analysis.variants.forEach((variant) => {
      md += `#### ${variant.uri}\n\n`;
      md += `- 码率: ${(variant.bandwidth / 1000000).toFixed(2)} Mbps\n`;
      if (variant.resolution) {
        md += `- 分辨率: ${variant.resolution.width}x${variant.resolution.height}\n`;
      }
      md += `- 切片数量: ${variant.segmentCount}\n`;
      md += `- 总时长: ${variant.totalDuration.toFixed(2)}s\n`;
      md += `- 目标切片时长: ${variant.targetDuration}s\n`;
      if (variant.hasDiscontinuities) {
        md += `- **注意**: 包含 ${variant.discontinuityCount} 个不连续性标记\n`;
      }
      if (variant.isEncrypted) {
        md += `- 加密: 已加密 (${variant.encryptionKeyCount} 个密钥)\n`;
      } else {
        md += `- 加密: 未加密\n`;
      }
      md += `\n`;
    });

    md += `### CDN 状态\n\n`;
    md += `- 总请求数: ${analysis.cdnStatus.totalRequests}\n`;
    md += `- 成功请求: ${analysis.cdnStatus.successCount}\n`;
    md += `- 失败请求: ${analysis.cdnStatus.errorCount}\n`;
    md += `- 平均响应时间: ${analysis.cdnStatus.avgResponseTimeMs.toFixed(0)}ms\n`;
    md += `- 最大响应时间: ${analysis.cdnStatus.maxResponseTimeMs}ms\n`;
    if (Object.keys(analysis.cdnStatus.statusCodeBreakdown).length > 0) {
      md += `- HTTP 状态码分布:\n`;
      Object.entries(analysis.cdnStatus.statusCodeBreakdown)
        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        .forEach(([code, count]) => {
          md += `  - ${code}: ${count} 次\n`;
        });
    }
    md += `\n`;

    if (analysis.crossMidnight) {
      md += `### :calendar: 跨午夜标记\n\n`;
      md += `**注意**: 检测到时间戳跨越午夜边界。请确认时间戳连续性是否正确。\n\n`;
    }

    md += `---\n\n`;
    md += `## 时间线\n\n`;
    md += `详细时间线请查看 [timeline.html](./timeline.html) 文件。\n\n`;

    md += `---\n\n`;
    md += `*报告生成时间: ${new Date().toISOString()}*\n`;

    return md;
  }

  private async generateTimelineHtml(): Promise<string> {
    const htmlContent = this.buildTimelineHtml();
    const outputPath = path.join(this.outputDir, 'timeline.html');
    await fs.promises.writeFile(outputPath, htmlContent, 'utf-8');
    return outputPath;
  }

  private buildTimelineHtml(): string {
    const { analysis, metadata } = this.result;
    const variants = analysis.variants;
    const timeline = analysis.timeline;

    const variantNames = [...new Set(timeline.map((t) => t.variant))].sort();
    const variantMap = new Map(variantNames.map((name, idx) => [name, idx]));

    const seqNumbers = [...new Set(timeline.map((t) => t.sequenceNumber))].sort((a, b) => a - b);
    const minSeq = seqNumbers[0] || 0;
    const maxSeq = seqNumbers[seqNumbers.length - 1] || 0;

    const timelineDataJson = JSON.stringify(
      {
        packageName: metadata.packageName,
        processedAt: metadata.processedAt.toISOString(),
        variants: variants.map((v) => ({
          uri: v.uri,
          bandwidth: v.bandwidth,
          resolution: v.resolution,
          segmentCount: v.segmentCount,
          totalDuration: v.totalDuration,
        })),
        timeline: timeline.map((t) => ({
          variant: t.variant,
          sequenceNumber: t.sequenceNumber,
          startTime: t.startTime,
          endTime: t.endTime,
          duration: t.duration,
          programDateTime: t.programDateTime,
          status: t.status,
        })),
        variantNames,
        seqNumbers,
        minSeq,
        maxSeq,
      },
      null,
      2
    );

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HLS 时间线 - ${metadata.packageName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 1px solid #333;
      margin-bottom: 30px;
    }
    h1 { font-size: 2em; margin-bottom: 10px; color: #fff; }
    .subtitle { color: #888; font-size: 0.9em; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .info-card {
      background: #16213e;
      padding: 15px;
      border-radius: 8px;
      border-left: 3px solid #e94560;
    }
    .info-card h3 { font-size: 0.8em; color: #888; margin-bottom: 5px; }
    .info-card p { font-size: 1.2em; font-weight: bold; color: #fff; }
    .legend {
      display: flex;
      gap: 20px;
      justify-content: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9em;
    }
    .legend-box {
      width: 20px;
      height: 20px;
      border-radius: 4px;
    }
    .status-present { background: #4ade80; }
    .status-missing { background: #ef4444; }
    .status-duplicate { background: #f59e0b; }
    .timeline-container {
      background: #16213e;
      border-radius: 12px;
      padding: 20px;
      overflow-x: auto;
    }
    .timeline-header {
      display: flex;
      margin-bottom: 15px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .timeline-variant-label {
      width: 150px;
      min-width: 150px;
      padding: 8px;
      font-weight: bold;
      color: #fff;
      background: #0f3460;
      text-align: center;
      border-radius: 4px;
      margin-right: 10px;
      font-size: 0.85em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .timeline-seq-numbers {
      flex: 1;
      display: flex;
      position: relative;
      min-width: fit-content;
    }
    .seq-number {
      width: 30px;
      min-width: 30px;
      text-align: center;
      font-size: 0.75em;
      color: #888;
      padding: 4px 0;
    }
    .seq-number.marker {
      color: #e94560;
      font-weight: bold;
    }
    .timeline-row {
      display: flex;
      margin-bottom: 5px;
      align-items: center;
    }
    .variant-label {
      width: 150px;
      min-width: 150px;
      padding: 8px;
      font-size: 0.85em;
      color: #aaa;
      background: #0f3460;
      margin-right: 10px;
      border-radius: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .variant-slots {
      flex: 1;
      display: flex;
      position: relative;
      min-width: fit-content;
    }
    .slot {
      width: 30px;
      min-width: 30px;
      height: 24px;
      margin: 0 1px;
      border-radius: 3px;
      position: relative;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .slot:hover {
      transform: scale(1.2);
      z-index: 10;
    }
    .slot.present { background: #4ade80; }
    .slot.missing { background: #ef4444; border: 1px dashed #b91c1c; }
    .slot.duplicate { background: #f59e0b; border: 1px solid #d97706; }
    .tooltip {
      position: absolute;
      background: #111;
      border: 1px solid #333;
      padding: 10px;
      border-radius: 6px;
      font-size: 0.8em;
      z-index: 1000;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .tooltip.visible { opacity: 1; }
    .tooltip h4 { margin-bottom: 5px; color: #e94560; }
    .tooltip p { margin: 3px 0; color: #aaa; }
    .tooltip .value { color: #fff; font-weight: bold; }
    .stats-summary {
      margin-top: 30px;
      padding: 20px;
      background: #0f3460;
      border-radius: 8px;
    }
    .stats-summary h3 { margin-bottom: 15px; color: #e94560; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
    }
    .stat-item {
      text-align: center;
      padding: 10px;
      background: #16213e;
      border-radius: 6px;
    }
    .stat-item .num {
      font-size: 1.5em;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .stat-item .num.green { color: #4ade80; }
    .stat-item .num.red { color: #ef4444; }
    .stat-item .num.yellow { color: #f59e0b; }
    .stat-item .label {
      font-size: 0.75em;
      color: #888;
    }
    .filter-controls {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85em;
      transition: all 0.2s;
    }
    .filter-btn.active {
      background: #e94560;
      color: white;
    }
    .filter-btn:not(.active) {
      background: #16213e;
      color: #aaa;
    }
    .filter-btn:hover:not(.active) {
      background: #0f3460;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>HLS 时间线可视化</h1>
      <p class="subtitle">包: ${metadata.packageName} | 生成时间: ${metadata.processedAt.toISOString()}</p>
    </header>

    <div class="info-grid">
      <div class="info-card">
        <h3>Variant 数量</h3>
        <p>${variants.length}</p>
      </div>
      <div class="info-card">
        <h3>总切片数</h3>
        <p>${variants.reduce((sum, v) => sum + v.segmentCount, 0)}</p>
      </div>
      <div class="info-card">
        <h3>总时长</h3>
        <p>${variants.length > 0 ? variants[0].totalDuration.toFixed(2) : 0}s</p>
      </div>
      <div class="info-card">
        <h3>序列范围</h3>
        <p>#${minSeq} - #${maxSeq}</p>
      </div>
    </div>

    <div class="legend">
      <div class="legend-item">
        <div class="legend-box status-present"></div>
        <span>正常 (Present)</span>
      </div>
      <div class="legend-item">
        <div class="legend-box status-missing"></div>
        <span>缺失 (Missing)</span>
      </div>
      <div class="legend-item">
        <div class="legend-box status-duplicate"></div>
        <span>重复 (Duplicate)</span>
      </div>
    </div>

    <div class="filter-controls">
      <button class="filter-btn active" data-filter="all">全部</button>
      <button class="filter-btn" data-filter="issues">仅问题</button>
      <button class="filter-btn" data-filter="missing">仅缺失</button>
      <button class="filter-btn" data-filter="duplicate">仅重复</button>
    </div>

    <div class="timeline-container">
      <div class="timeline-header">
        <div class="timeline-variant-label">Variant</div>
        <div class="timeline-seq-numbers" id="seq-header">
        </div>
      </div>
      <div id="timeline-rows">
      </div>
    </div>

    <div class="stats-summary">
      <h3>时间线统计</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="num green">${timeline.filter(t => t.status === 'present').length}</div>
          <div class="label">正常切片</div>
        </div>
        <div class="stat-item">
          <div class="num red">${timeline.filter(t => t.status === 'missing').length}</div>
          <div class="label">缺失切片</div>
        </div>
        <div class="stat-item">
          <div class="num yellow">${timeline.filter(t => t.status === 'duplicate').length}</div>
          <div class="label">重复切片</div>
        </div>
        <div class="stat-item">
          <div class="num" style="color: #e94560;">${timeline.length}</div>
          <div class="label">总计</div>
        </div>
      </div>
    </div>
  </div>

  <div class="tooltip" id="tooltip"></div>

  <script>
    const data = ${timelineDataJson};
    
    function init() {
      renderSeqHeader();
      renderTimeline();
      setupFilters();
    }

    function renderSeqHeader() {
      const header = document.getElementById('seq-header');
      header.innerHTML = '';
      
      for (let seq = data.minSeq; seq <= data.maxSeq; seq++) {
        const div = document.createElement('div');
        div.className = 'seq-number' + (seq % 10 === 0 ? ' marker' : '');
        div.textContent = seq;
        header.appendChild(div);
      }
    }

    function renderTimeline(filter = 'all') {
      const container = document.getElementById('timeline-rows');
      container.innerHTML = '';

      data.variantNames.forEach(variant => {
        const row = document.createElement('div');
        row.className = 'timeline-row';

        const label = document.createElement('div');
        label.className = 'variant-label';
        label.textContent = variant;
        row.appendChild(label);

        const slots = document.createElement('div');
        slots.className = 'variant-slots';

        const variantData = data.timeline.filter(t => t.variant === variant);
        const seqMap = new Map(variantData.map(t => [t.sequenceNumber, t]));

        for (let seq = data.minSeq; seq <= data.maxSeq; seq++) {
          const segment = seqMap.get(seq);
          const status = segment ? segment.status : 'missing';

          if (filter !== 'all') {
            if (filter === 'issues' && status === 'present') continue;
            if (filter === 'missing' && status !== 'missing') continue;
            if (filter === 'duplicate' && status !== 'duplicate') continue;
          }

          const slot = document.createElement('div');
          slot.className = 'slot ' + status;
          slot.dataset.seq = seq;
          slot.dataset.variant = variant;
          slot.dataset.status = status;

          if (segment) {
            slot.dataset.duration = segment.duration;
            slot.dataset.programDateTime = segment.programDateTime || '';
          }

          slot.addEventListener('mouseenter', showTooltip);
          slot.addEventListener('mouseleave', hideTooltip);
          slot.addEventListener('mousemove', moveTooltip);

          slots.appendChild(slot);
        }

        row.appendChild(slots);
        container.appendChild(row);
      });
    }

    function setupFilters() {
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderTimeline(btn.dataset.filter);
        });
      });
    }

    function showTooltip(e) {
      const tooltip = document.getElementById('tooltip');
      const target = e.target;
      
      const seq = target.dataset.seq;
      const variant = target.dataset.variant;
      const status = target.dataset.status;
      const duration = target.dataset.duration;
      const programDateTime = target.dataset.programDateTime;

      let statusText = status;
      if (status === 'present') statusText = '正常 (Present)';
      if (status === 'missing') statusText = '缺失 (Missing)';
      if (status === 'duplicate') statusText = '重复 (Duplicate)';

      let html = '<h4>切片信息</h4>';
      html += '<p>序列: <span class="value">#' + seq + '</span></p>';
      html += '<p>Variant: <span class="value">' + variant + '</span></p>';
      html += '<p>状态: <span class="value">' + statusText + '</span></p>';
      if (duration) {
        html += '<p>时长: <span class="value">' + parseFloat(duration).toFixed(3) + 's</span></p>';
      }
      if (programDateTime) {
        html += '<p>时间戳: <span class="value">' + programDateTime + '</span></p>';
      }

      tooltip.innerHTML = html;
      tooltip.classList.add('visible');
      moveTooltip(e);
    }

    function hideTooltip() {
      document.getElementById('tooltip').classList.remove('visible');
    }

    function moveTooltip(e) {
      const tooltip = document.getElementById('tooltip');
      const x = e.pageX + 15;
      const y = e.pageY + 15;
      
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }

    init();
  </script>
</body>
</html>`;

    return html;
  }
}

export default ReportGenerator;
