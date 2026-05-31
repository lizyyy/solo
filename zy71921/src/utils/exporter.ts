import type { Handover, Material, Exception, StatusLog, Confirmation } from '@/types';
import { generateChecksum } from './materialParser';
import { MATERIAL_TYPE_LABELS, MATERIAL_STATUS_LABELS, EXCEPTION_TYPE_LABELS, HANDOVER_STATUS_LABELS } from '@/types';

interface ExportData {
  handover: Handover;
  materials: Material[];
  exceptions: Exception[];
  statusLogs: StatusLog[];
  confirmations: Confirmation[];
  exportedAt: string;
  version: string;
}

export function prepareExportData(
  handover: Handover,
  materials: Material[],
  exceptions: Exception[],
  statusLogs: StatusLog[],
  confirmations: Confirmation[]
): ExportData {
  return {
    handover,
    materials: materials.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    exceptions: exceptions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    statusLogs: statusLogs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    confirmations: confirmations.sort((a, b) => new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime()),
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
  };
}

export async function exportToJSON(data: ExportData): Promise<{ content: string; checksum: string }> {
  const content = JSON.stringify(data, null, 2);
  const checksum = await generateChecksum(content);
  return { content, checksum };
}

export function exportToCSV(data: ExportData): { content: string; checksum: string } {
  let csv = '\uFEFF';
  
  csv += '=== 交接单信息 ===\n';
  csv += '字段,值\n';
  csv += `ID,${data.handover.id}\n`;
  csv += `标题,${data.handover.title}\n`;
  csv += `状态,${HANDOVER_STATUS_LABELS[data.handover.status]}\n`;
  csv += `操作人,${data.handover.operator}\n`;
  csv += `创建时间,${data.handover.createdAt}\n`;
  csv += '\n';

  csv += '=== 材料清单 ===\n';
  csv += '类型,名称,状态,创建时间\n';
  data.materials.forEach(m => {
    csv += `${MATERIAL_TYPE_LABELS[m.type]},${m.name},${MATERIAL_STATUS_LABELS[m.status]},${m.createdAt}\n`;
  });
  csv += '\n';

  csv += '=== 异常记录 ===\n';
  csv += '类型,严重程度,描述,状态,创建时间\n';
  data.exceptions.forEach(e => {
    csv += `${EXCEPTION_TYPE_LABELS[e.type]},${e.severity},${e.description},${e.status},${e.createdAt}\n`;
  });
  csv += '\n';

  csv += '=== 状态变更记录 ===\n';
  csv += '从状态,到状态,操作人,备注,时间\n';
  data.statusLogs.forEach(s => {
    const from = s.fromStatus ? HANDOVER_STATUS_LABELS[s.fromStatus] : '-';
    const to = HANDOVER_STATUS_LABELS[s.toStatus];
    csv += `${from},${to},${s.operator},${s.remark || '-'},${s.createdAt}\n`;
  });

  const checksum = simpleChecksum(csv);
  return { content: csv, checksum };
}

export function exportToHTML(data: ExportData): string {
  const materialsByType = data.materials.reduce((acc, m) => {
    const type = m.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(m);
    return acc;
  }, {} as Record<string, Material[]>);

  const openExceptions = data.exceptions.filter(e => e.status === 'open').length;
  const resolvedExceptions = data.exceptions.filter(e => e.status === 'resolved').length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.handover.title} - 交接单</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, "PingFang SC", sans-serif; padding: 40px; background: #fff; color: #1a1a1a; }
    .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: 600; margin-bottom: 10px; }
    .meta { color: #666; font-size: 14px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #e8e8e8; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .info-item { font-size: 14px; }
    .info-label { color: #666; margin-right: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e8e8e8; }
    th { background: #f7f7f7; font-weight: 500; }
    .status-normal { color: #10b981; }
    .status-warning { color: #f59e0b; }
    .status-danger { color: #ef4444; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat-item { padding: 15px; background: #f7f7f7; border-radius: 4px; }
    .stat-value { font-size: 24px; font-weight: 600; }
    .stat-label { font-size: 12px; color: #666; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e8e8e8; font-size: 12px; color: #999; }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${data.handover.title}</div>
    <div class="meta">
      交接单号: ${data.handover.id} | 
      操作人: ${data.handover.operator} | 
      导出时间: ${data.exportedAt}
    </div>
  </div>

  <div class="section">
    <div class="section-title">概览</div>
    <div class="stats">
      <div class="stat-item">
        <div class="stat-value">${data.materials.length}</div>
        <div class="stat-label">材料总数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value status-warning">${openExceptions}</div>
        <div class="stat-label">待处理异常</div>
      </div>
      <div class="stat-item">
        <div class="stat-value status-normal">${resolvedExceptions}</div>
        <div class="stat-label">已解决异常</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">基本信息</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">状态:</span>${HANDOVER_STATUS_LABELS[data.handover.status]}</div>
      <div class="info-item"><span class="info-label">创建时间:</span>${data.handover.createdAt}</div>
      <div class="info-item"><span class="info-label">更新时间:</span>${data.handover.updatedAt}</div>
      <div class="info-item"><span class="info-label">操作人:</span>${data.handover.operator}</div>
    </div>
  </div>

  ${Object.entries(materialsByType).map(([type, items]) => `
  <div class="section">
    <div class="section-title">${MATERIAL_TYPE_LABELS[type as keyof typeof MATERIAL_TYPE_LABELS] || type} (${items.length})</div>
    <table>
      <thead>
        <tr>
          <th>名称</th>
          <th>状态</th>
          <th>创建时间</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(m => `
        <tr>
          <td>${m.name}</td>
          <td class="${m.status === 'normal' ? 'status-normal' : m.status === 'duplicate' ? 'status-warning' : 'status-danger'}">
            ${MATERIAL_STATUS_LABELS[m.status]}
          </td>
          <td>${m.createdAt}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  `).join('')}

  ${data.exceptions.length > 0 ? `
  <div class="section">
    <div class="section-title">异常记录</div>
    <table>
      <thead>
        <tr>
          <th>类型</th>
          <th>严重程度</th>
          <th>描述</th>
          <th>状态</th>
          <th>创建时间</th>
        </tr>
      </thead>
      <tbody>
        ${data.exceptions.map(e => `
        <tr>
          <td>${EXCEPTION_TYPE_LABELS[e.type]}</td>
          <td class="${e.severity === 'critical' || e.severity === 'high' ? 'status-danger' : 'status-warning'}">${e.severity}</td>
          <td>${e.description}</td>
          <td class="${e.status === 'resolved' ? 'status-normal' : 'status-warning'}">${e.status}</td>
          <td>${e.createdAt}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">状态变更历史</div>
    <table>
      <thead>
        <tr>
          <th>从状态</th>
          <th>到状态</th>
          <th>操作人</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        ${data.statusLogs.map(s => `
        <tr>
          <td>${s.fromStatus ? HANDOVER_STATUS_LABELS[s.fromStatus] : '-'}</td>
          <td>${HANDOVER_STATUS_LABELS[s.toStatus]}</td>
          <td>${s.operator}</td>
          <td>${s.createdAt}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    导出系统: 雕塑运输交接系统 v${data.version} | 本文件由系统自动生成
  </div>
</body>
</html>`;
}

function simpleChecksum(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
