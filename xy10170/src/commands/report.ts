import * as path from 'path';
import * as fs from 'fs-extra';
import { differenceInDays } from 'date-fns';
import config from '../config';
import certificateRepository from '../database/repositories/certificateRepository';
import historyRepository from '../database/repositories/historyRepository';
import db from '../database/connection';
import { Certificate, CertificateType, CertificateStatus } from '../types';
import { formatErrorForUser } from '../utils/errors';

interface ReportOptions {
  format?: 'html' | 'csv' | 'json';
  output?: string;
  windows?: string;
  types?: string;
  includeExpired?: boolean;
  reminders?: boolean;
}

function getTypeLabel(type: CertificateType): string {
  const labels: Record<CertificateType, string> = {
    [CertificateType.SSL]: 'SSL证书',
    [CertificateType.DOMAIN]: '域名',
    [CertificateType.VENDOR]: '供应商资质',
    [CertificateType.EMPLOYEE]: '员工证书'
  };
  return labels[type] || type;
}

function getStatusLabel(status: CertificateStatus): string {
  const labels: Record<CertificateStatus, string> = {
    [CertificateStatus.ACTIVE]: '正常',
    [CertificateStatus.EXPIRING]: '即将到期',
    [CertificateStatus.EXPIRED]: '已过期',
    [CertificateStatus.MERGED]: '已合并'
  };
  return labels[status] || status;
}

function padZero(num: number, len: number = 2): string {
  return num.toString().padStart(len, '0');
}

function formatDateChinese(date: Date): string {
  return `${date.getFullYear()}年${padZero(date.getMonth() + 1)}月${padZero(date.getDate())}日`;
}

function formatDate(dateString: string): string {
  try {
    return formatDateChinese(new Date(dateString));
  } catch {
    return dateString;
  }
}

function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

function formatFileTimestamp(date: Date): string {
  return `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}_${padZero(date.getHours())}${padZero(date.getMinutes())}${padZero(date.getSeconds())}`;
}

function calculateDaysUntilExpiry(cert: Certificate): number {
  const expiryDate = new Date(cert.expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(expiryDate, today);
}

function getSeverity(days: number): string {
  if (days < 0) return 'critical';
  if (days <= 7) return 'high';
  if (days <= 30) return 'medium';
  if (days <= 90) return 'low';
  return 'normal';
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    critical: '严重',
    high: '高危',
    medium: '中等',
    low: '低危',
    normal: '正常'
  };
  return labels[severity] || severity;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a',
    normal: '#2563eb'
  };
  return colors[severity] || '#6b7280';
}

function parseWindows(windowsStr?: string): number[] {
  if (!windowsStr) return config.defaultExpiryWindows;
  return windowsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
}

function parseTypes(typesStr?: string): CertificateType[] {
  if (!typesStr) return Object.values(CertificateType);
  const types = typesStr.split(',').map(s => s.trim().toUpperCase());
  return types.filter((t): t is CertificateType => 
    Object.values(CertificateType).includes(t as CertificateType)
  );
}

