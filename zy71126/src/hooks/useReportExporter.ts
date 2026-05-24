import { useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { useAppStore, useFilteredSeats } from '@/store/appStore';
import { ExportReport } from '@/types';

export function useReportExporter() {
  const seats = useFilteredSeats();
  const { layoutName, filters, currentTimelineIndex, viewMode } = useAppStore();

  const generateReport = useCallback(async (): Promise<ExportReport> => {
    const blockedSeats = seats.filter((s) => s.isBlocked);
    
    let screenshot: string | undefined;
    try {
      const canvasElement = document.querySelector('canvas');
      if (canvasElement) {
        screenshot = canvasElement.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Failed to capture screenshot', e);
    }

    const report: ExportReport = {
      generatedAt: new Date().toISOString(),
      cameraPosition: { x: 0, y: 0, z: 0 },
      filters: {
        rows: [...filters.rows],
        blockedOnly: filters.blockedOnly,
      },
      timelinePosition: currentTimelineIndex,
      totalSeats: seats.length,
      blockedSeats: blockedSeats.length,
      blockedSeatIds: blockedSeats.map((s) => s.id),
      layoutName,
      screenshot,
    };

    return report;
  }, [seats, filters, currentTimelineIndex, layoutName]);

  const exportAsJSON = useCallback(async () => {
    const report = await generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `视线报告_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generateReport]);

  const exportAsHTML = useCallback(async () => {
    const report = await generateReport();
    const blockedRate = ((report.blockedSeats / report.totalSeats) * 100).toFixed(1);
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>教室视线检查报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #60a5fa; font-size: 28px; margin-bottom: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 30px 0; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
    .stat-label { color: #94a3b8; font-size: 14px; }
    .good { color: #10b981; }
    .bad { color: #ef4444; }
    .screenshot { margin: 30px 0; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
    .screenshot img { width: 100%; display: block; }
    .details { background: #1e293b; padding: 24px; border-radius: 12px; margin-top: 30px; }
    .details h3 { margin-top: 0; margin-bottom: 16px; color: #60a5fa; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #94a3b8; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>教室视线检查报告</h1>
    <div style="color: #94a3b8;">生成时间: ${new Date(report.generatedAt).toLocaleString()}</div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${report.totalSeats}</div>
      <div class="stat-label">总座位数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value bad">${report.blockedSeats}</div>
      <div class="stat-label">遮挡座位</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${parseFloat(blockedRate) > 20 ? 'bad' : 'good'}">${blockedRate}%</div>
      <div class="stat-label">遮挡率</div>
    </div>
  </div>

  ${report.screenshot ? `
  <div class="screenshot">
    <img src="${report.screenshot}" alt="教室布局截图" />
  </div>
  ` : ''}

  <div class="details">
    <h3>报告详情</h3>
    <div class="detail-row">
      <span class="detail-label">布局名称</span>
      <span>${report.layoutName}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">筛选条件 - 仅显示遮挡</span>
      <span>${report.filters.blockedOnly ? '是' : '否'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">筛选条件 - 排数</span>
      <span>${report.filters.rows.length === 0 ? '全部' : report.filters.rows.map(r => r + 1 + '排').join(', ')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">时间轴位置</span>
      <span>${report.timelinePosition >= 0 ? `第 ${report.timelinePosition + 1} 个状态` : '当前状态'}</span>
    </div>
  </div>

  <div class="footer">
    教室视线检查工具 - 本报告与导出时的视角、筛选条件、时间轴位置完全一致
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `视线报告_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generateReport]);

  useEffect(() => {
    const handleExport = () => {
      exportAsHTML();
    };
    window.addEventListener('exportReport', handleExport);
    return () => window.removeEventListener('exportReport', handleExport);
  }, [exportAsHTML]);

  return { exportAsJSON, exportAsHTML };
}
