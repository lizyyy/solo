class AI_Observatory {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.is3DView = false;
        this.selectedDevice = null;
        this.hoveredDevice = null;
        
        this.layers = {
            gis: true,
            devices: true,
            anomalies: true,
            layer3d: true
        };
        
        this.filters = {
            floor: 'all',
            deviceType: 'all',
            anomalyLevel: 'all'
        };
        
        this.viewState = {
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            isDragging: false,
            lastX: 0,
            lastY: 0
        };
        
        this.plans = [];
        this.notes = [];
        this.resolvedConflicts = [];
        this.activeConflict = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadState();
        this.render();
        this.updateUI();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('mapCanvas');
        const container = document.getElementById('mapContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.ctx = this.canvas.getContext('2d');
        
        const resizeObserver = new ResizeObserver(() => {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.render();
        });
        resizeObserver.observe(container);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        document.getElementById('layerGIS').addEventListener('change', (e) => {
            this.layers.gis = e.target.checked;
            this.render();
        });
        document.getElementById('layerDevices').addEventListener('change', (e) => {
            this.layers.devices = e.target.checked;
            this.render();
        });
        document.getElementById('layerAnomalies').addEventListener('change', (e) => {
            this.layers.anomalies = e.target.checked;
            this.render();
        });
        document.getElementById('layer3D').addEventListener('change', (e) => {
            this.layers.layer3d = e.target.checked;
            this.render();
        });
        
        document.getElementById('floorFilter').addEventListener('change', (e) => {
            this.filters.floor = e.target.value;
            this.updateFilters();
            this.saveState();
        });
        document.getElementById('deviceTypeFilter').addEventListener('change', (e) => {
            this.filters.deviceType = e.target.value;
            this.updateFilters();
            this.saveState();
        });
        document.getElementById('anomalyLevelFilter').addEventListener('change', (e) => {
            this.filters.anomalyLevel = e.target.value;
            this.updateFilters();
            this.saveState();
        });
        
        document.getElementById('view2D').addEventListener('click', () => this.setViewMode(false));
        document.getElementById('view3D').addEventListener('click', () => this.setViewMode(true));
        
        document.getElementById('savePlanBtn').addEventListener('click', () => this.openPlanModal(true));
        document.getElementById('loadPlanBtn').addEventListener('click', () => this.openPlanModal(false));
        document.getElementById('exportBtn').addEventListener('click', () => this.exportScreenshot());
        document.getElementById('exportReportBtn').addEventListener('click', () => this.openReportModal());
        
        document.getElementById('addNoteBtn').addEventListener('click', () => this.addNote());
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        document.getElementById('cancelPlanBtn').addEventListener('click', () => this.closeModals());
        document.getElementById('confirmSavePlan').addEventListener('click', () => this.savePlan());
        
        document.getElementById('keepGISBtn').addEventListener('click', () => this.resolveConflict('gis'));
        document.getElementById('keepImportBtn').addEventListener('click', () => this.resolveConflict('import'));
        document.getElementById('mergeBtn').addEventListener('click', () => this.resolveConflict('merge'));
        
        document.getElementById('closeDiffBtn').addEventListener('click', () => this.closeModals());
        document.getElementById('applyNoteFilters').addEventListener('click', () => this.applyCurrentNoteFilters());
        document.getElementById('closeReportBtn').addEventListener('click', () => this.closeModals());
        document.getElementById('downloadReportBtn').addEventListener('click', () => this.downloadReportHtml());
        document.getElementById('downloadReportCsvBtn').addEventListener('click', () => this.downloadReportCsv());
    }
    
    setViewMode(is3D) {
        this.is3DView = is3D;
        document.getElementById('view2D').classList.toggle('active', !is3D);
        document.getElementById('view3D').classList.toggle('active', is3D);
        this.saveState();
        this.render();
    }
    
    onMouseDown(e) {
        this.viewState.isDragging = true;
        this.viewState.lastX = e.clientX;
        this.viewState.lastY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }
    
    onMouseMove(e) {
        if (this.viewState.isDragging) {
            this.viewState.offsetX += e.clientX - this.viewState.lastX;
            this.viewState.offsetY += e.clientY - this.viewState.lastY;
            this.viewState.lastX = e.clientX;
            this.viewState.lastY = e.clientY;
            this.render();
        } else {
            this.checkHover(e);
        }
    }
    
    onMouseUp() {
        this.viewState.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }
    
    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewState.offsetX) / this.viewState.scale;
        const y = (e.clientY - rect.top - this.viewState.offsetY) / this.viewState.scale;
        
        const devices = this.getFilteredDevices();
        for (const device of devices) {
            const dist = Utils.calculateDistance({ x, y }, device.position);
            if (dist < 20) {
                this.selectDevice(device);
                return;
            }
        }
        
        for (const anomaly of this.getFilteredAnomalies()) {
            for (const pos of anomaly.affectedPositions) {
                const dist = Utils.calculateDistance({ x, y }, pos);
                if (dist < 25) {
                    this.selectAnomaly(anomaly);
                    return;
                }
            }
        }
        
        this.selectedDevice = null;
        this.updateSelectedDeviceInfo();
        this.render();
    }
    
    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.viewState.scale *= delta;
        this.viewState.scale = Math.max(0.5, Math.min(3, this.viewState.scale));
        this.render();
    }
    
    checkHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewState.offsetX) / this.viewState.scale;
        const y = (e.clientY - rect.top - this.viewState.offsetY) / this.viewState.scale;
        
        let hovered = null;
        const devices = this.getFilteredDevices();
        
        for (const device of devices) {
            const dist = Utils.calculateDistance({ x, y }, device.position);
            if (dist < 20) {
                hovered = device;
                break;
            }
        }
        
        this.hoveredDevice = hovered;
        this.showTooltip(e, hovered);
        this.render();
    }
    
    showTooltip(e, device) {
        const tooltip = document.getElementById('tooltip');
        if (!device) {
            tooltip.classList.add('hidden');
            return;
        }
        
        tooltip.classList.remove('hidden');
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
        
        const hasAnomaly = ANOMALIES.some(a => a.deviceId === device.id || a.gisDeviceId === device.id);
        
        tooltip.innerHTML = `
            <h4>${device.name}</h4>
            <div class="tooltip-item">
                <span class="label">类型</span>
                <span class="value">${Utils.getDeviceTypeName(device.type)}</span>
            </div>
            <div class="tooltip-item">
                <span class="label">楼层</span>
                <span class="value">${device.floor}层</span>
            </div>
            <div class="tooltip-item">
                <span class="label">状态</span>
                <span class="value">${Utils.getStatusName(device.status)}</span>
            </div>
            <div class="tooltip-item">
                <span class="label">坐标</span>
                <span class="value">(${device.position.x}, ${device.position.y})</span>
            </div>
            <div class="tooltip-item">
                <span class="label">照片</span>
                <span class="value">${device.hasPhoto ? '有' : '<span style="color:#f87171">无</span>'}</span>
            </div>
            ${hasAnomaly ? '<div class="tooltip-item"><span class="label">异常</span><span class="value" style="color:#f87171">检测到异常</span></div>' : ''}
        `;
    }
    
    selectDevice(device) {
        this.selectedDevice = device;
        this.updateSelectedDeviceInfo();
        this.render();
    }
    
    selectAnomaly(anomaly) {
        const device = IMPORT_DATA.devices.find(d => d.id === anomaly.deviceId) || 
                       GIS_DATA.devices.find(d => d.id === anomaly.gisDeviceId);
        if (device) {
            this.selectedDevice = device;
            this.updateSelectedDeviceInfo();
        }
        this.render();
    }
    
    updateSelectedDeviceInfo() {
        const infoDiv = document.getElementById('selectedDeviceInfo');
        
        if (!this.selectedDevice) {
            infoDiv.innerHTML = '<p class="empty-text">点击地图上的设备查看详情</p>';
            return;
        }
        
        const device = this.selectedDevice;
        const anomalies = ANOMALIES.filter(a => a.deviceId === device.id || a.gisDeviceId === device.id);
        const hasConflict = DATA_CONFLICTS.some(c => 
            c.gisData.name === device.name || c.importData.name === device.name
        );
        
        infoDiv.innerHTML = `
            <div class="info-row">
                <span class="info-label">设备名称</span>
                <span class="info-value">${device.name}</span>
            </div>
            <div class="info-row">
                <span class="info-label">设备类型</span>
                <span class="info-value">${Utils.getDeviceTypeName(device.type)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">所在楼层</span>
                <span class="info-value">${device.floor}层</span>
            </div>
            <div class="info-row">
                <span class="info-label">运行状态</span>
                <span class="info-value ${device.status === 'offline' ? 'critical' : device.status === 'warning' ? 'warning' : ''}">${Utils.getStatusName(device.status)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">安装日期</span>
                <span class="info-value">${device.installDate}</span>
            </div>
            <div class="info-row">
                <span class="info-label">坐标</span>
                <span class="info-value">${device.coords.lat.toFixed(4)}, ${device.coords.lng.toFixed(4)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">现场照片</span>
                <span class="info-value ${!device.hasPhoto ? 'warning' : ''}">${device.hasPhoto ? '已上传' : '缺失'}</span>
            </div>
            ${anomalies.length > 0 ? `
            <div class="info-row">
                <span class="info-label">异常数量</span>
                <span class="info-value critical">${anomalies.length} 个</span>
            </div>
            ` : ''}
            ${hasConflict ? `
            <div class="info-row">
                <span class="info-label">数据冲突</span>
                <span class="info-value warning">存在冲突</span>
            </div>
            ` : ''}
        `;
    }
    
    getFilteredDevices() {
        let devices = [...IMPORT_DATA.devices];
        
        if (this.filters.floor !== 'all') {
            devices = devices.filter(d => d.floor === parseInt(this.filters.floor));
        }
        if (this.filters.deviceType !== 'all') {
            devices = devices.filter(d => d.type === this.filters.deviceType);
        }
        
        return devices;
    }
    
    getFilteredAnomalies() {
        let anomalies = [...ANOMALIES];
        
        if (this.filters.floor !== 'all') {
            const floor = parseInt(this.filters.floor);
            anomalies = anomalies.filter(a => a.floor === floor || (a.targetFloor && a.targetFloor === floor));
        }
        if (this.filters.anomalyLevel !== 'all') {
            anomalies = anomalies.filter(a => a.level === this.filters.anomalyLevel);
        }
        
        return anomalies;
    }
    
    updateFilters() {
        this.render();
        this.updateUI();
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.viewState.offsetX, this.viewState.offsetY);
        this.ctx.scale(this.viewState.scale, this.viewState.scale);
        
        if (this.layers.gis) {
            this.drawGISFloor();
        }
        
        if (this.layers.anomalies) {
            this.drawAnomalies();
        }
        
        if (this.layers.devices) {
            this.drawDevices();
        }
        
        if (this.is3DView && this.layers.layer3d) {
            this.draw3DFloors();
        }
        
        this.ctx.restore();
    }
    
    drawGISFloor() {
        const building = GIS_DATA.buildings[0];
        const floors = this.filters.floor !== 'all' ? [parseInt(this.filters.floor)] : building.floors;
        
        floors.forEach((floor, index) => {
            const floorOffset = this.is3DView ? (floor - 1) * 60 : 0;
            const alpha = 0.3 + (floor / building.floors.length) * 0.3;
            
            this.ctx.fillStyle = `rgba(30, 58, 138, ${alpha})`;
            this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.rect(
                building.position.x,
                building.position.y + floorOffset,
                building.width,
                building.height
            );
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.fillStyle = 'rgba(0, 212, 255, 0.7)';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(`${floor}层`, building.position.x + 10, building.position.y + floorOffset + 25);
            
            this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
            this.ctx.lineWidth = 1;
            for (let x = building.position.x + 50; x < building.position.x + building.width; x += 50) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, building.position.y + floorOffset);
                this.ctx.lineTo(x, building.position.y + floorOffset + building.height);
                this.ctx.stroke();
            }
            for (let y = building.position.y + 50 + floorOffset; y < building.position.y + floorOffset + building.height; y += 50) {
                this.ctx.beginPath();
                this.ctx.moveTo(building.position.x, y);
                this.ctx.lineTo(building.position.x + building.width, y);
                this.ctx.stroke();
            }
        });
    }
    
    draw3DFloors() {
        const building = GIS_DATA.buildings[0];
        const floors = building.floors;
        
        floors.forEach((floor, index) => {
            if (this.filters.floor !== 'all' && floor !== parseInt(this.filters.floor)) return;
            
            const floorOffset = (floor - 1) * 60;
            
            this.ctx.fillStyle = 'rgba(30, 58, 138, 0.2)';
            this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
            this.ctx.lineWidth = 1;
            
            this.ctx.beginPath();
            this.ctx.moveTo(building.position.x + building.width, building.position.y + floorOffset);
            this.ctx.lineTo(building.position.x + building.width + 40, building.position.y + floorOffset - 30);
            this.ctx.lineTo(building.position.x + building.width + 40, building.position.y + floorOffset + building.height - 30);
            this.ctx.lineTo(building.position.x + building.width, building.position.y + floorOffset + building.height);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(building.position.x, building.position.y + floorOffset);
            this.ctx.lineTo(building.position.x + 40, building.position.y + floorOffset - 30);
            this.ctx.lineTo(building.position.x + building.width + 40, building.position.y + floorOffset - 30);
            this.ctx.lineTo(building.position.x + building.width, building.position.y + floorOffset);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        });
    }
    
    drawDevices() {
        const devices = this.getFilteredDevices();
        
        devices.forEach(device => {
            const floorOffset = this.is3DView ? (device.floor - 1) * 60 : 0;
            const x = device.position.x;
            const y = device.position.y + floorOffset;
            const isSelected = this.selectedDevice && this.selectedDevice.id === device.id;
            const isHovered = this.hoveredDevice && this.hoveredDevice.id === device.id;
            const hasAnomaly = ANOMALIES.some(a => a.deviceId === device.id || a.gisDeviceId === device.id);
            
            if (hasAnomaly && this.layers.anomalies) {
                const anomaly = ANOMALIES.find(a => a.deviceId === device.id || a.gisDeviceId === device.id);
                this.ctx.shadowColor = Utils.getLevelColor(anomaly.level);
                this.ctx.shadowBlur = 20;
            }
            
            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 18);
            gradient.addColorStop(0, Utils.getDeviceColor(device.type));
            gradient.addColorStop(1, Utils.getDeviceColor(device.type) + '00');
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 18, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.shadowBlur = 0;
            
            this.ctx.fillStyle = device.status === 'offline' ? '#666' : Utils.getDeviceColor(device.type);
            this.ctx.beginPath();
            this.ctx.arc(x, y, 12, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = device.status === 'offline' ? '#999' : '#fff';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            const icons = { camera: '●', sensor: '◆', gateway: '■' };
            this.ctx.fillText(icons[device.type] || '?', x, y);
            
            if (isSelected || isHovered) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 16, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            
            if (!device.hasPhoto) {
                this.ctx.fillStyle = '#f87171';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillText('!', x + 12, y - 10);
            }
            
            this.ctx.fillStyle = '#e0e0e0';
            this.ctx.font = '11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(Utils.truncateText(device.name, 10), x, y + 28);
        });
    }
    
    drawAnomalies() {
        const anomalies = this.getFilteredAnomalies();
        
        anomalies.forEach(anomaly => {
            const color = Utils.getLevelColor(anomaly.level);
            
            if (anomaly.type === 'coordinate-offset') {
                const floorOffset = this.is3DView ? (anomaly.floor - 1) * 60 : 0;
                const pos1 = anomaly.affectedPositions[0];
                const pos2 = anomaly.affectedPositions[1];
                
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                this.ctx.moveTo(pos1.x, pos1.y + floorOffset);
                this.ctx.lineTo(pos2.x, pos2.y + floorOffset);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                
                this.ctx.fillStyle = color;
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                
                this.ctx.beginPath();
                this.ctx.arc(pos1.x, pos1.y + floorOffset, 8, 0, Math.PI * 2);
                this.ctx.stroke();
                
                this.ctx.beginPath();
                this.ctx.arc(pos2.x, pos2.y + floorOffset, 8, 0, Math.PI * 2);
                this.ctx.stroke();
            } else if (anomaly.type === 'cross-floor' && this.is3DView) {
                const pos1 = anomaly.affectedPositions[0];
                const pos2 = anomaly.affectedPositions[1];
                const offset1 = (pos1.floor - 1) * 60;
                const offset2 = (pos2.floor - 1) * 60;
                
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 10;
                
                this.ctx.beginPath();
                this.ctx.moveTo(pos1.x, pos1.y + offset1);
                this.ctx.lineTo(pos2.x, pos2.y + offset2);
                this.ctx.stroke();
                
                this.ctx.shadowBlur = 0;
                
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc((pos1.x + pos2.x) / 2, (pos1.y + offset1 + pos2.y + offset2) / 2, 10, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('!', (pos1.x + pos2.x) / 2, (pos1.y + offset1 + pos2.y + offset2) / 2);
            } else {
                const floorOffset = this.is3DView ? (anomaly.floor - 1) * 60 : 0;
                
                anomaly.affectedPositions.forEach(pos => {
                    const px = pos.x;
                    const py = pos.y + (pos.floor ? (pos.floor - 1) * 60 : floorOffset);
                    
                    this.ctx.strokeStyle = color;
                    this.ctx.lineWidth = 3;
                    this.ctx.shadowColor = color;
                    this.ctx.shadowBlur = 15;
                    
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, 25, 0, Math.PI * 2);
                    this.ctx.stroke();
                    
                    this.ctx.shadowBlur = 0;
                    
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, 8, 0, Math.PI * 2);
                    this.ctx.fill();
                });
            }
        });
    }
    
    updateUI() {
        this.updateViewInfo();
        this.updateAnomalyList();
        this.updateConflictList();
        this.updateNotesList();
        
        document.getElementById('floorFilter').value = this.filters.floor;
        document.getElementById('deviceTypeFilter').value = this.filters.deviceType;
        document.getElementById('anomalyLevelFilter').value = this.filters.anomalyLevel;
    }
    
    updateViewInfo() {
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        
        const floorText = this.filters.floor === 'all' ? '全部' : `${this.filters.floor}层`;
        document.getElementById('currentFloor').textContent = `当前楼层: ${floorText}`;
        document.getElementById('deviceCount').textContent = `设备: ${devices.length}`;
        document.getElementById('anomalyCount').textContent = `异常: ${anomalies.length}`;
    }
    
    updateAnomalyList() {
        const container = document.getElementById('anomalyList');
        const anomalies = this.getFilteredAnomalies();
        
        if (anomalies.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无异常数据</div>';
            return;
        }
        
        container.innerHTML = anomalies.map(anomaly => `
            <div class="anomaly-item ${anomaly.level}" data-id="${anomaly.id}">
                <div class="anomaly-title">${anomaly.title}</div>
                <div class="anomaly-meta">
                    ${Utils.getLevelName(anomaly.level)} · ${anomaly.floor}层 · ${Utils.truncateText(anomaly.description, 30)}
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.anomaly-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const anomaly = ANOMALIES.find(a => a.id === id);
                if (anomaly) {
                    this.selectAnomaly(anomaly);
                }
            });
        });
    }
    
    updateConflictList() {
        const container = document.getElementById('conflictList');
        const unresolvedConflicts = DATA_CONFLICTS.filter(c => !this.resolvedConflicts.includes(c.id));
        
        if (unresolvedConflicts.length === 0) {
            container.innerHTML = '<div style="color:#666;font-size:12px;text-align:center;padding:10px;">暂无数据冲突</div>';
            return;
        }
        
        container.innerHTML = unresolvedConflicts.map(conflict => `
            <div class="conflict-item" data-id="${conflict.id}">
                <div class="conflict-title">${conflict.title}</div>
                <div class="conflict-desc">${conflict.description}</div>
            </div>
        `).join('');
        
        container.querySelectorAll('.conflict-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.openConflictModal(id);
            });
        });
    }
    
    openConflictModal(conflictId) {
        const conflict = DATA_CONFLICTS.find(c => c.id === conflictId);
        if (!conflict) return;
        
        this.activeConflict = conflict;
        
        document.getElementById('gisDataDisplay').innerHTML = this.renderConflictData(conflict.gisData);
        document.getElementById('importDataDisplay').innerHTML = this.renderConflictData(conflict.importData);
        
        const suggestionList = document.getElementById('suggestionList');
        suggestionList.innerHTML = conflict.suggestions.map(s => `<li>${s}</li>`).join('');
        
        document.getElementById('conflictModal').classList.remove('hidden');
    }
    
    renderConflictData(data) {
        return Object.entries(data).map(([key, value]) => {
            const isObject = typeof value === 'object' && value !== null;
            const displayValue = isObject ? JSON.stringify(value) : value;
            return `
                <div class="conflict-data-row">
                    <span class="label">${key}</span>
                    <span class="value">${displayValue}</span>
                </div>
            `;
        }).join('');
    }
    
    resolveConflict(resolution) {
        if (!this.activeConflict) return;
        
        this.resolvedConflicts.push(this.activeConflict.id);
        this.activeConflict = null;
        this.closeModals();
        this.updateConflictList();
        this.saveState();
    }
    
    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
    
    addNote() {
        const input = document.getElementById('noteInput');
        const text = input.value.trim();
        
        if (!text) return;
        
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        
        const note = {
            id: Utils.generateId(),
            text,
            timestamp: Date.now(),
            filters: Utils.deepClone(this.filters),
            layers: Utils.deepClone(this.layers),
            viewState: Utils.deepClone(this.viewState),
            is3DView: this.is3DView,
            selectedDevice: this.selectedDevice ? this.selectedDevice.id : null,
            snapshot: {
                deviceCount: devices.length,
                anomalyCount: anomalies.length,
                anomalyBreakdown: {
                    critical: anomalies.filter(a => a.level === 'critical').length,
                    warning: anomalies.filter(a => a.level === 'warning').length,
                    info: anomalies.filter(a => a.level === 'info').length
                }
            }
        };
        
        this.notes.unshift(note);
        input.value = '';
        
        this.updateNotesList();
        this.saveState();
    }
    
    updateNotesList() {
        const container = document.getElementById('noteList');
        
        if (this.notes.length === 0) {
            container.innerHTML = '<div style="color:#666;font-size:12px;text-align:center;padding:10px;">暂无备注</div>';
            return;
        }
        
        container.innerHTML = this.notes.slice(0, 10).map(note => {
            const hasDiff = this.hasNoteDiff(note);
            const diffCount = this.getDiffCount(note);
            
            return `
                <div class="note-item" data-id="${note.id}">
                    <div class="note-time">${Utils.formatDate(note.timestamp)}</div>
                    <div>${note.text}</div>
                    <div style="font-size:11px;color:#888;margin-top:4px;">
                        设备: ${note.snapshot.deviceCount} | 异常: ${note.snapshot.anomalyCount}
                    </div>
                    ${hasDiff ? `<div class="note-diff">存在 ${diffCount} 项差异，点击查看详情</div>` : ''}
                    <div class="note-actions">
                        <button class="note-action-btn view-diff" data-id="${note.id}">查看差异</button>
                        <button class="note-action-btn restore-note" data-id="${note.id}">恢复状态</button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.view-diff').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const note = this.notes.find(n => n.id === id);
                if (note) {
                    this.showDiffModal(note);
                }
            });
        });
        
        container.querySelectorAll('.restore-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const note = this.notes.find(n => n.id === id);
                if (note) {
                    this.restoreNoteFilters(note);
                }
            });
        });
        
        container.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const note = this.notes.find(n => n.id === id);
                if (note) {
                    this.showDiffModal(note);
                }
            });
        });
    }
    
    hasNoteDiff(note) {
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        
        const filterDiff = Object.keys(note.filters).some(key => note.filters[key] !== this.filters[key]);
        const layerDiff = Object.keys(note.layers).some(key => note.layers[key] !== this.layers[key]);
        const viewDiff = note.is3DView !== this.is3DView;
        const countDiff = note.snapshot.deviceCount !== devices.length || 
                         note.snapshot.anomalyCount !== anomalies.length;
        
        return filterDiff || layerDiff || viewDiff || countDiff;
    }
    
    getDiffCount(note) {
        let count = 0;
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        
        Object.keys(note.filters).forEach(key => {
            if (note.filters[key] !== this.filters[key]) count++;
        });
        Object.keys(note.layers).forEach(key => {
            if (note.layers[key] !== this.layers[key]) count++;
        });
        if (note.is3DView !== this.is3DView) count++;
        if (note.snapshot.deviceCount !== devices.length) count++;
        if (note.snapshot.anomalyCount !== anomalies.length) count++;
        
        return count;
    }
    
    hasFilterDiff(savedFilters) {
        return Object.keys(savedFilters).some(key => savedFilters[key] !== this.filters[key]);
    }
    
    showDiffModal(note) {
        this.activeNote = note;
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        
        const diffCount = this.getDiffCount(note);
        document.getElementById('diffSummary').innerHTML = `
            <h4>差异概览</h4>
            <div class="diff-summary-stats">
                <div class="diff-stat">
                    <span class="diff-stat-label">总差异项</span>
                    <span class="diff-stat-value">${diffCount}</span>
                </div>
                <div class="diff-stat">
                    <span class="diff-stat-label">设备数量变化</span>
                    <span class="diff-stat-value">${note.snapshot.deviceCount} → ${devices.length}</span>
                </div>
                <div class="diff-stat">
                    <span class="diff-stat-label">异常数量变化</span>
                    <span class="diff-stat-value">${note.snapshot.anomalyCount} → ${anomalies.length}</span>
                </div>
            </div>
        `;
        
        this.renderFilterDiff(note);
        this.renderAnomalyDiff(note);
        this.renderLayerDiff(note);
        
        document.getElementById('diffModal').classList.remove('hidden');
    }
    
    renderFilterDiff(note) {
        const container = document.getElementById('filterDiffDisplay');
        const filterLabels = {
            floor: '楼层',
            deviceType: '设备类型',
            anomalyLevel: '异常等级'
        };
        const valueLabels = {
            floor: { all: '全部楼层', '1': '1层', '2': '2层', '3': '3层' },
            deviceType: { all: '全部类型', camera: '摄像头', sensor: '传感器', gateway: '网关' },
            anomalyLevel: { all: '全部等级', critical: '严重', warning: '警告', info: '提示' }
        };
        
        let html = `
            <div class="diff-row">
                <div class="diff-cell header field-name">字段</div>
                <div class="diff-cell header">备注时的值</div>
                <div class="diff-cell header">当前值</div>
            </div>
        `;
        
        Object.keys(note.filters).forEach(key => {
            const oldVal = note.filters[key];
            const newVal = this.filters[key];
            const hasDiff = oldVal !== newVal;
            
            html += `
                <div class="diff-row">
                    <div class="diff-cell field-name">${filterLabels[key]}</div>
                    <div class="diff-cell ${hasDiff ? 'old-value' : 'same-value'}">${valueLabels[key][oldVal] || oldVal}</div>
                    <div class="diff-cell ${hasDiff ? 'new-value' : 'same-value'}">${valueLabels[key][newVal] || newVal}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    renderAnomalyDiff(note) {
        const container = document.getElementById('anomalyDiffDisplay');
        const current = this.getFilteredAnomalies();
        
        let html = `
            <div class="diff-row">
                <div class="diff-cell header field-name">统计项</div>
                <div class="diff-cell header">备注时</div>
                <div class="diff-cell header">当前</div>
            </div>
        `;
        
        const fields = [
            { key: 'deviceCount', label: '设备数量' },
            { key: 'anomalyCount', label: '异常总数' }
        ];
        
        fields.forEach(field => {
            const oldVal = note.snapshot[field.key];
            const newVal = field.key === 'deviceCount' ? this.getFilteredDevices().length : current.length;
            const hasDiff = oldVal !== newVal;
            
            html += `
                <div class="diff-row">
                    <div class="diff-cell field-name">${field.label}</div>
                    <div class="diff-cell ${hasDiff ? 'old-value' : 'same-value'}">${oldVal}</div>
                    <div class="diff-cell ${hasDiff ? 'new-value' : 'same-value'}">${newVal}</div>
                </div>
            `;
        });
        
        const levels = [
            { key: 'critical', label: '严重异常' },
            { key: 'warning', label: '警告异常' },
            { key: 'info', label: '提示异常' }
        ];
        
        levels.forEach(level => {
            const oldVal = note.snapshot.anomalyBreakdown[level.key];
            const newVal = current.filter(a => a.level === level.key).length;
            const hasDiff = oldVal !== newVal;
            
            html += `
                <div class="diff-row">
                    <div class="diff-cell field-name">${level.label}</div>
                    <div class="diff-cell ${hasDiff ? 'old-value' : 'same-value'}">${oldVal}</div>
                    <div class="diff-cell ${hasDiff ? 'new-value' : 'same-value'}">${newVal}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    renderLayerDiff(note) {
        const container = document.getElementById('layerDiffDisplay');
        const layerLabels = {
            gis: 'GIS底图',
            devices: '设备点位',
            anomalies: '异常高亮',
            layer3d: '3D楼层'
        };
        
        let html = `
            <div class="diff-row">
                <div class="diff-cell header field-name">图层</div>
                <div class="diff-cell header">备注时</div>
                <div class="diff-cell header">当前</div>
            </div>
        `;
        
        Object.keys(note.layers).forEach(key => {
            const oldVal = note.layers[key];
            const newVal = this.layers[key];
            const hasDiff = oldVal !== newVal;
            
            html += `
                <div class="diff-row">
                    <div class="diff-cell field-name">${layerLabels[key]}</div>
                    <div class="diff-cell ${hasDiff ? 'old-value' : 'same-value'}">${oldVal ? '显示' : '隐藏'}</div>
                    <div class="diff-cell ${hasDiff ? 'new-value' : 'same-value'}">${newVal ? '显示' : '隐藏'}</div>
                </div>
            `;
        });
        
        const viewDiff = note.is3DView !== this.is3DView;
        html += `
            <div class="diff-row">
                <div class="diff-cell field-name">视图模式</div>
                <div class="diff-cell ${viewDiff ? 'old-value' : 'same-value'}">${note.is3DView ? '3D视图' : '2D视图'}</div>
                <div class="diff-cell ${viewDiff ? 'new-value' : 'same-value'}">${this.is3DView ? '3D视图' : '2D视图'}</div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    applyCurrentNoteFilters() {
        if (!this.activeNote) return;
        this.restoreNoteFilters(this.activeNote);
        this.closeModals();
    }
    
    restoreNoteFilters(note) {
        this.filters = Utils.deepClone(note.filters);
        if (note.layers) this.layers = Utils.deepClone(note.layers);
        if (note.viewState) this.viewState = Utils.deepClone(note.viewState);
        if (note.is3DView !== undefined) this.is3DView = note.is3DView;
        
        document.getElementById('floorFilter').value = this.filters.floor;
        document.getElementById('deviceTypeFilter').value = this.filters.deviceType;
        document.getElementById('anomalyLevelFilter').value = this.filters.anomalyLevel;
        
        document.getElementById('layerGIS').checked = this.layers.gis;
        document.getElementById('layerDevices').checked = this.layers.devices;
        document.getElementById('layerAnomalies').checked = this.layers.anomalies;
        document.getElementById('layer3D').checked = this.layers.layer3d;
        
        document.getElementById('view2D').classList.toggle('active', !this.is3DView);
        document.getElementById('view3D').classList.toggle('active', this.is3DView);
        
        if (note.selectedDevice) {
            const device = IMPORT_DATA.devices.find(d => d.id === note.selectedDevice) ||
                          GIS_DATA.devices.find(d => d.id === note.selectedDevice);
            if (device) {
                this.selectedDevice = device;
                this.updateSelectedDeviceInfo();
            }
        } else {
            this.selectedDevice = null;
            this.updateSelectedDeviceInfo();
        }
        
        this.updateFilters();
        this.render();
        this.saveState();
    }
    
    openPlanModal(isSave) {
        this.loadPlans();
        this.updatePlanList();
        
        const modal = document.getElementById('planModal');
        const inputContainer = modal.querySelector('.plan-input');
        const saveBtn = document.getElementById('confirmSavePlan');
        
        inputContainer.style.display = isSave ? 'block' : 'none';
        saveBtn.style.display = isSave ? 'inline-block' : 'none';
        
        document.getElementById('planNameInput').value = '';
        modal.classList.remove('hidden');
    }
    
    updatePlanList() {
        const container = document.getElementById('planList');
        
        if (this.plans.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无保存的方案</div>';
            return;
        }
        
        container.innerHTML = this.plans.map(plan => `
            <div class="plan-item" data-id="${plan.id}">
                <div class="plan-info">
                    <div class="plan-name">${plan.name}</div>
                    <div class="plan-time">${Utils.formatDate(plan.timestamp)}</div>
                </div>
                <div class="plan-actions">
                    <button class="delete-btn" data-id="${plan.id}">删除</button>
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.plan-item .plan-info').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.parentElement.dataset.id;
                this.loadPlan(id);
            });
        });
        
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.deletePlan(id);
            });
        });
    }
    
    savePlan() {
        const nameInput = document.getElementById('planNameInput');
        const name = nameInput.value.trim() || `方案 ${Utils.formatDateShort(Date.now())}`;
        
        const plan = {
            id: Utils.generateId(),
            name,
            timestamp: Date.now(),
            filters: Utils.deepClone(this.filters),
            layers: Utils.deepClone(this.layers),
            viewState: Utils.deepClone(this.viewState),
            is3DView: this.is3DView,
            selectedDeviceId: this.selectedDevice ? this.selectedDevice.id : null,
            notes: Utils.deepClone(this.notes),
            resolvedConflicts: [...this.resolvedConflicts]
        };
        
        this.plans.unshift(plan);
        Utils.storage.set('ai_observatory_plans', this.plans);
        
        this.closeModals();
        this.updatePlanList();
    }
    
    loadPlans() {
        this.plans = Utils.storage.get('ai_observatory_plans', []);
    }
    
    loadPlan(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan) return;
        
        this.filters = Utils.deepClone(plan.filters);
        this.layers = Utils.deepClone(plan.layers);
        this.viewState = Utils.deepClone(plan.viewState);
        this.is3DView = plan.is3DView;
        this.notes = Utils.deepClone(plan.notes);
        this.resolvedConflicts = plan.resolvedConflicts ? [...plan.resolvedConflicts] : [];
        
        if (plan.selectedDeviceId) {
            this.selectedDevice = IMPORT_DATA.devices.find(d => d.id === plan.selectedDeviceId) ||
                                 GIS_DATA.devices.find(d => d.id === plan.selectedDeviceId);
        } else {
            this.selectedDevice = null;
        }
        
        document.getElementById('floorFilter').value = this.filters.floor;
        document.getElementById('deviceTypeFilter').value = this.filters.deviceType;
        document.getElementById('anomalyLevelFilter').value = this.filters.anomalyLevel;
        
        document.getElementById('layerGIS').checked = this.layers.gis;
        document.getElementById('layerDevices').checked = this.layers.devices;
        document.getElementById('layerAnomalies').checked = this.layers.anomalies;
        document.getElementById('layer3D').checked = this.layers.layer3d;
        
        document.getElementById('view2D').classList.toggle('active', !this.is3DView);
        document.getElementById('view3D').classList.toggle('active', this.is3DView);
        
        this.closeModals();
        this.updateUI();
        this.updateSelectedDeviceInfo();
        this.render();
    }
    
    deletePlan(planId) {
        this.plans = this.plans.filter(p => p.id !== planId);
        Utils.storage.set('ai_observatory_plans', this.plans);
        this.updatePlanList();
    }
    
    saveState() {
        const state = {
            filters: this.filters,
            layers: this.layers,
            viewState: this.viewState,
            is3DView: this.is3DView,
            notes: this.notes,
            resolvedConflicts: this.resolvedConflicts,
            lastSave: Date.now()
        };
        Utils.storage.set('ai_observatory_state', state);
    }
    
    loadState() {
        const state = Utils.storage.get('ai_observatory_state', null);
        if (!state) return;
        
        if (state.filters) this.filters = { ...this.filters, ...state.filters };
        if (state.layers) this.layers = { ...this.layers, ...state.layers };
        if (state.viewState) this.viewState = { ...this.viewState, ...state.viewState };
        if (state.is3DView !== undefined) this.is3DView = state.is3DView;
        if (state.notes) this.notes = state.notes;
        if (state.resolvedConflicts) this.resolvedConflicts = state.resolvedConflicts;
    }
    
    exportScreenshot() {
        const watermark = document.getElementById('exportWatermark');
        const now = new Date();
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        
        watermark.innerHTML = `
            <div class="watermark-title">AI特征空间观测台 - 导出截图</div>
            <div class="watermark-item">导出时间: ${Utils.formatDate(now)}</div>
            <div class="watermark-item">楼层: ${this.filters.floor === 'all' ? '全部' : this.filters.floor + '层'}</div>
            <div class="watermark-item">设备类型: ${this.filters.deviceType === 'all' ? '全部' : Utils.getDeviceTypeName(this.filters.deviceType)}</div>
            <div class="watermark-item">异常等级: ${this.filters.anomalyLevel === 'all' ? '全部' : Utils.getLevelName(this.filters.anomalyLevel)}</div>
            <div class="watermark-item">视图: ${this.is3DView ? '3D' : '2D'}</div>
            <div class="watermark-stats">
                <div class="watermark-item">设备总数: ${devices.length} | 异常总数: ${anomalies.length}</div>
                <div class="watermark-item">严重: ${anomalies.filter(a => a.level === 'critical').length} | 警告: ${anomalies.filter(a => a.level === 'warning').length} | 提示: ${anomalies.filter(a => a.level === 'info').length}</div>
            </div>
        `;
        watermark.classList.remove('hidden');
        
        const mapContainer = document.getElementById('mapContainer');
        
        html2canvas(mapContainer, {
            backgroundColor: '#0f172a',
            scale: 2,
            useCORS: true
        }).then(canvas => {
            watermark.classList.add('hidden');
            
            const link = document.createElement('a');
            link.download = `AI观测台_${Utils.formatDateShort(now)}_${now.getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(() => {
            watermark.classList.add('hidden');
            alert('截图导出失败，请重试');
        });
    }
    
    openReportModal() {
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        const now = new Date();
        
        const criticalCount = anomalies.filter(a => a.level === 'critical').length;
        const warningCount = anomalies.filter(a => a.level === 'warning').length;
        const infoCount = anomalies.filter(a => a.level === 'info').length;
        
        const unresolvedConflicts = DATA_CONFLICTS.filter(c => !this.resolvedConflicts.includes(c.id));
        
        let reportHtml = `
            <div class="report-section">
                <h4>报告概览</h4>
                <div class="report-stats">
                    <div class="report-stat-card">
                        <div class="report-stat-value total">${devices.length}</div>
                        <div class="report-stat-label">设备总数</div>
                    </div>
                    <div class="report-stat-card">
                        <div class="report-stat-value critical">${criticalCount}</div>
                        <div class="report-stat-label">严重异常</div>
                    </div>
                    <div class="report-stat-card">
                        <div class="report-stat-value warning">${warningCount}</div>
                        <div class="report-stat-label">警告异常</div>
                    </div>
                    <div class="report-stat-card">
                        <div class="report-stat-value info">${infoCount}</div>
                        <div class="report-stat-label">提示异常</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h4>当前筛选条件</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>筛选项</th>
                            <th>值</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>楼层</td><td>${this.filters.floor === 'all' ? '全部楼层' : this.filters.floor + '层'}</td></tr>
                        <tr><td>设备类型</td><td>${this.filters.deviceType === 'all' ? '全部类型' : Utils.getDeviceTypeName(this.filters.deviceType)}</td></tr>
                        <tr><td>异常等级</td><td>${this.filters.anomalyLevel === 'all' ? '全部等级' : Utils.getLevelName(this.filters.anomalyLevel)}</td></tr>
                        <tr><td>视图模式</td><td>${this.is3DView ? '3D视图' : '2D视图'}</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h4>异常明细 (共${anomalies.length}条)</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>异常标题</th>
                            <th>等级</th>
                            <th>类型</th>
                            <th>楼层</th>
                            <th>描述</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${anomalies.map((a, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${a.title}</td>
                                <td style="color: ${Utils.getLevelColor(a.level)}">${Utils.getLevelName(a.level)}</td>
                                <td>${a.type}</td>
                                <td>${a.floor}层${a.targetFloor ? ' → ' + a.targetFloor + '层' : ''}</td>
                                <td>${a.description}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h4>设备明细 (共${devices.length}台)</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>设备名称</th>
                            <th>类型</th>
                            <th>楼层</th>
                            <th>状态</th>
                            <th>照片</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${devices.map((d, i) => {
                            const hasAnomaly = ANOMALIES.some(a => a.deviceId === d.id || a.gisDeviceId === d.id);
                            return `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${d.name}</td>
                                    <td>${Utils.getDeviceTypeName(d.type)}</td>
                                    <td>${d.floor}层</td>
                                    <td style="color: ${d.status === 'offline' ? '#ef4444' : d.status === 'warning' ? '#fbbf24' : '#10b981'}">${Utils.getStatusName(d.status)}</td>
                                    <td style="color: ${d.hasPhoto ? '#10b981' : '#ef4444'}">${d.hasPhoto ? '已上传' : '缺失'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            ${unresolvedConflicts.length > 0 ? `
            <div class="report-section">
                <h4>未解决的数据冲突 (共${unresolvedConflicts.length}条)</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>冲突标题</th>
                            <th>类型</th>
                            <th>描述</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${unresolvedConflicts.map((c, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${c.title}</td>
                                <td>${c.type}</td>
                                <td>${c.description}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${this.notes.length > 0 ? `
            <div class="report-section">
                <h4>备注记录 (共${this.notes.length}条)</h4>
                ${this.notes.slice(0, 5).map(n => `
                    <div class="report-note">
                        <div class="report-note-time">${Utils.formatDate(n.timestamp)}</div>
                        <div>${n.text}</div>
                        <div style="font-size:11px;color:#888;margin-top:4px;">
                            筛选: 楼层${n.filters.floor === 'all' ? '全部' : n.filters.floor + '层'} | 
                            设备: ${n.snapshot.deviceCount}台 | 
                            异常: ${n.snapshot.anomalyCount}条
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <div class="report-footer">
                报告生成时间: ${Utils.formatDate(now)} | AI特征空间观测台 v1.0
            </div>
        `;
        
        document.getElementById('reportContent').innerHTML = reportHtml;
        document.getElementById('reportModal').classList.remove('hidden');
    }
    
    downloadReportHtml() {
        const devices = this.getFilteredDevices();
        const anomalies = this.getFilteredAnomalies();
        const now = new Date();
        
        const criticalCount = anomalies.filter(a => a.level === 'critical').length;
        const warningCount = anomalies.filter(a => a.level === 'warning').length;
        const infoCount = anomalies.filter(a => a.level === 'info').length;
        
        const unresolvedConflicts = DATA_CONFLICTS.filter(c => !this.resolvedConflicts.includes(c.id));
        
        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>AI特征空间观测台 - 分析报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 40px; }
        .report-header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #0ea5e9; }
        .report-header h1 { color: #0ea5e9; margin: 0 0 10px 0; }
        .report-section { margin-bottom: 30px; }
        .report-section h2 { color: #0ea5e9; font-size: 18px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
        .report-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
        .report-stat-card { background: white; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .report-stat-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
        .report-stat-value.critical { color: #ef4444; }
        .report-stat-value.warning { color: #f59e0b; }
        .report-stat-value.info { color: #3b82f6; }
        .report-stat-value.total { color: #10b981; }
        .report-stat-label { font-size: 13px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        th { background: #f1f5f9; color: #0ea5e9; font-weight: 600; }
        .report-note { background: #f5f3ff; border-left: 3px solid #8b5cf6; padding: 12px 16px; border-radius: 4px; margin-bottom: 10px; }
        .report-note-time { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .report-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    </style>
</head>
<body>
    <div class="report-header">
        <h1>AI特征空间观测台 - 分析报告</h1>
        <div>生成时间: ${Utils.formatDate(now)}</div>
    </div>
    
    <div class="report-section">
        <h2>报告概览</h2>
        <div class="report-stats">
            <div class="report-stat-card">
                <div class="report-stat-value total">${devices.length}</div>
                <div class="report-stat-label">设备总数</div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-value critical">${criticalCount}</div>
                <div class="report-stat-label">严重异常</div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-value warning">${warningCount}</div>
                <div class="report-stat-label">警告异常</div>
            </div>
            <div class="report-stat-card">
                <div class="report-stat-value info">${infoCount}</div>
                <div class="report-stat-label">提示异常</div>
            </div>
        </div>
    </div>
    
    <div class="report-section">
        <h2>当前筛选条件</h2>
        <table>
            <thead><tr><th>筛选项</th><th>值</th></tr></thead>
            <tbody>
                <tr><td>楼层</td><td>${this.filters.floor === 'all' ? '全部楼层' : this.filters.floor + '层'}</td></tr>
                <tr><td>设备类型</td><td>${this.filters.deviceType === 'all' ? '全部类型' : Utils.getDeviceTypeName(this.filters.deviceType)}</td></tr>
                <tr><td>异常等级</td><td>${this.filters.anomalyLevel === 'all' ? '全部等级' : Utils.getLevelName(this.filters.anomalyLevel)}</td></tr>
                <tr><td>视图模式</td><td>${this.is3DView ? '3D视图' : '2D视图'}</td></tr>
            </tbody>
        </table>
    </div>
    
    <div class="report-section">
        <h2>异常明细 (共${anomalies.length}条)</h2>
        <table>
            <thead>
                <tr><th>序号</th><th>异常标题</th><th>等级</th><th>类型</th><th>楼层</th><th>描述</th></tr>
            </thead>
            <tbody>
                ${anomalies.map((a, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${a.title}</td>
                        <td>${Utils.getLevelName(a.level)}</td>
                        <td>${a.type}</td>
                        <td>${a.floor}层${a.targetFloor ? ' → ' + a.targetFloor + '层' : ''}</td>
                        <td>${a.description}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="report-section">
        <h2>设备明细 (共${devices.length}台)</h2>
        <table>
            <thead>
                <tr><th>序号</th><th>设备名称</th><th>类型</th><th>楼层</th><th>状态</th><th>照片</th></tr>
            </thead>
            <tbody>
                ${devices.map((d, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${d.name}</td>
                        <td>${Utils.getDeviceTypeName(d.type)}</td>
                        <td>${d.floor}层</td>
                        <td>${Utils.getStatusName(d.status)}</td>
                        <td>${d.hasPhoto ? '已上传' : '缺失'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    ${unresolvedConflicts.length > 0 ? `
    <div class="report-section">
        <h2>未解决的数据冲突 (共${unresolvedConflicts.length}条)</h2>
        <table>
            <thead>
                <tr><th>序号</th><th>冲突标题</th><th>类型</th><th>描述</th></tr>
            </thead>
            <tbody>
                ${unresolvedConflicts.map((c, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${c.title}</td>
                        <td>${c.type}</td>
                        <td>${c.description}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}
    
    <div class="report-footer">
        AI特征空间观测台 v1.0 | 本报告由系统自动生成
    </div>
</body>
</html>
        `;
        
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `AI观测台报告_${Utils.formatDateShort(now)}_${now.getTime()}.html`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    downloadReportCsv() {
        const anomalies = this.getFilteredAnomalies();
        const devices = this.getFilteredDevices();
        const now = new Date();
        
        const csvContent = [
            ['AI特征空间观测台 - 异常明细导出'],
            ['导出时间', Utils.formatDate(now)],
            ['楼层', this.filters.floor === 'all' ? '全部楼层' : this.filters.floor + '层'],
            ['设备类型', this.filters.deviceType === 'all' ? '全部类型' : Utils.getDeviceTypeName(this.filters.deviceType)],
            ['异常等级', this.filters.anomalyLevel === 'all' ? '全部等级' : Utils.getLevelName(this.filters.anomalyLevel)],
            [''],
            ['序号', '异常标题', '等级', '类型', '楼层', '目标楼层', '描述', '关联设备'],
            ...anomalies.map((a, i) => [
                i + 1,
                a.title,
                Utils.getLevelName(a.level),
                a.type,
                a.floor + '层',
                a.targetFloor ? a.targetFloor + '层' : '-',
                a.description,
                IMPORT_DATA.devices.find(d => d.id === a.deviceId)?.name || GIS_DATA.devices.find(d => d.id === a.gisDeviceId)?.name || '-'
            ]),
            [''],
            ['设备统计'],
            ['设备总数', devices.length],
            ['在线', devices.filter(d => d.status === 'online').length],
            ['离线', devices.filter(d => d.status === 'offline').length],
            ['警告', devices.filter(d => d.status === 'warning').length],
            ['缺照片', devices.filter(d => !d.hasPhoto).length],
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `AI观测台_异常明细_${Utils.formatDateShort(now)}_${now.getTime()}.csv`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.observatory = new AI_Observatory();
});
