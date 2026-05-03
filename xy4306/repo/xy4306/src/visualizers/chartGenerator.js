const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { CONFIG, ISSUE_TYPES, ISSUE_SEVERITY } = require('../config/constants');

class ChartGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.chartsDir = path.join(outputDir, CONFIG.OUTPUT.CHARTS_FOLDER);
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.chartsDir)) {
      fs.mkdirSync(this.chartsDir, { recursive: true });
    }
  }

  generateBatchChart(analysisResult) {
    const { vehicle, batch, temperatures, doorEvents, issues, statistics } = analysisResult;
    
    if (!temperatures || temperatures.length === 0) {
      return null;
    }

    const safeMax = CONFIG.TEMPERATURE.THRESHOLD.SAFE_MAX;
    const dangerMax = CONFIG.TEMPERATURE.THRESHOLD.DANGER_MAX;

    const tempData = temperatures.map(t => ({
      x: t.timestamp,
      y: t.temperature
    }));

    const doorAnnotations = this.createDoorAnnotations(doorEvents);
    const issueAnnotations = this.createIssueAnnotations(issues);
    const noteAnnotations = this.createNoteAnnotations(analysisResult.notes || []);

    const filename = `chart_${vehicle}_${batch}.html`;
    const filepath = path.join(this.chartsDir, filename);

    const chartHtml = this.generateChartHtml({
      title: `冷链温度复盘 - ${vehicle} - 批次 ${batch}`,
      subtitle: `时间范围: ${statistics.timeRange?.startStr || 'N/A'} ~ ${statistics.timeRange?.endStr || 'N/A'}`,
      tempData,
      doorAnnotations,
      issueAnnotations,
      noteAnnotations,
      safeMax,
      dangerMax,
      statistics
    });

    fs.writeFileSync(filepath, chartHtml, 'utf-8');

    return {
      filename,
      filepath,
      vehicle,
      batch
    };
  }

  generateConsolidatedChart(consolidatedReport) {
    const filename = 'chart_overview.html';
    const filepath = path.join(this.chartsDir, filename);

    const overviewHtml = this.generateOverviewHtml(consolidatedReport);
    fs.writeFileSync(filepath, overviewHtml, 'utf-8');

    return {
      filename,
      filepath
    };
  }

  createDoorAnnotations(doorEvents) {
    const annotations = [];
    
    for (const event of doorEvents) {
      annotations.push({
        type: 'door_open',
        x: event.openTime,
        label: '开门',
        details: {
          duration: event.durationMinutes,
          isExceeded: event.isExceeded
        }
      });
      
      if (event.closeTime) {
        annotations.push({
          type: 'door_close',
          x: event.closeTime,
          label: '关门',
          details: {
            duration: event.durationMinutes,
            isExceeded: event.isExceeded
          }
        });
      }
    }

    return annotations;
  }

  createIssueAnnotations(issues) {
    return issues.map(issue => ({
      type: issue.type,
      severity: issue.severity,
      x: issue.startTime,
      endX: issue.endTime,
      label: this.getIssueLabel(issue),
      description: issue.description,
      id: issue.id
    }));
  }

  createNoteAnnotations(notes) {
    return notes
      .filter(n => n.timestamp)
      .map(note => ({
        type: 'note',
        x: note.timestamp,
        label: '备注',
        content: note.content,
        isAnomaly: note.isAnomalyRelated
      }));
  }

  getIssueLabel(issue) {
    const labels = {
      [ISSUE_TYPES.CONTINUOUS_OVERTEMP]: '超温',
      [ISSUE_TYPES.SHORT_FLUCTUATION]: '波动',
      [ISSUE_TYPES.DOOR_OPEN_EXCEEDED]: '超时开门',
      [ISSUE_TYPES.SENSOR_GAP]: '数据断点',
      [ISSUE_TYPES.SENSOR_DRIFT]: '传感器漂移',
      [ISSUE_TYPES.NOTE_MENTIONED]: '备注异常'
    };
    return labels[issue.type] || '异常';
  }

  generateChartHtml(options) {
    const { 
      title, 
      subtitle, 
      tempData, 
      doorAnnotations, 
      issueAnnotations, 
      noteAnnotations,
      safeMax,
      dangerMax,
      statistics
    } = options;

    const minTemp = Math.min(...tempData.map(d => d.y)) - 2;
    const maxTemp = Math.max(...tempData.map(d => d.y), safeMax + 5) + 2;

    const tempDataJson = JSON.stringify(tempData);
    const doorAnnotationsJson = JSON.stringify(doorAnnotations);
    const issueAnnotationsJson = JSON.stringify(issueAnnotations);
    const noteAnnotationsJson = JSON.stringify(noteAnnotations);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@2.1.0"></script>
  <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.4"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .stat-card .label {
      color: #666;
      font-size: 13px;
      margin-bottom: 5px;
    }
    .stat-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .stat-card.safe .value { color: #10b981; }
    .stat-card.warning .value { color: #f59e0b; }
    .stat-card.danger .value { color: #ef4444; }
    .chart-container {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      margin-bottom: 20px;
    }
    .chart-wrapper {
      position: relative;
      height: 500px;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
    .issues-section {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .issues-section h3 {
      margin-bottom: 15px;
      color: #333;
      font-size: 18px;
    }
    .issue-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .issue-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 15px;
      border-radius: 8px;
      background: #f9fafb;
      border-left: 4px solid #e5e7eb;
    }
    .issue-item.critical { border-left-color: #ef4444; background: #fef2f2; }
    .issue-item.high { border-left-color: #f59e0b; background: #fffbeb; }
    .issue-item.medium { border-left-color: #3b82f6; background: #eff6ff; }
    .issue-item.low { border-left-color: #10b981; background: #ecfdf5; }
    .issue-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .issue-badge.critical { background: #fee2e2; color: #991b1b; }
    .issue-badge.high { background: #fef3c7; color: #92400e; }
    .issue-badge.medium { background: #dbeafe; color: #1e40af; }
    .issue-badge.low { background: #d1fae5; color: #065f46; }
    .issue-content {
      flex: 1;
    }
    .issue-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    .issue-desc {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
    }
    .issue-time {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 6px;
    }
    .no-issues {
      text-align: center;
      padding: 40px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">温度记录数</div>
        <div class="value">${statistics.totalRecords || 0}</div>
      </div>
      <div class="stat-card ${statistics.temperature?.avg <= safeMax ? 'safe' : 'warning'}">
        <div class="label">平均温度</div>
        <div class="value">${statistics.temperature?.avg?.toFixed(1) || 'N/A'}°C</div>
      </div>
      <div class="stat-card">
        <div class="label">最高温度</div>
        <div class="value ${statistics.temperature?.max > safeMax ? 'danger' : ''}">${statistics.temperature?.max?.toFixed(1) || 'N/A'}°C</div>
      </div>
      <div class="stat-card">
        <div class="label">最低温度</div>
        <div class="value">${statistics.temperature?.min?.toFixed(1) || 'N/A'}°C</div>
      </div>
      <div class="stat-card ${statistics.issues?.total > 0 ? 'warning' : 'safe'}">
        <div class="label">检测问题数</div>
        <div class="value">${statistics.issues?.total || 0}</div>
      </div>
      <div class="stat-card">
        <div class="label">开门事件</div>
        <div class="value">${statistics.doorEvents?.total || 0}</div>
      </div>
    </div>

    <div class="chart-container">
      <div class="chart-wrapper">
        <canvas id="temperatureChart"></canvas>
      </div>
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color" style="background: #3b82f6;"></div>
          <span>温度曲线</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #10b981;"></div>
          <span>安全阈值 (${safeMax}°C)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #f59e0b;"></div>
          <span>危险阈值 (${dangerMax}°C)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #8b5cf6;"></div>
          <span>开门事件</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: #ef4444;"></div>
          <span>异常标注</span>
        </div>
      </div>
    </div>

    <div class="issues-section">
      <h3>检测到的问题 (${issueAnnotations.length})</h3>
      ${issueAnnotations.length === 0 ? 
        '<div class="no-issues">✓ 未检测到异常问题</div>' : 
        this.generateIssueListHtml(issueAnnotations)}
    </div>
  </div>

  <script>
    const tempData = ${tempDataJson};
    const doorAnnotations = ${doorAnnotationsJson};
    const issueAnnotations = ${issueAnnotationsJson};
    const noteAnnotations = ${noteAnnotationsJson};
    const safeMax = ${safeMax};
    const dangerMax = ${dangerMax};

    const ctx = document.getElementById('temperatureChart').getContext('2d');

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: '温度 (°C)',
          data: tempData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            displayColors: false,
            callbacks: {
              title: function(context) {
                return new Date(context[0].parsed.x).toLocaleString('zh-CN');
              },
              label: function(context) {
                return \`温度: \${context.parsed.y.toFixed(1)}°C\`;
              }
            }
          },
          annotation: {
            annotations: (function() {
              const annotations = {};
              
              annotations.safeLine = {
                type: 'line',
                yMin: safeMax,
                yMax: safeMax,
                borderColor: '#10b981',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: \`安全: \${safeMax}°C\`,
                  position: 'end',
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: 6
                }
              };
              
              annotations.dangerLine = {
                type: 'line',
                yMin: dangerMax,
                yMax: dangerMax,
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: \`危险: \${dangerMax}°C\`,
                  position: 'end',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: 6
                }
              };

              let boxIndex = 0;
              issueAnnotations.forEach(issue => {
                if (issue.x && issue.endX) {
                  const colors = {
                    critical: 'rgba(239, 68, 68, 0.2)',
                    high: 'rgba(245, 158, 11, 0.2)',
                    medium: 'rgba(59, 130, 246, 0.2)',
                    low: 'rgba(16, 185, 129, 0.2)'
                  };
                  const borderColors = {
                    critical: '#ef4444',
                    high: '#f59e0b',
                    medium: '#3b82f6',
                    low: '#10b981'
                  };
                  
                  annotations[\`box_\${boxIndex++}\`] = {
                    type: 'box',
                    xMin: issue.x,
                    xMax: issue.endX,
                    backgroundColor: colors[issue.severity] || 'rgba(255, 200, 200, 0.2)',
                    borderColor: borderColors[issue.severity] || '#ff6b6b',
                    borderWidth: 2,
                    label: {
                      display: true,
                      content: issue.label,
                      position: 'start',
                      backgroundColor: borderColors[issue.severity] || '#ff6b6b',
                      color: 'white',
                      padding: 6
                    }
                  };
                }
              });

              return annotations;
            })()
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                hour: 'HH:mm',
                day: 'MM-dd HH:mm'
              },
              tooltipFormat: 'yyyy-MM-dd HH:mm:ss'
            },
            title: {
              display: true,
              text: '时间',
              color: '#666'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              color: '#666',
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            title: {
              display: true,
              text: '温度 (°C)',
              color: '#666'
            },
            min: ${minTemp},
            max: ${maxTemp},
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              color: '#666'
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;
  }

  generateIssueListHtml(issues) {
    const severityLabels = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低'
    };

    let html = '<div class="issue-list">';
    
    for (const issue of issues) {
      html += `
        <div class="issue-item ${issue.severity}">
          <span class="issue-badge ${issue.severity}">${severityLabels[issue.severity]}</span>
          <div class="issue-content">
            <div class="issue-title">${issue.label} (${issue.id})</div>
            <div class="issue-desc">${issue.description}</div>
            <div class="issue-time">
              时间: ${dayjs(issue.x).format('YYYY-MM-DD HH:mm:ss')}
              ${issue.endX && issue.x !== issue.endX ? 
                ` ~ ${dayjs(issue.endX).format('YYYY-MM-DD HH:mm:ss')}` : ''}
            </div>
          </div>
        </div>`;
    }
    
    html += '</div>';
    return html;
  }

  generateOverviewHtml(consolidatedReport) {
    const { overallStatus, totalBatches, totalIssues, issueBreakdown, generatedAtStr } = consolidatedReport;
    
    const statusColors = {
      normal: '#10b981',
      attention: '#3b82f6',
      warning: '#f59e0b',
      critical: '#ef4444'
    };
    
    const statusLabels = {
      normal: '正常',
      attention: '需关注',
      warning: '警告',
      critical: '严重'
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>冷链温度复盘 - 总览报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 20px;
      text-align: center;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .status-card {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      margin-bottom: 20px;
      text-align: center;
    }
    .status-indicator {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      margin-right: 10px;
      background: ${statusColors[overallStatus]};
    }
    .status-text {
      font-size: 28px;
      font-weight: bold;
      color: ${statusColors[overallStatus]};
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .stat-card .label { color: #666; font-size: 13px; margin-bottom: 8px; }
    .stat-card .value { font-size: 32px; font-weight: bold; color: #333; }
    .stat-card.critical .value { color: #ef4444; }
    .stat-card.high .value { color: #f59e0b; }
    .stat-card.medium .value { color: #3b82f6; }
    .stat-card.low .value { color: #10b981; }
    .footer {
      text-align: center;
      padding: 20px;
      color: #9ca3af;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>冷链温度复盘器 - 总览报告</h1>
      <p>生成时间: ${generatedAtStr}</p>
    </div>

    <div class="status-card">
      <div class="status-indicator"></div>
      <span class="status-text">${statusLabels[overallStatus]}</span>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">分析批次</div>
        <div class="value">${totalBatches}</div>
      </div>
      <div class="stat-card ${issueBreakdown.critical > 0 ? 'critical' : ''}">
        <div class="label">严重问题</div>
        <div class="value">${issueBreakdown.critical}</div>
      </div>
      <div class="stat-card ${issueBreakdown.high > 0 ? 'high' : ''}">
        <div class="label">高优先级</div>
        <div class="value">${issueBreakdown.high}</div>
      </div>
      <div class="stat-card ${issueBreakdown.medium > 0 ? 'medium' : ''}">
        <div class="label">中优先级</div>
        <div class="value">${issueBreakdown.medium}</div>
      </div>
      <div class="stat-card ${issueBreakdown.low > 0 ? 'low' : ''}">
        <div class="label">低优先级</div>
        <div class="value">${issueBreakdown.low}</div>
      </div>
    </div>

    <div class="footer">
      请查看各批次详细图表以获取完整分析结果
    </div>
  </div>
</body>
</html>`;
  }
}

module.exports = ChartGenerator;
