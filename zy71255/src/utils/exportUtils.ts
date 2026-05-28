import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import type { ReportData, Enterprise, Transaction, AnomalyRecord } from './types';

export function generateReportHTML(data: ReportData): string {
  const { enterprises, transactions, gaps, anomalies, summary } = data;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>配额流向分析报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
    .header h1 { font-size: 28px; color: #1e293b; margin-bottom: 10px; }
    .header .date { color: #64748b; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
    .summary-card .label { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .summary-card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
    .section { margin-bottom: 40px; }
    .section h2 { font-size: 20px; color: #1e293b; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f1f5f9; font-weight: 600; color: #475569; }
    tr:hover { background: #f8fafc; }
    .high { color: #dc2626; }
    .medium { color: #d97706; }
    .low { color: #2563eb; }
    .gap-positive { color: #16a34a; font-weight: 600; }
    .gap-negative { color: #dc2626; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>配额流向分析报告</h1>
    <p class="date">生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="label">企业总数</div>
      <div class="value">${summary.totalEnterprises}</div>
    </div>
    <div class="summary-card">
      <div class="label">交易总数</div>
      <div class="value">${summary.totalTransactions}</div>
    </div>
    <div class="summary-card">
      <div class="label">交易总额</div>
      <div class="value">${summary.totalAmount.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="label">异常总数</div>
      <div class="value ${summary.totalAnomalies > 0 ? 'high' : ''}">${summary.totalAnomalies}</div>
    </div>
  </div>

  <div class="section">
    <h2>企业信息</h2>
    <table>
      <thead>
        <tr>
          <th>企业ID</th>
          <th>企业名称</th>
          <th>所属行业</th>
          <th>配额额度</th>
          <th>已用额度</th>
          <th>剩余额度</th>
        </tr>
      </thead>
      <tbody>
        ${enterprises.map(e => `
          <tr>
            <td>${e.id}</td>
            <td>${e.name}</td>
            <td>${e.industry}</td>
            <td>${e.quota.toLocaleString()}</td>
            <td>${e.usedQuota.toLocaleString()}</td>
            <td class="${e.quota - e.usedQuota >= 0 ? 'gap-positive' : 'gap-negative'}">${(e.quota - e.usedQuota).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>交易记录</h2>
    <table>
      <thead>
        <tr>
          <th>交易ID</th>
          <th>日期</th>
          <th>企业</th>
          <th>金额</th>
          <th>来源企业</th>
          <th>目标企业</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(tx => `
          <tr>
            <td>${tx.id}</td>
            <td>${tx.date}</td>
            <td>${tx.enterpriseName}</td>
            <td>${tx.amount.toLocaleString()}</td>
            <td>${tx.fromEnterpriseId || '-'}</td>
            <td>${tx.toEnterpriseId || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>缺口分析</h2>
    <table>
      <thead>
        <tr>
          <th>企业ID</th>
          <th>企业名称</th>
          <th>配额额度</th>
          <th>已用额度</th>
          <th>缺口金额</th>
        </tr>
      </thead>
      <tbody>
        ${gaps.map(g => `
          <tr>
            <td>${g.enterpriseId}</td>
            <td>${g.enterpriseName}</td>
            <td>${g.quota.toLocaleString()}</td>
            <td>${g.usedQuota.toLocaleString()}</td>
            <td class="${g.gapAmount > 0 ? 'gap-positive' : 'gap-negative'}">${g.gapAmount.toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>异常检测</h2>
    ${anomalies.length === 0 ? '<p style="color: #64748b; padding: 20px; text-align: center;">未检测到异常</p>' : `
      <table>
        <thead>
          <tr>
            <th>异常类型</th>
            <th>严重程度</th>
            <th>描述</th>
            <th>关联ID</th>
          </tr>
        </thead>
        <tbody>
          ${anomalies.map(a => `
            <tr>
              <td>${a.type}</td>
              <td><span class="${a.severity}">${a.severity}</span></td>
              <td>${a.description}</td>
              <td>${a.relatedIds.join(', ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}
  </div>
</body>
</html>
  `.trim();
}

export async function exportToPDF(data: ReportData, filename: string): Promise<void> {
  const html = generateReportHTML(data);
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    throw new Error('无法打开打印窗口');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  await new Promise(resolve => {
    printWindow.onload = resolve;
  });

  const canvas = await html2canvas(printWindow.document.body, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  printWindow.close();

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'l' : 'p',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function exportToExcel(data: ReportData, filename: string): void {
  const { enterprises, transactions, gaps, anomalies } = data;

  const enterpriseData = enterprises.map((e: Enterprise) => ({
    '企业ID': e.id,
    '企业名称': e.name,
    '所属行业': e.industry,
    '配额额度': e.quota,
    '已用额度': e.usedQuota,
    '剩余额度': e.quota - e.usedQuota
  }));

  const transactionData = transactions.map((tx: Transaction) => ({
    '交易ID': tx.id,
    '日期': tx.date,
    '企业ID': tx.enterpriseId,
    '企业名称': tx.enterpriseName,
    '金额': tx.amount,
    '来源企业': tx.fromEnterpriseId || '',
    '目标企业': tx.toEnterpriseId || '',
    '履约期ID': tx.periodId || '',
    '描述': tx.description || ''
  }));

  const gapData = gaps.map(g => ({
    '企业ID': g.enterpriseId,
    '企业名称': g.enterpriseName,
    '配额额度': g.quota,
    '已用额度': g.usedQuota,
    '缺口金额': g.gapAmount
  }));

  const anomalyData = anomalies.map((a: AnomalyRecord) => ({
    '异常类型': a.type,
    '严重程度': a.severity,
    '描述': a.description,
    '关联ID': a.relatedIds.join(', ')
  }));

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(enterpriseData);
  XLSX.utils.book_append_sheet(wb, ws1, '企业信息');

  const ws2 = XLSX.utils.json_to_sheet(transactionData);
  XLSX.utils.book_append_sheet(wb, ws2, '交易记录');

  const ws3 = XLSX.utils.json_to_sheet(gapData);
  XLSX.utils.book_append_sheet(wb, ws3, '缺口分析');

  const ws4 = XLSX.utils.json_to_sheet(anomalyData);
  XLSX.utils.book_append_sheet(wb, ws4, '问题记录');

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportToJSON(data: ReportData, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function captureScreenshot(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error(`未找到ID为 ${elementId} 的元素`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  canvas.toBlob((blob) => {
    if (!blob) {
      throw new Error('截图生成失败');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
