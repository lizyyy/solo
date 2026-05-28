import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import type { Enterprise, Transaction, Gap, Issue } from '@/types';

export interface ExportData {
  enterprises: Enterprise[];
  transactions: Transaction[];
  gaps: Gap[];
  issues: Issue[];
  periodName?: string;
}

export interface ReportSummary {
  totalEnterprises: number;
  totalTransactions: number;
  totalAmount: number;
  totalGap: number;
  totalIssues: number;
  openIssues: number;
}

function getEnterpriseNameById(enterprises: Enterprise[], id: string): string {
  const ent = enterprises.find(e => e.id === id);
  return ent ? ent.name : id;
}

function getSummary(data: ExportData): ReportSummary {
  const { enterprises, transactions, gaps, issues } = data;
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount * tx.price, 0);
  const totalGap = gaps.reduce((sum, g) => sum + Math.max(0, g.gap), 0);
  const openIssues = issues.filter(i => i.status === 'open').length;

  return {
    totalEnterprises: enterprises.length,
    totalTransactions: transactions.length,
    totalAmount,
    totalGap,
    totalIssues: issues.length,
    openIssues,
  };
}

const issueTypeLabels: Record<string, string> = {
  duplicate_deduction: '配额重复扣除',
  period_misalignment: '履约期错位',
  flow_occlusion: '流线遮挡',
};

const severityLabels: Record<string, { label: string; class: string }> = {
  low: { label: '低', class: 'low' },
  medium: { label: '中', class: 'medium' },
  high: { label: '高', class: 'high' },
};

const statusLabels: Record<string, string> = {
  open: '待处理',
  explained: '已解释',
  fixed: '已修复',
};

