const ReportManager = {
    generateReport(sessionId = null) {
        const records = sessionId 
            ? Storage.getSessionRecords(sessionId)
            : Storage.getRecords();
        
        const normalRecords = records.filter(r => r.status === 'normal');
        const anomalyRecords = records.filter(r => r.status === 'anomaly');
        
        const now = new Date();
        const session = sessionId 
            ? Storage.getHistory().find(s => s.sessionId === sessionId)
            : null;

        let html = `
            <div class="report-header">
                <h1>🔬 浮力密度实验报告</h1>
                <p class="report-meta">
                    生成时间：${now.toLocaleString('zh-CN')}
                    ${session ? ` | 实验时间：${new Date(session.startTime).toLocaleString('zh-CN')}` : ''}
                </p>
            </div>

            <div class="report-summary">
                <div class="report-summary-item">
                    <span class="value">${records.length}</span>
                    <span class="label">总实验次数</span>
                </div>
                <div class="report-summary-item">
                    <span class="value" style="color: #48bb78">${normalRecords.length}</span>
                    <span class="label">正常记录</span>
                </div>
                <div class="report-summary-item">
                    <span class="value" style="color: #f56565">${anomalyRecords.length}</span>
                    <span class="label">异常记录</span>
                </div>
                <div class="report-summary-item">
                    <span class="value" style="color: #667eea">${records.length > 0 ? (normalRecords.length / records.length * 100).toFixed(1) : 0}%</span>
                    <span class="label">合格率</span>
                </div>
            </div>
        `;

        if (normalRecords.length > 0) {
            html += `
                <div class="report-section">
                    <h2>📊 正常实验记录</h2>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>物体</th>
                                <th>体积(cm³)</th>
                                <th>质量(g)</th>
                                <th>密度(g/cm³)</th>
                                <th>液体密度(g/cm³)</th>
                                <th>排水量(cm³)</th>
                                <th>浮力(N)</th>
                                <th>状态</th>
                                <th>操作者</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const record of normalRecords) {
                html += `
                    <tr>
                        <td>${record.name}</td>
                        <td>${record.volume}</td>
                        <td>${record.mass}</td>
                        <td>${record.analysis?.objectDensity?.toFixed(3) || '-'}</td>
                        <td>${record.liquidDensity}</td>
                        <td>${record.analysis?.displacement?.toFixed(2) || '-'}</td>
                        <td>${record.analysis?.buoyancy?.toFixed(3) || '-'}</td>
                        <td>${record.analysis?.stateLabel || '-'}</td>
                        <td>${record.operator || '-'}</td>
                    </tr>
                `;
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (anomalyRecords.length > 0) {
            html += `
                <div class="report-section">
                    <h2>⚠️ 异常实验记录</h2>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>物体</th>
                                <th>异常原因</th>
                                <th>原始数据</th>
                                <th>时间</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const record of anomalyRecords) {
                const errors = record.validation?.errors?.map(e => e.message).join('; ') || '未知错误';
                html += `
                    <tr class="anomaly">
                        <td>${record.name}</td>
                        <td style="color: #c53030">${errors}</td>
                        <td>
                            体积:${record.volume}cm³, 
                            质量:${record.mass}g, 
                            液体密度:${record.liquidDensity}g/cm³
                            ${record.displacement ? `, 排水量:${record.displacement}cm³` : ''}
                        </td>
                        <td>${new Date(record.timestamp).toLocaleString('zh-CN')}</td>
                    </tr>
                `;
            }
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (normalRecords.length > 0) {
            const floatingCount = normalRecords.filter(r => r.analysis?.state === 'floating').length;
            const sinkingCount = normalRecords.filter(r => r.analysis?.state === 'sinking').length;
            const suspendedCount = normalRecords.filter(r => r.analysis?.state === 'suspended').length;

            html += `
                <div class="report-section">
                    <h2>📚 实验结论</h2>
                    <div style="background: #f7fafc; padding: 16px; border-radius: 8px; line-height: 1.8;">
                        <p><strong>1. 阿基米德原理验证：</strong>物体在液体中受到的浮力等于排开液体的重力，即 F<sub>浮</sub> = ρ<sub>液</sub> × g × V<sub>排</sub></p>
                        <p><strong>2. 浮沉条件：</strong></p>
                        <ul style="margin-left: 20px; margin-top: 8px;">
                            <li>当 ρ<sub>物</sub> &lt; ρ<sub>液</sub> 时，物体<strong>漂浮</strong>（本次实验 ${floatingCount} 次）</li>
                            <li>当 ρ<sub>物</sub> = ρ<sub>液</sub> 时，物体<strong>悬浮</strong>（本次实验 ${suspendedCount} 次）</li>
                            <li>当 ρ<sub>物</sub> &gt; ρ<sub>液</sub> 时，物体<strong>下沉</strong>（本次实验 ${sinkingCount} 次）</li>
                        </ul>
                        <p style="margin-top: 12px;"><strong>3. 排水量规律：</strong></p>
                        <ul style="margin-left: 20px; margin-top: 8px;">
                            <li>漂浮时：V<sub>排</sub> = V<sub>物</sub> × (ρ<sub>物</sub> / ρ<sub>液</sub>)，排水量小于物体体积</li>
                            <li>悬浮/下沉时：V<sub>排</sub> = V<sub>物</sub>，排水量等于物体体积</li>
                        </ul>
                        ${anomalyRecords.length > 0 ? `
                            <p style="margin-top: 12px; color: #c53030;">
                                <strong>4. 异常说明：</strong>本次实验共有 ${anomalyRecords.length} 条异常记录，
                                主要原因为：${this.getTopError(anomalyRecords)}
                            </p>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        return html;
    },

    getTopError(records) {
        const errorCounts = {};
        for (const record of records) {
            if (record.validation?.errors) {
                for (const error of record.validation.errors) {
                    const key = error.field;
                    errorCounts[key] = (errorCounts[key] || 0) + 1;
                }
            }
        }
        
        const sorted = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return '数据校验未通过';
        
        const fieldNames = {
            'volume': '体积数据错误',
            'mass': '质量数据错误',
            'displacement': '排水量数据错误',
            'liquidDensity': '液体密度错误',
            'name': '物体名称缺失'
        };
        
        return sorted.slice(0, 3).map(([field, count]) => 
            `${fieldNames[field] || field}(${count}次)`
        ).join('、');
    },

    downloadReport(html, filename = null) {
        const now = new Date();
        const reportFilename = filename || `浮力密度实验报告_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}.html`;

        const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>浮力密度实验报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 0 20px;
            color: #2d3748;
            line-height: 1.6;
        }
        .report-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #667eea;
        }
        .report-header h1 {
            margin: 0 0 10px 0;
            color: #2d3748;
        }
        .report-meta {
            color: #718096;
            font-size: 14px;
        }
        .report-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
        }
        .report-summary-item {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .report-summary-item .value {
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            display: block;
        }
        .report-summary-item .label {
            font-size: 14px;
            color: #718096;
        }
        .report-section {
            margin-bottom: 30px;
        }
        .report-section h2 {
            font-size: 18px;
            color: #2d3748;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        .report-table th,
        .report-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .report-table th {
            background: #f7fafc;
            font-weight: 600;
            color: #4a5568;
        }
        .report-table tr.anomaly {
            background: #fff5f5;
        }
        @media print {
            body {
                margin: 0;
                padding: 20px;
            }
            .report-summary-item {
                break-inside: avoid;
            }
            .report-section {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = reportFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async exportScreenshot(elementId = null) {
        const element = elementId ? document.getElementById(elementId) : document.body;
        
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false
            });
            
            const now = new Date();
            const filename = `浮力密度实验截图_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.png`;
            
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            return { success: true, filename };
        } catch (error) {
            console.error('Screenshot export error:', error);
            return { success: false, error };
        }
    }
};
