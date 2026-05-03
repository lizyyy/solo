import { MemoryReport } from '../types';
import { formatHex, formatSize } from '../utils';

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#dc2626';
    case 'HIGH': return '#ea580c';
    case 'MEDIUM': return '#eab308';
    case 'LOW': return '#22c55e';
    default: return '#6b7280';
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'FLASH': return '#3b82f6';
    case 'RAM': return '#10b981';
    case 'OTP': return '#8b5cf6';
    case 'RESERVED': return '#6b7280';
    default: return '#9ca3af';
  }
}

function getUtilizationBar(utilization: number): string {
  let color = '#22c55e';
  if (utilization > 90) color = '#dc2626';
  else if (utilization > 75) color = '#ea580c';
  
  return `
    <div style="background: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;">
      <div style="width: ${Math.min(utilization, 100)}%; height: 100%; background: ${color};"></div>
    </div>
  `;
}

export function generateLayoutHtml(report: MemoryReport): string {
  const criticalCount = report.issues.filter(i => i.severity === 'CRITICAL').length;
  const highCount = report.issues.filter(i => i.severity === 'HIGH').length;
  const mediumCount = report.issues.filter(i => i.severity === 'MEDIUM').length;
  const lowCount = report.issues.filter(i => i.severity === 'LOW').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Firmware Memory Layout Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.5; }
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 28px; margin-bottom: 8px; color: #1e293b; }
    h2 { font-size: 20px; margin: 24px 0 12px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    h3 { font-size: 16px; margin: 16px 0 8px; color: #475569; }
    .header { background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header-meta { color: #64748b; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card-title { font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .card-value { font-size: 32px; font-weight: bold; color: #1e293b; }
    .card-metric { font-size: 14px; color: #64748b; margin-top: 4px; }
    .summary-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .summary-table td { padding: 6px 0; font-size: 14px; }
    .summary-table td:first-child { color: #64748b; }
    .summary-table td:last-child { text-align: right; font-weight: 500; }
    .issues-summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .issue-badge { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 6px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .issue-dot { width: 12px; height: 12px; border-radius: 50%; }
    .issue-count { font-weight: bold; font-size: 18px; }
    .issue-label { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 13px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
    td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    tr:hover td { background: #f8fafc; }
    .severity-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; color: white; }
    .layout-container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
    .layout-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .layout-title { font-weight: 600; }
    .layout-legend { display: flex; gap: 16px; font-size: 12px; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-color { width: 12px; height: 12px; border-radius: 2px; }
    .memory-bar { height: 40px; background: #e5e7eb; border-radius: 6px; position: relative; overflow: hidden; margin: 8px 0; }
    .memory-segment { position: absolute; height: 100%; top: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: white; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.3); overflow: hidden; }
    .memory-segment:hover { opacity: 0.9; }
    .address-labels { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 4px; }
    .region-grid { display: grid; gap: 20px; margin-top: 16px; }
    .region-card { background: #f8fafc; border-radius: 6px; padding: 16px; }
    .region-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .region-name { font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .region-type { font-size: 11px; padding: 2px 8px; border-radius: 4px; color: white; }
    .tooltip { position: relative; }
    .tooltip:hover::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 6px 10px; border-radius: 4px; font-size: 12px; white-space: nowrap; z-index: 100; }
    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: 1fr; }
      .issues-summary { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Firmware Memory Layout Pre-Check Report</h1>
      <div class="header-meta">Generated: ${report.generatedAt.toLocaleString()}</div>
    </div>

    <div class="summary-grid">
      <div class="card">
        <div class="card-title">Flash Usage</div>
        <div class="card-value" style="color: ${report.summary.flash.utilization > 90 ? '#dc2626' : '#3b82f6'}">${formatSize(report.summary.flash.used)}</div>
        <div class="card-metric">of ${formatSize(report.summary.flash.total)} (${report.summary.flash.utilization.toFixed(1)}%)</div>
        <div style="margin-top: 12px;">${getUtilizationBar(report.summary.flash.utilization)}</div>
        <table class="summary-table">
          <tr><td>Free</td><td>${formatSize(report.summary.flash.free)}</td></tr>
          <tr><td>Used</td><td>${formatSize(report.summary.flash.used)}</td></tr>
          <tr><td>Total</td><td>${formatSize(report.summary.flash.total)}</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">RAM Usage</div>
        <div class="card-value" style="color: ${report.summary.ram.utilization > 90 ? '#dc2626' : '#10b981'}">${formatSize(report.summary.ram.used)}</div>
        <div class="card-metric">of ${formatSize(report.summary.ram.total)} (${report.summary.ram.utilization.toFixed(1)}%)</div>
        <div style="margin-top: 12px;">${getUtilizationBar(report.summary.ram.utilization)}</div>
        <table class="summary-table">
          <tr><td>Free</td><td>${formatSize(report.summary.ram.free)}</td></tr>
          <tr><td>Used</td><td>${formatSize(report.summary.ram.used)}</td></tr>
          <tr><td>Total</td><td>${formatSize(report.summary.ram.total)}</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">Issues Detected</div>
        <div class="card-value" style="color: ${report.issues.length > 0 ? '#dc2626' : '#22c55e'}">${report.issues.length}</div>
        <div class="card-metric">${report.issues.length === 0 ? 'All checks passed!' : 'See details below'}</div>
        <table class="summary-table">
          <tr><td><span style="color: ${getSeverityColor('CRITICAL')}">●</span> Critical</td><td>${criticalCount}</td></tr>
          <tr><td><span style="color: ${getSeverityColor('HIGH')}">●</span> High</td><td>${highCount}</td></tr>
          <tr><td><span style="color: ${getSeverityColor('MEDIUM')}">●</span> Medium</td><td>${mediumCount}</td></tr>
          <tr><td><span style="color: ${getSeverityColor('LOW')}">●</span> Low</td><td>${lowCount}</td></tr>
        </table>
      </div>
    </div>

    ${report.issues.length > 0 ? `
    <h2>Issues</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Severity</th>
          <th>Type</th>
          <th>Title</th>
          <th>Affected Region</th>
          <th>Address</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        ${report.issues.map(issue => `
        <tr>
          <td><code>${issue.id}</code></td>
          <td><span class="severity-badge" style="background: ${getSeverityColor(issue.severity)}">${issue.severity}</span></td>
          <td>${issue.type}</td>
          <td><strong>${issue.title}</strong><br><small style="color: #64748b">${issue.description}</small></td>
          <td>${issue.affectedRegion || '-'}</td>
          <td>${issue.address !== undefined ? `<code>${formatHex(issue.address)}</code>` : '-'}</td>
          <td>${issue.size !== undefined ? formatSize(issue.size) : '-'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    <h2>Memory Layout Visualization</h2>
    
    ${report.regions.map(region => {
      const totalSize = Number(region.length);
      const segments = [];
      
      for (const section of region.sections) {
        const start = Number(section.address - region.origin);
        const size = Number(section.size);
        const startPercent = (start / totalSize) * 100;
        const widthPercent = (size / totalSize) * 100;
        
        segments.push({
          name: section.name,
          startPercent,
          widthPercent,
          size,
          address: section.address
        });
      }
      
      return `
      <div class="layout-container">
        <div class="layout-header">
          <div class="layout-title">
            <span class="legend-color" style="background: ${getTypeColor(region.type)}"></span>
            ${region.name} (${region.type})
          </div>
          <div style="font-size: 12px; color: #64748b">
            ${formatHex(region.origin)} - ${formatHex(region.origin + region.length)} | ${formatSize(region.length)}
          </div>
        </div>
        <div class="memory-bar">
          ${segments.map((seg, i) => `
          <div class="memory-segment tooltip" 
               style="left: ${seg.startPercent}%; width: ${seg.widthPercent}%; background: ${i % 2 === 0 ? getTypeColor(region.type) : `${getTypeColor(region.type)}dd`}"
               data-tooltip="${seg.name}: ${formatSize(BigInt(seg.size))} at ${formatHex(seg.address)}">
            ${seg.widthPercent > 10 ? seg.name : ''}
          </div>
          `).join('')}
        </div>
        <div class="address-labels">
          <span>${formatHex(region.origin)}</span>
          <span>${formatHex(region.origin + region.length / 2n)}</span>
          <span>${formatHex(region.origin + region.length)}</span>
        </div>
      </div>
      `;
    }).join('')}

    <h2>Memory Regions Detail</h2>
    <table>
      <thead>
        <tr>
          <th>Region</th>
          <th>Type</th>
          <th>Origin</th>
          <th>Length</th>
          <th>Used</th>
          <th>Free</th>
          <th>Utilization</th>
        </tr>
      </thead>
      <tbody>
        ${report.regions.map(region => `
        <tr>
          <td><strong>${region.name}</strong></td>
          <td><span class="region-type" style="background: ${getTypeColor(region.type)}">${region.type}</span></td>
          <td><code>${formatHex(region.origin)}</code></td>
          <td>${formatSize(region.length)}</td>
          <td>${formatSize(region.used)}</td>
          <td>${formatSize(region.free)}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${getUtilizationBar(region.utilization)}
              <span>${region.utilization.toFixed(1)}%</span>
            </div>
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    ${report.otaStatus && report.otaStatus.partitions.length > 0 ? `
    <h2>OTA Partition Status</h2>
    <table>
      <thead>
        <tr>
          <th>Partition</th>
          <th>Start</th>
          <th>End</th>
          <th>Used</th>
          <th>Free</th>
          <th>Min Required</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${report.otaStatus.partitions.map(p => {
          const statusColor = p.status === 'OK' ? '#22c55e' : p.status === 'WARNING' ? '#eab308' : '#dc2626';
          return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td><code>${formatHex(p.start)}</code></td>
          <td><code>${formatHex(p.end)}</code></td>
          <td>${formatSize(p.used)}</td>
          <td>${formatSize(p.free)}</td>
          <td>${formatSize(p.minRequired)}</td>
          <td><span class="severity-badge" style="background: ${statusColor}">${p.status}</span></td>
        </tr>
        `;
        }).join('')}
      </tbody>
    </table>
    ` : ''}

    ${report.features ? `
    <h2>Feature Status</h2>
    
    ${report.features.enabled.length > 0 ? `
    <h3>Enabled Features</h3>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Flash Delta</th>
          <th>RAM Delta</th>
        </tr>
      </thead>
      <tbody>
        ${report.features.enabled.map(f => `
        <tr>
          <td>${f.featureName}</td>
          <td>${f.memoryImpact.flashDelta > 0 ? '+' : ''}${formatSize(BigInt(f.memoryImpact.flashDelta))}</td>
          <td>${f.memoryImpact.ramDelta > 0 ? '+' : ''}${formatSize(BigInt(f.memoryImpact.ramDelta))}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${report.features.disabled.length > 0 ? `
    <h3>Disabled Features</h3>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Flash Delta</th>
          <th>RAM Delta</th>
        </tr>
      </thead>
      <tbody>
        ${report.features.disabled.map(f => `
        <tr>
          <td>${f.featureName}</td>
          <td>${f.memoryImpact.flashDelta > 0 ? '+' : ''}${formatSize(BigInt(f.memoryImpact.flashDelta))}</td>
          <td>${f.memoryImpact.ramDelta > 0 ? '+' : ''}${formatSize(BigInt(f.memoryImpact.ramDelta))}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${report.features.rollbackRisk ? `
    <h3>Rollback Risk Analysis</h3>
    <div class="card">
      <p><strong>Can Rollback:</strong> ${report.features.rollbackRisk.canRollback ? '✅ Yes' : '❌ No'}</p>
      <p><strong>Max Flash Needed for Rollback:</strong> ${formatSize(report.features.rollbackRisk.maxFlashNeeded)}</p>
      <p><strong>Available Flash:</strong> ${formatSize(report.features.rollbackRisk.availableFlash)}</p>
      ${report.features.rollbackRisk.criticalFeatures.length > 0 ? `<p><strong>Critical Features at Risk:</strong> ${report.features.rollbackRisk.criticalFeatures.join(', ')}</p>` : ''}
    </div>
    ` : ''}
    ` : ''}

  </div>
</body>
</html>`;
}