export function generateReportHTML(data: ExportData): string {
  const { enterprises, transactions, gaps, issues, periodName } = data;
  const summary = getSummary(data);

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>碳交易流向分析报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
    .header h1 { font-size: 28px; color: #1e293b; margin-bottom: 10px; }
    .header .date { color: #64748b; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
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
    .status-open { color: #dc2626; }
    .status-explained { color: #d97706; }
    .status-fixed { color: #16a34a; }
  </style>
</head>
<body>
  <div class="header">
    <h1>碳交易流向分析报告</h1>
    <p class="date">生成时间: ${new Date().toLocaleString('zh-CN')}${periodName ? ` | 履约期: ${periodName}` : ''}</p>
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
      <div class="label">交易总额(元)</div>
      <div class="value">${summary.totalAmount.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="label">缺口总量(吨)</div>
      <div class="value ${summary.totalGap > 0 ? 'gap-negative' : ''}">${summary.totalGap.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="label">问题总数</div>
      <div class="value">${summary.totalIssues}</div>
    </div>
    <div class="summary-card">
      <div class="label">待处理问题</div>
      <div class="value ${summary.openIssues > 0 ? 'high' : ''}">${summary.openIssues}</div>
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
          <th>配额额度(吨)</th>
          <th>已用额度(吨)</th>
          <th>剩余额度(吨)</th>
        </tr>
      </thead>
      <tbody>
        ${enterprises.map(e => `
          <tr>
            <td>${e.id}</td>
            <td>${e.name}</td>
            <td>${e.industry}</td>
            <td>${e.totalQuota.toLocaleString()}</td>
            <td>${e.usedQuota.toLocaleString()}</td>
            <td class="${e.totalQuota - e.usedQuota >= 0 ? 'gap-positive' : 'gap-negative'}">${(e.totalQuota - e.usedQuota).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>交易流水明细</h2>
    <table>
      <thead>
        <tr>
          <th>交易ID</th>
          <th>日期</th>
          <th>出让企业</th>
          <th>受让企业</th>
          <th>交易量(吨)</th>
          <th>单价(元/吨)</th>
          <th>总金额(元)</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(tx => `
          <tr>
            <td>${tx.id}</td>
            <td>${tx.date}</td>
            <td>${getEnterpriseNameById(enterprises, tx.fromId)}</td>
            <td>${getEnterpriseNameById(enterprises, tx.toId)}</td>
            <td>${tx.amount.toLocaleString()}</td>
            <td>${tx.price.toLocaleString()}</td>
            <td>${(tx.amount * tx.price).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>履约缺口分析</h2>
    <table>
      <thead>
        <tr>
          <th>企业名称</th>
          <th>应缴配额(吨)</th>
          <th>实缴配额(吨)</th>
          <th>缺口(吨)</th>
        </tr>
      </thead>
      <tbody>
        ${gaps.map(g => `
          <tr>
            <td>${getEnterpriseNameById(enterprises, g.enterpriseId)}</td>
            <td>${g.required.toLocaleString()}</td>
            <td>${g.actual.toLocaleString()}</td>
            <td class="${g.gap > 0 ? 'gap-negative' : 'gap-positive'}">${g.gap.toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>问题记录</h2>
    ${issues.length === 0 ? '<p style="color: #64748b; padding: 20px; text-align: center;">未检测到问题</p>' : `
      <table>
        <thead>
          <tr>
            <th>问题类型</th>
            <th>严重程度</th>
            <th>状态</th>
            <th>描述</th>
            <th>关联企业</th>
            <th>修正说明</th>
          </tr>
        </thead>
        <tbody>
          ${issues.map(a => `
            <tr>
              <td>${issueTypeLabels[a.type] || a.type}</td>
              <td><span class="${severityLabels[a.severity]?.class || ''}">${severityLabels[a.severity]?.label || a.severity}</span></td>
              <td><span class="status-${a.status}">${statusLabels[a.status] || a.status}</span></td>
              <td>${a.description}</td>
              <td>${a.enterpriseId ? getEnterpriseNameById(enterprises, a.enterpriseId) : '-'}</td>
              <td>${a.fixNote || '-'}</td>
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

export async function exportToPDF(data: ExportData, filename: string = '碳交易流向报告'): Promise<void> {
  const html = generateReportHTML(data);
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  await new Promise<void>((resolve) => {
    printWindow.onload = () => resolve();
    setTimeout(resolve, 1000);
  });

  const canvas = await html2canvas(printWindow.document.body, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  printWindow.close();

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'l' : 'p',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function exportToExcel(data: ExportData, filename: string = '碳交易流向数据'): void {
  const { enterprises, transactions, gaps, issues } = data;

  const enterpriseData = enterprises.map((e) => ({
    '企业ID': e.id,
    '企业名称': e.name,
    '所属行业': e.industry,
    '配额额度(吨)': e.totalQuota,
    '已用额度(吨)': e.usedQuota,
    '剩余额度(吨)': e.totalQuota - e.usedQuota,
  }));

  const transactionData = transactions.map((tx) => ({
    '交易ID': tx.id,
    '日期': tx.date,
    '出让企业ID': tx.fromId,
    '出让企业名称': getEnterpriseNameById(enterprises, tx.fromId),
    '受让企业ID': tx.toId,
    '受让企业名称': getEnterpriseNameById(enterprises, tx.toId),
    '交易量(吨)': tx.amount,
    '单价(元/吨)': tx.price,
    '总金额(元)': tx.amount * tx.price,
    '履约期ID': tx.periodId,
  }));

  const gapData = gaps.map((g) => ({
    '企业ID': g.enterpriseId,
    '企业名称': getEnterpriseNameById(enterprises, g.enterpriseId),
    '应缴配额(吨)': g.required,
    '实缴配额(吨)': g.actual,
    '缺口(吨)': g.gap,
    '履约期ID': g.periodId,
  }));

  const issueData = issues.map((a) => ({
    '问题ID': a.id,
    '问题类型': issueTypeLabels[a.type] || a.type,
    '严重程度': severityLabels[a.severity]?.label || a.severity,
    '状态': statusLabels[a.status] || a.status,
    '描述': a.description,
    '关联企业ID': a.enterpriseId || '',
    '关联企业名称': a.enterpriseId ? getEnterpriseNameById(enterprises, a.enterpriseId) : '',
    '关联交易ID': a.transactionId || '',
    '修正说明': a.fixNote || '',
  }));

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(enterpriseData);
  XLSX.utils.book_append_sheet(wb, ws1, '企业信息');

  const ws2 = XLSX.utils.json_to_sheet(transactionData);
  XLSX.utils.book_append_sheet(wb, ws2, '交易记录');

  const ws3 = XLSX.utils.json_to_sheet(gapData);
  XLSX.utils.book_append_sheet(wb, ws3, '缺口分析');

  const ws4 = XLSX.utils.json_to_sheet(issueData);
  XLSX.utils.book_append_sheet(wb, ws4, '问题记录');

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportToJSON(data: ExportData, filename: string = '碳交易流向数据'): void {
  const exportData = {
    exportTime: new Date().toISOString(),
    periodName: data.periodName,
    ...data,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
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

export async function captureScreenshot(elementId: string, filename: string = '截图'): Promise<void> {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error(`未找到ID为 ${elementId} 的元素`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0A1628',
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
