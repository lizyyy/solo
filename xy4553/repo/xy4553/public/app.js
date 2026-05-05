class WWTPDashboard {
    constructor() {
        this.currentDate = null;
        this.currentData = null;
        this.charts = {};
        this.selectedRisk = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadDates();
        this.initDateInput();
    }

    initDateInput() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('newDate').value = today;
    }

    bindEvents() {
        document.getElementById('importSampleBtn').addEventListener('click', () => this.importSampleData());
        document.getElementById('importBtn').addEventListener('click', () => this.openImportModal());
        document.getElementById('confirmImportBtn').addEventListener('click', () => this.confirmImport());
        document.getElementById('saveRemarkBtn').addEventListener('click', () => this.saveRemark());
        document.getElementById('exportMdBtn').addEventListener('click', () => this.exportMarkdown());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJson());
        
        document.getElementById('dateSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadData(e.target.value);
            }
        });
        
        document.getElementById('tankSelect').addEventListener('change', () => this.updateCharts());
        document.getElementById('riskFilter').addEventListener('change', () => this.renderRiskList());
        
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target));
        });
        
        ['scadaFile', 'blowerFile', 'pumpFile', 'labFile', 'jsonFile'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                const fileName = e.target.files[0]?.name || '未选择文件';
                document.getElementById(id.replace('File', 'FileName')).textContent = fileName;
            });
        });
    }

    switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.getElementById(tabId + 'Tab').classList.add('active');
    }

    async loadDates() {
        try {
            const response = await fetch('/api/dates');
            const dates = await response.json();
            
            const select = document.getElementById('dateSelect');
            select.innerHTML = '<option value="">请选择历史数据</option>';
            
            dates.forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                option.textContent = date;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading dates:', error);
            this.showToast('加载日期列表失败', 'error');
        }
    }

    async loadData(date) {
        try {
            this.showLoading();
            
            const response = await fetch(`/api/data/${date}`);
            const data = await response.json();
            
            if (data.date) {
                this.currentDate = date;
                this.currentData = data;
                this.renderData();
                this.hideLoading();
            } else {
                this.hideLoading();
                this.showToast('数据不存在', 'error');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.hideLoading();
            this.showToast('加载数据失败', 'error');
        }
    }

    async importSampleData() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/sample-data');
            const sampleData = await response.json();
            
            await this.saveDataToServer(sampleData.date, sampleData);
            
            this.hideLoading();
            this.showToast('示例数据导入成功', 'success');
            
            await this.loadDates();
            document.getElementById('dateSelect').value = sampleData.date;
            await this.loadData(sampleData.date);
            
        } catch (error) {
            console.error('Error importing sample data:', error);
            this.hideLoading();
            this.showToast('导入示例数据失败', 'error');
        }
    }

    openImportModal() {
        const date = document.getElementById('newDate').value;
        if (!date) {
            this.showToast('请选择数据日期', 'error');
            return;
        }
        this.currentDate = date;
        showModal('importModal');
    }

    async confirmImport() {
        try {
            const activeTab = document.querySelector('.tab.active').dataset.tab;
            
            if (activeTab === 'json') {
                await this.importFromJson();
            } else {
                await this.importFromCsv();
            }
            
        } catch (error) {
            console.error('Error importing:', error);
            this.showToast('导入失败: ' + error.message, 'error');
        }
    }

    async importFromJson() {
        const jsonFile = document.getElementById('jsonFile').files[0];
        
        if (!jsonFile) {
            this.showToast('请选择JSON文件', 'error');
            return;
        }
        
        this.showLoading();
        
        const text = await this.readFile(jsonFile);
        const data = JSON.parse(text);
        
        await this.saveDataToServer(this.currentDate, data);
        
        closeModal('importModal');
        this.hideLoading();
        this.showToast('数据导入成功', 'success');
        
        await this.loadDates();
        document.getElementById('dateSelect').value = this.currentDate;
        await this.loadData(this.currentDate);
    }

    async importFromCsv() {
        const scadaFile = document.getElementById('scadaFile').files[0];
        const blowerFile = document.getElementById('blowerFile').files[0];
        const pumpFile = document.getElementById('pumpFile').files[0];
        const labFile = document.getElementById('labFile').files[0];
        
        if (!scadaFile && !blowerFile && !pumpFile && !labFile) {
            this.showToast('请至少选择一个文件', 'error');
            return;
        }
        
        this.showLoading();
        
        const importData = {
            date: this.currentDate,
            scadaData: scadaFile ? await this.parseScadaCsv(scadaFile) : [],
            blowerData: blowerFile ? await this.parseBlowerCsv(blowerFile) : [],
            pumpData: pumpFile ? await this.parsePumpCsv(pumpFile) : [],
            labData: labFile ? await this.parseLabCsv(labFile) : []
        };
        
        await this.saveDataToServer(this.currentDate, importData);
        
        closeModal('importModal');
        this.hideLoading();
        this.showToast('数据导入成功', 'success');
        
        await this.loadDates();
        document.getElementById('dateSelect').value = this.currentDate;
        await this.loadData(this.currentDate);
    }

    async saveDataToServer(date, data) {
        const response = await fetch('/api/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                date: date,
                scadaData: data.scadaData,
                blowerData: data.blowerData,
                pumpData: data.pumpData,
                labData: data.labData
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error('服务器保存失败');
        }
        
        return result;
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    parseCsv(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            
            return obj;
        });
    }

    async parseScadaCsv(file) {
        const text = await this.readFile(file);
        const rows = this.parseCsv(text);
        
        return rows.map(row => ({
            time: this.parseDateTime(row.time || row.时间 || row.Time),
            tank: row.tank || row.池组 || row.Tank || '1#池',
            dissolvedOxygen: parseFloat(row.dissolvedOxygen || row.溶解氧 || row.DO || 0),
            ammoniaNitrogen: parseFloat(row.ammoniaNitrogen || row.氨氮 || row.NH3 || 0)
        }));
    }

    async parseBlowerCsv(file) {
        const text = await this.readFile(file);
        const rows = this.parseCsv(text);
        
        return rows.map(row => ({
            time: this.parseDateTime(row.time || row.时间 || row.Time),
            blower: row.blower || row.鼓风机 || row.Blower || '1#鼓风机',
            power: parseFloat(row.power || row.功率 || row.Power || 0),
            frequency: parseFloat(row.frequency || row.频率 || row.Frequency || 0),
            status: row.status || row.状态 || row.Status || '运行'
        }));
    }

    async parsePumpCsv(file) {
        const text = await this.readFile(file);
        const rows = this.parseCsv(text);
        
        return rows.map(row => ({
            time: this.parseDateTime(row.time || row.时间 || row.Time),
            pump: row.pump || row.回流泵 || row.Pump || '1#回流泵',
            flowRate: parseFloat(row.flowRate || row.流量 || row.FlowRate || 0),
            status: row.status || row.状态 || row.Status || '运行'
        }));
    }

    async parseLabCsv(file) {
        const text = await this.readFile(file);
        const rows = this.parseCsv(text);
        
        return rows.map(row => ({
            time: this.parseDateTime(row.time || row.时间 || row.Time),
            item: row.item || row.项目 || row.Item || '',
            instrumentValue: parseFloat(row.instrumentValue || row.仪表值 || row.InstrumentValue || 0),
            labValue: parseFloat(row.labValue || row.化验值 || row.LabValue || 0),
            unit: row.unit || row.单位 || row.Unit || 'mg/L',
            remark: row.remark || row.备注 || row.Remark || ''
        }));
    }

    parseDateTime(value) {
        if (!value) {
            return new Date().toISOString();
        }
        
        try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        } catch (e) {
        }
        
        return new Date().toISOString();
    }

    renderData() {
        if (!this.currentData) {
            return;
        }
        
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('content').style.display = 'grid';
        document.getElementById('riskSummary').style.display = 'grid';
        
        this.updateTankSelect();
        this.updateRiskSummary();
        this.initCharts();
        this.renderRiskList();
    }

    updateTankSelect() {
        const tanks = [...new Set(this.currentData.scadaData?.map(d => d.tank) || [])];
        const select = document.getElementById('tankSelect');
        
        select.innerHTML = '<option value="all">全部池组</option>';
        tanks.forEach(tank => {
            const option = document.createElement('option');
            option.value = tank;
            option.textContent = tank;
            select.appendChild(option);
        });
    }

    updateRiskSummary() {
        const analysis = this.currentData.analysis;
        
        if (analysis && analysis.summary) {
            document.getElementById('overAerationCount').textContent = analysis.summary.risks.over_aeration || 0;
            document.getElementById('hypoxiaCount').textContent = analysis.summary.risks.hypoxia || 0;
            document.getElementById('pumpAnomalyCount').textContent = analysis.summary.risks.pump_anomaly || 0;
            document.getElementById('labMismatchCount').textContent = analysis.summary.risks.lab_mismatch || 0;
        }
    }

    initCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '时间'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '数值'
                    }
                }
            }
        };

        const selectedTank = document.getElementById('tankSelect').value;
        const tankColors = {
            '1#池': '#667eea',
            '2#池': '#f093fb',
            '3#池': '#4facfe',
            '4#池': '#43e97b'
        };

        Object.values(this.charts).forEach(chart => chart.destroy());

        if (this.currentData.scadaData && this.currentData.scadaData.length > 0) {
            const tanks = selectedTank === 'all' 
                ? [...new Set(this.currentData.scadaData.map(d => d.tank))]
                : [selectedTank];

            const doDatasets = tanks.map(tank => {
                const tankData = this.currentData.scadaData.filter(d => d.tank === tank);
                const labels = tankData.map(d => this.formatTime(d.time));
                const values = tankData.map(d => d.dissolvedOxygen);
                
                return {
                    label: `${tank} - 溶解氧`,
                    data: values,
                    borderColor: tankColors[tank] || '#667eea',
                    backgroundColor: (tankColors[tank] || '#667eea') + '20',
                    fill: true,
                    tension: 0.4
                };
            });

            const nh3Datasets = tanks.map(tank => {
                const tankData = this.currentData.scadaData.filter(d => d.tank === tank);
                const labels = tankData.map(d => this.formatTime(d.time));
                const values = tankData.map(d => d.ammoniaNitrogen);
                
                return {
                    label: `${tank} - 氨氮`,
                    data: values,
                    borderColor: tankColors[tank] || '#667eea',
                    backgroundColor: (tankColors[tank] || '#667eea') + '20',
                    fill: true,
                    tension: 0.4
                };
            });

            const doCtx = document.getElementById('doChart').getContext('2d');
            this.charts.doChart = new Chart(doCtx, {
                type: 'line',
                data: {
                    labels: doDatasets[0]?.data.map((_, i) => this.formatTime(this.currentData.scadaData[i]?.time) || ''),
                    datasets: doDatasets
                },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: {
                            ...chartOptions.scales.y,
                            title: { ...chartOptions.scales.y.title, text: '溶解氧 (mg/L)' }
                        }
                    }
                }
            });

            const nh3Ctx = document.getElementById('nh3Chart').getContext('2d');
            this.charts.nh3Chart = new Chart(nh3Ctx, {
                type: 'line',
                data: {
                    labels: nh3Datasets[0]?.data.map((_, i) => this.formatTime(this.currentData.scadaData[i]?.time) || ''),
                    datasets: nh3Datasets
                },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: {
                            ...chartOptions.scales.y,
                            title: { ...chartOptions.scales.y.title, text: '氨氮 (mg/L)' }
                        }
                    }
                }
            });
        }

        if (this.currentData.blowerData && this.currentData.blowerData.length > 0) {
            const blowers = [...new Set(this.currentData.blowerData.map(d => d.blower))];
            const blowerDatasets = blowers.map(blower => {
                const blowerData = this.currentData.blowerData.filter(d => d.blower === blower);
                return {
                    label: `${blower} - 功率`,
                    data: blowerData.map(d => d.power),
                    borderColor: '#ff416c',
                    backgroundColor: '#ff416c20',
                    fill: true,
                    tension: 0.4
                };
            });

            const blowerCtx = document.getElementById('blowerChart').getContext('2d');
            this.charts.blowerChart = new Chart(blowerCtx, {
                type: 'line',
                data: {
                    labels: this.currentData.blowerData.map(d => this.formatTime(d.time)),
                    datasets: blowerDatasets
                },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: {
                            ...chartOptions.scales.y,
                            title: { ...chartOptions.scales.y.title, text: '功率 (kW)' }
                        }
                    }
                }
            });
        }

        if (this.currentData.pumpData && this.currentData.pumpData.length > 0) {
            const pumps = [...new Set(this.currentData.pumpData.map(d => d.pump))];
            const pumpDatasets = pumps.map(pump => {
                const pumpData = this.currentData.pumpData.filter(d => d.pump === pump);
                return {
                    label: `${pump} - 流量`,
                    data: pumpData.map(d => d.flowRate),
                    borderColor: '#f093fb',
                    backgroundColor: '#f093fb20',
                    fill: true,
                    tension: 0.4
                };
            });

            const pumpCtx = document.getElementById('pumpChart').getContext('2d');
            this.charts.pumpChart = new Chart(pumpCtx, {
                type: 'line',
                data: {
                    labels: this.currentData.pumpData.map(d => this.formatTime(d.time)),
                    datasets: pumpDatasets
                },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: {
                            ...chartOptions.scales.y,
                            title: { ...chartOptions.scales.y.title, text: '流量 (m³/h)' }
                        }
                    }
                }
            });
        }
    }

    updateCharts() {
        this.initCharts();
    }

    formatTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    formatDateTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN');
    }

    renderRiskList() {
        const filter = document.getElementById('riskFilter').value;
        const risks = this.currentData.analysis?.risks || [];
        const remarks = this.currentData.remarks || [];
        
        const filteredRisks = filter === 'all' 
            ? risks 
            : risks.filter(r => r.type === filter);
        
        const riskTypeNames = {
            over_aeration: '曝气过量',
            hypoxia: '缺氧风险',
            pump_anomaly: '回流异常',
            lab_mismatch: '化验偏差'
        };
        
        const listContainer = document.getElementById('riskList');
        listContainer.innerHTML = '';
        
        if (filteredRisks.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="padding: 40px;">
                    <p style="color: #999;">暂无风险事件</p>
                </div>
            `;
            return;
        }
        
        filteredRisks.forEach((risk, index) => {
            const remark = remarks.find(r => r.time === risk.time && r.type === risk.type);
            
            const card = document.createElement('div');
            card.className = `risk-card ${risk.type}`;
            card.innerHTML = `
                <div class="risk-card-header">
                    <span class="risk-type ${risk.type}">${riskTypeNames[risk.type] || risk.type}</span>
                    <span class="risk-time">${this.formatDateTime(risk.time)}</span>
                </div>
                <div class="risk-reason">${risk.reason}</div>
                ${risk.tank ? `<div style="font-size: 12px; color: #666;">池组: ${risk.tank}</div>` : ''}
                ${risk.pump ? `<div style="font-size: 12px; color: #666;">设备: ${risk.pump}</div>` : ''}
                ${risk.blower ? `<div style="font-size: 12px; color: #666;">设备: ${risk.blower}</div>` : ''}
                ${risk.item ? `<div style="font-size: 12px; color: #666;">化验项目: ${risk.item}</div>` : ''}
                
                ${remark ? `
                    <div class="remark-section">
                        <div class="remark-text">✓ 已改判: ${remark.newReason}</div>
                        <div class="remark-operator">操作人员: ${remark.operator}</div>
                    </div>
                ` : `
                    <div style="margin-top: 10px;">
                        <button class="btn-warning" style="padding: 5px 15px; font-size: 12px;" 
                                onclick="dashboard.openRemarkModal('${risk.type}', '${risk.time}', \`${risk.reason.replace(/`/g, "'")}\`)">
                            人工改判
                        </button>
                    </div>
                `}
            `;
            
            listContainer.appendChild(card);
        });
    }

    openRemarkModal(type, time, reason) {
        const typeNames = {
            over_aeration: '曝气过量',
            hypoxia: '缺氧风险',
            pump_anomaly: '回流异常',
            lab_mismatch: '化验偏差'
        };
        
        this.selectedRisk = { type, time, originalReason: reason };
        
        document.getElementById('remarkType').value = typeNames[type] || type;
        document.getElementById('remarkTime').value = this.formatDateTime(time);
        document.getElementById('remarkOriginalReason').value = reason;
        document.getElementById('remarkNewReason').value = '';
        document.getElementById('remarkOperator').value = '';
        
        showModal('remarkModal');
    }

    async saveRemark() {
        const newReason = document.getElementById('remarkNewReason').value.trim();
        const operator = document.getElementById('remarkOperator').value.trim();
        
        if (!newReason || !operator) {
            this.showToast('请填写改判原因和操作人员', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/remarks/${this.currentDate}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: this.selectedRisk.type,
                    time: this.selectedRisk.time,
                    originalReason: this.selectedRisk.originalReason,
                    newReason: newReason,
                    operator: operator
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                closeModal('remarkModal');
                this.showToast('改判保存成功', 'success');
                await this.loadData(this.currentDate);
            } else {
                this.showToast('保存失败', 'error');
            }
        } catch (error) {
            console.error('Error saving remark:', error);
            this.showToast('保存失败: ' + error.message, 'error');
        }
    }

    exportMarkdown() {
        if (!this.currentDate) {
            this.showToast('请先加载数据', 'error');
            return;
        }
        
        window.open(`/api/export/markdown/${this.currentDate}`, '_blank');
    }

    exportJson() {
        if (!this.currentDate) {
            this.showToast('请先加载数据', 'error');
            return;
        }
        
        window.open(`/api/export/json/${this.currentDate}`, '_blank');
    }

    showLoading() {
        document.body.style.cursor = 'wait';
    }

    hideLoading() {
        document.body.style.cursor = 'default';
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

function showModal(id) {
    document.getElementById(id).classList.add('show');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new WWTPDashboard();
});
