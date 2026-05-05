/**
 * 主应用逻辑
 * 连接所有模块并处理用户交互
 */

const App = {
    // 初始化应用
    init: function() {
        this.bindEvents();
        Visualization.init();
    },
    
    // 绑定事件
    bindEvents: function() {
        // 标签页切换
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // 文件上传
        document.getElementById('score-log').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'score-log');
        });
        
        document.getElementById('round-schedule').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'round-schedule');
        });
        
        document.getElementById('video-timestamps').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'video-timestamps');
        });
        
        document.getElementById('referee-notes').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'referee-notes');
        });
        
        // 按钮事件
        document.getElementById('load-sample-data').addEventListener('click', () => {
            this.loadSampleData();
        });
        
        document.getElementById('clear-all-data').addEventListener('click', () => {
            this.clearAllData();
        });
        
        document.getElementById('analyze-data').addEventListener('click', () => {
            this.analyzeData();
        });
        
        // 筛选器事件
        document.getElementById('filter-fencer').addEventListener('change', () => {
            this.applyFilters();
        });
        
        document.getElementById('filter-piste').addEventListener('change', () => {
            this.applyFilters();
        });
        
        document.getElementById('filter-anomaly').addEventListener('change', () => {
            this.applyFilters();
        });
        
        // 可视化筛选器
        document.getElementById('viz-fencer').addEventListener('change', () => {
            this.updateVisualization();
        });
        
        document.getElementById('viz-piste').addEventListener('change', () => {
            this.updateVisualization();
        });
        
        document.getElementById('show-anomalies').addEventListener('change', () => {
            this.updateVisualization();
        });
        
        document.getElementById('show-video-markers').addEventListener('change', () => {
            this.updateVisualization();
        });
        
        // 保存备注
        document.getElementById('save-note').addEventListener('click', () => {
            this.saveNote();
        });
        
        // 导出按钮
        document.getElementById('export-markdown').addEventListener('click', () => {
            this.exportData('markdown');
        });
        
        document.getElementById('export-json').addEventListener('click', () => {
            this.exportData('json');
        });
        
        document.getElementById('export-csv').addEventListener('click', () => {
            this.exportData('csv');
        });
    },
    
    // 切换标签页
    switchTab: function(tabName) {
        // 移除所有活动状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // 添加活动状态
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    },
    
    // 处理文件上传
    handleFileUpload: function(event, fileType) {
        const file = event.target.files[0];
        if (!file) return;
        
        const statusElement = document.getElementById(`${fileType}-status`);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                let parsedData = null;
                
                // 根据文件类型解析
                switch (fileType) {
                    case 'score-log':
                        parsedData = DataParser.parseScoreLog(content);
                        break;
                    case 'round-schedule':
                        parsedData = DataParser.parseRoundSchedule(content);
                        break;
                    case 'video-timestamps':
                        parsedData = DataParser.parseVideoTimestamps(content);
                        break;
                    case 'referee-notes':
                        parsedData = DataParser.parseRefereeNotes(content);
                        break;
                }
                
                if (parsedData && parsedData.length > 0) {
                    // 存储到Analysis模块
                    switch (fileType) {
                        case 'score-log':
                            Analysis.data.scoreLogs = parsedData;
                            break;
                        case 'round-schedule':
                            Analysis.data.roundSchedule = parsedData;
                            break;
                        case 'video-timestamps':
                            Analysis.data.videoTimestamps = parsedData;
                            break;
                        case 'referee-notes':
                            Analysis.data.refereeNotes = parsedData;
                            break;
                    }
                    
                    statusElement.textContent = `已加载 ${parsedData.length} 条记录`;
                    statusElement.className = 'file-status success';
                    
                    // 检查是否有足够数据进行分析
                    this.checkDataReady();
                } else {
                    statusElement.textContent = '文件解析失败，请检查格式';
                    statusElement.className = 'file-status error';
                }
            } catch (error) {
                console.error('文件解析错误:', error);
                statusElement.textContent = '文件解析出错: ' + error.message;
                statusElement.className = 'file-status error';
            }
        };
        
        reader.onerror = () => {
            statusElement.textContent = '文件读取失败';
            statusElement.className = 'file-status error';
        };
        
        reader.readAsText(file);
    },
    
    // 加载示例数据
    loadSampleData: function() {
        const sampleData = DataParser.generateSampleData();
        
        Analysis.loadData(
            sampleData.scoreLogs,
            sampleData.roundSchedule,
            sampleData.videoTimestamps,
            sampleData.refereeNotes
        );
        
        // 更新状态显示
        const statusElements = [
            { id: 'score-log-status', count: sampleData.scoreLogs.length },
            { id: 'round-schedule-status', count: sampleData.roundSchedule.length },
            { id: 'video-timestamps-status', count: sampleData.videoTimestamps.length },
            { id: 'referee-notes-status', count: sampleData.refereeNotes.length }
        ];
        
        statusElements.forEach(item => {
            const element = document.getElementById(item.id);
            element.textContent = `已加载 ${item.count} 条记录`;
            element.className = 'file-status success';
        });
        
        // 启用按钮
        this.checkDataReady();
        
        // 显示提示
        alert('示例数据已加载！点击"开始分析"按钮进行数据分析。');
    },
    
    // 清空所有数据
    clearAllData: function() {
        if (confirm('确定要清空所有数据吗？')) {
            Analysis.loadData([], [], [], []);
            Analysis.data.manualNotes = {};
            
            // 清空状态显示
            const statusElements = [
                'score-log-status',
                'round-schedule-status',
                'video-timestamps-status',
                'referee-notes-status'
            ];
            
            statusElements.forEach(id => {
                document.getElementById(id).textContent = '';
                document.getElementById(id).className = 'file-status';
            });
            
            // 清空文件输入
            document.getElementById('score-log').value = '';
            document.getElementById('round-schedule').value = '';
            document.getElementById('video-timestamps').value = '';
            document.getElementById('referee-notes').value = '';
            
            // 禁用按钮
            document.getElementById('clear-all-data').disabled = true;
            document.getElementById('analyze-data').disabled = true;
            
            // 禁用筛选器
            document.getElementById('filter-fencer').disabled = true;
            document.getElementById('filter-piste').disabled = true;
            document.getElementById('filter-anomaly').disabled = true;
            document.getElementById('viz-fencer').disabled = true;
            document.getElementById('viz-piste').disabled = true;
            
            // 清空表格和图表
            document.getElementById('anomaly-table-container').innerHTML = '<p style="text-align: center; color: #666;">暂无异常数据</p>';
            document.getElementById('timeline-chart').innerHTML = '';
            
            // 重置统计
            document.getElementById('total-bouts').textContent = '-';
            document.getElementById('total-anomalies').textContent = '-';
            document.getElementById('total-fencers').textContent = '-';
            document.getElementById('total-pistes').textContent = '-';
            
            // 禁用导出按钮
            document.getElementById('export-markdown').disabled = true;
            document.getElementById('export-json').disabled = true;
            document.getElementById('export-csv').disabled = true;
            
            alert('所有数据已清空！');
        }
    },
    
    // 检查数据是否准备好
    checkDataReady: function() {
        const hasScoreLogs = Analysis.data.scoreLogs.length > 0;
        const hasRoundSchedule = Analysis.data.roundSchedule.length > 0;
        
        // 只要有得分日志就可以分析
        if (hasScoreLogs || hasRoundSchedule) {
            document.getElementById('clear-all-data').disabled = false;
            document.getElementById('analyze-data').disabled = false;
        }
    },
    
    // 分析数据
    analyzeData: function() {
        // 对齐时间线
        Analysis.alignTimeline();
        
        // 检测异常
        Analysis.detectAllAnomalies();
        
        // 获取分析结果
        const result = Analysis.getAnalysisResult();
        
        // 更新统计
        Visualization.updateSummary(result.summary);
        
        // 更新筛选器
        const fencers = Analysis.getFencers();
        const pistes = Analysis.getPistes();
        Visualization.updateFilters(fencers, pistes);
        
        // 渲染异常表格
        Visualization.renderAnomalyTable(result.anomalies);
        
        // 渲染时间线
        this.updateVisualization();
        
        // 启用导出按钮
        document.getElementById('export-markdown').disabled = false;
        document.getElementById('export-json').disabled = false;
        document.getElementById('export-csv').disabled = false;
        
        // 切换到分析标签页
        this.switchTab('analysis');
        
        alert(`分析完成！\n\n总剑数: ${result.summary.totalBouts}\n异常数量: ${result.summary.totalAnomalies}\n选手数量: ${result.summary.totalFencers}\n场地数量: ${result.summary.totalPistes}`);
    },
    
    // 应用筛选器
    applyFilters: function() {
        const fencer = document.getElementById('filter-fencer').value;
        const piste = document.getElementById('filter-piste').value;
        const anomalyType = document.getElementById('filter-anomaly').value;
        
        const filtered = Analysis.filterData(fencer, piste, anomalyType);
        Visualization.renderAnomalyTable(filtered.anomalies);
    },
    
    // 更新可视化
    updateVisualization: function() {
        const fencer = document.getElementById('viz-fencer').value;
        const piste = document.getElementById('viz-piste').value;
        const showAnomalies = document.getElementById('show-anomalies').checked;
        const showVideoMarkers = document.getElementById('show-video-markers').checked;
        
        const filtered = Analysis.filterData(fencer, piste, '');
        
        Visualization.renderTimeline(
            filtered.timeline,
            filtered.anomalies,
            showAnomalies,
            showVideoMarkers
        );
    },
    
    // 保存备注
    saveNote: function() {
        const selectedBout = Visualization.selectedBout;
        if (!selectedBout) {
            alert('请先选择一个剑次！');
            return;
        }
        
        const reversalType = document.getElementById('reversal-type').value;
        const reversalReason = document.getElementById('reversal-reason').value;
        
        if (!reversalType && !reversalReason) {
            alert('请输入改判类型或改判理由！');
            return;
        }
        
        Analysis.saveManualNote(selectedBout.boutId, reversalType, reversalReason);
        alert('备注已保存！');
    },
    
    // 导出数据
    exportData: function(type) {
        const result = Analysis.getAnalysisResult();
        const previewContent = document.getElementById('export-preview-content');
        
        let content = '';
        
        switch (type) {
            case 'markdown':
                content = Export.exportMarkdown(result);
                break;
            case 'json':
                content = Export.exportJSON(result);
                break;
            case 'csv':
                content = Export.exportCSV(result.anomalies, result.manualNotes);
                if (!content) {
                    alert('没有异常数据可导出！');
                    return;
                }
                break;
        }
        
        // 显示预览
        previewContent.textContent = content;
        
        // 切换到导出标签页
        this.switchTab('export');
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
