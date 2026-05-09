import type { ProjectData, ReportData } from '../types';
import {
  getValidationSummary,
  checkBoothOverlap,
  getShortestPathForZone
} from './';

export function generateReportData(project: ProjectData): ReportData {
  const summary = getValidationSummary(project.validationResults);
  
  const evacuationPaths = project.zones.map(zone => {
    const shortestPath = getShortestPathForZone(zone.id, project.evacuationPaths);
    const exit = project.exits.find(e => e.id === shortestPath?.toExit);
    
    return {
      zone: zone.name,
      exit: exit?.name || '未知',
      distance: shortestPath?.distance || 0,
      maxAllowed: project.config.maxEvacuationDistance,
      status: shortestPath 
        ? (shortestPath.isBlocked 
            ? 'blocked' 
            : (shortestPath.distance > project.config.maxEvacuationDistance 
                ? 'over_limit' 
                : 'ok'))
        : 'blocked',
      waypoints: shortestPath?.waypoints || []
    };
  });
  
  const overlaps = checkBoothOverlap(project.booths);
  const boothDetails = project.booths.map(booth => {
    const boothOverlaps = overlaps.filter(
      o => o.booth1 === booth.id || o.booth2 === booth.id
    ).map(o => {
      const otherId = o.booth1 === booth.id ? o.booth2 : o.booth1;
      const other = project.booths.find(b => b.id === otherId);
      return other?.name || otherId;
    });
    
    return {
      name: booth.name,
      position: booth.position,
      dimension: booth.dimension,
      overlaps: boothOverlaps
    };
  });
  
  const exitDetails = project.exits.map(exit => {
    const nearbyBooth = project.booths.find(booth => {
      const exitCenter = { x: exit.position.x, z: exit.position.z };
      const boothCenter = {
        x: booth.position.x + booth.dimension.width / 2,
        z: booth.position.z + booth.dimension.depth / 2
      };
      const distance = Math.sqrt(
        Math.pow(exitCenter.x - boothCenter.x, 2) +
        Math.pow(exitCenter.z - boothCenter.z, 2)
      );
      return distance < 2.0;
    });
    
    return {
      name: exit.name,
      position: exit.position,
      accessibility: nearbyBooth ? `被「${nearbyBooth.name}」阻挡` : '正常'
    };
  });
  
  return {
    projectName: project.name,
    generatedAt: new Date().toLocaleString('zh-CN'),
    totalBooths: project.booths.length,
    totalExits: project.exits.length,
    totalZones: project.zones.length,
    validationSummary: summary,
    evacuationPaths,
    boothDetails,
    exitDetails
  };
}

