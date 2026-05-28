import { formatDateTime, formatDuration, downloadFile } from '../utils/helpers.js';
import { EXPORT_FORMATS, GALLERY_DIMENSIONS } from '../utils/constants.js';

export class ReportExporter {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  export(format, name, options) {
    const record = this.dataManager.getCurrentRecord();
    if (!record) return null;

    switch (format) {
      case EXPORT_FORMATS.HTML:
        return this.exportHTML(record, name, options);
      case EXPORT_FORMATS.JSON:
        return this.exportJSON(record, name, options);
      case EXPORT_FORMATS.CSV:
        return this.exportCSV(record, name, options);
      default:
        return null;
    }
  }

  exportHTML(record, name, options) {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 16px;
      margin-bottom: 32px;
    }
    .header h1 { font-size: 32px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #667eea;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    .stat-card {
      background: linear-gradient(135deg, #f8f9ff 0%, #f0f0ff 100%);
      border-radius: 10px;
      padding: 16px;
      border-left: 4px solid #667eea;
    }
    .stat-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 600; color: #1d1d1f; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9ff; font-weight: 500; color: #666; font-size: 13px; }
    tr:hover { background: #f8f9ff; }
    .heat-bar {
      display: inline-block;
      height: 8px;
      background: linear-gradient(90deg, #22c55e, #eab308, #ef4444);
      border-radius: 4px;
    }
    .issue-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      margin-right: 4px;
    }
    .issue-duplicate { background: #fef3c7; color: #d97706; }
    .issue-occlusion { background: #fce7f3; color: #db2777; }
    .issue-bias { background: #dbeafe; color: #2563eb; }
    .severity-high { color: #ef4444; }
    .severity-medium { color: #f59e0b; }
    .severity-low { color: #22c55e; }
    .congestion-point {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .footer {
      text-align: center;
      color: #888;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .empty { color: #888; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 ${name}</h1>
      <p>生成时间: ${formatDateTime(Date.now())} | 记录时间: ${formatDateTime(record.createdAt)}</p>
    </div>

    <div class="section">
      <h2>📊 观展概览</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">访客总数</div>
          <div class="stat-value">${record.statistics.totalVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">独立访客</div>
          <div class="stat-value">${record.statistics.uniqueVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均停留时长</div>
          <div class="stat-value" style="font-size: 18px;">${formatDuration(record.statistics.avgDuration)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均观看作品</div>
          <div class="stat-value">${record.statistics.avgArtworksPerVisitor.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">作品总数</div>
          <div class="stat-value">${record.statistics.totalArtworks}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">拥堵点</div>
          <div class="stat-value" style="color: ${record.congestionPoints.length > 3 ? '#ef4444' : '#f59e0b'};">${record.congestionPoints.length}</div>
        </div>
      </div>
    </div>

    ${options.includeArtworks ? `
    <div class="section">
      <h2>🔥 作品热度排行</h2>
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>作品名称</th>
            <th>楼层</th>
            <th>观看人数</th>
            <th>平均停留</th>
            <th>热度指数</th>
          </tr>
        </thead>
        <tbody>
          ${record.statistics.artworks.slice(0, 15).map((art, idx) => {
            const maxHeat = record.statistics.artworks[0].heatValue || 1;
            const heatPercent = (art.heatValue / maxHeat * 100).toFixed(0);
            return `
            <tr>
              <td><strong>${idx + 1}</strong></td>
              <td>${art.name}</td>
              <td>${art.floor || 1}层</td>
              <td>${art.totalVisitors}人</td>
              <td>${formatDuration(art.avgStayDuration)}</td>
              <td>
                <div class="heat-bar" style="width: ${heatPercent}%;"></div>
                <span style="margin-left: 8px; font-size: 12px;">${heatPercent}%</span>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${options.includeCongestion ? `
    <div class="section">
      <h2>🚶 拥堵点分析</h2>
      ${record.congestionPoints.length === 0 ? '<p class="empty">未检测到拥堵点</p>' : `
      <table>
        <thead>
          <tr>
            <th>位置</th>
            <th>楼层</th>
            <th>发生时间</th>
            <th>聚集人数</th>
            <th>持续时间</th>
            <th>严重程度</th>
          </tr>
        </thead>
        <tbody>
          ${record.congestionPoints.map((cp, idx) => `
            <tr>
              <td>
                <span class="congestion-point" style="background: ${cp.severity === 'high' ? '#ef4444' : cp.severity === 'medium' ? '#f59e0b' : '#22c55e'};"></span>
                (${cp.x.toFixed(1)}, ${cp.z.toFixed(1)})
              </td>
              <td>${cp.floor}层</td>
              <td>${formatDateTime(cp.timestamp)}</td>
              <td>${cp.visitorCount}人</td>
              <td>${cp.duration.toFixed(0)}秒</td>
              <td class="severity-${cp.severity}">${cp.severity === 'high' ? '🔴 高' : cp.severity === 'medium' ? '🟡 中' : '🟢 低'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>
    ` : ''}

    ${options.includeVisitors ? `
    <div class="section">
      <h2>👥 入口批次分析</h2>
      <table>
        <thead>
          <tr>
            <th>批次</th>
            <th>访客数</th>
            <th>最早进入</th>
            <th>最晚离开</th>
            <th>平均停留</th>
          </tr>
        </thead>
        <tbody>
          ${record.batches.map(batch => `
            <tr>
              <td><strong>${batch.name}</strong></td>
              <td>${batch.visitorCount}人</td>
              <td>${formatDateTime(batch.entranceTime)}</td>
              <td>${formatDateTime(batch.exitTime)}</td>
              <td>${formatDuration(batch.avgDuration)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${options.includeIssues ? `
    <div class="section">
      <h2>⚠️ 数据质量问题</h2>
      ${record.statistics.issues.duplicates + record.statistics.issues.occlusions + record.statistics.issues.biases === 0 
        ? '<p class="empty">✅ 未检测到数据质量问题</p>' : `
        <div style="margin-bottom: 16px; padding: 12px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;">
            系统检测到以下数据质量问题，已在分析中做相应处理。详细记录请查看原始数据。
          </p>
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
          ${record.issues.duplicates.length > 0 ? `
            <span class="issue-badge issue-duplicate">
              🔄 ${record.issues.duplicates.length} 条重复访客记录
            </span>
          ` : ''}
          ${record.issues.occlusions.length > 0 ? `
            <span class="issue-badge issue-occlusion">
              🏢 ${record.issues.occlusions.length} 条楼层遮挡记录
            </span>
          ` : ''}
          ${record.issues.biases.length > 0 ? `
            <span class="issue-badge issue-bias">
              🚪 ${record.issues.biases.length} 条入口热度偏差
            </span>
          ` : ''}
        </div>
        ${record.issues.duplicates.length > 0 ? `
        <h3 style="font-size: 16px; margin: 20px 0 10px;">重复访客记录</h3>
        <table>
          <thead><tr><th>访客ID</th><th>设备标识</th><th>间隔时间</th><th>处理说明</th></tr></thead>
          <tbody>
            ${record.issues.duplicates.slice(0, 10).map(d => `
              <tr>
                <td><code>${d.visitorId.slice(0, 12)}...</code></td>
                <td><code>${d.deviceId.slice(0, 16)}...</code></td>
                <td>${Math.round(d.timeDiff / 60000)} 分钟</td>
                <td style="color: #666; font-size: 12px;">${d.reason}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
        ${record.issues.biases.length > 0 ? `
        <h3 style="font-size: 16px; margin: 20px 0 10px;">入口热度偏差 (影响作品)</h3>
        <table>
          <thead><tr><th>作品</th><th>受影响访客</th><th>偏差说明</th></tr></thead>
          <tbody>
            ${Array.from(new Set(record.issues.biases.map(b => b.artworkId))).slice(0, 10).map(artworkId => {
              const biases = record.issues.biases.filter(b => b.artworkId === artworkId);
              const artwork = record.artworks.find(a => a.id === artworkId);
              return `
                <tr>
                  <td>${artwork?.name || artworkId}</td>
                  <td>${biases.length}人</td>
                  <td style="color: #666; font-size: 12px;">可能受到入口人流引导，热度被高估</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ` : ''}
      `}
    </div>
    ` : ''}

    ${options.includeHeatmap ? `
    <div class="section">
      <h2>📍 热力分布说明</h2>
      <p style="color: #666; margin-bottom: 16px;">
        热力图基于访客停留时间和经过频次计算，颜色从绿到红表示热度从低到高。
      </p>
      <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #f8f9ff; border-radius: 8px;">
        <span style="font-size: 12px; color: #22c55e;">低热度</span>
        <div style="flex: 1; height: 12px; border-radius: 6px; background: linear-gradient(90deg, #22c55e, #eab308, #ef4444);"></div>
        <span style="font-size: 12px; color: #ef4444;">高热度</span>
      </div>
      <p style="color: #888; font-size: 12px; margin-top: 12px;">
        热力图数据包含 ${record.heatmapData.length} 个采样点，覆盖 ${GALLERY_DIMENSIONS.width}m × ${GALLERY_DIMENSIONS.depth}m × ${GALLERY_DIMENSIONS.floorCount}层 展厅空间。
      </p>
    </div>
    ` : ''}

    <div class="footer">
      <p>本报告由「画廊观展动线热图分析工具」生成</p>
      <p>记录ID: ${record.id} | 生成时间: ${formatDateTime(Date.now())}</p>
    </div>
  </div>
</body>
</html>`;

    downloadFile(html, `${name}.html`, 'text/html');
    return html;
  }

  exportJSON(record, name, options) {
    const exportData = {
      name: name,
      exportedAt: Date.now(),
      record: {
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        statistics: record.statistics,
        batches: record.batches,
        congestionPoints: record.congestionPoints,
        issues: record.issues
      }
    };

    if (options.includeArtworks) {
      exportData.record.artworks = record.statistics.artworks;
    }

    if (options.includeVisitors) {
      exportData.record.visitors = record.visitors.map(v => ({
        id: v.id,
        deviceId: v.deviceId,
        batch: v.batch,
        totalDuration: v.totalDuration,
        totalDistance: v.totalDistance,
        artworkVisits: v.artworkVisits,
        entranceTime: v.entranceTime,
        exitTime: v.exitTime,
        isDuplicate: v.isDuplicate,
        issues: v.issues
      }));
    }

    if (options.includeHeatmap) {
      exportData.record.heatmapData = record.heatmapData;
    }

    const json = JSON.stringify(exportData, null, 2);
    downloadFile(json, `${name}.json`, 'application/json');
    return json;
  }

  exportCSV(record, name, options) {
    let csv = '';
    const parts = [];

    if (options.includeArtworks) {
      parts.push('=== 作品热度排行 ===');
      parts.push('排名,作品名称,楼层,观看人数,平均停留(秒),热度指数');
      record.statistics.artworks.forEach((art, idx) => {
        parts.push(`${idx + 1},"${art.name}",${art.floor || 1},${art.totalVisitors},${art.avgStayDuration.toFixed(1)},${art.heatValue.toFixed(2)}`);
      });
      parts.push('');
    }

    if (options.includeVisitors) {
      parts.push('=== 访客记录 ===');
      parts.push('访客ID,设备ID,批次,总时长(秒),总距离(m),观看作品数,进入时间,离开时间,是否重复');
      record.visitors.forEach(v => {
        parts.push(`"${v.id}","${v.deviceId}","${v.batch}",${v.totalDuration.toFixed(1)},${v.totalDistance.toFixed(1)},${v.artworkVisits.length},${formatDateTime(v.entranceTime)},${formatDateTime(v.exitTime)},${v.isDuplicate ? '是' : '否'}`);
      });
      parts.push('');
    }

    if (options.includeCongestion) {
      parts.push('=== 拥堵点 ===');
      parts.push('序号,X坐标,Z坐标,楼层,时间,人数,持续时间(秒),严重程度');
      record.congestionPoints.forEach((cp, idx) => {
        parts.push(`${idx + 1},${cp.x.toFixed(2)},${cp.z.toFixed(2)},${cp.floor},${formatDateTime(cp.timestamp)},${cp.visitorCount},${cp.duration.toFixed(0)},${cp.severity}`);
      });
      parts.push('');
    }

    if (options.includeIssues) {
      parts.push('=== 数据质量问题 ===');
      if (record.issues.duplicates.length > 0) {
        parts.push('--- 重复访客 ---');
        parts.push('访客ID,设备ID,间隔(分钟),原因');
        record.issues.duplicates.forEach(d => {
          parts.push(`"${d.visitorId}","${d.deviceId}",${Math.round(d.timeDiff / 60000)},"${d.reason}"`);
        });
      }
      if (record.issues.biases.length > 0) {
        parts.push('--- 入口热度偏差 ---');
        parts.push('作品ID,访客ID,到达时间(秒),距入口距离(m)');
        record.issues.biases.forEach(b => {
          parts.push(`"${b.artworkId}","${b.visitorId}",${b.timeFromEntrance.toFixed(1)},${b.distToEntrance}`);
        });
      }
    }

    csv = parts.join('\n');
    downloadFile(csv, `${name}.csv`, 'text/csv');
    return csv;
  }
}
