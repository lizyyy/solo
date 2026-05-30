import { jsPDF } from 'jspdf';
import { OrderBookSnapshot } from '../types/data';
import { Anomaly } from '../types/anomaly';
import { Annotation } from '../types/annotation';
import {
  ANOMALY_TYPE_NAMES,
  ANOMALY_TYPE_COLORS,
  ANOMALY_DESCRIPTIONS,
} from '../types/anomaly';
import { DEFAULT_TAGS } from '../types/annotation';
import { formatTime, formatDate, formatDateTime, formatPrice, formatQuantity } from '../utils/formatters';

export interface ReportConfig {
  title: string;
  author: string;
  includeRawData: boolean;
  includeCharts: boolean;
  includeAnnotations: boolean;
  includeAnomalies: boolean;
}

export interface ReportData {
  snapshots: OrderBookSnapshot[];
  anomalies: Anomaly[];
  annotations: Annotation[];
  config: ReportConfig;
  generatedAt: number;
}

export interface ReportSummary {
  totalSnapshots: number;
  timeSpan: number;
  totalAnomalies: number;
  anomaliesByType: Record<string, number>;
  highSeverityCount: number;
  totalAnnotations: number;
  avgSpread: number;
  dataQualityScore: number;
}

export const generateReportSummary = (
  snapshots: OrderBookSnapshot[],
  anomalies: Anomaly[],
  annotations: Annotation[]
): ReportSummary => {
  const totalSnapshots = snapshots.length;
  const timeSpan = totalSnapshots > 1
    ? snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp
    : 0;

  const anomaliesByType: Record<string, number> = {};
  anomalies.forEach((a) => {
    anomaliesByType[a.type] = (anomaliesByType[a.type] || 0) + 1;
  });

  const highSeverityCount = anomalies.filter((a) => a.severity >= 3).length;

  let totalSpread = 0;
  let spreadCount = 0;
  snapshots.forEach((s) => {
    if (s.bids[0]?.price && s.asks[0]?.price) {
      totalSpread += s.asks[0].price - s.bids[0].price;
      spreadCount++;
    }
  });
  const avgSpread = spreadCount > 0 ? totalSpread / spreadCount : 0;

  const maxPossibleAnomalies = totalSnapshots * 8;
  const dataQualityScore = maxPossibleAnomalies > 0
    ? Math.max(0, Math.min(100, 100 - (anomalies.length / maxPossibleAnomalies) * 100 * 5))
    : 100;

  return {
    totalSnapshots,
    timeSpan,
    totalAnomalies: anomalies.length,
    anomaliesByType,
    highSeverityCount,
    totalAnnotations: annotations.length,
    avgSpread,
    dataQualityScore,
  };
};