export function exportReportAsHTML(report: ReportData): string {
  const overallStatus = report.validationSummary.error > 0 
    ? '存在严重问题' 
    : (report.validationSummary.warning > 0 
        ? '存在警告' 
        : '全部合格');
  
  const overallStatusClass = report.validationSummary.error > 0 
    ? 'text-red-600' 
    : (report.validationSummary.warning > 0 
        ? 'text-yellow-600' 
        : 'text-green-600');
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>疏散路线预演报告 - ${report.projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 { font-size: 28px; margin-bottom: 10px; color: #1a1a1a; }
    h2 { font-size: 20px; margin: 30px 0 15px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
    h3 { font-size: 16px; margin: 20px 0 10px; color: #34495e; }
    .meta { color: #7f8c8d; font-size: 14px; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .summary-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .summary-card .number { font-size: 36px; font-weight: bold; color: #3498db; }
    .summary-card .label { font-size: 14px; color: #7f8c8d; margin-top: 5px; }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
    }
    .status-ok { background: #d4edda; color: #155724; }
    .status-warning { background: #fff3cd; color: #856404; }
    .status-error { background: #f8d7da; color: #721c24; }
    .status-blocked { background: #f8d7da; color: #721c24; }
    .status-over_limit { background: #ffeaa7; color: #e17055; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f5f6fa;
      font-weight: 600;
      color: #2c3e50;
    }
    tr:hover { background: #fafafa; }
    .overall-status {
      font-size: 20px;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #95a5a6;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>展馆疏散路线预演报告</h1>
  <p class="meta">项目名称：${report.projectName} | 生成时间：${report.generatedAt}</p>
  
  <h2>总体评估</h2>
  <div class="overall-status ${overallStatusClass}">总体状态：${overallStatus}</div>
  
  <div class="summary-grid">
    <div class="summary-card">
      <div class="number">${report.totalBooths}</div>
      <div class="label">展位总数</div>
    </div>
    <div class="summary-card">
      <div class="number">${report.totalExits}</div>
      <div class="label">安全出口</div>
    </div>
    <div class="summary-card">
      <div class="number">${report.totalZones}</div>
      <div class="label">疏散区域</div>
    </div>
    <div class="summary-card">
      <div class="number" style="color: ${report.validationSummary.error > 0 ? '#e74c3c' : (report.validationSummary.warning > 0 ? '#f39c12' : '#27ae60')}">
        ${report.validationSummary.error > 0 ? '⚠️' : (report.validationSummary.warning > 0 ? '⚡' : '✓')}
      </div>
      <div class="label">
        ${report.validationSummary.error > 0 ? `${report.validationSummary.error}个错误` : 
          (report.validationSummary.warning > 0 ? `${report.validationSummary.warning}个警告` : '无问题')}
      </div>
    </div>
  </div>
  
  <h2>验证结果统计</h2>
  <table>
    <thead>
      <tr>
        <th>状态</th>
        <th>数量</th>
        <th>说明</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="status-badge status-ok">合格</span></td>
        <td>${report.validationSummary.ok}</td>
        <td>符合安全规范</td>
      </tr>
      <tr>
        <td><span class="status-badge status-warning">警告</span></td>
        <td>${report.validationSummary.warning}</td>
        <td>建议优化</td>
      </tr>
      <tr>
        <td><span class="status-badge status-error">错误</span></td>
        <td>${report.validationSummary.error}</td>
        <td>必须整改</td>
      </tr>
    </tbody>
  </table>
  
  <h2>疏散路线分析</h2>
  <table>
    <thead>
      <tr>
        <th>区域</th>
        <th>最近出口</th>
        <th>距离 (米)</th>
        <th>最大限制 (米)</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>
      ${report.evacuationPaths.map(path => `
      <tr>
        <td>${path.zone}</td>
        <td>${path.exit}</td>
        <td>${path.distance.toFixed(2)}</td>
        <td>${path.maxAllowed}</td>
        <td>
          <span class="status-badge status-${path.status}">
            ${path.status === 'ok' ? '正常' : 
              path.status === 'over_limit' ? '超限' : 
              path.status === 'blocked' ? '阻断' : path.status}
          </span>
        </td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <h2>展位详情</h2>
  <table>
    <thead>
      <tr>
        <th>展位名称</th>
        <th>位置 (X, Z)</th>
        <th>尺寸 (宽 × 深)</th>
        <th>重叠问题</th>
      </tr>
    </thead>
    <tbody>
      ${report.boothDetails.map(booth => `
      <tr>
        <td>${booth.name}</td>
        <td>(${booth.position.x.toFixed(1)}, ${booth.position.z.toFixed(1)})</td>
        <td>${booth.dimension.width} × ${booth.dimension.depth}</td>
        <td>
          ${booth.overlaps.length > 0 
            ? `<span class="status-badge status-error">与 ${booth.overlaps.join('、')} 重叠</span>`
            : '<span class="status-badge status-ok">正常</span>'}
        </td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <h2>安全出口详情</h2>
  <table>
    <thead>
      <tr>
        <th>出口名称</th>
        <th>位置 (X, Z)</th>
        <th>可访问性</th>
      </tr>
    </thead>
    <tbody>
      ${report.exitDetails.map(exit => `
      <tr>
        <td>${exit.name}</td>
        <td>(${exit.position.x.toFixed(1)}, ${exit.position.z.toFixed(1)})</td>
        <td>
          ${exit.accessibility === '正常' 
            ? '<span class="status-badge status-ok">正常</span>'
            : `<span class="status-badge status-error">${exit.accessibility}</span>`}
        </td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <p>本报告由「展馆疏散路线三维预演系统」自动生成</p>
    <p>报告数据仅供参考，实际疏散方案需经专业审核</p>
  </div>
</body>
</html>`;
}

export function exportReportAsCSV(report: ReportData): string {
  const lines: string[] = [];
  
  lines.push('展馆疏散路线预演报告');
  lines.push(`项目名称,${report.projectName}`);
  lines.push(`生成时间,${report.generatedAt}`);
  lines.push('');
  
  lines.push('统计概览');
  lines.push('展位总数,安全出口,疏散区域,合格数,警告数,错误数');
  lines.push(`${report.totalBooths},${report.totalExits},${report.totalZones},${report.validationSummary.ok},${report.validationSummary.warning},${report.validationSummary.error}`);
  lines.push('');
  
  lines.push('疏散路线');
  lines.push('区域,最近出口,距离(米),最大限制(米),状态');
  report.evacuationPaths.forEach(path => {
    const status = path.status === 'ok' ? '正常' : 
                   path.status === 'over_limit' ? '超限' : 
                   path.status === 'blocked' ? '阻断' : path.status;
    lines.push(`${path.zone},${path.exit},${path.distance.toFixed(2)},${path.maxAllowed},${status}`);
  });
  lines.push('');
  
  lines.push('展位详情');
  lines.push('展位名称,位置X,位置Z,宽度,深度,重叠问题');
  report.boothDetails.forEach(booth => {
    lines.push(`${booth.name},${booth.position.x.toFixed(1)},${booth.position.z.toFixed(1)},${booth.dimension.width},${booth.dimension.depth},${booth.overlaps.length > 0 ? '与 ' + booth.overlaps.join('、') + ' 重叠' : '无'}`);
  });
  lines.push('');
  
  lines.push('安全出口');
  lines.push('出口名称,位置X,位置Z,可访问性');
  report.exitDetails.forEach(exit => {
    lines.push(`${exit.name},${exit.position.x.toFixed(1)},${exit.position.z.toFixed(1)},${exit.accessibility}`);
  });
  
  return lines.join('\n');
}

export function downloadReportHTML(report: ReportData): void {
  const html = exportReportAsHTML(report);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `疏散报告-${report.projectName}-${Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadReportCSV(report: ReportData): void {
  const csv = exportReportAsCSV(report);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `疏散报告-${report.projectName}-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
