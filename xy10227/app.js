class TheaterSeatAnalyzer {
    constructor() {
        this.canvas = document.getElementById('theater-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.svgOverlay = document.getElementById('svg-overlay');
        
        this.state = {
            theater: {
                rows: 10,
                seatsPerRow: 15,
                rowSpacing: 80,
                seatHeight: 45,
                eyeHeight: 120,
            },
            devices: [],
            ticketTiers: [
                { id: 'vip', name: 'VIP', price: 888, rows: [1, 2, 3], color: '#f6ad55' },
                { id: 'standard', name: '标准', price: 388, rows: [4, 5, 6, 7], color: '#68d391' },
                { id: 'economy', name: '经济', price: 188, rows: [8, 9, 10], color: '#90cdf4' }
            ],
            seats: [],
            stats: {
                total: 0,
                available: 0,
                partial: 0,
                blocked: 0,
                impactPercent: 0
            },
            lastConfigHash: null,
            deviceCounter: 0
        };
        
        this.dragging = null;
        this.dragOffset = { x: 0, y: 0 };
        
        this.tierChart = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.initializeSeats();
        this.setupEventListeners();
        this.renderTicketTiers();
        this.updateAll();
    }
    
    setupCanvas() {
        const resize = () => {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.svgOverlay.setAttribute('width', rect.width);
            this.svgOverlay.setAttribute('height', rect.height);
            
            this.render();
        };
        
        resize();
        window.addEventListener('resize', resize);
    }
    
    initializeSeats() {
        const { rows, seatsPerRow } = this.state.theater;
        this.state.seats = [];
        
        for (let row = 1; row <= rows; row++) {
            for (let seat = 1; seat <= seatsPerRow; seat++) {
                const tier = this.getTicketTierForRow(row);
                this.state.seats.push({
                    row,
                    seat,
                    tier: tier ? tier.id : 'economy',
                    status: 'available',
                    blockingDevices: [],
                    obstructionPercent: 0
                });
            }
        }
        
        this.state.stats.total = this.state.seats.length;
    }
    
    getTicketTierForRow(row) {
        return this.state.ticketTiers.find(tier => tier.rows.includes(row));
    }
    
    setupEventListeners() {
        document.getElementById('btn-apply-theater').addEventListener('click', () => this.applyTheaterSettings());
        document.getElementById('btn-add-camera').addEventListener('click', () => this.addDevice('camera'));
        document.getElementById('btn-add-speaker').addEventListener('click', () => this.addDevice('speaker'));
        document.getElementById('btn-reset').addEventListener('click', () => this.resetScene());
        document.getElementById('btn-help').addEventListener('click', () => this.showHelp());
        document.getElementById('btn-export-json').addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-export-report').addEventListener('click', () => this.generateReport());
        document.getElementById('btn-print-report').addEventListener('click', () => window.print());
        document.getElementById('btn-close-report').addEventListener('click', () => this.closeReport());
        
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
        
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    }
    
    applyTheaterSettings() {
        const rows = parseInt(document.getElementById('rows').value) || 10;
        const seatsPerRow = parseInt(document.getElementById('seats-per-row').value) || 15;
        const rowSpacing = parseInt(document.getElementById('row-spacing').value) || 80;
        const seatHeight = parseInt(document.getElementById('seat-height').value) || 45;
        
        if (rows < 3 || rows > 20) {
            this.showStatus('座位排数必须在 3-20 之间', 'error');
            return;
        }
        
        if (seatsPerRow < 5 || seatsPerRow > 30) {
            this.showStatus('每排座位数必须在 5-30 之间', 'error');
            return;
        }
        
        if (rowSpacing < 50 || rowSpacing > 150) {
            this.showStatus('排距必须在 50-150 cm 之间', 'error');
            return;
        }
        
        if (seatHeight < 30 || seatHeight > 60) {
            this.showStatus('座位高度必须在 30-60 cm 之间', 'error');
            return;
        }
        
        this.state.theater = {
            ...this.state.theater,
            rows,
            seatsPerRow,
            rowSpacing,
            seatHeight
        };
        
        this.state.ticketTiers[0].rows = Array.from({ length: Math.ceil(rows * 0.3) }, (_, i) => i + 1);
        this.state.ticketTiers[1].rows = Array.from({ length: Math.ceil(rows * 0.4) }, (_, i) => Math.ceil(rows * 0.3) + 1 + i);
        this.state.ticketTiers[2].rows = Array.from({ length: rows - Math.ceil(rows * 0.7) }, (_, i) => Math.ceil(rows * 0.7) + 1 + i);
        
        this.initializeSeats();
        this.renderTicketTiers();
        this.updateAll();
        this.showStatus('剧场设置已更新', 'success');
    }
    
    addDevice(type) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        const device = {
            id: `device-${++this.state.deviceCounter}`,
            type,
            name: type === 'camera' ? `摄像机 ${this.state.deviceCounter}` : `音箱 ${this.state.deviceCounter}`,
            x: width / 2 + (Math.random() - 0.5) * 200,
            y: height * 0.3 + (Math.random() - 0.5) * 100,
            width: type === 'camera' ? 60 : 50,
            height: type === 'camera' ? 80 : 70,
            physicalHeight: type === 'camera' ? 180 : 150,
            physicalWidth: type === 'camera' ? 40 : 35
        };
        
        if (this.checkDeviceConflict(device)) {
            this.showStatus('设备位置与现有设备冲突，请调整位置', 'warning');
        }
        
        this.state.devices.push(device);
        this.renderDeviceList();
        this.updateAll();
        this.showStatus(`已添加${type === 'camera' ? '摄像机' : '音箱'}`, 'success');
    }
    
    checkDeviceConflict(newDevice) {
        const conflict = this.state.devices.some(device => {
            if (device.id === newDevice.id) return false;
            
            const dx = Math.abs(device.x - newDevice.x);
            const dy = Math.abs(device.y - newDevice.y);
            const minDistance = Math.max(device.width, newDevice.width) * 0.5;
            
            return dx < minDistance && dy < minDistance;
        });
        
        return conflict;
    }
    
    deleteDevice(deviceId) {
        const index = this.state.devices.findIndex(d => d.id === deviceId);
        if (index > -1) {
            this.state.devices.splice(index, 1);
            this.renderDeviceList();
            this.updateAll();
            this.showStatus('设备已删除', 'success');
        }
    }
    
    updateDeviceFromInput(deviceId, field, value) {
        const device = this.state.devices.find(d => d.id === deviceId);
        if (device) {
            if (field === 'x' || field === 'y' || field === 'physicalHeight') {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    device[field] = numValue;
                    this.updateAll();
                }
            }
        }
    }
    
    renderDeviceList() {
        const list = document.getElementById('device-list');
        list.innerHTML = '';
        
        this.state.devices.forEach(device => {
            const item = document.createElement('div');
            item.className = 'device-item';
            item.innerHTML = `
                <div class="device-item-header">
                    <span class="device-item-name">
                        ${device.type === 'camera' ? '📷' : '🔊'} ${device.name}
                    </span>
                    <button class="device-item-delete" data-id="${device.id}" title="删除">×</button>
                </div>
                <div class="device-item-details">
                    <div class="form-group">
                        <label>X 位置</label>
                        <input type="number" value="${Math.round(device.x)}" data-id="${device.id}" data-field="x">
                    </div>
                    <div class="form-group">
                        <label>Y 位置</label>
                        <input type="number" value="${Math.round(device.y)}" data-id="${device.id}" data-field="y">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>设备高度 (cm)</label>
                        <input type="number" value="${device.physicalHeight}" data-id="${device.id}" data-field="physicalHeight">
                    </div>
                </div>
            `;
            
            list.appendChild(item);
        });
        
        list.querySelectorAll('.device-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteDevice(e.target.dataset.id));
        });
        
        list.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.updateDeviceFromInput(e.target.dataset.id, e.target.dataset.field, e.target.value);
            });
        });
    }
    
    renderTicketTiers() {
        const container = document.getElementById('ticket-tiers');
        container.innerHTML = '';
        
        this.state.ticketTiers.forEach(tier => {
            const item = document.createElement('div');
            item.className = `ticket-tier ${tier.id}`;
            item.innerHTML = `
                <div class="ticket-tier-header">
                    <span class="ticket-tier-name">${tier.name}</span>
                    <span class="ticket-tier-price">¥${tier.price}</span>
                </div>
                <div class="ticket-tier-inputs">
                    <div class="form-group">
                        <label>起始排</label>
                        <input type="number" value="${tier.rows[0]}" data-id="${tier.id}" data-field="startRow" min="1" max="${this.state.theater.rows}">
                    </div>
                    <div class="form-group">
                        <label>结束排</label>
                        <input type="number" value="${tier.rows[tier.rows.length - 1]}" data-id="${tier.id}" data-field="endRow" min="1" max="${this.state.theater.rows}">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>票价 (¥)</label>
                        <input type="number" value="${tier.price}" data-id="${tier.id}" data-field="price" min="0">
                    </div>
                </div>
            `;
            
            container.appendChild(item);
        });
        
        container.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.updateTicketTier(e.target.dataset.id, e.target.dataset.field, e.target.value);
            });
        });
    }
    
    updateTicketTier(tierId, field, value) {
        const tier = this.state.ticketTiers.find(t => t.id === tierId);
        if (!tier) return;
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        
        if (field === 'price') {
            tier.price = numValue;
        } else if (field === 'startRow') {
            const endRow = tier.rows[tier.rows.length - 1];
            if (numValue <= endRow) {
                tier.rows = Array.from({ length: endRow - numValue + 1 }, (_, i) => numValue + i);
            }
        } else if (field === 'endRow') {
            const startRow = tier.rows[0];
            if (numValue >= startRow) {
                tier.rows = Array.from({ length: numValue - startRow + 1 }, (_, i) => startRow + i);
            }
        }
        
        this.state.seats.forEach(seat => {
            const t = this.getTicketTierForRow(seat.row);
            seat.tier = t ? t.id : 'economy';
        });
        
        this.updateAll();
    }
    
    calculateLineOfSight() {
        const { theater, devices, seats } = this.state;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const stageX = canvasWidth / 2;
        const stageY = 0;
        
        seats.forEach(seat => {
            const seatPos = this.getSeatPosition(seat.row, seat.seat);
            const eyeX = seatPos.x;
            const eyeY = seatPos.y;
            
            let totalObstruction = 0;
            let blockingDevices = [];
            
            devices.forEach(device => {
                const deviceCenterX = device.x;
                const deviceCenterY = device.y;
                const deviceHalfWidth = device.width / 2;
                const deviceHalfHeight = device.height / 2;
                
                const deviceLeft = deviceCenterX - deviceHalfWidth;
                const deviceRight = deviceCenterX + deviceHalfWidth;
                const deviceTop = deviceCenterY - deviceHalfHeight;
                const deviceBottom = deviceCenterY + deviceHalfHeight;
                
                const lineStart = { x: eyeX, y: eyeY };
                const lineEnd = { x: stageX, y: stageY };
                
                const intersections = this.lineRectIntersection(
                    lineStart, lineEnd,
                    deviceLeft, deviceTop, deviceRight, deviceBottom
                );
                
                if (intersections.length > 0) {
                    const lineLength = Math.sqrt(
                        Math.pow(lineEnd.x - lineStart.x, 2) + 
                        Math.pow(lineEnd.y - lineStart.y, 2)
                    );
                    
                    let totalIntersectionLength = 0;
                    for (let i = 0; i < intersections.length; i += 2) {
                        if (i + 1 < intersections.length) {
                            const segLength = Math.sqrt(
                                Math.pow(intersections[i + 1].x - intersections[i].x, 2) +
                                Math.pow(intersections[i + 1].y - intersections[i].y, 2)
                            );
                            totalIntersectionLength += segLength;
                        }
                    }
                    
                    const obstructionPercent = Math.min(1, totalIntersectionLength / lineLength) * 100;
                    
                    if (obstructionPercent > 5) {
                        totalObstruction += obstructionPercent;
                        blockingDevices.push(device.id);
                    }
                }
            });
            
            seat.obstructionPercent = Math.min(100, totalObstruction);
            seat.blockingDevices = blockingDevices;
            
            if (seat.obstructionPercent >= 50) {
                seat.status = 'blocked';
            } else if (seat.obstructionPercent >= 15) {
                seat.status = 'partial';
            } else {
                seat.status = 'available';
            }
        });
    }
    
    getSeatPosition(row, seatNum) {
        const { rows, seatsPerRow } = this.state.theater;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        const marginX = 60;
        const marginY = 80;
        
        const gridWidth = width - marginX * 2;
        const gridHeight = height - marginY * 2;
        
        const seatWidth = gridWidth / seatsPerRow;
        const seatHeight = gridHeight / rows;
        
        const x = marginX + (seatNum - 0.5) * seatWidth;
        const y = marginY + (row - 0.5) * seatHeight;
        
        return { x, y, width: seatWidth * 0.8, height: seatHeight * 0.8 };
    }
    
    lineRectIntersection(lineStart, lineEnd, rectLeft, rectTop, rectRight, rectBottom) {
        const intersections = [];
        
        const topIntersection = this.lineLineIntersection(
            lineStart, lineEnd,
            { x: rectLeft, y: rectTop }, { x: rectRight, y: rectTop }
        );
        if (topIntersection) intersections.push(topIntersection);
        
        const bottomIntersection = this.lineLineIntersection(
            lineStart, lineEnd,
            { x: rectLeft, y: rectBottom }, { x: rectRight, y: rectBottom }
        );
        if (bottomIntersection) intersections.push(bottomIntersection);
        
        const leftIntersection = this.lineLineIntersection(
            lineStart, lineEnd,
            { x: rectLeft, y: rectTop }, { x: rectLeft, y: rectBottom }
        );
        if (leftIntersection) intersections.push(leftIntersection);
        
        const rightIntersection = this.lineLineIntersection(
            lineStart, lineEnd,
            { x: rectRight, y: rectTop }, { x: rectRight, y: rectBottom }
        );
        if (rightIntersection) intersections.push(rightIntersection);
        
        return intersections;
    }
    
    lineLineIntersection(p1, p2, p3, p4) {
        const denominator = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
        if (denominator === 0) return null;
        
        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;
        
        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return {
                x: p1.x + ua * (p2.x - p1.x),
                y: p1.y + ua * (p2.y - p1.y)
            };
        }
        
        return null;
    }
    
    updateStats() {
        const { seats } = this.state;
        
        const available = seats.filter(s => s.status === 'available').length;
        const partial = seats.filter(s => s.status === 'partial').length;
        const blocked = seats.filter(s => s.status === 'blocked').length;
        
        this.state.stats = {
            total: seats.length,
            available,
            partial,
            blocked,
            impactPercent: seats.length > 0 ? Math.round((blocked + partial * 0.5) / seats.length * 100) : 0
        };
        
        document.getElementById('stat-total').textContent = this.state.stats.total;
        document.getElementById('stat-available').textContent = this.state.stats.available;
        document.getElementById('stat-partial').textContent = this.state.stats.partial;
        document.getElementById('stat-blocked').textContent = this.state.stats.blocked;
        document.getElementById('stat-impact-percent').textContent = `${this.state.stats.impactPercent}%`;
        document.getElementById('stat-cameras').textContent = this.state.devices.filter(d => d.type === 'camera').length;
        document.getElementById('stat-speakers').textContent = this.state.devices.filter(d => d.type === 'speaker').length;
        
        this.updateTierChart();
    }
    
    updateTierChart() {
        const ctx = document.getElementById('tier-chart');
        
        const tierData = this.state.ticketTiers.map(tier => {
            const tierSeats = this.state.seats.filter(s => s.tier === tier.id);
            const blocked = tierSeats.filter(s => s.status === 'blocked').length;
            const partial = tierSeats.filter(s => s.status === 'partial').length;
            const available = tierSeats.filter(s => s.status === 'available').length;
            
            const revenueLoss = (blocked * tier.price) + (partial * tier.price * 0.5);
            const totalRevenue = tierSeats.length * tier.price;
            
            return {
                name: tier.name,
                color: tier.color,
                available,
                partial,
                blocked,
                revenueLoss,
                totalRevenue
            };
        });
        
        if (this.tierChart) {
            this.tierChart.destroy();
        }
        
        this.tierChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: tierData.map(t => t.name),
                datasets: [
                    {
                        label: '可用',
                        data: tierData.map(t => t.available),
                        backgroundColor: '#68d391'
                    },
                    {
                        label: '部分遮挡',
                        data: tierData.map(t => t.partial),
                        backgroundColor: '#f6ad55'
                    },
                    {
                        label: '完全遮挡',
                        data: tierData.map(t => t.blocked),
                        backgroundColor: '#fc8181'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    render() {
        const { ctx, canvas, state } = this;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, width, height);
        
        this.renderSeats();
        this.renderLinesOfSight();
        this.renderDevices();
    }
    
    renderSeats() {
        const { ctx, state } = this;
        const { seats } = state;
        
        seats.forEach(seat => {
            const pos = this.getSeatPosition(seat.row, seat.seat);
            
            let color;
            switch (seat.status) {
                case 'blocked':
                    color = '#fc8181';
                    break;
                case 'partial':
                    color = '#f6ad55';
                    break;
                default:
                    color = '#68d391';
            }
            
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            
            const cornerRadius = 4;
            ctx.beginPath();
            ctx.roundRect(pos.x - pos.width / 2, pos.y - pos.height / 2, pos.width, pos.height, cornerRadius);
            ctx.fill();
            ctx.stroke();
            
            if (seat.status !== 'available') {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.font = `${Math.min(pos.width, pos.height) * 0.5}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(seat.status === 'blocked' ? '×' : '!', pos.x, pos.y);
            }
        });
    }
    
    renderLinesOfSight() {
        const { ctx, state } = this;
        const width = this.canvas.width;
        
        const stageX = width / 2;
        const stageY = 0;
        
        state.seats.forEach(seat => {
            if (seat.status === 'available' || seat.blockingDevices.length === 0) return;
            
            const pos = this.getSeatPosition(seat.row, seat.seat);
            
            ctx.strokeStyle = seat.status === 'blocked' ? 'rgba(252, 129, 129, 0.3)' : 'rgba(246, 173, 85, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(stageX, stageY);
            ctx.stroke();
        });
    }
    
    renderDevices() {
        const { ctx, state } = this;
        
        state.devices.forEach(device => {
            const x = device.x;
            const y = device.y;
            const w = device.width;
            const h = device.height;
            
            ctx.fillStyle = device.type === 'camera' ? '#667eea' : '#9f7aea';
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = 'white';
            ctx.font = `${Math.min(w, h) * 0.4}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(device.type === 'camera' ? '📷' : '🔊', x, y);
            
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.font = '10px Arial';
            ctx.fillText(device.name, x, y + h / 2 + 12);
        });
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        for (let i = this.state.devices.length - 1; i >= 0; i--) {
            const device = this.state.devices[i];
            const dx = Math.abs(x - device.x);
            const dy = Math.abs(y - device.y);
            
            if (dx <= device.width / 2 && dy <= device.height / 2) {
                this.dragging = device;
                this.dragOffset = {
                    x: x - device.x,
                    y: y - device.y
                };
                this.canvas.style.cursor = 'grabbing';
                break;
            }
        }
    }
    
    handleMouseMove(e) {
        if (!this.dragging) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let hovering = false;
            for (let i = this.state.devices.length - 1; i >= 0; i--) {
                const device = this.state.devices[i];
                const dx = Math.abs(x - device.x);
                const dy = Math.abs(y - device.y);
                
                if (dx <= device.width / 2 && dy <= device.height / 2) {
                    hovering = true;
                    break;
                }
            }
            
            this.canvas.style.cursor = hovering ? 'grab' : 'default';
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.dragging.x = Math.max(this.dragging.width / 2, Math.min(this.canvas.width - this.dragging.width / 2, x - this.dragOffset.x));
        this.dragging.y = Math.max(this.dragging.height / 2, Math.min(this.canvas.height - this.dragging.height / 2, y - this.dragOffset.y));
        
        this.updateAll();
    }
    
    handleMouseUp(e) {
        if (this.dragging) {
            if (this.checkDeviceConflict(this.dragging)) {
                this.showStatus('设备位置与现有设备冲突', 'warning');
            }
            this.renderDeviceList();
            this.dragging = null;
            this.canvas.style.cursor = 'default';
        }
    }
    
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        for (let i = this.state.devices.length - 1; i >= 0; i--) {
            const device = this.state.devices[i];
            const dx = Math.abs(x - device.x);
            const dy = Math.abs(y - device.y);
            
            if (dx <= device.width / 2 && dy <= device.height / 2) {
                this.deleteDevice(device.id);
                break;
            }
        }
    }
    
    updateAll() {
        const currentHash = this.getConfigHash();
        
        if (currentHash === this.state.lastConfigHash && this.state.seats.length > 0) {
            this.render();
            this.updateStats();
            return;
        }
        
        this.calculateLineOfSight();
        this.render();
        this.updateStats();
        this.state.lastConfigHash = currentHash;
    }
    
    getConfigHash() {
        const config = {
            theater: this.state.theater,
            devices: this.state.devices.map(d => ({
                id: d.id,
                x: Math.round(d.x),
                y: Math.round(d.y),
                width: d.width,
                height: d.height,
                physicalHeight: d.physicalHeight
            })),
            ticketTiers: this.state.ticketTiers
        };
        
        return JSON.stringify(config);
    }
    
    resetScene() {
        if (confirm('确定要重置所有设置吗？这将清除所有设备和配置。')) {
            this.state.theater = {
                rows: 10,
                seatsPerRow: 15,
                rowSpacing: 80,
                seatHeight: 45,
                eyeHeight: 120,
            };
            this.state.devices = [];
            this.state.ticketTiers = [
                { id: 'vip', name: 'VIP', price: 888, rows: [1, 2, 3], color: '#f6ad55' },
                { id: 'standard', name: '标准', price: 388, rows: [4, 5, 6, 7], color: '#68d391' },
                { id: 'economy', name: '经济', price: 188, rows: [8, 9, 10], color: '#90cdf4' }
            ];
            this.state.lastConfigHash = null;
            
            document.getElementById('rows').value = 10;
            document.getElementById('seats-per-row').value = 15;
            document.getElementById('row-spacing').value = 80;
            document.getElementById('seat-height').value = 45;
            
            this.initializeSeats();
            this.renderDeviceList();
            this.renderTicketTiers();
            this.updateAll();
            this.showStatus('场景已重置', 'success');
        }
    }
    
    showHelp() {
        document.getElementById('help-modal').classList.remove('hidden');
    }
    
    closeReport() {
        document.getElementById('report-modal').classList.add('hidden');
    }
    
    exportJSON() {
        const exportData = {
            theater: this.state.theater,
            devices: this.state.devices,
            ticketTiers: this.state.ticketTiers,
            seats: this.state.seats,
            stats: this.state.stats,
            exportTime: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `theater-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showStatus('JSON 数据已导出', 'success');
    }
    
    generateReport() {
        const { state } = this;
        
        const tierAnalysis = state.ticketTiers.map(tier => {
            const tierSeats = state.seats.filter(s => s.tier === tier.id);
            const blocked = tierSeats.filter(s => s.status === 'blocked').length;
            const partial = tierSeats.filter(s => s.status === 'partial').length;
            const available = tierSeats.filter(s => s.status === 'available').length;
            
            const revenueLoss = (blocked * tier.price) + (partial * tier.price * 0.5);
            const totalRevenue = tierSeats.length * tier.price;
            const lossPercent = totalRevenue > 0 ? Math.round(revenueLoss / totalRevenue * 100) : 0;
            
            return {
                ...tier,
                total: tierSeats.length,
                available,
                partial,
                blocked,
                revenueLoss,
                totalRevenue,
                lossPercent
            };
        });
        
        const blockedSeats = state.seats.filter(s => s.status === 'blocked').map(s => `${s.row}排${s.seat}座`);
        const partialSeats = state.seats.filter(s => s.status === 'partial').map(s => `${s.row}排${s.seat}座`);
        
        const reportHTML = `
            <div class="report-section">
                <h3>📊 概览统计</h3>
                <div class="report-stat-grid">
                    <div class="report-stat-card">
                        <div class="report-stat-value">${state.stats.total}</div>
                        <div class="report-stat-label">总座位数</div>
                    </div>
                    <div class="report-stat-card">
                        <div class="report-stat-value">${state.stats.available}</div>
                        <div class="report-stat-label">可用座位</div>
                    </div>
                    <div class="report-stat-card">
                        <div class="report-stat-value partial">${state.stats.partial}</div>
                        <div class="report-stat-label">部分遮挡</div>
                    </div>
                    <div class="report-stat-card">
                        <div class="report-stat-value blocked">${state.stats.blocked}</div>
                        <div class="report-stat-label">完全遮挡</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h3>🎥 设备清单</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>设备名称</th>
                            <th>类型</th>
                            <th>X位置</th>
                            <th>Y位置</th>
                            <th>高度 (cm)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.devices.length === 0 ? 
                            '<tr><td colspan="5" style="text-align:center;color:#718096;">暂无设备</td></tr>' :
                            state.devices.map(d => `
                                <tr>
                                    <td>${d.name}</td>
                                    <td>${d.type === 'camera' ? '摄像机' : '音箱'}</td>
                                    <td>${Math.round(d.x)}</td>
                                    <td>${Math.round(d.y)}</td>
                                    <td>${d.physicalHeight}</td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h3>💰 票档影响分析</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>票档</th>
                            <th>票价</th>
                            <th>座位数</th>
                            <th>可用</th>
                            <th>部分遮挡</th>
                            <th>完全遮挡</th>
                            <th>预计损失</th>
                            <th>损失比例</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tierAnalysis.map(t => `
                            <tr>
                                <td>${t.name}</td>
                                <td>¥${t.price}</td>
                                <td>${t.total}</td>
                                <td>${t.available}</td>
                                <td>${t.partial}</td>
                                <td>${t.blocked}</td>
                                <td>¥${t.revenueLoss.toLocaleString()}</td>
                                <td>${t.lossPercent}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h3>⚠️ 受影响座位详情</h3>
                ${blockedSeats.length > 0 ? `
                    <p><strong>完全遮挡座位 (${blockedSeats.length}个):</strong> ${blockedSeats.slice(0, 50).join('、')}${blockedSeats.length > 50 ? '...' : ''}</p>
                ` : ''}
                ${partialSeats.length > 0 ? `
                    <p><strong>部分遮挡座位 (${partialSeats.length}个):</strong> ${partialSeats.slice(0, 50).join('、')}${partialSeats.length > 50 ? '...' : ''}</p>
                ` : ''}
                ${blockedSeats.length === 0 && partialSeats.length === 0 ? 
                    '<p style="color:#68d391;">🎉 所有座位视线正常，无遮挡！</p>' : ''}
            </div>
            
            <div class="report-section">
                <h3>📐 剧场参数</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>参数</th>
                            <th>值</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>座位排数</td><td>${state.theater.rows} 排</td></tr>
                        <tr><td>每排座位数</td><td>${state.theater.seatsPerRow} 个</td></tr>
                        <tr><td>排距</td><td>${state.theater.rowSpacing} cm</td></tr>
                        <tr><td>座位高度</td><td>${state.theater.seatHeight} cm</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="report-section" style="font-size:0.875rem;color:#718096;text-align:right;">
                报告生成时间: ${new Date().toLocaleString('zh-CN')}
            </div>
        `;
        
        document.getElementById('report-content').innerHTML = reportHTML;
        document.getElementById('report-modal').classList.remove('hidden');
    }
    
    showStatus(message, type = 'success') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        
        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TheaterSeatAnalyzer();
});
