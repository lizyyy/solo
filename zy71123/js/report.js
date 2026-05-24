class ReportGenerator {
    constructor() {
        this.reportData = null;
    }

    generateHTMLReport(reportData, sceneData) {
        this.reportData = reportData;
        
        const totalDistance = reportData.totalDistance || 0;
        const totalTime = reportData.totalTime || 0;
        const batteryUsed = reportData.batteryUsed || 0;
        const pointsInspected = reportData.pointsInspected || 0;
        const totalPoints = reportData.totalPoints || 0;
        const efficiency = totalPoints > 0 ? ((pointsInspected / totalPoints) * 100).toFixed(1) : 0;
        
        const eventsByType = this.groupEventsByType(reportData.events || []);
        const warnings = eventsByType['警告'] || [];
        const lowBatteryEvents = eventsByType['低电量'] || [];
        
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>巡检机器人路线报告</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            color: #333;
            padding: 40px 20px;
        }
        
        .report-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }
        
        .report-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
        }
        
        .report-header h1 {
            font-size: 28px;
            margin-bottom: 8px;
        }
        
        .report-header p {
            opacity: 0.9;
            font-size: 14px;
        }
        
        .report-body {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #667eea;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e8e8e8;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
        }
        
        .stat-card {
            background: #f8f9ff;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            border-left: 4px solid #667eea;
        }
        
        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 13px;
            color: #666;
        }
        
        .stat-card.warning {
            border-left-color: #ed8936;
            background: #fffaf0;
        }
        
        .stat-card.warning .stat-value {
            color: #ed8936;
        }
        
        .stat-card.success {
            border-left-color: #48bb78;
            background: #f0fff4;
        }
        
        .stat-card.success .stat-value {
            color: #48bb78;
        }
        
        .route-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        
        .route-table th {
            background: #667eea;
            color: white;
            padding: 12px 15px;
            text-align: left;
            font-weight: 500;
        }
        
        .route-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e8e8e8;
        }
        
        .route-table tr:hover {
            background: #f8f9ff;
        }
        
        .route-table .return {
            color: #ed8936;
            font-weight: 500;
        }
        
        .event-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #e8e8e8;
            border-radius: 8px;
        }
        
        .event-item {
            padding: 12px 15px;
            border-bottom: 1px solid #e8e8e8;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .event-item:last-child {
            border-bottom: none;
        }
        
        .event-type {
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            flex-shrink: 0;
        }
        
        .event-type.info { background: #e3f2fd; color: #1976d2; }
        .event-type.warning { background: #fff3e0; color: #e65100; }
        .event-type.success { background: #e8f5e9; color: #2e7d32; }
        .event-type.error { background: #ffebee; color: #c62828; }
        
        .event-content {
            flex: 1;
        }
        
        .event-message {
            margin-bottom: 4px;
            line-height: 1.5;
        }
        
        .event-meta {
            font-size: 12px;
            color: #999;
        }
        
        .summary-box {
            background: #f8f9ff;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        
        .summary-box h4 {
            margin-bottom: 10px;
            color: #667eea;
        }
        
        .summary-box p {
            line-height: 1.8;
            color: #555;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            background: #f5f7fa;
            color: #999;
            font-size: 12px;
        }
        
        .data-preview {
            background: #f5f7fa;
            border-radius: 8px;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre;
        }
        
        .quality-score {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 8px;
            color: white;
        }
        
        .score-circle {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: 700;
        }
        
        .score-info h4 {
            margin-bottom: 5px;
            font-size: 16px;
        }
        
        .score-info p {
            opacity: 0.9;
            font-size: 13px;
        }
        
        .highlight {
            background: #fff3cd;
            padding: 2px 6px;
            border-radius: 3px;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>🤖 巡检机器人路线报告</h1>
            <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
        </div>
        
        <div class="report-body">
            <div class="section">
                <div class="quality-score">
                    <div class="score-circle">${efficiency}</div>
                    <div class="score-info">
                        <h4>巡检完成率</h4>
                        <p>成功完成 ${pointsInspected}/${totalPoints} 个巡检点</p>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">📊 数据概览</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${totalDistance.toFixed(1)}</div>
                        <div class="stat-label">总距离 (米)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${this.formatTime(totalTime)}</div>
                        <div class="stat-label">总耗时</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${batteryUsed.toFixed(1)}%</div>
                        <div class="stat-label">电量消耗</div>
                    </div>
                    <div class="stat-card ${warnings.length > 0 ? 'warning' : 'success'}">
                        <div class="stat-value">${warnings.length + lowBatteryEvents.length}</div>
                        <div class="stat-label">异常事件</div>
                    </div>
                </div>
            </div>
            
            ${warnings.length > 0 || lowBatteryEvents.length > 0 ? `
            <div class="section">
                <h3 class="section-title">⚠️ 问题总结</h3>
                <div class="summary-box">
                    <h4>巡检过程中发现以下问题需要关注：</h4>
                    <p>
                        ${warnings.length > 0 ? `• <span class="highlight">${warnings.length} 个路径警告</span>：存在无法到达的巡检点，建议检查障碍物位置<br>` : ''}
                        ${lowBatteryEvents.length > 0 ? `• <span class="highlight">${lowBatteryEvents.length} 次低电量返航</span>：建议优化路线规划或增加充电桩` : ''}
                    </p>
                </div>
            </div>
            ` : ''}
            
            <div class="section">
                <h3 class="section-title">🗺️ 路线详情</h3>
                <table class="route-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>目标点</th>
                            <th>从位置</th>
                            <th>到位置</th>
                            <th>距离(米)</th>
                            <th>类型</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(reportData.route || []).map((segment, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${segment.pointName}</td>
                            <td>(${segment.from.x.toFixed(1)}, ${segment.from.z.toFixed(1)})</td>
                            <td>(${segment.to.x.toFixed(1)}, ${segment.to.z.toFixed(1)})</td>
                            <td>${segment.distance.toFixed(1)}</td>
                            <td class="${segment.isReturn ? 'return' : ''}">${segment.isReturn ? '↩️ 返航' : '✅ 巡检'}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h3 class="section-title">📝 事件日志</h3>
                <div class="event-list">
                    ${(reportData.events || []).map(event => `
                    <div class="event-item">
                        <span class="event-type ${this.getEventTypeClass(event.type)}">${event.type}</span>
                        <div class="event-content">
                            <div class="event-message">${event.message}</div>
                            <div class="event-meta">
                                时间: ${this.formatTime(event.time)} | 
                                位置: (${event.position.x.toFixed(1)}, ${event.position.z.toFixed(1)}) | 
                                电量: ${event.battery.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="section">
                <h3 class="section-title">💾 原始数据</h3>
                <div class="data-preview">${JSON.stringify({
                    summary: {
                        totalDistance,
                        totalTime,
                        batteryUsed,
                        pointsInspected,
                        totalPoints
                    },
                    scene: sceneData || {},
                    events: reportData.events || []
                }, null, 2)}</div>
            </div>
        </div>
        
        <div class="footer">
            <p>室内巡检机器人路线可视化系统 | 报告自动生成</p>
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    getEventTypeClass(type) {
        const typeMap = {
            '警告': 'warning',
            '错误': 'error',
            '完成': 'success',
            '任务完成': 'success',
            '低电量': 'warning'
        };
        return typeMap[type] || 'info';
    }

    groupEventsByType(events) {
        const groups = {};
        for (const event of events) {
            if (!groups[event.type]) {
                groups[event.type] = [];
            }
            groups[event.type].push(event);
        }
        return groups;
    }

    formatTime(seconds) {
        if (!seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    downloadReport(reportData, sceneData) {
        const html = this.generateHTMLReport(reportData, sceneData);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `巡检报告_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    exportJSON(data, filename = 'export.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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