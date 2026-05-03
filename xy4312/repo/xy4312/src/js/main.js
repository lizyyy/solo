/**
 * 主入口文件
 * 整合所有模块，创建应用程序的核心逻辑
 */

import store from './state/store.js';
import importManager from './io/import.js';
import exportManager from './io/export.js';
import Scene3D from './visualization/scene3D.js';
import Timeline from './visualization/timeline.js';

class App {
    constructor() {
        this.scene3D = null;
        this.timeline = null;
        this.selectedRisk = null;
    }

    init() {
        this.initScene();
        this.initTimeline();
        this.initEventListeners();
        this.initStateListeners();
        this.loadSampleData();
    }

    initScene() {
        const sceneContainer = document.getElementById('scene-container');
        this.scene3D = new Scene3D(sceneContainer, {
            onRiskClick: (risk) => this.handleRiskClick(risk),
            onVehicleClick: (vehicleId) => this.handleVehicleClick(vehicleId)
        });
        this.scene3D.init();
    }

    initTimeline() {
        const timelineContainer = document.getElementById('timeline-container');
        this.timeline = new Timeline(timelineContainer, {
            onTimeChange: (time) => this.handleTimeChange(time),
            onPlayStateChange: (isPlaying) => this.handlePlayStateChange(isPlaying)
        });
        this.timeline.init();
    }

