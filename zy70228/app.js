class GreenhouseLimiter {
    constructor() {
        this.state = {
            totalCapacity: 200,
            safetyThreshold: 80,
            currentCount: 0,
            flowMode: 'stopped',
            currentRoute: 'A',
            zones: {
                entrance: { name: '入口大厅', count: 0, capacity: 50 },
                tropical: { name: '热带植物区', count: 0, capacity: 80 },
                desert: { name: '沙漠植物区', count: 0, capacity: 40 },
                orchid: { name: '兰花展室', count: 0, capacity: 30 },
                exit: { name: '出口商店', count: 0, capacity: 50 }
            },
            history: [],
            historyIndex: -1,
            isDemoRunning: false
        };

        this.routes = {
            A: {
                name: '路线A (经典)',
                steps: ['entrance', 'tropical', 'desert', 'orchid', 'exit'],
                description: '经典游览路线，适合首次参观'
            },
            B: {
                name: '路线B (快捷)',
                steps: ['entrance', 'tropical', 'orchid', 'exit'],
                description: '快捷路线，节省时间'
            },
            C: {
                name: '路线C (深度)',
                steps: ['entrance', 'desert', 'tropical', 'orchid', 'tropical', 'exit'],
                description: '深度游览，重复参观热带区'
            }
        };

        this.flowIntervals = {
            normal: null,
            high: null
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        this.renderRoute();
        this.updateAllDisplay();
        this.addHistoryRecord('系统初始化', '初始化温室限流器系统');
    }

    setupEventListeners() {
        document.getElementById('btn-normal-flow').addEventListener('click', () => this.startNormalFlow());
        document.getElementById('btn-high-flow').addEventListener('click', () => this.startHighFlow());
        document.getElementById('btn-stop-flow').addEventListener('click', () => this.stopFlow());
        
        document.getElementById('total-capacity').addEventListener('change', (e) => this.updateCapacity(e.target.value));
        document.getElementById('safety-threshold').addEventListener('change', (e) => this.updateThreshold(e.target.value));
        
        document.querySelectorAll('.route-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchRoute(e.target.dataset.route));
        });
        
        document.getElementById('btn-demo-short').addEventListener('click', () => this.runShortDemo());
        document.getElementById('btn-demo-exception').addEventListener('click', () => this.runExceptionDemo());
        document.getElementById('btn-reset').addEventListener('click', () => this.resetSystem());
        
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-add-record').addEventListener('click', () => this.addManualRecord());
        document.getElementById('btn-edit-record').addEventListener('click', () => this.editLatestRecord());
    }

    updateTime() {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        document.getElementById('current-time').textContent = timeStr;
    }

    startNormalFlow() {
        this.stopFlow();
        this.state.flowMode = 'normal';
        this.updateStatus('运行中', 'normal');
        this.addHistoryRecord('人流控制', '启动正常流量模式');
        
        this.flowIntervals.normal = setInterval(() => {
            if (this.state.currentCount < this.state.totalCapacity) {
                this.addVisitors(2);
            } else {
                this.stopFlow();
                this.showAlert('温室已达到最大容量，已自动暂停进入', 'danger');
            }
        }, 2000);
    }

    startHighFlow() {
        this.stopFlow();
        this.state.flowMode = 'high';
        this.updateStatus('高峰模式', 'warning');
        this.addHistoryRecord('人流控制', '启动高峰流量模式');
        
        this.flowIntervals.high = setInterval(() => {
            if (this.state.currentCount < this.state.totalCapacity) {
                this.addVisitors(5);
            } else {
                this.stopFlow();
                this.showAlert('温室已达到最大容量，已自动暂停进入', 'danger');
            }
        }, 1500);
    }

    stopFlow() {
        if (this.flowIntervals.normal) {
            clearInterval(this.flowIntervals.normal);
            this.flowIntervals.normal = null;
        }
        if (this.flowIntervals.high) {
            clearInterval(this.flowIntervals.high);
            this.flowIntervals.high = null;
        }
        this.state.flowMode = 'stopped';
        this.updateStatus('已暂停', 'warning');
        if (this.state.currentCount > 0) {
            this.addHistoryRecord('人流控制', '暂停游客进入');
        }
    }

    addVisitors(count) {
        const remaining = this.state.totalCapacity - this.state.currentCount;
        const actualCount = Math.min(count, remaining);
        
        this.state.currentCount += actualCount;
        
        const route = this.routes[this.state.currentRoute];
        const zoneDistribution = this.distributeVisitors(actualCount, route.steps);
        
        for (const [zone, visitors] of Object.entries(zoneDistribution)) {
            this.state.zones[zone].count = Math.min(
                this.state.zones[zone].count + visitors,
                this.state.zones[zone].capacity * 1.5
            );
        }
        
        this.updateAllDisplay();
        this.checkAlerts();
    }

    distributeVisitors(total, routeSteps) {
        const distribution = {};
        const uniqueZones = [...new Set(routeSteps)];
        
        uniqueZones.forEach(zone => {
            distribution[zone] = 0;
        });
        
        for (let i = 0; i < total; i++) {
            const zoneIndex = i % uniqueZones.length;
            const zone = uniqueZones[zoneIndex];
            distribution[zone]++;
        }
        
        return distribution;
    }

    removeVisitors(count) {
        const actualCount = Math.min(count, this.state.currentCount);
        this.state.currentCount -= actualCount;
        
        const zones = Object.keys(this.state.zones);
        zones.forEach(zone => {
            const removeFromZone = Math.ceil(actualCount / zones.length);
            this.state.zones[zone].count = Math.max(0, this.state.zones[zone].count - removeFromZone);
        });
        
        this.updateAllDisplay();
        this.checkAlerts();
    }

    updateCapacity(value) {
        const newCapacity = parseInt(value);
        if (newCapacity >= 50 && newCapacity <= 1000) {
            const oldValue = this.state.totalCapacity;
            this.state.totalCapacity = newCapacity;
            this.addHistoryRecord('配置修改', `总容量从 ${oldValue} 修改为 ${newCapacity}`, { before: oldValue, after: newCapacity });
            this.updateAllDisplay();
        }
    }

    updateThreshold(value) {
        const newThreshold = parseInt(value);
        if (newThreshold >= 50 && newThreshold <= 100) {
            const oldValue = this.state.safetyThreshold;
            this.state.safetyThreshold = newThreshold;
            this.addHistoryRecord('配置修改', `安全阈值从 ${oldValue}% 修改为 ${newThreshold}%`, { before: `${oldValue}%`, after: `${newThreshold}%` });
            this.updateAllDisplay();
        }
    }

    switchRoute(routeId) {
        if (routeId === this.state.currentRoute) return;
        
        const oldRoute = this.state.currentRoute;
        this.state.currentRoute = routeId;
        
        document.querySelectorAll('.route-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.route === routeId) {
                btn.classList.add('active');
            }
        });
        
        this.addHistoryRecord('路线切换', `从 ${this.routes[oldRoute].name} 切换到 ${this.routes[routeId].name}`, {
            before: this.routes[oldRoute].name,
            after: this.routes[routeId].name
        });
        
        this.renderRoute();
    }

    renderRoute() {
        const route = this.routes[this.state.currentRoute];
        const routeDisplay = document.querySelector('.route-steps');
        routeDisplay.innerHTML = '';
        
        route.steps.forEach((zoneId, index) => {
            const zone = this.state.zones[zoneId];
            const stepDiv = document.createElement('div');
            stepDiv.className = 'route-step';
            
            const node = document.createElement('div');
            node.className = 'step-node active';
            node.innerHTML = `${index + 1}<br>${zone.name.substring(0, 2)}`;
            stepDiv.appendChild(node);
            
            if (index < route.steps.length - 1) {
                const arrow = document.createElement('div');
                arrow.className = 'step-arrow';
                arrow.textContent = '→';
                stepDiv.appendChild(arrow);
            }
            
            routeDisplay.appendChild(stepDiv);
        });
        
        document.getElementById('stat-route').textContent = this.state.currentRoute;
    }

    updateAllDisplay() {
        const capacityRate = Math.round((this.state.currentCount / this.state.totalCapacity) * 100);
        
        document.getElementById('current-count').textContent = this.state.currentCount;
        document.getElementById('stat-current').textContent = this.state.currentCount;
        document.getElementById('stat-total').textContent = this.state.totalCapacity;
        
        const rateElement = document.getElementById('capacity-rate');
        rateElement.textContent = `${capacityRate}%`;
        rateElement.classList.remove('warning', 'danger');
        if (capacityRate >= this.state.safetyThreshold) {
            rateElement.classList.add('warning');
        }
        if (capacityRate >= 90) {
            rateElement.classList.add('danger');
        }
        
        this.updateZonesDisplay();
        this.updateRiskLevel();
    }

    updateZonesDisplay() {
        Object.entries(this.state.zones).forEach(([zoneId, zone]) => {
            const zoneElement = document.querySelector(`.zone[data-zone="${zoneId}"]`);
            if (!zoneElement) return;
            
            const countElement = zoneElement.querySelector('.zone-count');
            const capacityElement = zoneElement.querySelector('.zone-capacity');
            const heatElement = zoneElement.querySelector('.zone-heat');
            
            countElement.textContent = zone.count;
            capacityElement.textContent = zone.capacity;
            
            const rate = (zone.count / zone.capacity) * 100;
            heatElement.style.setProperty('--heat-width', `${Math.min(rate, 100)}%`);
            
            zoneElement.classList.remove('low', 'medium', 'high', 'critical');
            if (rate <= 50) {
                zoneElement.classList.add('low');
            } else if (rate <= 80) {
                zoneElement.classList.add('medium');
            } else if (rate <= 100) {
                zoneElement.classList.add('high');
            } else {
                zoneElement.classList.add('critical');
            }
            
            const heatBar = heatElement.querySelector('::after') || heatElement;
            heatElement.style.overflow = 'hidden';
        });
        
        this.updateHeatBars();
    }

    updateHeatBars() {
        const style = document.createElement('style');
        style.innerHTML = '';
        
        Object.entries(this.state.zones).forEach(([zoneId, zone]) => {
            const rate = (zone.count / zone.capacity) * 100;
            const width = Math.min(rate, 100);
            style.innerHTML += `
                .zone[data-zone="${zoneId}"] .zone-heat::after {
                    width: ${width}% !important;
                }
            `;
        });
        
        const existingStyle = document.getElementById('heat-bar-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        style.id = 'heat-bar-styles';
        document.head.appendChild(style);
    }

    updateRiskLevel() {
        const capacityRate = (this.state.currentCount / this.state.totalCapacity) * 100;
        const riskElement = document.getElementById('stat-risk');
        
        riskElement.classList.remove('medium', 'high');
        
        if (capacityRate < 50) {
            riskElement.textContent = '低';
        } else if (capacityRate < this.state.safetyThreshold) {
            riskElement.textContent = '中';
            riskElement.classList.add('medium');
        } else {
            riskElement.textContent = '高';
            riskElement.classList.add('high');
        }
    }

    checkAlerts() {
        const alertBanner = document.getElementById('alert-banner');
        const capacityRate = (this.state.currentCount / this.state.totalCapacity) * 100;
        
        let maxZoneRate = 0;
        Object.values(this.state.zones).forEach(zone => {
            const rate = (zone.count / zone.capacity) * 100;
            if (rate > maxZoneRate) maxZoneRate = rate;
        });
        
        if (maxZoneRate > 100) {
            this.showAlert('⚠️ 紧急：部分区域已超容！请立即启动限流措施', 'danger');
        } else if (capacityRate >= this.state.safetyThreshold) {
            this.showAlert(`⚠️ 警告：总容量已达 ${capacityRate.toFixed(0)}%，接近安全阈值`, 'warning');
        } else if (maxZoneRate >= 80) {
            this.showAlert(`⚠️ 提示：部分区域容量较高，建议引导分流`, 'warning');
        } else {
            this.hideAlert();
        }
    }

    showAlert(message, type) {
        const alertBanner = document.getElementById('alert-banner');
        alertBanner.textContent = message;
        alertBanner.style.display = 'block';
        alertBanner.className = `alert-banner ${type}`;
    }

    hideAlert() {
        const alertBanner = document.getElementById('alert-banner');
        alertBanner.style.display = 'none';
    }

    updateStatus(text, type) {
        const statusBadge = document.getElementById('system-status');
        statusBadge.textContent = text;
        statusBadge.className = `status-badge ${type}`;
    }

    addHistoryRecord(type, description, changes = null) {
        const record = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            type,
            description,
            changes,
            stateSnapshot: JSON.parse(JSON.stringify(this.state))
        };
        
        this.state.history.push(record);
        this.state.historyIndex = this.state.history.length - 1;
        this.renderHistory();
    }

    renderHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        
        const recentRecords = this.state.history.slice(-10).reverse();
        
        recentRecords.forEach((record, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (index === 0) item.classList.add('current');
            
            let changesHtml = '';
            if (record.changes) {
                changesHtml = `<div class="history-changes">变化: ${record.changes.before} → ${record.changes.after}</div>`;
            }
            
            item.innerHTML = `
                <div class="history-time">${record.timestamp} - ${record.type}</div>
                <div>${record.description}</div>
                ${changesHtml}
            `;
            
            historyList.appendChild(item);
        });
    }

    undo() {
        if (this.state.historyIndex <= 0) {
            this.showAlert('没有可撤回的操作', 'warning');
            return;
        }
        
        const currentRecord = this.state.history[this.state.historyIndex];
        this.state.historyIndex--;
        const previousState = this.state.history[this.state.historyIndex].stateSnapshot;
        
        Object.assign(this.state, previousState);
        
        const lastItem = document.querySelector('.history-item.current');
        if (lastItem) {
            lastItem.classList.remove('current');
            lastItem.classList.add('undo');
        }
        
        this.addHistoryRecord('撤回操作', `撤回: ${currentRecord.description}`);
        this.updateAllDisplay();
        this.renderRoute();
    }

    addManualRecord() {
        const time = new Date().toLocaleTimeString();
        const count = this.state.currentCount;
        this.addHistoryRecord('手动补录', `补录记录 - 当前人数: ${count}`, {
            before: '-',
            after: `${count}人`
        });
        this.showAlert('已添加补录记录', 'warning');
    }

    editLatestRecord() {
        if (this.state.history.length === 0) {
            this.showAlert('没有可修改的记录', 'warning');
            return;
        }
        
        const latestRecord = this.state.history[this.state.history.length - 1];
        const newDescription = `${latestRecord.description} (已修改)`;
        
        this.state.history[this.state.history.length - 1].description = newDescription;
        this.state.history[this.state.history.length - 1].edited = true;
        
        const lastItem = document.querySelector('.history-item.current');
        if (lastItem) {
            lastItem.classList.add('edit');
        }
        
        this.addHistoryRecord('修改记录', `修改了记录: ${latestRecord.description}`);
        this.renderHistory();
        this.showAlert('已修改最新记录', 'warning');
    }

    async runShortDemo() {
        if (this.state.isDemoRunning) return;
        this.state.isDemoRunning = true;
        
        this.resetSystem();
        this.showAlert('🎬 开始最短演示路径：正常流程演示', 'warning');
        
        await this.delay(1000);
        
        this.startNormalFlow();
        await this.delay(4000);
        
        this.switchRoute('B');
        await this.delay(3000);
        
        this.addManualRecord();
        await this.delay(2000);
        
        this.stopFlow();
        this.showAlert('✅ 最短演示完成：系统正常运行，无异常', 'warning');
        
        this.state.isDemoRunning = false;
    }

    async runExceptionDemo() {
        if (this.state.isDemoRunning) return;
        this.state.isDemoRunning = true;
        
        this.resetSystem();
        this.showAlert('🎬 开始异常演示路径：超容预警触发', 'danger');
        
        await this.delay(1000);
        
        this.state.safetyThreshold = 60;
        this.addHistoryRecord('配置修改', '异常测试：降低安全阈值至60%', { before: '80%', after: '60%' });
        
        await this.delay(1000);
        
        this.startHighFlow();
        await this.delay(6000);
        
        this.showAlert('⚠️ 异常场景1：总容量接近阈值，自动警告触发', 'danger');
        await this.delay(3000);
        
        this.state.zones.orchid.count = 45;
        this.addHistoryRecord('异常模拟', '兰花展室超容模拟', { before: '30', after: '45' });
        this.updateAllDisplay();
        this.checkAlerts();
        
        await this.delay(3000);
        
        this.undo();
        this.showAlert('🔄 已撤回超容模拟，系统恢复', 'warning');
        
        await this.delay(2000);
        
        this.stopFlow();
        this.showAlert('✅ 异常演示完成：展示了超容预警和撤回机制', 'warning');
        
        this.state.isDemoRunning = false;
    }

    resetSystem() {
        this.stopFlow();
        
        this.state.currentCount = 0;
        Object.keys(this.state.zones).forEach(zone => {
            this.state.zones[zone].count = 0;
        });
        this.state.safetyThreshold = 80;
        this.state.currentRoute = 'A';
        
        document.getElementById('total-capacity').value = 200;
        document.getElementById('safety-threshold').value = 80;
        document.querySelectorAll('.route-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.route === 'A') btn.classList.add('active');
        });
        
        this.updateStatus('就绪', '');
        this.hideAlert();
        this.updateAllDisplay();
        this.renderRoute();
        
        this.addHistoryRecord('系统重置', '重置温室限流器系统');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GreenhouseLimiter();
});