async function generateHTMLReport(
  certs: Certificate[],
  stats: any,
  windows: number[],
  reminders: boolean
): Promise<string> {
  const today = formatDateChinese(new Date());
  
  const groupedByWindow: Record<number, Certificate[]> = {};
  const expired: Certificate[] = [];
  
  certs.forEach(cert => {
    const days = calculateDaysUntilExpiry(cert);
    
    if (days < 0) {
      expired.push(cert);
      return;
    }
    
    for (const window of windows.sort((a, b) => a - b)) {
      if (days <= window) {
        if (!groupedByWindow[window]) groupedByWindow[window] = [];
        groupedByWindow[window].push(cert);
        return;
      }
    }
  });
  
  let tableRows = '';
  certs.forEach(cert => {
    const days = calculateDaysUntilExpiry(cert);
    const severity = getSeverity(days);
    const color = getSeverityColor(severity);
    const daysText = days < 0 ? `已过期 ${Math.abs(days)} 天` : `${days} 天`;
    
    tableRows += `
      <tr>
        <td>${cert.name}</td>
        <td>${getTypeLabel(cert.type)}</td>
        <td>${formatDate(cert.issueDate)}</td>
        <td>${formatDate(cert.expiryDate)}</td>
        <td style="color: ${color}; font-weight: bold;">${daysText}</td>
        <td>${cert.ownerName || '-'}</td>
        <td>${cert.source}</td>
      </tr>
    `;
  });
  
  let reminderSection = '';
  if (reminders) {
    let reminderRows = '';
    
    if (expired.length > 0) {
      reminderRows += `
        <div class="reminder critical">
          <h3>🔴 已过期 (${expired.length} 个)</h3>
          <ul>
            ${expired.map(c => `<li><strong>${c.name}</strong> - ${formatDate(c.expiryDate)} 过期, 责任人: ${c.ownerName || '未分配'}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    for (const window of windows.sort((a, b) => a - b)) {
      const windowCerts = groupedByWindow[window] || [];
      if (windowCerts.length > 0) {
        const severity = window <= 7 ? 'high' : window <= 30 ? 'medium' : 'low';
        reminderRows += `
          <div class="reminder ${severity}">
            <h3>${window <= 7 ? '🟠' : window <= 30 ? '🟡' : '🟢'} ${window} 天内到期 (${windowCerts.length} 个)</h3>
            <ul>
              ${windowCerts.map(c => `<li><strong>${c.name}</strong> - ${formatDate(c.expiryDate)} 到期, 责任人: ${c.ownerName || '未分配'}${c.ownerEmail ? ` (${c.ownerEmail})` : ''}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    }
    
    reminderSection = `
      <div class="reminders">
        <h2>📢 到期提醒</h2>
        ${reminderRows || '<p>暂无即将到期的证书</p>'}
      </div>
    `;
  }
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>证书到期盘点报告 - ${today}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    h1 { color: #111827; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin: 30px 0 15px; }
    h3 { color: #4b5563; margin: 15px 0 10px; }
    .summary {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-top: 15px;
    }
    .stat-item {
      flex: 1;
      min-width: 150px;
      background: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-label {
      font-size: 14px;
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-top: 10px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    tr:hover { background: #f9fafb; }
    .reminders { margin-top: 30px; }
    .reminder {
      background: white;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 4px solid #6b7280;
    }
    .reminder.critical { border-left-color: #dc2626; background: #fef2f2; }
    .reminder.high { border-left-color: #ea580c; background: #fff7ed; }
    .reminder.medium { border-left-color: #ca8a04; background: #fefce8; }
    .reminder.low { border-left-color: #16a34a; background: #f0fdf4; }
    .reminder ul { margin-left: 20px; margin-top: 10px; }
    .reminder li { margin: 5px 0; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>📊 证书到期盘点报告</h1>
  
  <div class="summary">
    <h2>📈 统计概览</h2>
    <p><strong>报告日期:</strong> ${today}</p>
    <p><strong>到期窗口:</strong> ${windows.join(', ')} 天</p>
    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">证书总数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: #dc2626;">${stats.expired}</div>
        <div class="stat-label">已过期</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: #ea580c;">${stats.expiring}</div>
        <div class="stat-label">即将到期</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: #16a34a;">${stats.active}</div>
        <div class="stat-label">正常</div>
      </div>
    </div>
  </div>
  
  ${reminderSection}
  
  <div class="details">
    <h2>📋 证书明细</h2>
    <table>
      <thead>
        <tr>
          <th>名称</th>
          <th>类型</th>
          <th>颁发日期</th>
          <th>到期日期</th>
          <th>剩余天数</th>
          <th>责任人</th>
          <th>来源</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
  
  <div class="footer">
    <p>证书到期批量盘点 CLI 工具生成</p>
    <p>生成时间: ${formatTimestamp(new Date())}</p>
  </div>
</body>
</html>
  `;
}

async function generateCSVReport(certs: Certificate[]): Promise<string> {
  const headers = [
    '名称', '类型', '颁发日期', '到期日期', '剩余天数', 
    '责任人', '责任人邮箱', '部门', '颁发者', 
    '序列号', '指纹', '状态', '来源', '备注'
  ];
  
  const rows = certs.map(cert => {
    const days = calculateDaysUntilExpiry(cert);
    return [
      cert.name,
      getTypeLabel(cert.type),
      cert.issueDate,
      cert.expiryDate,
      days < 0 ? `-${Math.abs(days)}` : days.toString(),
      cert.ownerName || '',
      cert.ownerEmail || '',
      cert.department || '',
      cert.issuer || '',
      cert.serialNumber || '',
      cert.fingerprint || '',
      getStatusLabel(cert.status),
      cert.source,
      (cert.notes || '').replace(/\n/g, ' ')
    ].map(v => `"${v.toString().replace(/"/g, '""')}"`).join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}

async function generateJSONReport(certs: Certificate[], stats: any): Promise<string> {
  const report = {
    generatedAt: new Date().toISOString(),
    stats,
    certificates: certs.map(cert => ({
      ...cert,
      daysUntilExpiry: calculateDaysUntilExpiry(cert),
      severity: getSeverity(calculateDaysUntilExpiry(cert))
    }))
  };
  return JSON.stringify(report, null, 2);
}

export async function executeReport(options: ReportOptions): Promise<void> {
  console.log('\n📊 生成证书到期盘点报告...\n');
  
  try {
    await db.init();
    
    const reportFormat = options.format || 'html';
    const windows = parseWindows(options.windows);
    const types = parseTypes(options.types);
    
    console.log(`📋 报告格式: ${reportFormat.toUpperCase()}`);
    console.log(`⏰ 到期窗口: ${windows.join(', ')} 天`);
    console.log(`📦 证书类型: ${types.map(getTypeLabel).join(', ')}\n`);
    
    // 获取所有活跃证书
    let allCerts = await certificateRepository.findAll();
    let activeCerts = allCerts.filter(c => c.status !== CertificateStatus.MERGED);
    
    // 按类型过滤
    activeCerts = activeCerts.filter(c => types.includes(c.type));
    
    // 是否包含已过期
    if (!options.includeExpired) {
      activeCerts = activeCerts.filter(c => {
        const days = calculateDaysUntilExpiry(c);
        return days >= 0;
      });
    }
    
    if (activeCerts.length === 0) {
      console.log('⚠️  没有符合条件的证书数据');
      return;
    }
    
    // 计算统计数据
    const stats = {
      total: activeCerts.length,
      expired: activeCerts.filter(c => calculateDaysUntilExpiry(c) < 0).length,
      expiring: activeCerts.filter(c => {
        const days = calculateDaysUntilExpiry(c);
        return days >= 0 && days <= 30;
      }).length,
      active: activeCerts.filter(c => calculateDaysUntilExpiry(c) > 30).length,
      byType: {} as Record<string, number>
    };
    
    types.forEach(type => {
      stats.byType[getTypeLabel(type)] = activeCerts.filter(c => c.type === type).length;
    });
    
    // 按剩余天数排序
    activeCerts.sort((a, b) => calculateDaysUntilExpiry(a) - calculateDaysUntilExpiry(b));
    
    // 生成报告内容
    let content: string;
    let extension: string;
    
    switch (reportFormat) {
      case 'csv':
        content = await generateCSVReport(activeCerts);
        extension = 'csv';
        break;
      case 'json':
        content = await generateJSONReport(activeCerts, stats);
        extension = 'json';
        break;
      case 'html':
      default:
        content = await generateHTMLReport(activeCerts, stats, windows, options.reminders !== false);
        extension = 'html';
    }
    
    // 确定输出路径
    const timestamp = formatFileTimestamp(new Date());
    const defaultFilename = `certificate_report_${timestamp}.${extension}`;
    let outputPath: string;
    
    if (options.output) {
      const stat = await fs.stat(options.output).catch(() => null);
      if (stat && stat.isDirectory()) {
        outputPath = path.join(options.output, defaultFilename);
      } else {
        outputPath = options.output;
      }
    } else {
      outputPath = path.join(config.reportDir, defaultFilename);
    }
    
    // 确保输出目录存在
    await fs.ensureDir(path.dirname(outputPath));
    
    // 写入文件
    await fs.writeFile(outputPath, content, 'utf8');
    
    // 记录历史
    try {
      for (const cert of activeCerts) {
        await historyRepository.addRecord(
          cert.id,
          'EXPORT',
          `导出到报告: ${path.basename(outputPath)}`
        );
      }
    } catch (e) {
      // 忽略历史记录错误
    }
    
    console.log('✅ 报告生成成功！\n');
    console.log(`📁 输出文件: ${outputPath}`);
    console.log(`📊 统计信息:`);
    console.log(`   总数: ${stats.total}`);
    console.log(`   已过期: ${stats.expired}`);
    console.log(`   即将到期: ${stats.expiring}`);
    console.log(`   正常: ${stats.active}\n`);
    
    console.log(`📦 按类型分布:`);
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    console.log('');
    
    if (reportFormat === 'html') {
      console.log('💡 提示: 用浏览器打开 HTML 文件可查看美化后的报告');
    }
    
  } catch (error) {
    console.error(formatErrorForUser(error));
    process.exit(1);
  }
}