    initEventListeners() {
        document.getElementById('btn-import-trajectory').addEventListener('click', () => {
            document.getElementById('file-input-trajectory').click();
        });

        document.getElementById('btn-import-map').addEventListener('click', () => {
            document.getElementById('file-input-map').click();
        });

        document.getElementById('btn-export-report').addEventListener('click', () => {
            this.exportReport();
        });

        document.getElementById('btn-export-risks').addEventListener('click', () => {
            this.exportRisks();
        });

        document.getElementById('file-input-trajectory').addEventListener('change', (event) => {
            this.importTrajectory(event);
        });

        document.getElementById('file-input-map').addEventListener('change', (event) => {
            this.importMap(event);
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                this.switchTab(event.target.dataset.tab);
            });
        });

        document.getElementById('btn-select-all-vehicles').addEventListener('click', () => {
            store.selectAllVehicles();
        });

        document.getElementById('btn-deselect-all-vehicles').addEventListener('click', () => {
            store.deselectAllVehicles();
        });

        document.getElementById('filter-high').addEventListener('change', () => {
            this.updateSeverityFilter();
        });

        document.getElementById('filter-medium').addEventListener('change', () => {
            this.updateSeverityFilter();
        });

        document.getElementById('filter-low').addEventListener('change', () => {
            this.updateSeverityFilter();
        });

        document.getElementById('btn-close-risk-detail').addEventListener('click', () => {
            this.closeRiskDetail();
        });

        document.getElementById('btn-jump-to-risk').addEventListener('click', () => {
            this.jumpToRisk();
        });
    }

    initStateListeners() {
        store.subscribe((state, changeType) => {
            this.updateUI(state, changeType);
        }, ['all']);
    }

    loadSampleData() {
        const sampleMap = this.createSampleMap();
        store.setMapData(sampleMap);

        const sampleTrajectory = this.createSampleTrajectory();
        const result = importManager.validateTrajectoryData(sampleTrajectory);
        
        if (result.validData.length > 0) {
            store.setTrajectoryData(result.validData, result.invalidRows, result.statistics);
        }
    }

    createSampleMap() {
        return {
            id: 'sample_warehouse',
            name: '示例仓库',
            version: '1.0',
            description: '示例仓库地图数据',
            bounds: {
                minX: 0,
                maxX: 100,
                minY: 0,
                maxY: 80,
                minZ: 0,
                maxZ: 5
            },
            zones: [
                {
                    id: 'zone_receiving',
                    name: '收货区',
                    type: 'receiving',
                    bounds: {
                        minX: 0,
                        maxX: 20,
                        minY: 0,
                        maxY: 80
                    }
                },
                {
                    id: 'zone_storage_a',
                    name: '存储区A',
                    type: 'storage',
                    bounds: {
                        minX: 20,
                        maxX: 60,
                        minY: 0,
                        maxY: 40
                    }
                },
                {
                    id: 'zone_storage_b',
                    name: '存储区B',
                    type: 'storage',
                    bounds: {
                        minX: 20,
                        maxX: 60,
                        minY: 40,
                        maxY: 80
                    }
                },
                {
                    id: 'zone_shipping',
                    name: '发货区',
                    type: 'shipping',
                    bounds: {
                        minX: 80,
                        maxX: 100,
                        minY: 0,
                        maxY: 80
                    }
                }
            ],
            aisles: [
                {
                    id: 'aisle_main_1',
                    name: '主通道1',
                    type: 'main',
                    width: 5,
                    bounds: {
                        minX: 60,
                        maxX: 80,
                        minY: 0,
                        maxY: 80
                    }
                },
                {
                    id: 'aisle_cross_1',
                    name: '横通道1',
                    type: 'cross',
                    width: 4,
                    bounds: {
                        minX: 20,
                        maxX: 60,
                        minY: 20,
                        maxY: 24
                    }
                },
                {
                    id: 'aisle_cross_2',
                    name: '横通道2',
                    type: 'cross',
                    width: 4,
                    bounds: {
                        minX: 20,
                        maxX: 60,
                        minY: 56,
                        maxY: 60
                    }
                }
            ],
            racks: [
                {
                    id: 'rack_1_1',
                    name: '货架1-1',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 25,
                        maxX: 28,
                        minY: 5,
                        maxY: 15
                    }
                },
                {
                    id: 'rack_1_2',
                    name: '货架1-2',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 32,
                        maxX: 35,
                        minY: 5,
                        maxY: 15
                    }
                },
                {
                    id: 'rack_2_1',
                    name: '货架2-1',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 25,
                        maxX: 28,
                        minY: 25,
                        maxY: 35
                    }
                },
                {
                    id: 'rack_2_2',
                    name: '货架2-2',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 32,
                        maxX: 35,
                        minY: 25,
                        maxY: 35
                    }
                },
                {
                    id: 'rack_3_1',
                    name: '货架3-1',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 25,
                        maxX: 28,
                        minY: 45,
                        maxY: 55
                    }
                },
                {
                    id: 'rack_3_2',
                    name: '货架3-2',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 32,
                        maxX: 35,
                        minY: 45,
                        maxY: 55
                    }
                },
                {
                    id: 'rack_4_1',
                    name: '货架4-1',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 25,
                        maxX: 28,
                        minY: 65,
                        maxY: 75
                    }
                },
                {
                    id: 'rack_4_2',
                    name: '货架4-2',
                    type: 'standard',
                    levels: 5,
                    height: 5,
                    bounds: {
                        minX: 32,
                        maxX: 35,
                        minY: 65,
                        maxY: 75
                    }
                }
            ],
            restrictedAreas: [
                {
                    id: 'restricted_office',
                    name: '办公区',
                    type: 'no_vehicle',
                    restriction: 'no_vehicle',
                    bounds: {
                        minX: 85,
                        maxX: 95,
                        minY: 10,
                        maxY: 30
                    }
                },
                {
                    id: 'restricted_charging',
                    name: '充电区',
                    type: 'speed_limit',
                    restriction: 'speed_limit',
                    bounds: {
                        minX: 85,
                        maxX: 95,
                        minY: 50,
                        maxY: 70
                    }
                }
            ]
        };
    }

    createSampleTrajectory() {
        const baseTime = Date.now() - 3600000;
        const vehicles = [
            { id: 'FORKLIFT-01', type: 'forklift', color: '#e74c3c' },
            { id: 'FORKLIFT-02', type: 'forklift', color: '#3498db' },
            { id: 'AGV-01', type: 'agv', color: '#2ecc71' },
            { id: 'AGV-02', type: 'agv', color: '#f39c12' },
            { id: 'PICKER-01', type: 'picker', color: '#9b59b6' }
        ];

        const trajectories = [];

        vehicles.forEach(vehicle => {
            const path = this.generateRandomPath(vehicle.id);
            path.forEach((point, index) => {
                trajectories.push({
                    vehicleId: vehicle.id,
                    timestamp: baseTime + index * 5000,
                    x: point.x,
                    y: point.y,
                    z: 0,
                    speed: point.speed
                });
            });
        });

        return trajectories;
    }

    generateRandomPath(vehicleId) {
        const path = [];
        const segments = this.getPathForVehicle(vehicleId);
        
        for (let i = 0; i < segments.length - 1; i++) {
            const start = segments[i];
            const end = segments[i + 1];
            const steps = 5 + Math.floor(Math.random() * 5);
            
            for (let j = 0; j <= steps; j++) {
                const progress = j / steps;
                const x = start.x + (end.x - start.x) * progress + (Math.random() - 0.5) * 2;
                const y = start.y + (end.y - start.y) * progress + (Math.random() - 0.5) * 2;
                const speed = 2 + Math.random() * 8;
                
                path.push({ x, y, speed });
            }
        }

        return path;
    }

    getPathForVehicle(vehicleId) {
        const paths = {
            'FORKLIFT-01': [
                { x: 10, y: 40 },
                { x: 70, y: 40 },
                { x: 40, y: 40 },
                { x: 40, y: 10 },
                { x: 30, y: 10 },
                { x: 90, y: 10 },
                { x: 90, y: 40 }
            ],
            'FORKLIFT-02': [
                { x: 10, y: 60 },
                { x: 70, y: 60 },
                { x: 40, y: 60 },
                { x: 40, y: 70 },
                { x: 30, y: 70 },
                { x: 90, y: 70 },
                { x: 90, y: 60 }
            ],
            'AGV-01': [
                { x: 10, y: 20 },
                { x: 50, y: 20 },
                { x: 50, y: 10 },
                { x: 45, y: 10 },
                { x: 85, y: 10 },
                { x: 85, y: 20 }
            ],
            'AGV-02': [
                { x: 10, y: 50 },
                { x: 50, y: 50 },
                { x: 50, y: 60 },
                { x: 45, y: 60 },
                { x: 85, y: 60 },
                { x: 85, y: 50 }
            ],
            'PICKER-01': [
                { x: 30, y: 30 },
                { x: 30, y: 10 },
                { x: 35, y: 10 },
                { x: 35, y: 30 },
                { x: 30, y: 30 },
                { x: 30, y: 40 }
            ]
        };

        return paths[vehicleId] || [
            { x: 10, y: 40 },
            { x: 50, y: 40 },
            { x: 90, y: 40 }
        ];
    }

    async importTrajectory(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const result = await importManager.importTrajectoryCSV(file);
            
            if (result.success) {
                this.showNotification(`成功导入 ${result.validDataCount} 条轨迹数据`, 'success');
            } else {
                this.showNotification(`导入失败: ${result.error}`, 'error');
            }

            event.target.value = '';
        } catch (error) {
            this.showNotification(`导入错误: ${error.message}`, 'error');
            event.target.value = '';
        }
    }

    async importMap(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const result = await importManager.importMapJSON(file);
            
            if (result.success) {
                this.showNotification('地图导入成功', 'success');
            } else {
                this.showNotification(`导入失败: ${result.error}`, 'error');
            }

            event.target.value = '';
        } catch (error) {
            this.showNotification(`导入错误: ${error.message}`, 'error');
            event.target.value = '';
        }
    }

    exportReport() {
        try {
            const result = exportManager.downloadMarkdownReport();
            this.showNotification('报告导出成功', 'success');
        } catch (error) {
            this.showNotification(`导出错误: ${error.message}`, 'error');
        }
    }

    exportRisks() {
        try {
            const result = exportManager.downloadCSV();
            this.showNotification('风险清单导出成功', 'success');
        } catch (error) {
            this.showNotification(`导出错误: ${error.message}`, 'error');
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabName}`);
        });
    }

    updateSeverityFilter() {
        const severities = [];
        if (document.getElementById('filter-high').checked) severities.push('high');
        if (document.getElementById('filter-medium').checked) severities.push('medium');
        if (document.getElementById('filter-low').checked) severities.push('low');
        
        store.setSeverityFilters(severities);
    }

    updateUI(state, changeType) {
        if (changeType === 'trajectoryData' || changeType === 'all') {
            this.updateStatistics(state);
            this.updateVehicleList(state.filters);
            this.updateDataQuality(state);
        }

        if (changeType === 'risks' || changeType === 'all') {
            this.updateRiskStatistics(state.risks);
            this.updateRiskList(state.risks);
        }

        if (changeType === 'filters' || changeType === 'all') {
            this.updateVehicleFilters(state.filters);
        }

        if (changeType === 'selectedRisk' || changeType === 'all') {
            this.updateSelectedRisk(state.selectedRisk);
        }
    }

    updateStatistics(state) {
        const dataPoints = state.trajectoryData.length;
        const vehicles = state.filters.allVehicles.length;
        const risks = state.risks ? state.risks.statistics.totalRisks : 0;

        document.getElementById('stat-data-points').textContent = dataPoints;
        document.getElementById('stat-vehicles').textContent = vehicles;
        document.getElementById('stat-risks').textContent = risks;
    }

    updateRiskStatistics(risks) {
        if (!risks) {
            document.getElementById('risk-high').textContent = '0';
            document.getElementById('risk-medium').textContent = '0';
            document.getElementById('risk-low').textContent = '0';
            document.getElementById('risk-collisions').textContent = '0';
            document.getElementById('risk-suddenStops').textContent = '0';
            document.getElementById('risk-restricted').textContent = '0';
            document.getElementById('risk-speeding').textContent = '0';
            document.getElementById('risk-nearMisses').textContent = '0';
            return;
        }

        const bySeverity = risks.statistics.bySeverity;
        const byType = risks.statistics.byType;

        document.getElementById('risk-high').textContent = bySeverity.high || 0;
        document.getElementById('risk-medium').textContent = bySeverity.medium || 0;
        document.getElementById('risk-low').textContent = bySeverity.low || 0;

        document.getElementById('risk-collisions').textContent = byType.collisions || 0;
        document.getElementById('risk-suddenStops').textContent = byType.suddenStops || 0;
        document.getElementById('risk-restricted').textContent = byType.restrictedAreaApproaches || 0;
        document.getElementById('risk-speeding').textContent = byType.speeding || 0;
        document.getElementById('risk-nearMisses').textContent = byType.nearMisses || 0;
    }

    updateVehicleList(filters) {
        const listContainer = document.getElementById('vehicle-list');
        
        if (filters.allVehicles.length === 0) {
            listContainer.innerHTML = '<p class="no-data">暂无车辆数据</p>';
            return;
        }

        let html = '';
        filters.allVehicles.forEach(vehicleId => {
            const isSelected = filters.vehicles.includes(vehicleId);
            html += `
                <label class="checkbox-item">
                    <input type="checkbox" class="vehicle-checkbox" 
                           data-vehicle="${vehicleId}" ${isSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                    ${vehicleId}
                </label>
            `;
        });

        listContainer.innerHTML = html;

        listContainer.querySelectorAll('.vehicle-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const vehicleId = event.target.dataset.vehicle;
                store.toggleVehicleFilter(vehicleId);
            });
        });
    }

    updateVehicleFilters(filters) {
        const checkboxes = document.querySelectorAll('.vehicle-checkbox');
        checkboxes.forEach(checkbox => {
            const vehicleId = checkbox.dataset.vehicle;
            const isSelected = filters.vehicles.includes(vehicleId);
            checkbox.checked = isSelected;
        });
    }

    updateRiskList(risks) {
        const listContainer = document.getElementById('risk-list');
        
        if (!risks || risks.statistics.totalRisks === 0) {
            listContainer.innerHTML = '<p class="no-data">暂无风险数据</p>';
            return;
        }

        const allRisks = [
            ...(risks.collisions || []).map(r => ({ ...r, displayType: 'collision' })),
            ...(risks.suddenStops || []).map(r => ({ ...r, displayType: 'suddenStop' })),
            ...(risks.restrictedAreaApproaches || []).map(r => ({ ...r, displayType: 'restrictedArea' })),
            ...(risks.speeding || []).map(r => ({ ...r, displayType: 'speeding' })),
            ...(risks.nearMisses || []).map(r => ({ ...r, displayType: 'nearMiss' }))
        ];

        allRisks.sort((a, b) => {
            const severityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return a.timestamp - b.timestamp;
        });

        let html = '';
        allRisks.forEach((risk, index) => {
            const typeLabel = this.getRiskTypeLabel(risk.displayType);
            const time = this.formatTime(risk.timestamp);
            
            html += `
                <div class="risk-item ${risk.severity}" data-risk-id="${risk.id}">
                    <div class="risk-header">
                        <span class="risk-type">${typeLabel}</span>
                        <span class="risk-severity ${risk.severity}">${this.getSeverityLabel(risk.severity)}</span>
                    </div>
                    <div class="risk-body">
                        <p class="risk-desc">${risk.description}</p>
                        <p class="risk-time">${time}</p>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;

        listContainer.querySelectorAll('.risk-item').forEach(item => {
            item.addEventListener('click', () => {
                const riskId = item.dataset.riskId;
                this.selectRiskById(riskId);
            });
        });
    }

    updateDataQuality(state) {
        const statistics = state.parseStatistics;
        
        if (!statistics) {
            document.getElementById('data-total').textContent = '0';
            document.getElementById('data-valid').textContent = '0';
            document.getElementById('data-invalid').textContent = '0';
            return;
        }

        document.getElementById('data-total').textContent = statistics.totalRows;
        document.getElementById('data-valid').textContent = statistics.validRows;
        document.getElementById('data-invalid').textContent = statistics.invalidRows;

        this.updateInvalidRowsList(state.invalidRows);
    }

    updateInvalidRowsList(invalidRows) {
        const listContainer = document.getElementById('invalid-rows-list');
        
        if (!invalidRows || invalidRows.length === 0) {
            listContainer.innerHTML = '<p class="no-data">无问题数据</p>';
            return;
        }

        let html = '';
        invalidRows.slice(0, 20).forEach((row, index) => {
            const errorTypeLabel = this.getErrorTypeLabel(row.errorType);
            
            html += `
                <div class="invalid-row-item">
                    <div class="invalid-row-header">
                        <span class="row-number">第 ${row.rowNumber} 行</span>
                        <span class="error-type">${errorTypeLabel}</span>
                    </div>
                    <div class="invalid-row-body">
                        <p class="error-message">${row.errors ? row.errors.join('; ') : '未知错误'}</p>
                        <p class="row-data">${row.rowData}</p>
                    </div>
                </div>
            `;
        });

        if (invalidRows.length > 20) {
            html += `<p class="more-rows">... 还有 ${invalidRows.length - 20} 条问题数据</p>`;
        }

        listContainer.innerHTML = html;
    }

    updateSelectedRisk(selectedRisk) {
        this.selectedRisk = selectedRisk;
        this.showRiskDetail(selectedRisk);
    }

    showRiskDetail(risk) {
        const detailPanel = document.getElementById('risk-detail-panel');
        const detailContent = document.getElementById('risk-detail-content');

        if (!risk) {
            detailPanel.classList.add('hidden');
            return;
        }

        detailPanel.classList.remove('hidden');

        let html = `
            <div class="detail-section">
                <h4>基本信息</h4>
                <div class="detail-item">
                    <span class="detail-label">风险ID:</span>
                    <span class="detail-value">${risk.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">风险类型:</span>
                    <span class="detail-value">${this.getRiskTypeLabel(risk.type || risk.displayType)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">严重程度:</span>
                    <span class="detail-value severity-${risk.severity}">${this.getSeverityLabel(risk.severity)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">时间:</span>
                    <span class="detail-value">${this.formatTime(risk.timestamp)}</span>
                </div>
            </div>

            <div class="detail-section">
                <h4>详细描述</h4>
                <p class="description">${risk.description}</p>
            </div>
        `;

        if (risk.vehicles) {
            html += `
                <div class="detail-section">
                    <h4>涉及车辆</h4>
                    <div class="vehicle-list">
                        ${risk.vehicles.map(v => `<span class="vehicle-tag">${v}</span>`).join('')}
                    </div>
                </div>
            `;
        } else if (risk.vehicleId) {
            html += `
                <div class="detail-section">
                    <h4>涉及车辆</h4>
                    <div class="vehicle-list">
                        <span class="vehicle-tag">${risk.vehicleId}</span>
                    </div>
                </div>
            `;
        }

        if (risk.position) {
            html += `
                <div class="detail-section">
                    <h4>位置信息</h4>
                    <div class="detail-item">
                        <span class="detail-label">X:</span>
                        <span class="detail-value">${risk.position.x.toFixed(2)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Y:</span>
                        <span class="detail-value">${risk.position.y.toFixed(2)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Z:</span>
                        <span class="detail-value">${(risk.position.z || 0).toFixed(2)}</span>
                    </div>
                </div>
            `;
        }

        if (risk.positions) {
            html += `
                <div class="detail-section">
                    <h4>位置信息</h4>
                    ${risk.positions.map((pos, i) => `
                        <div class="position-item">
                            <h5>车辆 ${i + 1}</h5>
                            <div class="detail-item">
                                <span class="detail-label">位置:</span>
                                <span class="detail-value">(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${(pos.z || 0).toFixed(2)})</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (risk.speed !== undefined) {
            html += `
                <div class="detail-section">
                    <h4>速度信息</h4>
                    <div class="detail-item">
                        <span class="detail-label">当前速度:</span>
                        <span class="detail-value">${risk.speed.toFixed(1)} km/h</span>
                    </div>
            `;
            
            if (risk.speedLimit) {
                html += `
                    <div class="detail-item">
                        <span class="detail-label">限速:</span>
                        <span class="detail-value">${risk.speedLimit} km/h</span>
                    </div>
                `;
            }
            
            html += '</div>';
        }

        if (risk.distance !== undefined || risk.distances !== undefined) {
            html += `
                <div class="detail-section">
                    <h4>距离信息</h4>
                    <div class="detail-item">
                        <span class="detail-label">距离:</span>
                        <span class="detail-value">${(risk.distance || risk.distances).toFixed(2)} 米</span>
                    </div>
                </div>
            `;
        }

        if (risk.acceleration !== undefined) {
            html += `
                <div class="detail-section">
                    <h4>加速度信息</h4>
                    <div class="detail-item">
                        <span class="detail-label">加速度:</span>
                        <span class="detail-value">${risk.acceleration.toFixed(2)} m/s²</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">之前速度:</span>
                        <span class="detail-value">${risk.previousSpeed ? risk.previousSpeed.toFixed(1) : 'N/A'} km/h</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">当前速度:</span>
                        <span class="detail-value">${risk.currentSpeed ? risk.currentSpeed.toFixed(1) : 'N/A'} km/h</span>
                    </div>
                </div>
            `;
        }

        if (risk.areaName) {
            html += `
                <div class="detail-section">
                    <h4>区域信息</h4>
                    <div class="detail-item">
                        <span class="detail-label">区域名称:</span>
                        <span class="detail-value">${risk.areaName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">是否进入:</span>
                        <span class="detail-value">${risk.isInside ? '是' : '否'}</span>
                    </div>
                </div>
            `;
        }

        if (risk.evidence) {
            html += `
                <div class="detail-section">
                    <h4>证据数据</h4>
                    <pre class="evidence-data">${JSON.stringify(risk.evidence, null, 2)}</pre>
                </div>
            `;
        }

        detailContent.innerHTML = html;
    }

    closeRiskDetail() {
        store.clearSelectedRisk();
        document.getElementById('risk-detail-panel').classList.add('hidden');
    }

    jumpToRisk() {
        if (this.selectedRisk && this.selectedRisk.timestamp) {
            store.setCurrentTime(this.selectedRisk.timestamp);
            store.play();
        }
    }

    selectRiskById(riskId) {
        const risks = store.getRisks();
        if (!risks) return;

        const allRisks = [
            ...(risks.collisions || []),
            ...(risks.suddenStops || []),
            ...(risks.restrictedAreaApproaches || []),
            ...(risks.speeding || []),
            ...(risks.nearMisses || [])
        ];

        const risk = allRisks.find(r => r.id === riskId);
        if (risk) {
            store.setSelectedRisk(risk);
        }
    }

    handleRiskClick(risk) {
        store.setSelectedRisk(risk);
    }

    handleVehicleClick(vehicleId) {
        console.log('Vehicle clicked:', vehicleId);
    }

    handleTimeChange(time) {
    }

    handlePlayStateChange(isPlaying) {
    }

    getRiskTypeLabel(type) {
        const labels = {
            'collision': '会车风险',
            'collisions': '会车风险',
            'suddenStop': '急停风险',
            'suddenStops': '急停风险',
            'restrictedArea': '禁行区靠近',
            'restrictedAreaApproaches': '禁行区靠近',
            'speeding': '超速风险',
            'nearMiss': '险兆事件',
            'nearMisses': '险兆事件'
        };
        return labels[type] || type;
    }

    getSeverityLabel(severity) {
        const labels = {
            'high': '高风险',
            'medium': '中风险',
            'low': '低风险'
        };
        return labels[severity] || severity;
    }

    getErrorTypeLabel(errorType) {
        const labels = {
            'missingFields': '缺少必填字段',
            'timeOutOfOrder': '时间倒序',
            'outOfBounds': '坐标越界',
            'speedAbnormal': '速度异常',
            'invalidFormat': '格式错误',
            'unknown': '未知错误'
        };
        return labels[errorType] || errorType;
    }

    formatTime(timestamp) {
        if (!timestamp || timestamp === 0) return '--:--:--';

        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            return String(timestamp);
        }

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${hours}:${minutes}:${seconds}`;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

export default App;
