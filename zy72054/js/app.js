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
        
        document.getElementById('addNoteBtn').addEventListener('click', () => this.addNote());
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        document.getElementById('cancelPlanBtn').addEventListener('click', () => this.closeModals());
        document.getElementById('confirmSavePlan').addEventListener('click', () => this.savePlan());
        
        document.getElementById('keepGISBtn').addEventListener('click', () => this.resolveConflict('gis'));
        document.getElementById('keepImportBtn').addEventListener('click', () => this.resolveConflict('import'));
        document.getElementById('mergeBtn').addEventListener('click', () => this.resolveConflict('merge'));
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
        
        const filtersState = Utils.deepClone(this.filters);
        
        const note = {
            id: Utils.generateId(),
            text,
            timestamp: Date.now(),
            filters: filtersState,
            selectedDevice: this.selectedDevice ? this.selectedDevice.id : null
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
            const hasDiff = this.hasFilterDiff(note.filters);
            
            return `
                <div class="note-item" data-id="${note.id}">
                    <div class="note-time">${Utils.formatDate(note.timestamp)}</div>
                    <div>${note.text}</div>
                    ${hasDiff ? `<div class="note-diff">筛选条件有变更</div>` : ''}
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const note = this.notes.find(n => n.id === id);
                if (note) {
                    this.restoreNoteFilters(note);
                }
            });
        });
    }
    
    hasFilterDiff(savedFilters) {
        return Object.keys(savedFilters).some(key => savedFilters[key] !== this.filters[key]);
    }
    
    restoreNoteFilters(note) {
        this.filters = Utils.deepClone(note.filters);
        
        document.getElementById('floorFilter').value = this.filters.floor;
        document.getElementById('deviceTypeFilter').value = this.filters.deviceType;
        document.getElementById('anomalyLevelFilter').value = this.filters.anomalyLevel;
        
        if (note.selectedDevice) {
            const device = IMPORT_DATA.devices.find(d => d.id === note.selectedDevice) ||
                          GIS_DATA.devices.find(d => d.id === note.selectedDevice);
            if (device) {
                this.selectedDevice = device;
                this.updateSelectedDeviceInfo();
            }
        }
        
        this.updateFilters();
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
        
        watermark.innerHTML = `
            <div class="watermark-title">AI特征空间观测台 - 导出截图</div>
            <div class="watermark-item">导出时间: ${Utils.formatDate(now)}</div>
            <div class="watermark-item">楼层: ${this.filters.floor === 'all' ? '全部' : this.filters.floor + '层'}</div>
            <div class="watermark-item">设备类型: ${this.filters.deviceType === 'all' ? '全部' : Utils.getDeviceTypeName(this.filters.deviceType)}</div>
            <div class="watermark-item">异常等级: ${this.filters.anomalyLevel === 'all' ? '全部' : Utils.getLevelName(this.filters.anomalyLevel)}</div>
            <div class="watermark-item">视图: ${this.is3DView ? '3D' : '2D'}</div>
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.observatory = new AI_Observatory();
});
