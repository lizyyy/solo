class UI {
    constructor() {
        this.compareList = [];
        this.initElements();
        this.initListeners();
    }

    initElements() {
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.timeSlider = document.getElementById('timeSlider');
        this.timeValue = document.getElementById('timeValue');
        this.view3dBtn = document.getElementById('view3dBtn');
        this.view2dBtn = document.getElementById('view2dBtn');
        this.viewFrontBtn = document.getElementById('viewFrontBtn');
        this.viewSideBtn = document.getElementById('viewSideBtn');
        this.heatmapToggle = document.getElementById('heatmapToggle');
        this.compareMode = document.getElementById('compareMode');
        this.exampleSelect = document.getElementById('exampleSelect');
        this.importBtn = document.getElementById('importBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.addGateBtn = document.getElementById('addGateBtn');
        this.addBatchBtn = document.getElementById('addBatchBtn');
        this.clearCompareBtn = document.getElementById('clearCompareBtn');
        this.gateList = document.getElementById('gateList');
        this.batchList = document.getElementById('batchList');
        this.warningList = document.getElementById('warningList');
        this.eventLog = document.getElementById('eventLog');
        this.comparePanel = document.getElementById('comparePanel');
        this.fileInput = document.getElementById('fileInput');
        this.tooltip = document.getElementById('tooltip');
    }

    initListeners() {
        this.speedSlider.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.speedValue.textContent = speed + 'x';
            simulation.setSpeed(speed);
        });

        this.playBtn.addEventListener('click', () => {
            simulation.start();
            this.playBtn.classList.add('btn-primary');
            this.pauseBtn.classList.remove('btn-primary');
        });

        this.pauseBtn.addEventListener('click', () => {
            simulation.pause();
            this.pauseBtn.classList.add('btn-primary');
            this.playBtn.classList.remove('btn-primary');
        });

        this.timeSlider.addEventListener('input', (e) => {
            const targetTime = parseInt(e.target.value);
            this.timeValue.textContent = targetTime + 's';
        });

        this.timeSlider.addEventListener('change', (e) => {
            const targetTime = parseInt(e.target.value);
            simulation.jumpToTime(targetTime);
            visualization.clear();
            visualization.createGates();
            visualization.createClosedAreas();
            this.updateGateList();
            this.updateBatchList();
        });

        this.view3dBtn.addEventListener('click', () => {
            visualization.setView3D();
            this.view3dBtn.classList.add('btn-primary');
            this.view2dBtn.classList.remove('btn-primary');
        });

        this.view2dBtn.addEventListener('click', () => {
            visualization.setView2D();
            this.view2dBtn.classList.add('btn-primary');
            this.view3dBtn.classList.remove('btn-primary');
        });

        this.viewFrontBtn.addEventListener('click', () => {
            visualization.setViewFront();
        });

        this.viewSideBtn.addEventListener('click', () => {
            visualization.setViewSide();
        });

        this.heatmapToggle.addEventListener('click', () => {
            const active = visualization.toggleHeatmap();
            this.heatmapToggle.classList.toggle('active', active);
        });

        this.compareMode.addEventListener('click', () => {
            this.addCurrentToCompare();
        });

        this.exampleSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadExample(e.target.value);
            }
        });

        this.importBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const config = JSON.parse(event.target.result);
                        this.loadConfig(config);
                    } catch (err) {
                        alert('配置文件格式错误');
                    }
                };
                reader.readAsText(file);
            }
        });

        this.exportBtn.addEventListener('click', () => {
            this.exportReport();
        });

        this.resetBtn.addEventListener('click', () => {
            this.resetSimulation();
        });

        this.addGateBtn.addEventListener('click', () => {
            this.addGate();
        });

        this.addBatchBtn.addEventListener('click', () => {
            this.addBatch();
        });

        this.clearCompareBtn.addEventListener('click', () => {
            this.clearCompare();
        });

        window.addEventListener('resize', () => {
            visualization.resize();
        });
    }

    loadExample(name) {
        if (EXAMPLES[name]) {
            this.loadConfig(EXAMPLES[name]);
        }
    }

    loadConfig(config) {
        visualization.clear();
        simulation.loadConfig(config);
        visualization.createGates();
        visualization.createClosedAreas();
        this.updateGateList();
        this.updateBatchList();
        this.updateStats();
    }

    resetSimulation() {
        const example = this.exampleSelect.value;
        if (example) {
            this.loadExample(example);
        } else {
            visualization.clear();
            simulation.reset();
        }
        this.updateStats();
        this.clearEvents();
    }

    addGate() {
        const id = simulation.gates.length + 1;
        const x = (Math.random() - 0.5) * 40;
        const gate = new Gate(id, x, true, 1);
        simulation.gates.push(gate);
        visualization.createGates();
        this.updateGateList();
    }

    addBatch() {
        const id = simulation.batches.length + 1;
        const batch = new Batch(id, simulation.currentTime + 10, 50, 10);
        simulation.batches.push(batch);
        this.updateBatchList();
    }

    updateGateList() {
        this.gateList.innerHTML = '';
        simulation.gates.forEach(gate => {
            const div = document.createElement('div');
            div.className = `gate-item ${gate.open ? '' : 'closed'}`;
            div.innerHTML = `
                <span>闸机 ${gate.id}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="gate-status ${gate.open ? 'open' : 'closed'}"></span>
                    <span style="font-size: 10px;">${gate.getQueueLength()}人</span>
                </div>
            `;
            div.addEventListener('click', () => {
                gate.toggle();
                visualization.createGates();
                this.updateGateList();
                simulation.addEvent('闸机操作', `闸机 ${gate.id} ${gate.open ? '开启' : '关闭'}`);
            });
            this.gateList.appendChild(div);
        });
    }

    updateBatchList() {
        this.batchList.innerHTML = '';
        simulation.batches.forEach(batch => {
            const div = document.createElement('div');
            div.className = 'batch-item';
            const status = batch.completed ? '完成' : batch.spawned > 0 ? '进行中' : '等待';
            div.innerHTML = `
                <span>批次 ${batch.id}</span>
                <span style="font-size: 10px;">${batch.spawned}/${batch.count} ${status}</span>
            `;
            this.batchList.appendChild(div);
        });
    }

    updateStats() {
        const stats = simulation.updateStats();
        document.getElementById('totalPeople').textContent = stats.totalPeople;
        document.getElementById('enteredPeople').textContent = stats.enteredPeople;
        document.getElementById('queuingPeople').textContent = stats.queuingPeople;
        document.getElementById('scanningPeople').textContent = stats.scanningPeople;
        document.getElementById('avgWaitTime').textContent = stats.avgWaitTime.toFixed(1) + 's';
        document.getElementById('maxQueueLen').textContent = stats.maxQueueLen;
        document.getElementById('timeValue').textContent = stats.currentTime + 's';
        this.timeSlider.value = Math.min(stats.currentTime, 100);
    }

    updateWarnings() {
        if (simulation.warnings.length === 0) {
            this.warningList.innerHTML = '<div class="warning-item info">暂无预警信息</div>';
            return;
        }

        this.warningList.innerHTML = '';
        const recentWarnings = simulation.warnings.slice(-5).reverse();
        recentWarnings.forEach(w => {
            const div = document.createElement('div');
            div.className = `warning-item ${w.type}`;
            div.textContent = `[${Math.floor(w.time)}s] ${w.message}`;
            this.warningList.appendChild(div);
        });
    }

    updateEvents() {
        const newEvents = simulation.events.slice(-10);
        this.eventLog.innerHTML = '';
        newEvents.forEach(e => {
            const div = document.createElement('div');
            div.className = 'event-item';
            div.innerHTML = `<span class="event-time">[${Math.floor(e.time)}s]</span> ${e.message}`;
            this.eventLog.appendChild(div);
        });
        this.eventLog.scrollTop = this.eventLog.scrollHeight;
    }

    clearEvents() {
        this.eventLog.innerHTML = '';
    }

    addCurrentToCompare() {
        const report = simulation.getReport();
        this.compareList.push({
            name: `方案 ${this.compareList.length + 1}`,
            time: new Date().toLocaleTimeString(),
            report
        });
        this.updateComparePanel();
        this.compareMode.classList.add('active');
        setTimeout(() => this.compareMode.classList.remove('active'), 1000);
    }

    updateComparePanel() {
        if (this.compareList.length === 0) {
            this.comparePanel.innerHTML = '<div class="compare-empty">点击"方案对比"按钮添加方案</div>';
            return;
        }

        this.comparePanel.innerHTML = '';
        this.compareList.forEach(item => {
            const div = document.createElement('div');
            div.className = 'compare-item';
            div.innerHTML = `
                <h4>${item.name} (${item.time})</h4>
                <div class="compare-stats">
                    <span>总人数: ${item.report.totalPeople}</span>
                    <span>已入场: ${item.report.enteredPeople}</span>
                    <span>平均等待: ${item.report.avgWaitTime.toFixed(1)}s</span>
                    <span>最长队列: ${item.report.maxQueueLen}</span>
                </div>
            `;
            this.comparePanel.appendChild(div);
        });
    }

    clearCompare() {
        this.compareList = [];
        this.updateComparePanel();
    }

    exportReport() {
        const report = simulation.getReport();
        const fullReport = {
            ...report,
            exportTime: new Date().toISOString(),
            compareList: this.compareList
        };

        const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `排队模拟报告_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    update() {
        this.updateStats();
        this.updateWarnings();
        this.updateEvents();
        this.updateGateList();
        this.updateBatchList();
    }
}

const ui = new UI();