export const generateHTMLReport = (data: ReportData): string => {
  const summary = generateReportSummary(data.snapshots, data.anomalies, data.annotations);
  
  const getTagColor = (tagId: string) => {
    const tag = DEFAULT_TAGS.find((t) => t.id === tagId);
    return tag?.color || '#64748b';
  };

  const getTagName = (tagId: string) => {
    const tag = DEFAULT_TAGS.find((t) => t.id === tagId);
    return tag?.name || tagId;
  };

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.config.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 40px; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h2 { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #f1f5f9; border-left: 3px solid #3b82f6; padding-left: 12px; }
    h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .meta { display: flex; gap: 24px; color: #94a3b8; font-size: 14px; margin-top: 12px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
    .summary-card .label { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
    .summary-card .value { font-size: 24px; font-weight: 700; color: #f1f5f9; }
    .summary-card .value.danger { color: #f87171; }
    .summary-card .value.success { color: #34d399; }
    .summary-card .value.warning { color: #fbbf24; }
    .section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .quality-bar { height: 8px; background: #334155; border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .quality-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .anomaly-item { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .anomaly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .anomaly-type { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .anomaly-dot { width: 8px; height: 8px; border-radius: 50%; }
    .severity { display: flex; gap: 2px; }
    .severity-dot { width: 6px; height: 6px; border-radius: 50%; background: #475569; }
    .severity-dot.active { background: #f87171; }
    .anomaly-desc { color: #94a3b8; font-size: 14px; margin-bottom: 8px; }
    .anomaly-meta { display: flex; gap: 16px; font-size: 12px; color: #64748b; }
    .annotation-item { background: #0f172a; border-left: 3px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 12px; }
    .annotation-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .annotation-title { font-weight: 600; color: #f1f5f9; }
    .annotation-tag { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .annotation-content { color: #94a3b8; font-size: 14px; margin-bottom: 8px; }
    .annotation-meta { font-size: 12px; color: #64748b; }
    .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .table th, .table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #334155; font-size: 13px; }
    .table th { background: #0f172a; font-weight: 600; color: #94a3b8; }
    .table tr:hover { background: #0f172a; }
    .bid { color: #22d3ee; }
    .ask { color: #fb7185; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155; }
    .empty-state { text-align: center; color: #64748b; padding: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.config.title}</h1>
      <p style="color: #94a3b8;">期货盘口深度复盘报告</p>
      <div class="meta">
        <span>作者: ${data.config.author}</span>
        <span>生成时间: ${formatDateTime(data.generatedAt)}</span>
        <span>数据周期: ${formatDate(data.snapshots[0]?.timestamp || 0)} - ${formatDate(data.snapshots[data.snapshots.length - 1]?.timestamp || 0)}</span>
      </div>
    </div>

    <h2>数据概览</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">快照总数</div>
        <div class="value">${summary.totalSnapshots}</div>
      </div>
      <div class="summary-card">
        <div class="label">时间跨度</div>
        <div class="value">${(summary.timeSpan / 1000).toFixed(1)}s</div>
      </div>
      <div class="summary-card">
        <div class="label">异常总数</div>
        <div class="value ${summary.totalAnomalies > 0 ? 'danger' : 'success'}">${summary.totalAnomalies}</div>
      </div>
      <div class="summary-card">
        <div class="label">高严重度</div>
        <div class="value ${summary.highSeverityCount > 0 ? 'danger' : 'success'}">${summary.highSeverityCount}</div>
      </div>
      <div class="summary-card">
        <div class="label">标注数量</div>
        <div class="value">${summary.totalAnnotations}</div>
      </div>
      <div class="summary-card">
        <div class="label">平均价差</div>
        <div class="value warning">${formatPrice(summary.avgSpread)}</div>
      </div>
    </div>

    <div class="section">
      <h3>数据质量评分</h3>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #94a3b8;">综合评分</span>
        <span style="font-size: 24px; font-weight: 700; color: ${summary.dataQualityScore >= 80 ? '#34d399' : summary.dataQualityScore >= 60 ? '#fbbf24' : '#f87171'};">
          ${summary.dataQualityScore.toFixed(1)} / 100
        </span>
      </div>
      <div class="quality-bar">
        <div class="quality-bar-fill" style="width: ${summary.dataQualityScore}%; background: ${summary.dataQualityScore >= 80 ? '#34d399' : summary.dataQualityScore >= 60 ? '#fbbf24' : '#f87171'};"></div>
      </div>
    </div>

    ${data.config.includeAnomalies && data.anomalies.length > 0 ? `
      <h2>异常检测报告</h2>
      <div class="section">
        <h3>异常类型分布</h3>
        <div class="summary-grid">
          ${Object.entries(summary.anomaliesByType).map(([type, count]) => `
            <div class="summary-card">
              <div class="label">${ANOMALY_TYPE_NAMES[type as keyof typeof ANOMALY_TYPE_NAMES] || type}</div>
              <div class="value danger">${count}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <h3>异常详情</h3>
        ${data.anomalies.map((anomaly) => `
          <div class="anomaly-item">
            <div class="anomaly-header">
              <div class="anomaly-type">
                <div class="anomaly-dot" style="background: ${ANOMALY_TYPE_COLORS[anomaly.type] || '#f87171'};"></div>
                ${ANOMALY_TYPE_NAMES[anomaly.type] || anomaly.type}
              </div>
              <div class="severity">
                ${[1, 2, 3].map((i) => `<div class="severity-dot ${i <= anomaly.severity ? 'active' : ''}"></div>`).join('')}
              </div>
            </div>
            <div class="anomaly-desc">${anomaly.description}</div>
            <div class="anomaly-meta">
              <span>时间: ${formatTime(anomaly.timestamp)}</span>
              <span>快照: #${anomaly.snapshotIndex + 1}</span>
              ${anomaly.level ? `<span>档位: 第${anomaly.level}档</span>` : ''}
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #334155;">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">异常说明</div>
              <div style="font-size: 13px; color: #94a3b8;">
                ${ANOMALY_DESCRIPTIONS[anomaly.type]?.pattern || ''}
              </div>
            </div>
            ${anomaly.impact ? `
              <div style="margin-top: 12px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">影响分析</div>
                <div style="font-size: 13px; color: #94a3b8;">${anomaly.impact}</div>
              </div>
            ` : ''}
            ${anomaly.suggestions && anomaly.suggestions.length > 0 ? `
              <div style="margin-top: 12px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">处理建议</div>
                <ul style="font-size: 13px; color: #94a3b8; padding-left: 20px;">
                  ${anomaly.suggestions.map((s) => `<li>${s}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${data.config.includeAnnotations && data.annotations.length > 0 ? `
      <h2>策略标注</h2>
      <div class="section">
        ${data.annotations.map((ann) => `
          <div class="annotation-item" style="border-left-color: ${getTagColor(ann.tagId)};">
            <div class="annotation-header">
              <div class="annotation-title">${ann.title}</div>
              <span class="annotation-tag" style="background: ${getTagColor(ann.tagId)}20; color: ${getTagColor(ann.tagId)};">
                ${getTagName(ann.tagId)}
              </span>
            </div>
            ${ann.content ? `<div class="annotation-content">${ann.content}</div>` : ''}
            <div class="annotation-meta">
              时间: ${formatDateTime(ann.timestamp)} | 快照: #${ann.snapshotIndex + 1} | 创建于: ${formatDateTime(ann.createdAt)}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${data.config.includeRawData ? `
      <h2>盘口快照明细</h2>
      <div class="section" style="overflow-x: auto;">
        <table class="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>快照</th>
              ${[1, 2, 3, 4, 5].map((i) => `<th class="bid">买${i}价</th><th class="bid">买${i}量</th>`).join('')}
              ${[1, 2, 3, 4, 5].map((i) => `<th class="ask">卖${i}价</th><th class="ask">卖${i}量</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.snapshots.slice(0, 100).map((s, i) => `
              <tr>
                <td>${formatTime(s.timestamp)}</td>
                <td>#${i + 1}</td>
                ${s.bids.slice(0, 5).map((b) => `<td class="bid">${formatPrice(b.price)}</td><td class="bid">${formatQuantity(b.quantity)}</td>`).join('')}
                ${new Array(Math.max(0, 5 - s.bids.length)).fill(0).map(() => `<td></td><td></td>`).join('')}
                ${s.asks.slice(0, 5).map((a) => `<td class="ask">${formatPrice(a.price)}</td><td class="ask">${formatQuantity(a.quantity)}</td>`).join('')}
                ${new Array(Math.max(0, 5 - s.asks.length)).fill(0).map(() => `<td></td><td></td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${data.snapshots.length > 100 ? `<p style="text-align: center; color: #64748b; margin-top: 16px; font-size: 13px;">仅显示前100条快照，共${data.snapshots.length}条</p>` : ''}
      </div>
    ` : ''}

    <div class="footer">
      <p>本报告由期货盘口深度立方系统自动生成</p>
      <p style="margin-top: 4px;">生成时间: ${formatDateTime(data.generatedAt)}</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
};

export const downloadHTMLReport = (data: ReportData) => {
  const html = generateHTMLReport(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.config.title}_${formatDate(data.generatedAt)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadPDFReport = async (data: ReportData) => {
  const summary = generateReportSummary(data.snapshots, data.anomalies, data.annotations);
  const doc = new jsPDF();
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(data.config.title, 20, 25);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`期货盘口深度复盘报告`, 20, 35);
  doc.text(`生成时间: ${formatDateTime(data.generatedAt)}`, 20, 45);
  doc.text(`作者: ${data.config.author}`, 20, 55);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text('数据概览', 20, 75);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(60);
  
  const stats = [
    ['快照总数', String(summary.totalSnapshots)],
    ['时间跨度', `${(summary.timeSpan / 1000).toFixed(1)}秒`],
    ['异常总数', String(summary.totalAnomalies)],
    ['高严重度', String(summary.highSeverityCount)],
    ['标注数量', String(summary.totalAnnotations)],
    ['平均价差', formatPrice(summary.avgSpread)],
    ['数据质量', `${summary.dataQualityScore.toFixed(1)}/100`],
  ];

  let yPos = 90;
  stats.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 20 : 110;
    const y = yPos + Math.floor(i / 2) * 15;
    doc.text(`${label}: ${value}`, x, y);
  });

  if (data.config.includeAnomalies && data.anomalies.length > 0) {
    yPos = 150;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('异常检测报告', 20, yPos);

    yPos += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60);

    data.anomalies.slice(0, 10).forEach((anomaly, i) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 0, 0);
      doc.text(`${i + 1}. ${ANOMALY_TYPE_NAMES[anomaly.type] || anomaly.type}`, 20, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      const descLines = doc.splitTextToSize(anomaly.description, 170);
      doc.text(descLines, 25, yPos + 7);
      
      yPos += descLines.length * 6 + 8;
      
      doc.text(`时间: ${formatTime(anomaly.timestamp)} | 快照: #${anomaly.snapshotIndex + 1}`, 25, yPos);
      yPos += 10;
    });

    if (data.anomalies.length > 10) {
      doc.setTextColor(100);
      doc.text(`... 还有 ${data.anomalies.length - 10} 条异常记录，请查看完整HTML报告`, 25, yPos);
    }
  }

  doc.save(`${data.config.title}_${formatDate(data.generatedAt)}.pdf`);
};

export const downloadJSONData = (snapshots: OrderBookSnapshot[], anomalies: Anomaly[], annotations: Annotation[]) => {
  const data = {
    exportedAt: Date.now(),
    snapshots,
    anomalies,
    annotations,
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `盘口数据_${formatDate(Date.now())}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
