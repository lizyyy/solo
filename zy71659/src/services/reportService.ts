import { db } from '../db';
import type { 
  AnalysisReport, 
  ReportConfig, 
  ReportSummary,
  ExportFormat,
  AlignedSample 
} from '../types';
import { getAnalysisData } from './analysisService';
import { createHistoryRecord } from './historyService';
import { 
  exportReportToExcel, 
  exportToCSV, 
  exportToJSON,
  generateExportFilename 
} from '../utils/exporters';

export async function generateReport(
  config: ReportConfig
): Promise<AnalysisReport> {
  const { deviceId, startTime, endTime, generatedBy } = config;
  
  const { alignedSamples, segments, anomalies } = await getAnalysisData(
    deviceId,
    startTime,
    endTime
  );
  
  const sampleIdMap: Record<string, string> = {};
  alignedSamples.forEach((s, idx) => {
    sampleIdMap[`report_sample_${idx}`] = s.id!;
  });
  
  const torques = alignedSamples.map(s => s.torque);
  const temperatures = alignedSamples.map(s => s.temperature);
  
  const summary: ReportSummary = {
    totalSamples: alignedSamples.length,
    totalSegments: segments.length,
    totalDuration: alignedSamples.length > 0 
      ? alignedSamples[alignedSamples.length - 1].timestamp - alignedSamples[0].timestamp 
      : 0,
    avgSpeed: alignedSamples.length > 0 
      ? Math.round(alignedSamples.reduce((acc, s) => acc + s.speed, 0) / alignedSamples.length * 1000) / 1000
      : 0,
    avgTorque: alignedSamples.length > 0
      ? Math.round(alignedSamples.reduce((acc, s) => acc + s.torque, 0) / alignedSamples.length * 1000) / 1000
      : 0,
    maxTorque: torques.length > 0 ? Math.max(...torques) : 0,
    minTorque: torques.length > 0 ? Math.min(...torques) : 0,
    avgTemperature: temperatures.length > 0
      ? Math.round(temperatures.reduce((a, b) => a + b, 0) / temperatures.length * 10) / 10
      : 0,
    maxTemperature: temperatures.length > 0
      ? Math.max(...temperatures)
      : 0,
    anomalyCount: anomalies.length,
    segmentsWithAnomaly: segments.filter(s => s.hasAnomaly).length,
    confirmedAnomalyCount: anomalies.filter(a => a.status === 'confirmed' || a.status === 'resolved').length
  };
  
  const report: Omit<AnalysisReport, 'id'> = {
    title: config.title,
    deviceId,
    startTime,
    endTime,
    generatedBy,
    generatedAt: Date.now(),
    summary,
    segments: config.includeSegments ? segments : [],
    anomalies: config.includeAnomalies ? anomalies : [],
    sampleIdMap,
    config
  };
  
  const reportId = await db.reports.add(report as AnalysisReport);
  
  await createHistoryRecord(
    'report',
    String(reportId),
    'created',
    generatedBy,
    null,
    { reportId, title: config.title, summary }
  );
  
  return { ...report, id: String(reportId) };
}

export async function getReportById(reportId: string): Promise<AnalysisReport | undefined> {
  return db.reports.get(reportId);
}

export async function getReports(deviceId?: string): Promise<AnalysisReport[]> {
  if (deviceId) {
    return db.reports
      .where('deviceId')
      .equals(deviceId)
      .reverse()
      .sortBy('generatedAt');
  }
  return db.reports.orderBy('generatedAt').reverse().toArray();
}

export async function exportReport(
  reportId: string,
  format: ExportFormat,
  operator: string
): Promise<void> {
  const report = await db.reports.get(reportId);
  if (!report) {
    throw new Error('报告不存在');
  }
  
  const { alignedSamples } = await getAnalysisData(
    report.deviceId,
    report.startTime,
    report.endTime
  );
  
  const filename = generateExportFilename('扭矩分析报告', report.deviceId, format);
  
  switch (format) {
    case 'xlsx':
      exportReportToExcel(report, alignedSamples, filename);
      break;
    case 'csv':
      const csvData = alignedSamples.map(s => ({
        时间戳: s.timestamp,
        设备编号: s.deviceId,
        转速: s.speed,
        扭矩: s.torque,
        温度: s.temperature,
        负载档位: s.loadLevel,
        对齐状态: s.alignmentStatus
      }));
      exportToCSV(csvData, filename);
      break;
    case 'json':
      exportToJSON(report, filename);
      break;
    case 'pdf':
      await generatePDF(report, alignedSamples, filename);
      break;
  }
  
  await db.reports.update(reportId, {
    exportedAt: Date.now(),
    exportedFormat: format
  });
  
  await createHistoryRecord(
    'report',
    reportId,
    'exported',
    operator,
    null,
    { format, filename }
  );
}

