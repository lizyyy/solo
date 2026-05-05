/**
 * 可视化模块
 * 用于时间线可视化和异常标记显示
 */

const Visualization = {
    // Chart.js 实例
    timelineChart: null,
    selectedBout: null,
    
    // 初始化可视化
    init: function() {
        // 可以在这里进行初始化操作
    },
    
    // 渲染时间线图表
    renderTimeline: function(timelineData, anomalies, showAnomalies, showVideoMarkers) {
        const canvasContainer = document.getElementById('timeline-chart');
        
        // 清空容器
        canvasContainer.innerHTML = '';
        
        // 创建canvas元素
        const canvas = document.createElement('canvas');
        canvas.id = 'timeline-canvas';
        canvasContainer.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        
        // 准备图表数据
        const datasets = [];
        const labels = [];
        
        // 处理时间线数据
        const boutPoints = [];
        const videoPoints = [];
        const refereeNotePoints = [];
        const anomalyPoints = [];
        
        // 收集所有唯一的时间点
        const timePoints = new Set();
        
        timelineData.forEach(item => {
            if (item.timeSeconds !== null) {
                timePoints.add(item.timeSeconds);
            }
        });
        
        // 转换时间点为标签
        const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
        const timeToLabel = {};
        
        sortedTimePoints.forEach((time, index) => {
            const hours = Math.floor(time / 3600);
            const minutes = Math.floor((time % 3600) / 60);
            const seconds = time % 60;
            labels.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            timeToLabel[time] = index;
        });
        
        // 处理各类型数据
        timelineData.forEach(item => {
            if (item.timeSeconds === null) return;
            
            const x = timeToLabel[item.timeSeconds];
            
            if (item.type === 'bout') {
                boutPoints.push({
                    x: x,
                    y: 0,
                    data: item.data,
                    boutId: item.boutId
                });
            } else if (item.type === 'video' && showVideoMarkers) {
                videoPoints.push({
                    x: x,
                    y: 1,
                    data: item.data,
                    description: item.description
                });
            } else if (item.type === 'referee_note') {
                refereeNotePoints.push({
                    x: x,
                    y: 2,
                    data: item.data,
                    referee: item.referee
                });
            }
        });
        
        // 处理异常点
        if (showAnomalies) {
            anomalies.forEach(anomaly => {
                const anomalyTime = Analysis.parseTime(anomaly.timestamp);
                if (anomalyTime !== null && timeToLabel[anomalyTime] !== undefined) {
                    anomalyPoints.push({
                        x: timeToLabel[anomalyTime],
                        y: -1,
                        data: anomaly,
                        type: anomaly.type,
                        typeName: anomaly.typeName
                    });
                }
            });
        }
        
        // 创建数据集
        if (boutPoints.length > 0) {
            datasets.push({
                label: '得分记录',
                data: boutPoints,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 12,
                pointStyle: 'circle'
            });
        }
        
        if (videoPoints.length > 0) {
            datasets.push({
                label: '视频标记',
                data: videoPoints,
                backgroundColor: 'rgba(40, 167, 69, 0.8)',
                borderColor: 'rgba(40, 167, 69, 1)',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 12,
                pointStyle: 'triangle'
            });
        }
        
        if (refereeNotePoints.length > 0) {
            datasets.push({
                label: '裁判备注',
                data: refereeNotePoints,
                backgroundColor: 'rgba(255, 193, 7, 0.8)',
                borderColor: 'rgba(255, 193, 7, 1)',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 12,
                pointStyle: 'rect'
            });
        }
        
        if (anomalyPoints.length > 0) {
            // 按类型分组
            const anomalyByType = {};
            anomalyPoints.forEach(point => {
                if (!anomalyByType[point.type]) {
                    anomalyByType[point.type] = [];
                }
                anomalyByType[point.type].push(point);
            });
            
            const anomalyColors = {
                'missed': { bg: 'rgba(255, 193, 7, 0.8)', border: 'rgba(255, 193, 7, 1)' },
                'double-light': { bg: 'rgba(23, 162, 184, 0.8)', border: 'rgba(23, 162, 184, 1)' },
                'score-mismatch': { bg: 'rgba(220, 53, 69, 0.8)', border: 'rgba(220, 53, 69, 1)' },
                'bye-anomaly': { bg: 'rgba(108, 117, 125, 0.8)', border: 'rgba(108, 117, 125, 1)' }
            };
            
            const anomalyNames = {
                'missed': '疑似漏记',
                'double-light': '双灯争议',
                'score-mismatch': '暂停后比分错位',
                'bye-anomaly': '选手轮空异常'
            };
            
            Object.keys(anomalyByType).forEach(type => {
                const color = anomalyColors[type] || anomalyColors['missed'];
                datasets.push({
                    label: anomalyNames[type] || '异常',
                    data: anomalyByType[type],
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    borderWidth: 2,
                    pointRadius: 10,
                    pointHoverRadius: 14,
                    pointStyle: 'star'
                });
            });
        }
        
        // 销毁旧图表
        if (this.timelineChart) {
            this.timelineChart.destroy();
        }
        
        // 创建新图表
        this.timelineChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: '时间'
                        },
                        ticks: {
                            callback: function(value, index, values) {
                                return labels[value] || '';
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '事件类型'
                        },
                        ticks: {
                            callback: function(value, index, values) {
                                const yLabels = {
                                    '-1': '异常',
                                    '0': '得分',
                                    '1': '视频',
                                    '2': '备注'
                                };
                                return yLabels[value] || value;
                            },
                            stepSize: 1
                        },
                        min: -2,
                        max: 3
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                if (!point) return '';
                                
                                if (point.boutId) {
                                    return [
                                        `剑次: ${point.boutId}`,
                                        `选手: ${point.data.fencer1} vs ${point.data.fencer2}`,
                                        `比分: ${point.data.score1} - ${point.data.score2}`,
                                        `获胜者: ${point.data.winner}`,
                                        `场地: ${point.data.piste}`
                                    ];
                                } else if (point.description) {
                                    return [
                                        `视频标记`,
                                        `描述: ${point.description}`,
                                        `视频时间: ${point.data.videoTime}`
                                    ];
                                } else if (point.referee) {
                                    return [
                                        `裁判备注`,
                                        `裁判: ${point.referee}`,
                                        `类型: ${point.data.noteType}`,
                                        `内容: ${point.data.content}`
                                    ];
                                } else if (point.typeName) {
                                    return [
                                        `${point.typeName}`,
                                        `描述: ${point.data.description}`,
                                        `严重程度: ${point.data.severity}`,
                                        `场地: ${point.data.piste}`
                                    ];
                                }
                                return '';
                            }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const datasetIndex = element.datasetIndex;
                        const index = element.index;
                        const point = this.timelineChart.data.datasets[datasetIndex].data[index];
                        
                        this.handlePointClick(point);
                    }
                }
            }
        });
    },
    
    // 处理点击事件
    handlePointClick: function(point) {
        if (!point) return;
        
        const detailContent = document.getElementById('bout-detail-content');
        const selectedBoutInfo = document.getElementById('selected-bout-info');
        const reversalType = document.getElementById('reversal-type');
        const reversalReason = document.getElementById('reversal-reason');
        const saveNoteBtn = document.getElementById('save-note');
        
        let htmlContent = '';
        
        if (point.boutId) {
            // 得分记录
            const bout = point.data;
            this.selectedBout = bout;
            
            htmlContent = `
                <div class="bout-detail-item">
                    <h4>剑次详情</h4>
                    <p><strong>剑次ID:</strong> ${bout.boutId}</p>
                    <p><strong>时间:</strong> ${bout.timestamp || '未知'}</p>
                    <p><strong>场地:</strong> ${bout.piste || '未知'}</p>
                    <p><strong>选手:</strong> ${bout.fencer1} vs ${bout.fencer2}</p>
                    <p><strong>比分:</strong> ${bout.score1} - ${bout.score2}</p>
                    <p><strong>获胜者:</strong> ${bout.winner || '未知'}</p>
                    <p><strong>灯状态:</strong> ${bout.lightStatus || '未知'}</p>
                    <p><strong>双灯:</strong> ${bout.isDoubleLight ? '是' : '否'}</p>
                    <p><strong>暂停前:</strong> ${bout.pauseBefore ? '是' : '否'}</p>
                    ${bout.notes ? `<p><strong>备注:</strong> ${bout.notes}</p>` : ''}
                </div>
            `;
            
            selectedBoutInfo.textContent = `${bout.boutId} - ${bout.fencer1} vs ${bout.fencer2}`;
            reversalType.disabled = false;
            reversalReason.disabled = false;
            saveNoteBtn.disabled = false;
            
            // 加载已保存的备注
            const savedNote = Analysis.getManualNote(bout.boutId);
            if (savedNote) {
                reversalType.value = savedNote.reversalType || '';
                reversalReason.value = savedNote.reversalReason || '';
            } else {
                reversalType.value = '';
                reversalReason.value = '';
            }
            
        } else if (point.description) {
            // 视频标记
            const video = point.data;
            this.selectedBout = null;
            
            htmlContent = `
                <div class="video-detail-item">
                    <h4>视频标记详情</h4>
                    <p><strong>时间码ID:</strong> ${video.timestampId}</p>
                    <p><strong>关联剑次:</strong> ${video.boutId || '无'}</p>
                    <p><strong>视频时间:</strong> ${video.videoTime || '未知'}</p>
                    <p><strong>实际时间:</strong> ${video.realTime || '未知'}</p>
                    <p><strong>描述:</strong> ${video.description || '无'}</p>
                    <p><strong>关键时刻:</strong> ${video.isKeyMoment ? '是' : '否'}</p>
                </div>
            `;
            
            selectedBoutInfo.textContent = '视频标记 - ' + (video.description || '无描述');
            reversalType.disabled = true;
            reversalReason.disabled = true;
            saveNoteBtn.disabled = true;
            
        } else if (point.referee) {
            // 裁判备注
            const note = point.data;
            this.selectedBout = null;
            
            htmlContent = `
                <div class="referee-note-detail-item">
                    <h4>裁判备注详情</h4>
                    <p><strong>备注ID:</strong> ${note.noteId}</p>
                    <p><strong>关联剑次:</strong> ${note.boutId || '无'}</p>
                    <p><strong>时间:</strong> ${note.timestamp || '未知'}</p>
                    <p><strong>裁判:</strong> ${note.referee || '未知'}</p>
                    <p><strong>类型:</strong> ${note.noteType || '未知'}</p>
                    <p><strong>内容:</strong> ${note.content || '无'}</p>
                    <p><strong>改判:</strong> ${note.isReversal ? '是' : '否'}</p>
                    ${note.reversalReason ? `<p><strong>改判理由:</strong> ${note.reversalReason}</p>` : ''}
                </div>
            `;
            
            selectedBoutInfo.textContent = '裁判备注 - ' + (note.referee || '未知裁判');
            reversalType.disabled = true;
            reversalReason.disabled = true;
            saveNoteBtn.disabled = true;
            
        } else if (point.typeName) {
            // 异常
            const anomaly = point.data;
            this.selectedBout = null;
            
            htmlContent = `
                <div class="anomaly-detail-item">
                    <h4>异常详情</h4>
                    <p><strong>异常ID:</strong> ${anomaly.anomalyId}</p>
                    <p><strong>类型:</strong> ${anomaly.typeName}</p>
                    <p><strong>描述:</strong> ${anomaly.description}</p>
                    <p><strong>严重程度:</strong> ${anomaly.severity}</p>
                    <p><strong>场地:</strong> ${anomaly.piste || '未知'}</p>
                    <p><strong>关联选手:</strong> ${anomaly.fencers ? anomaly.fencers.join(', ') : '无'}</p>
                    <p><strong>关联剑次:</strong> ${anomaly.relatedBouts ? anomaly.relatedBouts.join(', ') : '无'}</p>
                    <p><strong>时间:</strong> ${anomaly.timestamp || '未知'}</p>
                    ${anomaly.details ? `
                        <div class="anomaly-details">
                            <h5>详细信息:</h5>
                            <pre>${JSON.stringify(anomaly.details, null, 2)}</pre>
                        </div>
                    ` : ''}
                </div>
            `;
            
            selectedBoutInfo.textContent = '异常 - ' + anomaly.typeName;
            reversalType.disabled = true;
            reversalReason.disabled = true;
            saveNoteBtn.disabled = true;
        }
        
        detailContent.innerHTML = htmlContent;
    },
    
    // 更新图表（用于筛选后重新渲染）
    updateChart: function(timelineData, anomalies, showAnomalies, showVideoMarkers) {
        this.renderTimeline(timelineData, anomalies, showAnomalies, showVideoMarkers);
    },
    
    // 渲染异常表格
    renderAnomalyTable: function(anomalies) {
        const container = document.getElementById('anomaly-table-container');
        
        if (anomalies.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">暂无异常数据</p>';
            return;
        }
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>类型</th>
                        <th>描述</th>
                        <th>严重程度</th>
                        <th>场地</th>
                        <th>选手</th>
                        <th>时间</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const severityColors = {
            'low': '低',
            'medium': '中',
            'high': '高'
        };
        
        anomalies.forEach(anomaly => {
            const rowClass = `anomaly-${anomaly.type}`;
            html += `
                <tr class="${rowClass}">
                    <td>${anomaly.typeName}</td>
                    <td>${anomaly.description}</td>
                    <td>${severityColors[anomaly.severity] || anomaly.severity}</td>
                    <td>${anomaly.piste || '-'}</td>
                    <td>${anomaly.fencers ? anomaly.fencers.join(', ') : '-'}</td>
                    <td>${anomaly.timestamp || '-'}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
    },
    
    // 更新统计信息
    updateSummary: function(summary) {
        document.getElementById('total-bouts').textContent = summary.totalBouts;
        document.getElementById('total-anomalies').textContent = summary.totalAnomalies;
        document.getElementById('total-fencers').textContent = summary.totalFencers;
        document.getElementById('total-pistes').textContent = summary.totalPistes;
    },
    
    // 更新筛选器选项
    updateFilters: function(fencers, pistes) {
        const filterFencer = document.getElementById('filter-fencer');
        const filterPiste = document.getElementById('filter-piste');
        const vizFencer = document.getElementById('viz-fencer');
        const vizPiste = document.getElementById('viz-piste');
        
        // 更新选手选项
        const updateSelect = (select, options, defaultText) => {
            select.innerHTML = `<option value="">${defaultText}</option>`;
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                select.appendChild(opt);
            });
            select.disabled = false;
        };
        
        updateSelect(filterFencer, fencers, '所有选手');
        updateSelect(vizFencer, fencers, '所有选手');
        updateSelect(filterPiste, pistes, '所有场地');
        updateSelect(vizPiste, pistes, '所有场地');
        
        // 启用异常类型筛选
        document.getElementById('filter-anomaly').disabled = false;
    }
};

// 导出模块（用于Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Visualization;
}
