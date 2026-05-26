const ReportExporter = {
    generateReport(levelData, state, result, format = 'text') {
        const data = this.collectReportData(levelData, state, result);
        
        switch (format) {
            case 'json':
                return this.exportJSON(data);
            case 'html':
                return this.exportHTML(data);
            default:
                return this.exportText(data);
        }
    },

    collectReportData(levelData, state, result) {
        const placedEvents = [];
        state.tracks.forEach(track => {
            track.events.forEach(evt => {
                placedEvents.push({
                    id: evt.id,
                    name: evt.name,
                    type: evt.type,
                    track: track.name,
                    startTime: evt.startTime,
                    endTime: evt.endTime,
                    duration: evt.duration,
                    order: evt.order,
                    entranceId: evt.entranceId
                });
            });
        });

        placedEvents.sort((a, b) => a.startTime - b.startTime);

        return {
            levelName: levelData.name,
            levelId: levelData.id,
            difficulty: levelData.difficulty,
            timestamp: new Date().toISOString(),
            success: result.success,
            score: result.score,
            maxScore: levelData.maxScore,
            scorePercent: Math.round((result.score / levelData.maxScore) * 100),
            totalTime: state.maxTime,
            failReason: result.failReason,
            conflicts: result.conflicts.map(c => ({
                type: c.type,
                severity: c.severity,
                message: c.message,
                time: c.time
            })),
            errors: result.conflicts.filter(c => c.severity === 'error').length,
            warnings: result.conflicts.filter(c => c.severity === 'warning').length,
            events: placedEvents,
            sceneChanges: state.sceneChanges.map(sc => ({
                from: sc.fromScene,
                to: sc.toScene,
                startTime: sc.startTime,
                maxDuration: sc.maxDuration,
                actualDuration: sc.actualDuration,
                onTime: sc.actualDuration <= sc.maxDuration
            })),
            hints: levelData.hints
        };
    },

    exportText(data) {
        let report = `╔══════════════════════════════════════════════════════════════╗\n`;
        report += `║              剧场换景节奏游戏 - 演出结算报告                 ║\n`;
        report += `╚══════════════════════════════════════════════════════════════╝\n\n`;
        
        report += `【基本信息】\n`;
        report += `  关卡名称: ${data.levelName}\n`;
        report += `  难度等级: ${'★'.repeat(data.difficulty)}${'☆'.repeat(4 - data.difficulty)}\n`;
        report += `  导出时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}\n\n`;

        report += `【演出结果】\n`;
        report += `  演出状态: ${data.success ? '✓ 成功' : '✗ 失败'}\n`;
        report += `  最终得分: ${data.score} / ${data.maxScore} (${data.scorePercent}%)\n`;
        report += `  错误数量: ${data.errors}\n`;
        report += `  警告数量: ${data.warnings}\n\n`;

        if (data.failReason) {
            report += `【失败原因】\n`;
            report += `  ${data.failReason}\n\n`;
        }

        if (data.conflicts.length > 0) {
            report += `【冲突详情】\n`;
            data.conflicts.forEach((c, i) => {
                const icon = c.severity === 'error' ? '✗' : '⚠';
                const time = this.formatTime(c.time);
                report += `  ${i + 1}. [${time}] ${icon} ${c.message}\n`;
            });
            report += `\n`;
        }

        if (data.sceneChanges.length > 0) {
            report += `【换景统计】\n`;
            data.sceneChanges.forEach((sc, i) => {
                const status = sc.onTime ? '✓ 准时' : '✗ 超时';
                report += `  ${i + 1}. ${sc.from} → ${sc.to}: ${sc.actualDuration.toFixed(1)}s / ${sc.maxDuration}s ${status}\n`;
            });
            report += `\n`;
        }

        report += `【事件排程表】\n`;
        report += `  ─────────────────────────────────────────────────────────────\n`;
        report += `  时间    类型    轨道          事件名称\n`;
        report += `  ─────────────────────────────────────────────────────────────\n`;
        
        const typeMap = { light: '灯光', prop: '道具', actor: '演员' };
        data.events.forEach(evt => {
            const start = this.formatTime(evt.startTime);
            const end = this.formatTime(evt.endTime);
            const type = typeMap[evt.type] || evt.type;
            const track = evt.track.padEnd(12, ' ');
            report += `  ${start}-${end} ${type.padEnd(4, ' ')} ${track} ${evt.name}\n`;
        });

        if (data.hints && data.hints.length > 0) {
            report += `\n【关卡提示】\n`;
            data.hints.forEach((hint, i) => {
                report += `  ${i + 1}. ${hint}\n`;
            });
        }

        report += `\n╔══════════════════════════════════════════════════════════════╗\n`;
        report += `║  报告生成: 剧场换景节奏游戏 v1.0                            ║\n`;
        report += `╚══════════════════════════════════════════════════════════════╝\n`;

        return report;
    },

    exportHTML(data) {
        const typeColors = {
            light: '#ffd369',
            prop: '#4ecdc4',
            actor: '#a8e6cf'
        };
        const typeMap = { light: '灯光', prop: '道具', actor: '演员' };

        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>演出结算报告 - ${data.levelName}</title>
    <style>
        body {
            font-family: -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            background: #1a1a2e;
            color: #eaeaea;
        }
        .header {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #16213e, #0f3460);
            border-radius: 12px;
            border-bottom: 3px solid #e94560;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #e94560;
            margin: 0 0 10px 0;
        }
        .section {
            background: #16213e;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .section h2 {
            color: #ffd369;
            margin-top: 0;
            border-bottom: 1px solid #2d3a5c;
            padding-bottom: 10px;
        }
        .result-banner {
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .success { background: rgba(78, 205, 196, 0.2); color: #4ecdc4; }
        .fail { background: rgba(233, 69, 96, 0.2); color: #e94560; }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-item {
            text-align: center;
            padding: 15px;
            background: #0f3460;
            border-radius: 8px;
        }
        .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #e94560;
        }
        .stat-label {
            font-size: 12px;
            color: #888;
            margin-top: 5px;
        }
        .conflict-item {
            padding: 10px;
            margin-bottom: 8px;
            border-left: 3px solid;
            border-radius: 4px;
        }
        .conflict-error {
            background: rgba(233, 69, 96, 0.1);
            border-color: #e94560;
        }
        .conflict-warning {
            background: rgba(255, 211, 105, 0.1);
            border-color: #ffd369;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #2d3a5c;
        }
        th {
            background: #0f3460;
            color: #ffd369;
            font-weight: bold;
        }
        tr:hover {
            background: rgba(78, 205, 196, 0.1);
        }
        .event-type {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            color: #1a1a2e;
            font-weight: bold;
        }
        .scene-change {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            margin-bottom: 5px;
            background: #0f3460;
            border-radius: 4px;
        }
        .ontime { color: #4ecdc4; }
        .overtime { color: #e94560; }
        .hints {
            background: rgba(255, 211, 105, 0.1);
            border-left: 3px solid #ffd369;
            padding: 15px;
            border-radius: 4px;
        }
        .hints ul { margin: 0; padding-left: 20px; }
        .hints li { margin-bottom: 5px; }
        .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #2d3a5c;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎭 剧场换景节奏游戏</h1>
        <p>演出结算报告</p>
    </div>

    <div class="result-banner ${data.success ? 'success' : 'fail'}">
        ${data.success ? '✓ 演出成功' : '✗ 演出失败'}
    </div>

    <div class="section">
        <h2>📊 基本信息</h2>
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-value">${data.levelName}</div>
                <div class="stat-label">关卡名称</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${'★'.repeat(data.difficulty)}${'☆'.repeat(4 - data.difficulty)}</div>
                <div class="stat-label">难度</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.score}<span style="font-size:14px;color:#888">/${data.maxScore}</span></div>
                <div class="stat-label">得分</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.scorePercent}%</div>
                <div class="stat-label">完成度</div>
            </div>
        </div>
        <p><strong>导出时间:</strong> ${new Date(data.timestamp).toLocaleString('zh-CN')}</p>
    </div>

    ${data.failReason ? `
    <div class="section">
        <h2>❌ 失败原因</h2>
        <div class="conflict-item conflict-error">
            <strong>${data.failReason}</strong>
        </div>
    </div>
    ` : ''}

    ${data.conflicts.length > 0 ? `
    <div class="section">
        <h2>⚠️ 冲突详情 (${data.errors} 错误, ${data.warnings} 警告)</h2>
        ${data.conflicts.map(c => `
        <div class="conflict-item conflict-${c.severity}">
            <strong>[${this.formatTime(c.time)}]</strong> ${c.message}
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${data.sceneChanges.length > 0 ? `
    <div class="section">
        <h2>🔄 换景统计</h2>
        ${data.sceneChanges.map(sc => `
        <div class="scene-change">
            <span>${sc.from} → ${sc.to}</span>
            <span>
                用时: <strong>${sc.actualDuration.toFixed(1)}s</strong> / ${sc.maxDuration}s
                <span class="${sc.onTime ? 'ontime' : 'overtime'}">
                    ${sc.onTime ? '✓ 准时' : '✗ 超时 ' + (sc.actualDuration - sc.maxDuration).toFixed(1) + 's'}
                </span>
            </span>
        </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>📋 事件排程表</h2>
        <table>
            <thead>
                <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>轨道</th>
                    <th>事件名称</th>
                    <th>时长</th>
                </tr>
            </thead>
            <tbody>
                ${data.events.map(evt => `
                <tr>
                    <td>${this.formatTime(evt.startTime)} - ${this.formatTime(evt.endTime)}</td>
                    <td><span class="event-type" style="background: ${typeColors[evt.type]}">${typeMap[evt.type]}</span></td>
                    <td>${evt.track}</td>
                    <td>${evt.name}${evt.order ? ' (#' + evt.order + ')' : ''}</td>
                    <td>${evt.duration}s</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    ${data.hints && data.hints.length > 0 ? `
    <div class="section">
        <h2>💡 关卡提示</h2>
        <div class="hints">
            <ul>
                ${data.hints.map(h => `<li>${h}</li>`).join('')}
            </ul>
        </div>
    </div>
    ` : ''}

    <div class="footer">
        <p>剧场换景节奏游戏 v1.0 | 报告生成时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}</p>
    </div>
</body>
</html>`;
        
        return html;
    },

    exportJSON(data) {
        return JSON.stringify(data, null, 2);
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    downloadReport(content, filename, format) {
        const mimeTypes = {
            text: 'text/plain;charset=utf-8',
            html: 'text/html;charset=utf-8',
            json: 'application/json;charset=utf-8'
        };
        const extensions = {
            text: 'txt',
            html: 'html',
            json: 'json'
        };

        const blob = new Blob([content], { type: mimeTypes[format] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extensions[format]}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    generateFilename(levelData) {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10);
        const timeStr = date.toTimeString().slice(0, 5).replace(':', '-');
        return `演出报告_${levelData.name}_${dateStr}_${timeStr}`;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReportExporter };
}