async function generatePDF(
  report: AnalysisReport,
  samples: AlignedSample[],
  filename: string
): Promise<void> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('无法打开打印窗口');
  }
  
  const html = generateReportHTML(report, samples);
  
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function generateReportHTML(report: AnalysisReport, samples: AlignedSample[]): string {
  const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; }
    h1 { color: #0F172A; border-bottom: 2px solid #3B82F6; padding-bottom: 10px; }
    h2 { color: #1E293B; margin-top: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .summary-card { background: #F8FAFC; padding: 15px; border-radius: 8px; border-left: 4px solid #3B82F6; }
    .summary-label { font-size: 12px; color: #64748B; }
    .summary-value { font-size: 24px; font-weight: bold; color: #0F172A; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #E2E8F0; }
    th { background: #F1F5F9; font-weight: 600; }
    .anomaly-warning { background: #FEF3C7; }
    .anomaly-error { background: #FEE2E2; }
    .anomaly-critical { background: #FECACA; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p><strong>设备编号:</strong> ${report.deviceId}</p>
  <p><strong>分析时间范围:</strong> ${formatTime(report.startTime)} 至 ${formatTime(report.endTime)}</p>
  <p><strong>生成时间:</strong> ${formatTime(report.generatedAt)}</p>
  <p><strong>生成人:</strong> ${report.generatedBy}</p>
  
  <h2>数据摘要</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">采样点数</div>
      <div class="summary-value">${report.summary.totalSamples}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">工况段数</div>
      <div class="summary-value">${report.summary.totalSegments}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">平均扭矩</div>
      <div class="summary-value">${report.summary.avgTorque.toFixed(3)} N·m</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">最高温度</div>
      <div class="summary-value">${report.summary.maxTemperature.toFixed(1)} °C</div>
    </div>
  </div>
  
  ${report.config.includeSegments ? `
  <h2>工况分段统计</h2>
  <table>
    <thead>
      <tr>
        <th>负载档位</th>
        <th>开始时间</th>
        <th>结束时间</th>
        <th>采样点数</th>
        <th>平均转速</th>
        <th>平均扭矩</th>
        <th>最高温度</th>
        <th>异常</th>
      </tr>
    </thead>
    <tbody>
      ${report.segments.map(s => `
        <tr class="${s.hasAnomaly ? 'anomaly-warning' : ''}">
          <td>${s.loadLevel} 档</td>
          <td>${formatTime(s.startTime)}</td>
          <td>${formatTime(s.endTime)}</td>
          <td>${s.sampleCount}</td>
          <td>${s.avgSpeed.toFixed(0)} rpm</td>
          <td>${s.avgTorque.toFixed(3)} N·m</td>
          <td>${s.maxTemperature.toFixed(1)} °C</td>
          <td>${s.hasAnomaly ? '有' : '无'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  
  ${report.config.includeAnomalies ? `
  <h2>异常记录</h2>
  <table>
    <thead>
      <tr>
        <th>异常类型</th>
        <th>严重程度</th>
        <th>状态</th>
        <th>检测时间</th>
        <th>描述</th>
        <th>影响采样点</th>
      </tr>
    </thead>
    <tbody>
      ${report.anomalies.map(a => `
        <tr class="${a.severity === 'critical' ? 'anomaly-critical' : a.severity === 'error' ? 'anomaly-error' : 'anomaly-warning'}">
          <td>${a.type}</td>
          <td>${a.severity}</td>
          <td>${a.status}</td>
          <td>${formatTime(a.detectedAt)}</td>
          <td>${a.description}</td>
          <td>${a.affectedSampleIds.length}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  
  ${report.config.includeRawData ? `
  <h2>采样明细</h2>
  <table>
    <thead>
      <tr>
        <th>序号</th>
        <th>时间</th>
        <th>转速</th>
        <th>扭矩</th>
        <th>温度</th>
        <th>负载</th>
      </tr>
    </thead>
    <tbody>
      ${samples.slice(0, 100).map((s, i) => `
        <tr class="${s.anomalyIds.length > 0 ? 'anomaly-warning' : ''}">
          <td>${i + 1}</td>
          <td>${formatTime(s.timestamp)}</td>
          <td>${s.speed.toFixed(0)} rpm</td>
          <td>${s.torque.toFixed(3)} N·m</td>
          <td>${s.temperature.toFixed(1)} °C</td>
          <td>${s.loadLevel} 档</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <p style="color: #64748B; font-size: 12px;">* 仅显示前 100 条数据，完整数据请查看 Excel 导出</p>
  ` : ''}
</body>
</html>
`;
}
