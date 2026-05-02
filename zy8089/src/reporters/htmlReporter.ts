import * as fs from 'fs';
import { OtaValidationResult } from '../types';

export function generateTimelineHtml(result: OtaValidationResult, outputPath: string): void {
  const timelineEvents = result.rolloutDevices.map((device, index) => {
    const isFailed = result.versionValidation.devicesWithHigherVersion.includes(device.deviceId) ||
                    result.versionValidation.devicesBelowMinVersion.includes(device.deviceId) ||
                    result.versionValidation.incompatibleDevices.includes(device.deviceId);
    
    return {
      id: `event-${index}`,
      deviceId: device.deviceId,
      status: isFailed ? 'failed' : 'pending' as const,
      progress: isFailed ? 0 : 0,
      priority: device.priority,
      region: device.region,
      currentVersion: device.currentVersion,
      targetVersion: device.targetVersion,
      error: isFailed ? 'Validation failed' : undefined
    };
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTA Rollout Timeline</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0; opacity: 0.9; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-card .label { color: #666; font-size: 12px; text-transform: uppercase; }
    .stat-card .value { font-size: 24px; font-weight: bold; color: #333; }
    .stat-card.error .value { color: #e74c3c; }
    .stat-card.success .value { color: #27ae60; }
    .timeline { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
    .timeline-header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; }
    .timeline-body { max-height: 500px; overflow-y: auto; }
    .event-row { display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s; }
    .event-row:hover { background: #fafafa; }
    .event-row:last-child { border-bottom: none; }
    .status-dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 12px; }
    .status-pending { background: #f39c12; }
    .status-in_progress { background: #3498db; animation: pulse 1.5s infinite; }
    .status-completed { background: #27ae60; }
    .status-failed { background: #e74c3c; }
    .event-info { flex: 1; }
    .event-info .device-id { font-weight: 600; color: #333; }
    .event-info .details { font-size: 12px; color: #666; margin-top: 2px; }
    .event-meta { text-align: right; font-size: 12px; color: #999; }
    .priority-high { color: #e74c3c; }
    .priority-medium { color: #f39c12; }
    .priority-low { color: #95a5a6; }
    .progress-bar { width: 100px; height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden; margin-left: 15px; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 3px; transition: width 0.3s; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .summary { margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px; }
    .summary h3 { margin: 0 0 10px; color: #856404; }
    .summary ul { margin: 0; padding-left: 20px; }
    .summary li { color: #856404; margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>OTA Rollout Timeline</h1>
    <p>Firmware Version: ${result.manifest.version} | Target: ${result.manifest.targetDeviceType}</p>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="label">Total Devices</div>
      <div class="value">${result.rolloutDevices.length}</div>
    </div>
    <div class="stat-card success">
      <div class="label">Validation Pass</div>
      <div class="value">${result.rolloutDevices.length - result.totalErrors}</div>
    </div>
    <div class="stat-card error">
      <div class="label">Errors</div>
      <div class="value">${result.totalErrors}</div>
    </div>
    <div class="stat-card">
      <div class="label">Warnings</div>
      <div class="value">${result.totalWarnings}</div>
    </div>
  </div>

  <div class="timeline">
    <div class="timeline-header">
      <span><strong>Rollout Queue</strong> - ${timelineEvents.length} devices</span>
      <span style="color: #666; font-size: 12px;">Generated: ${new Date().toLocaleString()}</span>
    </div>
    <div class="timeline-body">
      ${timelineEvents.map(event => `
      <div class="event-row">
        <div class="status-dot status-${event.status}"></div>
        <div class="event-info">
          <div class="device-id">${event.deviceId}</div>
          <div class="details">${event.currentVersion} → ${event.targetVersion} | ${event.region}</div>
        </div>
        <div class="event-meta">
          <span class="priority-${event.priority}">${event.priority.toUpperCase()}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${event.progress}%"></div>
        </div>
      </div>
      `).join('')}
    </div>
  </div>

  ${result.totalErrors > 0 ? `
  <div class="summary">
    <h3>Validation Issues</h3>
    <ul>
      ${result.versionValidation.devicesWithHigherVersion.length > 0 ? `<li>${result.versionValidation.devicesWithHigherVersion.length} devices have version higher than target</li>` : ''}
      ${result.versionValidation.devicesBelowMinVersion.length > 0 ? `<li>${result.versionValidation.devicesBelowMinVersion.length} devices below minimum supported version</li>` : ''}
      ${result.versionValidation.incompatibleDevices.length > 0 ? `<li>${result.versionValidation.incompatibleDevices.length} devices with incompatible type</li>` : ''}
    </ul>
  </div>
  ` : ''}
</body>
</html>
  `;

  fs.writeFileSync(outputPath, html);
}
