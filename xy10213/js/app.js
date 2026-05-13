class App {
    constructor() {
        this.simulation = new Simulation();
        this.exporter = new Exporter();
        this.updateInterval = null;
        this.draggedVehicle = null;
        
        this.initElements();
        this.initEventListeners();
        this.updateUI();
    }

    initElements() {
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        
        this.peakArrivalRate = document.getElementById('peakArrivalRate');
        this.offPeakArrivalRate = document.getElementById('offPeakArrivalRate');
        this.maxQueueSize = document.getElementById('maxQueueSize');
        
        this.peakStrategy = document.getElementById('peakStrategy');
        this.offPeakStrategy = document.getElementById('offPeakStrategy');
        this.peakGates = document.getElementById('peakGates');
        this.offPeakGates = document.getElementById('offPeakGates');
        this.processingTime = document.getElementById('processingTime');
        
        this.peakGatesGroup = document.getElementById('peakGatesGroup');
        this.offPeakGatesGroup = document.getElementById('offPeakGatesGroup');
        
        this.testDataSet = document.getElementById('testDataSet');
        this.loadTestBtn = document.getElementById('loadTestBtn');
        
        this.addVehicleBtn = document.getElementById('addVehicleBtn');
        this.skipToPeakBtn = document.getElementById('skipToPeakBtn');
        this.clearQueueBtn = document.getElementById('clearQueueBtn');
        
        this.currentTimeEl = document.getElementById('currentTime');
        this.simulationStatusEl = document.getElementById('simulationStatus');
        this.processedCountEl = document.getElementById('processedCount');
        this.queueCountEl = document.getElementById('queueCount');
        this.overflowCountEl = document.getElementById('overflowCount');
        
        this.queueArea = document.getElementById('queueArea');
        this.gatesContainer = document.getElementById('gatesContainer');
        
        this.resultsOutput = document.getElementById('resultsOutput');
        this.businessSummary = document.getElementById('businessSummary');
    }

    initEventListeners() {
        this.playBtn.addEventListener('click', () => this.play());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.exportBtn.addEventListener('click', () => this.export());
        
        this.speedSlider.addEventListener('input', (e) => {
            const speed = parseInt(e.target.value);
            this.speedValue.textContent = `${speed}x`;
            this.simulation.setSpeed(speed);
        });
        
        this.peakArrivalRate.addEventListener('change', () => this.updateConfig());
        this.offPeakArrivalRate.addEventListener('change', () => this.updateConfig());
        this.maxQueueSize.addEventListener('change', () => this.updateConfig());
        
        this.peakStrategy.addEventListener('change', () => {
            this.toggleGatesConfig();
            this.updateConfig();
        });
        this.offPeakStrategy.addEventListener('change', () => {
            this.toggleGatesConfig();
            this.updateConfig();
        });
        this.peakGates.addEventListener('change', () => this.updateConfig());
        this.offPeakGates.addEventListener('change', () => this.updateConfig());
        this.processingTime.addEventListener('change', () => this.updateConfig());
        
        this.loadTestBtn.addEventListener('click', () => this.loadTestData());
        
        this.addVehicleBtn.addEventListener('click', () => this.addManualVehicle());
        this.skipToPeakBtn.addEventListener('click', () => this.skipToPeakTime());
        this.clearQueueBtn.addEventListener('click', () => this.clearQueue());
        
        this.setupDragAndDrop();
    }

    toggleGatesConfig() {
        if (this.peakStrategy.value === 'elastic') {
            this.peakGatesGroup.style.display = 'flex';
        } else {
            this.peakGatesGroup.style.display = 'flex';
        }
        
        if (this.offPeakStrategy.value === 'elastic') {
            this.offPeakGatesGroup.style.display = 'flex';
        } else {
            this.offPeakGatesGroup.style.display = 'flex';
        }
    }

    setupDragAndDrop() {
        let draggedVehicleId = null;
        let draggedElement = null;
        
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('vehicle-item')) {
                draggedVehicleId = parseInt(e.target.dataset.vehicleId);
                draggedElement = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedVehicleId);
            }
        });
        
        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('vehicle-item')) {
                e.target.classList.remove('dragging');
                draggedVehicleId = null;
                draggedElement = null;
                this.clearDropIndicators();
            }
        });
        
        document.addEventListener('dragover', (e) => {
            const vehicleItem = e.target.closest('.vehicle-item');
            if (vehicleItem && draggedVehicleId) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.showDropIndicator(vehicleItem);
            } else if (e.target.classList.contains('queue-area')) {
                e.preventDefault();
            }
        });
        
        document.addEventListener('dragleave', (e) => {
            this.clearDropIndicators();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.clearDropIndicators();
            
            if (!draggedVehicleId) return;
            
            const targetVehicle = e.target.closest('.vehicle-item');
            if (targetVehicle) {
                const targetVehicleId = parseInt(targetVehicle.dataset.vehicleId);
                
                if (draggedVehicleId !== targetVehicleId) {
                    const fromIndex = this.simulation.getQueueVehicleIndex(draggedVehicleId);
                    const toIndex = this.simulation.getQueueVehicleIndex(targetVehicleId);
                    
                    if (fromIndex >= 0 && toIndex >= 0) {
                        const success = this.simulation.moveVehicleInQueue(fromIndex, toIndex);
                        if (success) {
                            this.addLogEntry('success', `手动调度：车辆 #${draggedVehicleId} 移到位置 ${toIndex + 1}`);
                            this.updateUI();
                        }
                    }
                }
            }
        });
    }

    showDropIndicator(targetElement) {
        this.clearDropIndicators();
        targetElement.style.boxShadow = '0 0 10px 3px #38ef7d';
        targetElement.style.transform = 'scale(1.05)';
    }

    clearDropIndicators() {
        document.querySelectorAll('.vehicle-item').forEach(item => {
            item.style.boxShadow = '';
            item.style.transform = '';
        });
    }

    addManualVehicle() {
        const success = this.simulation.addManualVehicle();
        if (success) {
            this.addLogEntry('success', '手动添加了一辆车到队列');
        } else {
            this.addLogEntry('error', '队列已满，车辆溢出');
        }
        this.updateUI();
    }

    skipToPeakTime() {
        const peakStartMinutes = 6 * 60;
        if (this.simulation.currentTime < peakStartMinutes) {
            this.simulation.currentTime = peakStartMinutes;
            this.simulation.lastGenerationTime = peakStartMinutes;
            this.addLogEntry('info', '已跳到高峰时段（06:00）');
            this.updateUI();
        } else {
            this.addLogEntry('warning', '当前已在高峰时段或之后');
        }
    }

    clearQueue() {
        if (this.simulation.queue.size() > 0) {
            const count = this.simulation.queue.size();
            this.simulation.queue.clear();
            this.addLogEntry('warning', `手动清空了队列中的 ${count} 辆车`);
            this.updateUI();
        } else {
            this.addLogEntry('info', '队列为空，无需清空');
        }
    }

    updateConfig() {
        const config = {
            peakArrivalRate: parseInt(this.peakArrivalRate.value),
            offPeakArrivalRate: parseInt(this.offPeakArrivalRate.value),
            maxQueueSize: parseInt(this.maxQueueSize.value),
            peakStrategy: this.peakStrategy.value,
            offPeakStrategy: this.offPeakStrategy.value,
            peakGates: parseInt(this.peakGates.value),
            offPeakGates: parseInt(this.offPeakGates.value),
            processingTime: parseInt(this.processingTime.value)
        };
        
        this.simulation.setConfig(config);
        this.addLogEntry('info', '配置已更新');
    }

    loadTestData() {
        const scenario = this.testDataSet.value;
        const config = TestData.getConfig(scenario);
        
        if (config) {
            this.reset();
            
            this.peakArrivalRate.value = config.peakArrivalRate;
            this.offPeakArrivalRate.value = config.offPeakArrivalRate;
            this.maxQueueSize.value = config.maxQueueSize;
            this.peakStrategy.value = config.peakStrategy;
            this.offPeakStrategy.value = config.offPeakStrategy;
            this.peakGates.value = config.peakGates;
            this.offPeakGates.value = config.offPeakGates;
            this.processingTime.value = config.processingTime;
            
            this.updateConfig();
            
            const scenarioData = TestData[scenario];
            this.addLogEntry('success', `已加载测试场景：${scenarioData.name}`);
            this.addLogEntry('info', scenarioData.description);
        }
    }

    play() {
        if (this.simulation.status === 'running') return;
        
        this.simulation.start();
        this.addLogEntry('success', '仿真开始');
        this.startUIUpdate();
    }

    pause() {
        if (this.simulation.status !== 'running') return;
        
        this.simulation.pause();
        this.addLogEntry('warning', '仿真已暂停');
        this.stopUIUpdate();
    }

    reset() {
        this.simulation.reset();
        this.stopUIUpdate();
        this.resultsOutput.innerHTML = '<p>点击播放按钮开始仿真...</p>';
        this.businessSummary.innerHTML = '<p>等待仿真完成以生成业务分析报告...</p>';
        this.addLogEntry('info', '仿真已重置');
        this.updateUI();
    }

    export() {
        const { results, analysis, report } = this.simulation.getAnalysis();
        
        if (results.totalGenerated === 0) {
            this.addLogEntry('error', '没有可导出的数据，请先运行仿真');
            return;
        }
        
        this.exporter.export(results, analysis, report, 'text');
        this.addLogEntry('success', '结果已导出');
    }

    startUIUpdate() {
        if (this.updateInterval) return;
        this.updateInterval = setInterval(() => this.updateUI(), 100);
    }

    stopUIUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    updateUI() {
        const state = this.simulation.getState();
        
        this.updateStatusBar(state);
        this.updateQueueVisualization(state.queue);
        this.updateGatesVisualization(state.gates);
        this.updateSimulationStatus(state.status);
        
        if (state.status === 'stopped' || state.status === 'paused') {
            if (state.processedCount > 0) {
                this.generateReport();
            }
        }
    }

    updateStatusBar(state) {
        this.currentTimeEl.textContent = this.formatTime(state.currentTime);
        this.processedCountEl.textContent = state.processedCount;
        this.queueCountEl.textContent = state.queueSize;
        this.overflowCountEl.textContent = state.overflowCount;
    }

    updateSimulationStatus(status) {
        let statusText = '';
        let statusClass = '';
        
        switch (status) {
            case 'running':
                statusText = '运行中';
                statusClass = 'status-running';
                break;
            case 'paused':
                statusText = '已暂停';
                statusClass = 'status-paused';
                break;
            case 'stopped':
            default:
                statusText = '已停止';
                statusClass = 'status-stopped';
        }
        
        this.simulationStatusEl.textContent = statusText;
        this.simulationStatusEl.className = `status-value ${statusClass}`;
    }

    updateQueueVisualization(queue) {
        if (queue.length === 0) {
            this.queueArea.innerHTML = '<p class="empty-hint">队列为空</p>';
            return;
        }
        
        const displayVehicles = queue.slice(0, 50);
        const remaining = queue.length - displayVehicles.length;
        
        let html = '';
        displayVehicles.forEach(vehicle => {
            html += `
                <div class="vehicle-item" 
                     draggable="true" 
                     data-vehicle-id="${vehicle.id}"
                     title="车辆 #${vehicle.id} - 等待时间: ${vehicle.getWaitTime(this.simulation.currentTime).toFixed(1)} 分钟">
                    #${vehicle.id}
                </div>
            `;
        });
        
        if (remaining > 0) {
            html += `<div class="vehicle-item" style="background: #666;">+${remaining}</div>`;
        }
        
        this.queueArea.innerHTML = html;
    }

    updateGatesVisualization(gates) {
        if (gates.length === 0) {
            this.gatesContainer.innerHTML = '<p class="empty-hint">未配置闸口</p>';
            return;
        }
        
        let html = '';
        gates.forEach(gate => {
            let gateClass = '';
            let statusText = '';
            let clickable = false;
            let actionHint = '';
            
            switch (gate.status) {
                case 'processing':
                    gateClass = 'busy';
                    statusText = `处理中 (车辆 #${gate.currentVehicle ? gate.currentVehicle.id : '-'})`;
                    break;
                case 'idle':
                    gateClass = 'active';
                    statusText = '空闲 - 点击关闭';
                    clickable = true;
                    actionHint = 'cursor-pointer';
                    break;
                case 'inactive':
                    gateClass = 'inactive';
                    statusText = '未启用 - 点击开启';
                    clickable = true;
                    actionHint = 'cursor-pointer';
                    break;
            }
            
            html += `
                <div class="gate-item ${gateClass} ${actionHint}" 
                     data-gate-id="${gate.id}"
                     ${clickable ? 'title="点击切换闸口状态"' : ''}>
                    <div class="gate-header">闸口 #${gate.id}</div>
                    <div class="gate-status">${statusText}</div>
                    ${gate.status === 'processing' ? `
                        <div class="gate-progress">
                            <div class="gate-progress-bar" style="width: ${gate.progress}%"></div>
                        </div>
                    ` : ''}
                    <div class="gate-status" style="margin-top: 5px; font-size: 0.75rem;">
                        已处理: ${gate.processedCount} 辆
                    </div>
                </div>
            `;
        });
        
        this.gatesContainer.innerHTML = html;
        this.setupGateClickHandlers();
    }

    setupGateClickHandlers() {
        this.gatesContainer.querySelectorAll('.gate-item').forEach(gateElement => {
            gateElement.addEventListener('click', (e) => {
                const gateId = parseInt(gateElement.dataset.gateId);
                const gate = this.simulation.getGateById(gateId);
                
                if (gate && (gate.status === 'idle' || gate.status === 'inactive')) {
                    const success = this.simulation.toggleGate(gateId);
                    if (success) {
                        const newStatus = gate.status === 'idle' ? '已开启' : '已关闭';
                        const verb = gate.status === 'idle' ? '关闭' : '开启';
                        this.addLogEntry('success', `手动${verb}闸口 #${gateId}`);
                        this.updateUI();
                    } else {
                        this.addLogEntry('warning', '至少需要保持一个闸口开启');
                    }
                }
            });
        });
    }

    generateReport() {
        const { results, analysis, report } = this.simulation.getAnalysis();
        
        let resultsHtml = '';
        
        if (analysis.overallStatus === 'pass') {
            resultsHtml += this.createResultEntry('success', '✅ 仿真运行正常，所有指标符合标准');
        } else {
            resultsHtml += this.createResultEntry('error', '⚠️ 仿真存在问题，需要人工处理');
        }
        
        analysis.issues.forEach(issue => {
            resultsHtml += this.createResultEntry('error', `❌ [${issue.severity.toUpperCase()}] ${issue.message}`);
            resultsHtml += this.createResultEntry('warning', `   建议：${issue.recommendation}`);
        });
        
        analysis.warnings.forEach(warning => {
            resultsHtml += this.createResultEntry('warning', `⚠️ ${warning.message}`);
            resultsHtml += this.createResultEntry('warning', `   建议：${warning.recommendation}`);
        });
        
        resultsHtml += this.createResultEntry('info', `📊 统计数据：`);
        resultsHtml += this.createResultEntry('info', `   - 总到达车辆: ${results.totalGenerated} 辆`);
        resultsHtml += this.createResultEntry('info', `   - 已处理: ${results.totalProcessed} 辆`);
        resultsHtml += this.createResultEntry('info', `   - 排队中: ${results.remainingQueue} 辆`);
        resultsHtml += this.createResultEntry('info', `   - 溢出: ${results.overflowCount} 辆 (${results.overflowRate.toFixed(2)}%)`);
        resultsHtml += this.createResultEntry('info', `   - 平均等待: ${results.averageWaitTime.toFixed(2)} 分钟`);
        resultsHtml += this.createResultEntry('info', `   - 闸口利用率: ${results.averageGateUtilization.toFixed(2)}%`);
        
        this.resultsOutput.innerHTML = resultsHtml;
        
        this.updateBusinessSummary(report, analysis);
    }

    updateBusinessSummary(report, analysis) {
        let html = '';
        
        report.forEach(section => {
            html += '<div class="summary-section">';
            html += `<div class="summary-title">${section.title}</div>`;
            section.items.forEach(item => {
                html += `<div class="summary-item">• ${item}</div>`;
            });
            html += '</div>';
        });
        
        html += '<div class="summary-section">';
        html += '<div class="summary-title">六、最终结论</div>';
        
        if (analysis.overallStatus === 'pass') {
            html += '<div class="summary-item" style="color: #10b981; font-weight: bold;">✅ 验收通过：系统运行正常，可投入使用</div>';
            html += '<div class="summary-item">当前配置能够满足业务需求，各项性能指标在可接受范围内。建议继续监控高峰时段的队列情况，根据实际流量动态调整闸口策略。</div>';
        } else {
            html += '<div class="summary-item" style="color: #ef4444; font-weight: bold;">⚠️ 需要人工处理：存在关键问题</div>';
            html += '<div class="summary-item">当前配置存在以下问题需要优先处理：</div>';
            analysis.issues.forEach(issue => {
                html += `<div class="summary-item">- ${issue.message}</div>`;
                html += `<div class="summary-item" style="color: #f59e0b;">  处理建议：${issue.recommendation}</div>`;
            });
            html += '<div class="summary-item">建议调整配置后重新运行仿真进行验证。</div>';
        }
        
        html += '</div>';
        
        this.businessSummary.innerHTML = html;
    }

    createResultEntry(type, message) {
        const timestamp = this.formatTime(this.simulation.currentTime);
        return `<div class="result-entry ${type}">[${timestamp}] ${message}</div>`;
    }

    addLogEntry(type, message) {
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        const entry = document.createElement('div');
        entry.className = `result-entry ${type}`;
        entry.innerHTML = `[${timestamp}] ${message}`;
        
        if (this.resultsOutput.querySelector('.empty-hint')) {
            this.resultsOutput.innerHTML = '';
        }
        
        this.resultsOutput.appendChild(entry);
        this.resultsOutput.scrollTop = this.resultsOutput.scrollHeight;
    }

    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.floor((minutes % 1) * 60);
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
