import { DataPoint, Metadata, AnomalyConfig, AnomalyStatistics } from '../types';
import { generateCSV } from './csvParser';

export interface ExportReport {
  title: string;
  exportedAt: number;
  metadata: Metadata;
  anomalyConfig: AnomalyConfig;
  statistics: AnomalyStatistics;
  dataPoints: DataPoint[];
  supplementaryNote?: string;
  hasSupplementaryNote: boolean;
  dataBeforeSupplementary?: DataPoint[];
}

export function exportToJSON(report: ExportReport): void {
  const jsonStr = JSON.stringify(report, null, 2);
  downloadFile(jsonStr, `离心力分析报告_${formatDateForFilename()}.json`, 'application/json');
}

export function exportToCSV(dataPoints: DataPoint[]): void {
  const csvContent = generateCSV(dataPoints);
  const bom = '\uFEFF';
  downloadFile(bom + csvContent, `离心力数据_${formatDateForFilename()}.csv`, 'text/csv;charset=utf-8');
}

export function exportToHTML(
  report: ExportReport,
  chartImage?: string
): string {
  const anomalyPointsHTML = report.statistics.anomalyPoints.map((p, i) => `
    <tr class="${p.isAnomaly ? 'bg-red-50' : ''}">
      <td class="border px-3 py-2">${i + 1}</td>
      <td class="border px-3 py-2">${p.timeLabel}</td>
      <td class="border px-3 py-2 font-bold ${p.isAnomaly ? 'text-red-600' : ''}">${p.centrifugalForce}</td>
      <td class="border px-3 py-2">${p.direction === 'positive' ? '正' : p.direction === 'negative' ? '负' : '未知'}</td>
      <td class="border px-3 py-2">${p.isAnomaly ? '是' : '否'}</td>
      <td class="border px-3 py-2 text-sm text-gray-600">${p.anomalyReason || '-'}</td>
    </tr>
  `).join('');

  const diffHTML = report.hasSupplementaryNote && report.dataBeforeSupplementary 
    ? generateDiffHTML(report.dataBeforeSupplementary, report.dataPoints)
    : '';

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1e3a5f; border-bottom: 3px solid #1e3a5f; padding-bottom: 10px; }
    h2 { color: #2d5a87; margin-top: 30px; }
    .info-card { background: #f8fafc; border-left: 4px solid #1e3a5f; padding: 15px; margin: 15px 0; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-item { text-align: center; padding: 15px; background: #f0f4f8; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1e3a5f; }
    .stat-label { font-size: 12px; color: #64748b; }
    .anomaly .stat-value { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; }
    th { background: #1e3a5f; color: white; padding: 10px; text-align: left; }
    .chart-container { text-align: center; margin: 20px 0; }
    .chart-container img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; }
    .diff-section { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge-danger { background: #fee2e2; color: #dc2626; }
    .badge-success { background: #dcfce7; color: #16a34a; }
    @media print { body { font-size: 12px; } .info-card, .diff-section { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>🎢 ${report.title}</h1>
  
  <div class="info-card">
    <strong>📋 基本信息</strong><br>
    <strong>数据来源：</strong>${report.metadata.source}<br>
    <strong>处理人：</strong>${report.metadata.processor}<br>
    <strong>处理时间：</strong>${formatDateTime(report.metadata.processedAt)}<br>
    <strong>导出时间：</strong>${formatDateTime(report.exportedAt)}<br>
    <strong>备注：</strong>${report.metadata.remarks || '-'}
    ${report.metadata.supplementaryNote ? `<br><strong>补录备注：</strong><span class="badge badge-danger">有补录</span> ${report.metadata.supplementaryNote}` : ''}
  </div>

  <h2>📊 异常统计</h2>
  <div class="stat-grid">
    <div class="stat-item">
      <div class="stat-value">${report.statistics.totalCount}</div>
      <div class="stat-label">数据总数</div>
    </div>
    <div class="stat-item ${report.statistics.anomalyCount > 0 ? 'anomaly' : ''}">
      <div class="stat-value">${report.statistics.anomalyCount}</div>
      <div class="stat-label">异常数量</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${report.statistics.normalCount}</div>
      <div class="stat-label">正常数量</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${report.statistics.maxValue.toFixed(1)}</div>
      <div class="stat-label">最大值</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${report.statistics.avgValue.toFixed(1)}</div>
      <div class="stat-label">平均值</div>
    </div>
    ${report.statistics.maxAnomalyValue ? `
    <div class="stat-item anomaly">
      <div class="stat-value">${report.statistics.maxAnomalyValue.toFixed(1)}</div>
      <div class="stat-label">最大异常值</div>
    </div>` : ''}
  </div>

  ${chartImage ? `
  <h2>📈 数据图表</h2>
  <div class="chart-container">
    <img src="${chartImage}" alt="离心力数据图表">
  </div>
  ` : ''}

  <h2>⚠️ 异常点详情</h2>
  ${report.statistics.anomalyCount > 0 ? `
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>时间</th>
        <th>离心力(N)</th>
        <th>方向</th>
        <th>是否异常</th>
        <th>异常原因</th>
      </tr>
    </thead>
    <tbody>
      ${anomalyPointsHTML}
    </tbody>
  </table>
  ` : '<p>未检测到异常点。</p>'}

  <h2>🔧 检测配置</h2>
  <div class="info-card">
    <strong>检测方法：</strong>${report.anomalyConfig.method === 'iqr' ? 'IQR四分位距法' : report.anomalyConfig.method === 'zscore' ? 'Z-Score法' : '手动阈值'}<br>
    ${report.anomalyConfig.method === 'iqr' ? `<strong>IQR乘数：</strong>${report.anomalyConfig.iqrMultiplier}<br>` : ''}
    ${report.anomalyConfig.method === 'zscore' ? `<strong>Z-Score阈值：</strong>${report.anomalyConfig.zscoreThreshold}<br>` : ''}
    ${report.anomalyConfig.method === 'threshold' && report.anomalyConfig.manualThreshold ? 
      `<strong>阈值范围：</strong>${report.anomalyConfig.manualThreshold.min} - ${report.anomalyConfig.manualThreshold.max} N<br>` : ''}
    <strong>⚠️ 重要说明：</strong>异常检测基于<strong>原始数据点</strong>进行，不会对数据做平均或平滑处理，确保极端值不会被掩盖。
  </div>

  ${diffHTML}

  <div class="footer">
    <p>本报告由「游乐设施离心力提醒」工具自动生成</p>
    <p>报告包含完整的原始数据、检测配置和判定依据，便于后续接手人员复核</p>
  </div>
</body>
</html>`;
}

function generateDiffHTML(before: DataPoint[], after: DataPoint[]): string {
  const beforeAnomaly = before.filter(p => p.isAnomaly).length;
  const afterAnomaly = after.filter(p => p.isAnomaly).length;
  const anomalyDiff = afterAnomaly - beforeAnomaly;

  return `
  <h2>📝 补录备注差异对比</h2>
  <div class="diff-section">
    <strong>补录前后对比：</strong><br>
    <strong>补录前异常数：</strong>${beforeAnomaly}<br>
    <strong>补录后异常数：</strong>${afterAnomaly}<br>
    <strong>差异：</strong>${anomalyDiff > 0 ? '+' : ''}${anomalyDiff} 个异常点
    ${anomalyDiff !== 0 ? '<br><em>注：补录备注仅用于记录说明，不影响异常检测算法结果</em>' : ''}
  </div>`;
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDateForFilename(): string {
  const now = new Date();
  return `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadHTMLReport(html: string): void {
  downloadFile(html, `离心力分析报告_${formatDateForFilename()}.html`, 'text/html;charset=utf-8');
}
