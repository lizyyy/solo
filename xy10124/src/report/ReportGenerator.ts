import { AnalysisResult, ProjectConfig, AnomalyType, Trajectory } from '../types';

export interface ReportData {
  projectConfig: ProjectConfig;
  analysisResult: AnalysisResult;
  trajectory: Trajectory;
}

export class ReportGenerator {
  static generateHTMLReport(data: ReportData): string {
    const { projectConfig, analysisResult, trajectory } = data;
    const generatedAt = new Date().toLocaleString('zh-CN');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>机械臂避障分析报告 - ${trajectory.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 40px 20px;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 40px;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { color: #aaa; font-size: 14px; }
    .content { padding: 40px; }
    .section { margin-bottom: 40px; }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a2e;
      padding-bottom: 12px;
      border-bottom: 2px solid #00d4ff;
      margin-bottom: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card.total { background: #f0f4ff; }
    .stat-card.safe { background: #ecfdf5; }
    .stat-card.warn { background: #fffbeb; }
    .stat-card.danger { background: #fef2f2; }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .stat-value.total { color: #2563eb; }
    .stat-value.safe { color: #059669; }
    .stat-value.warn { color: #d97706; }
    .stat-value.danger { color: #dc2626; }
    .stat-label { font-size: 14px; color: #666; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .info-label { color: #666; font-size: 14px; }
    .info-value { font-weight: 600; color: #1a1a2e; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #374151;
      font-size: 13px;
    }
    td { font-size: 14px; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-collision { background: #fee2e2; color: #dc2626; }
    .badge-near { background: #fef3c7; color: #d97706; }
    .badge-boundary { background: #ede9fe; color: #7c3aed; }
    .obstacle-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .obstacle-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .obstacle-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }
    .footer {
      padding: 20px 40px;
      background: #f8fafc;
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
    }
    .summary-box {
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .summary-pass { background: #ecfdf5; border-left: 4px solid #059669; }
    .summary-fail { background: #fef2f2; border-left: 4px solid #dc2626; }
    .summary-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .summary-desc { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>机械臂避障分析报告</h1>
      <p>轨迹名称: ${trajectory.name} | 生成时间: ${generatedAt}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="summary-box ${analysisResult.collisionCount === 0 && analysisResult.boundaryViolationCount === 0 ? 'summary-pass' : 'summary-fail'}">
          <div class="summary-title">
            ${analysisResult.collisionCount === 0 && analysisResult.boundaryViolationCount === 0 
              ? '✅ 轨迹安全检查通过' 
              : '❌ 轨迹存在安全隐患'}
          </div>
          <div class="summary-desc">
            碰撞次数: ${analysisResult.collisionCount} | 边界违规: ${analysisResult.boundaryViolationCount} | 接近警告: ${analysisResult.nearMissCount}
          </div>
        </div>
        <div class="stats-grid">
          <div class="stat-card total">
            <div class="stat-value total">${analysisResult.totalPoints}</div>
            <div class="stat-label">总轨迹点</div>
          </div>
          <div class="stat-card safe">
            <div class="stat-value safe">${analysisResult.safePoints}</div>
            <div class="stat-label">安全点</div>
          </div>
          <div class="stat-card warn">
            <div class="stat-value warn">${analysisResult.nearMissCount}</div>
            <div class="stat-label">接近警告</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-value danger">${analysisResult.collisionCount + analysisResult.boundaryViolationCount}</div>
            <div class="stat-label">碰撞/违规</div>
          </div>
        </div>
      </div>
      <div class="section">
        <h2 class="section-title">轨迹基本信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">轨迹ID</span>
            <span class="info-value">${trajectory.id}</span>
          </div>
          <div class="info-item">
            <span class="info-label">轨迹名称</span>
            <span class="info-value">${trajectory.name}</span>
          </div>
          <div class="info-item">
            <span class="info-label">轨迹点数量</span>
            <span class="info-value">${trajectory.points.length}</span>
          </div>
          <div class="info-item">
            <span class="info-label">总时长</span>
            <span class="info-value">${trajectory.totalTime.toFixed(2)}s</span>
          </div>
          <div class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value">${new Date(trajectory.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          <div class="info-item">
            <span class="info-label">最小障碍物距离</span>
            <span class="info-value">${analysisResult.minDistanceToObstacles > 0 ? analysisResult.minDistanceToObstacles.toFixed(4) + 'm' : '碰撞'}</span>
          </div>
        </div>
      </div>
      <div class="section">
        <h2 class="section-title">障碍物配置</h2>
        <div class="obstacle-list">
          ${projectConfig.obstacles.map(obs => `
            <div class="obstacle-item">
              <div class="obstacle-color" style="background: ${obs.color}"></div>
              <div>
                <div style="font-weight: 600">${obs.name}</div>
                <div style="font-size: 12px; color: #666">${obs.type} | ${obs.geometry.type}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="section">
        <h2 class="section-title">异常详情 (${analysisResult.anomalies.length})</h2>
        ${analysisResult.anomalies.length === 0 ? `
          <p style="color: #666; padding: 20px; background: #f9fafb; border-radius: 6px; text-align: center;">
            未检测到任何异常
          </p>
        ` : `
          <table>
            <thead>
              <tr>
                <th>序号</th>
                <th>类型</th>
                <th>时间点</th>
                <th>轨迹点</th>
                <th>距离</th>
                <th>描述</th>
              </tr>
            </thead>
            <tbody>
              ${analysisResult.anomalies.map((anomaly, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>
                    <span class="badge ${this.getBadgeClass(anomaly.type)}">
                      ${this.getAnomalyTypeName(anomaly.type)}
                    </span>
                  </td>
                  <td>${anomaly.timestamp.toFixed(3)}s</td>
                  <td>${anomaly.pointIndex}</td>
                  <td>${anomaly.distance !== undefined ? anomaly.distance.toFixed(4) + 'm' : '-'}</td>
                  <td>${anomaly.description}</td>
                </tr>
                ${anomaly.jointStates ? `
                  <tr style="background: #fafafa;">
                    <td colspan="6" style="padding-left: 48px; font-size: 13px; color: #666;">
                      关节角度: J1=${anomaly.jointStates.joint1.toFixed(1)}°, J2=${anomaly.jointStates.joint2.toFixed(1)}°, 
                      J3=${anomaly.jointStates.joint3.toFixed(1)}°, J4=${anomaly.jointStates.joint4.toFixed(1)}°, 
                      J5=${anomaly.jointStates.joint5.toFixed(1)}°, J6=${anomaly.jointStates.joint6.toFixed(1)}°
                      ${anomaly.endEffectorPos ? ` | 末端位置: (${anomaly.endEffectorPos.x.toFixed(3)}, ${anomaly.endEffectorPos.y.toFixed(3)}, ${anomaly.endEffectorPos.z.toFixed(3)})` : ''}
                    </td>
                  </tr>
                ` : ''}
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
      <div class="section">
        <h2 class="section-title">工作空间边界</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">X轴范围</span>
            <span class="info-value">[${projectConfig.workspaceBounds.min.x}, ${projectConfig.workspaceBounds.max.x}]</span>
          </div>
          <div class="info-item">
            <span class="info-label">Y轴范围</span>
            <span class="info-value">[${projectConfig.workspaceBounds.min.y}, ${projectConfig.workspaceBounds.max.y}]</span>
          </div>
          <div class="info-item">
            <span class="info-label">Z轴范围</span>
            <span class="info-value">[${projectConfig.workspaceBounds.min.z}, ${projectConfig.workspaceBounds.max.z}]</span>
          </div>
          <div class="info-item">
            <span class="info-label">安全裕度</span>
            <span class="info-value">${projectConfig.safetyMargin}m</span>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>机械臂避障回放工具 | 报告版本 1.0</p>
    </div>
  </div>
</body>
</html>`;
  }

  static getBadgeClass(type: AnomalyType): string {
    switch (type) {
      case AnomalyType.COLLISION:
        return 'badge-collision';
      case AnomalyType.NEAR_MISS:
        return 'badge-near';
      case AnomalyType.BOUNDARY_VIOLATION:
        return 'badge-boundary';
      default:
        return '';
    }
  }

  static getAnomalyTypeName(type: AnomalyType): string {
    switch (type) {
      case AnomalyType.COLLISION:
        return '碰撞';
      case AnomalyType.NEAR_MISS:
        return '接近警告';
      case AnomalyType.BOUNDARY_VIOLATION:
        return '边界违规';
      default:
        return '未知';
    }
  }

  static downloadHTMLReport(data: ReportData, filename: string): void {
    const html = this.generateHTMLReport(data);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static downloadJSONReport(data: ReportData, filename: string): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static downloadCSVReport(data: ReportData, filename: string): void {
    const { analysisResult, trajectory } = data;
    let csv = '类型,时间点,轨迹点索引,距离,描述,J1,J2,J3,J4,J5,J6,末端X,末端Y,末端Z\n';

    analysisResult.anomalies.forEach((anomaly) => {
      const js = anomaly.jointStates;
      const eep = anomaly.endEffectorPos;
      csv += [
        this.getAnomalyTypeName(anomaly.type),
        anomaly.timestamp.toFixed(3),
        anomaly.pointIndex,
        anomaly.distance !== undefined ? anomaly.distance.toFixed(4) : '',
        `"${anomaly.description}"`,
        js ? js.joint1.toFixed(2) : '',
        js ? js.joint2.toFixed(2) : '',
        js ? js.joint3.toFixed(2) : '',
        js ? js.joint4.toFixed(2) : '',
        js ? js.joint5.toFixed(2) : '',
        js ? js.joint6.toFixed(2) : '',
        eep ? eep.x.toFixed(4) : '',
        eep ? eep.y.toFixed(4) : '',
        eep ? eep.z.toFixed(4) : ''
      ].join(',') + '\n';
    });

    csv += '\n\n轨迹摘要\n';
    csv += `轨迹名称,${trajectory.name}\n`;
    csv += `轨迹点数,${analysisResult.totalPoints}\n`;
    csv += `安全点数,${analysisResult.safePoints}\n`;
    csv += `碰撞次数,${analysisResult.collisionCount}\n`;
    csv += `接近警告,${analysisResult.nearMissCount}\n`;
    csv += `边界违规,${analysisResult.boundaryViolationCount}\n`;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
