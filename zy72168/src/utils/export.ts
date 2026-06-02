import type { Report, ReportItem } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function generateReportCSV(report: Report): string {
  const headers = ['点位名称', '地址', '状态', '最新反馈', '最新方案'];
  const rows: string[][] = [];
  const addItems = (items: ReportItem[]) => {
    for (const item of items) {
      rows.push([
        item.pointName,
        item.address,
        getStatusText(item.status),
        item.latestFeedback,
        item.latestPlan,
      ]);
    }
  };
  rows.push(['【已处理点位】']);
  addItems(report.sections.completed.items);
  rows.push([]);
  rows.push(['【待核实点位】']);
  addItems(report.sections.pending.items);
  rows.push([]);
  rows.push(['【需要现场复看点位】']);
  addItems(report.sections.review.items);
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    verified: '已核实',
    completed: '已完成',
    review: '需复看',
    resolved: '已解决',
    verify: '待核实',
  };
  return statusMap[status] || status;
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    verified: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    review: 'bg-orange-100 text-orange-800',
    resolved: 'bg-green-100 text-green-800',
    verify: 'bg-yellow-100 text-yellow-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

export function getTimePeriodText(period: string): string {
  const periodMap: Record<string, string> = {
    morning: '早高峰(7:00-9:00)',
    daytime: '日间(9:00-17:00)',
    evening: '晚高峰(17:00-19:00)',
    night: '夜间(19:00-7:00)',
  };
  return periodMap[period] || period;
}

export function getFeedbackTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    complaint: '居民投诉',
    meeting: '会议纪要',
    onsite: '现场记录',
    import: '数据导入',
  };
  return typeMap[type] || type;
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'yyyy年MM月dd日', { locale: zhCN });
  } catch {
    return dateStr;
  }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
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

export function exportToCSV(report: Report): void {
  const csv = generateReportCSV(report);
  const filename = `道路施工绕行评估报告_${formatDate(report.generatedAt)}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8');
}

export function generatePrintHTML(report: Report): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body { font-family: "SimSun", serif; padding: 40px; line-height: 1.8; }
    h1 { text-align: center; font-size: 24px; margin-bottom: 20px; }
    .meta { text-align: center; color: #666; margin-bottom: 30px; }
    .stats { display: flex; justify-content: space-around; margin: 30px 0; padding: 20px; background: #f5f5f5; }
    .stat-item { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .section { margin: 30px 0; }
    .section h2 { font-size: 18px; padding: 10px; background: #e5e7eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f3f4f6; }
    .status-completed { color: #10b981; }
    .status-pending { color: #eab308; }
    .status-review { color: #f97316; }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 60px;
      color: rgba(0,0,0,0.1);
      pointer-events: none;
    }
    .signature { margin-top: 60px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="watermark">道路施工绕行评估报告</div>
  <h1>${report.title}</h1>
  <div class="meta">
    生成时间：${formatDateTime(report.generatedAt)} |
    生成人：${report.generatedBy} |
    统计范围：${formatDate(report.timeRange.start)} 至 ${formatDate(report.timeRange.end)}
  </div>
  <div class="stats">
    <div class="stat-item">
      <div class="stat-value">${report.statistics.totalPoints}</div>
      <div>总点位</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${report.statistics.completedPoints}</div>
      <div>已处理</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${report.statistics.pendingPoints}</div>
      <div>待核实</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${report.statistics.reviewPoints}</div>
      <div>需复看</div>
    </div>
  </div>
  <div class="section">
    <h2>一、已处理点位 (${report.sections.completed.count})</h2>
    <table>
      <tr><th>点位名称</th><th>地址</th><th>状态</th><th>最新反馈</th><th>最新方案</th></tr>
      ${report.sections.completed.items.map(item => `
      <tr>
        <td>${item.pointName}</td>
        <td>${item.address}</td>
        <td class="status-completed">${getStatusText(item.status)}</td>
        <td>${item.latestFeedback}</td>
        <td>${item.latestPlan}</td>
      </tr>`).join('')}
    </table>
  </div>
  <div class="section">
    <h2>二、待核实点位 (${report.sections.pending.count})</h2>
    <table>
      <tr><th>点位名称</th><th>地址</th><th>状态</th><th>最新反馈</th><th>最新方案</th></tr>
      ${report.sections.pending.items.map(item => `
      <tr>
        <td>${item.pointName}</td>
        <td>${item.address}</td>
        <td class="status-pending">${getStatusText(item.status)}</td>
        <td>${item.latestFeedback}</td>
        <td>${item.latestPlan}</td>
      </tr>`).join('')}
    </table>
  </div>
  <div class="section">
    <h2>三、需要现场复看点位 (${report.sections.review.count})</h2>
    <table>
      <tr><th>点位名称</th><th>地址</th><th>状态</th><th>最新反馈</th><th>最新方案</th></tr>
      ${report.sections.review.items.map(item => `
      <tr>
        <td>${item.pointName}</td>
        <td>${item.address}</td>
        <td class="status-review">${getStatusText(item.status)}</td>
        <td>${item.latestFeedback}</td>
        <td>${item.latestPlan}</td>
      </tr>`).join('')}
    </table>
  </div>
  <div class="signature">
    <div>交接人签字：_______________</div>
    <div>接收人签字：_______________</div>
    <div>日期：_______________</div>
  </div>
</body>
</html>`;
}

export function printReport(report: Report): void {
  const html = generatePrintHTML(report);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }
}
