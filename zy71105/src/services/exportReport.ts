import { CollisionWarning, Light, ProgramSegment, SceneData } from '../types';

export function generateReportHTML(
  sceneData: SceneData,
  collisionWarnings: CollisionWarning[],
  screenshot?: string
): string {
  const dangerCount = collisionWarnings.filter((w) => w.severity === 'danger').length;
  const warningCount = collisionWarnings.filter((w) => w.severity === 'warning').length;
  const enabledLights = sceneData.lights.filter((l) => l.enabled).length;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>舞台灯光预演报告</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: 'Inter', 'Microsoft YaHei', sans-serif;
        background: #f5f5f7;
        padding: 40px;
        color: #1d1d1f;
      }
      .report-container {
        max-width: 1000px;
        margin: 0 auto;
        background: white;
        border-radius: 16px;
        padding: 48px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      }
      .header {
        text-align: center;
        margin-bottom: 40px;
        padding-bottom: 24px;
        border-bottom: 2px solid #e5e5ea;
      }
      .header h1 {
        font-size: 32px;
        font-weight: 700;
        color: #1d1d1f;
        margin-bottom: 8px;
      }
      .header p {
        color: #86868b;
        font-size: 14px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 32px;
      }
      .summary-card {
        background: #f5f5f7;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
      }
      .summary-card .value {
        font-size: 36px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .summary-card .label {
        font-size: 13px;
        color: #86868b;
        font-weight: 500;
      }
      .summary-card.danger .value { color: #ff3b30; }
      .summary-card.warning .value { color: #ff9500; }
      .summary-card.success .value { color: #34c759; }
      .summary-card.info .value { color: #0066ff; }
      .section {
        margin-bottom: 32px;
      }
      .section-title {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1d1d1f;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .section-title::before {
        content: '';
        width: 4px;
        height: 20px;
        background: #0066ff;
        border-radius: 2px;
      }
      .warnings-table {
        width: 100%;
        border-collapse: collapse;
      }
      .warnings-table th,
      .warnings-table td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid #e5e5ea;
      }
      .warnings-table th {
        background: #f5f5f7;
        font-weight: 600;
        font-size: 13px;
        color: #86868b;
      }
      .warnings-table td {
        font-size: 14px;
      }
      .severity-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
      }
      .severity-badge.danger {
        background: #fff2f2;
        color: #ff3b30;
      }
      .severity-badge.warning {
        background: #fff9e6;
        color: #ff9500;
      }
      .lights-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .light-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: #f5f5f7;
        border-radius: 8px;
      }
      .light-color {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .light-info {
        flex: 1;
      }
      .light-name {
        font-weight: 600;
        font-size: 14px;
      }
      .light-meta {
        font-size: 12px;
        color: #86868b;
      }
      .light-status {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .light-status.enabled {
        background: #e8f5e9;
        color: #34c759;
      }
      .light-status.disabled {
        background: #f5f5f7;
        color: #86868b;
      }
      .segments-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .segment-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        background: #f5f5f7;
        border-radius: 8px;
      }
      .segment-name {
        font-weight: 600;
        font-size: 14px;
        flex: 1;
      }
      .segment-time {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        color: #86868b;
      }
      .segment-lights {
        font-size: 12px;
        color: #0066ff;
        background: #e6f0ff;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .screenshot-container {
        margin-top: 24px;
        text-align: center;
      }
      .screenshot-container img {
        max-width: 100%;
        border-radius: 8px;
        border: 1px solid #e5e5ea;
      }
      .footer {
        margin-top: 48px;
        padding-top: 24px;
        border-top: 1px solid #e5e5ea;
        text-align: center;
        color: #86868b;
        font-size: 12px;
      }
      @media print {
        body {
          background: white;
          padding: 0;
        }
        .report-container {
          box-shadow: none;
          padding: 24px;
        }
      }
    </style>
</head>
<body>
    <div class="report-container">
      <div class="header">
        <h1>舞台灯光预演报告</h1>
        <p>生成时间: ${new Date().toLocaleString('zh-CN')} | 数据版本: ${sceneData.version}</p>
      </div>

      <div class="summary-grid">
        <div class="summary-card danger">
          <div class="value">${dangerCount}</div>
          <div class="label">严重警告</div>
        </div>
        <div class="summary-card warning">
          <div class="value">${warningCount}</div>
          <div class="label">一般警告</div>
        </div>
        <div class="summary-card success">
          <div class="value">${enabledLights}</div>
          <div class="label">启用灯具</div>
        </div>
        <div class="summary-card info">
          <div class="value">${sceneData.programSegments.length}</div>
          <div class="label">节目段落</div>
        </div>
      </div>

      ${collisionWarnings.length > 0 ? `
      <div class="section">
        <h2 class="section-title">碰撞警告</h2>
        <table class="warnings-table">
          <thead>
            <tr>
              <th>严重程度</th>
              <th>灯具</th>
              <th>禁区</th>
              <th>时间点</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            ${collisionWarnings.map((w) => `
              <tr>
                <td><span class="severity-badge ${w.severity}">${w.severity === 'danger' ? '严重' : '警告'}</span></td>
                <td>${w.lightName}</td>
                <td>${w.zoneName}</td>
                <td>${formatTime(w.timestamp)}</td>
                <td>${w.message}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : `
      <div class="section">
        <h2 class="section-title">碰撞警告</h2>
        <div style="padding: 24px; background: #e8f5e9; border-radius: 8px; text-align: center; color: #34c759; font-weight: 500;">
          ✓ 未检测到光束碰撞，所有灯具设置正常
        </div>
      </div>
      `}

      <div class="section">
        <h2 class="section-title">灯具清单</h2>
        <div class="lights-grid">
          ${sceneData.lights.map((l) => `
            <div class="light-item">
              <div class="light-color" style="background: ${l.color};"></div>
              <div class="light-info">
                <div class="light-name">${l.name}</div>
                <div class="light-meta">${l.type} | ${l.group} | 光束角: ${l.beamAngle}°</div>
              </div>
              <span class="light-status ${l.enabled ? 'enabled' : 'disabled'}">
                ${l.enabled ? '启用' : '关闭'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">节目段落</h2>
        <div class="segments-list">
          ${sceneData.programSegments.map((s) => `
            <div class="segment-item">
              <span class="segment-name">${s.name}</span>
              <span class="segment-time">${formatTime(s.startTime)} - ${formatTime(s.endTime)}</span>
              <span class="segment-lights">${s.lightStates.length} 个灯具</span>
            </div>
          `).join('')}
        </div>
      </div>

      ${screenshot ? `
      <div class="section">
        <h2 class="section-title">场景预览</h2>
        <div class="screenshot-container">
          <img src="${screenshot}" alt="场景预览" />
        </div>
      </div>
      ` : ''}

      <div class="footer">
        舞台灯光束预演系统 | 报告由系统自动生成
      </div>
    </div>
</body>
</html>
  `;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function exportReport(sceneData: SceneData, warnings: CollisionWarning[], screenshot?: string) {
  const html = generateReportHTML(sceneData, warnings, screenshot);
  
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `灯光预演报告_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printReport(sceneData: SceneData, warnings: CollisionWarning[], screenshot?: string) {
  const html = generateReportHTML(sceneData, warnings, screenshot);
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export function exportSceneJSON(sceneData: SceneData) {
  const json = JSON.stringify(sceneData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `舞台场景_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
