class GameRenderer {
    constructor(canvas, gameMap) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameMap = gameMap;
        this.gridSize = gameMap.getGridSize();
        this.animationFrameId = null;
        this.lastTimestamp = 0;
        this.gameInstance = null;
        
        this._setupCanvas();
    }

    _setupCanvas() {
        const dimensions = this.gameMap.getDimensions();
        this.canvas.width = dimensions.width;
        this.canvas.height = dimensions.height;
    }

    setGameInstance(gameInstance) {
        this.gameInstance = gameInstance;
    }

    resize() {
        this._setupCanvas();
    }

    start() {
        this.lastTimestamp = performance.now();
        this._renderLoop();
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    _renderLoop(timestamp = performance.now()) {
        const deltaTime = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        
        this._clear();
        this._render(deltaTime);
        
        this.animationFrameId = requestAnimationFrame(t => this._renderLoop(t));
    }

    _clear() {
        this.ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _render(deltaTime) {
        this._renderGrid();
        this._renderMapElements();
        this._renderPaths();
        this._renderEvents();
        this._renderAEDLocations();
        this._renderPatient();
        this._renderResources();
    }

    _renderGrid() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.strokeStyle = CONFIG.COLORS.GRID;
        ctx.lineWidth = 1;
        
        for (let x = 0; x <= width; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= height; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    _renderMapElements() {
        const ctx = this.ctx;
        const mapConfig = this.gameMap.mapConfig;
        
        if (mapConfig.roads) {
            mapConfig.roads.forEach(road => {
                this._drawRoad(road);
            });
        }
        
        if (mapConfig.buildings) {
            mapConfig.buildings.forEach(building => {
                this._drawBuilding(building);
            });
        }
        
        if (mapConfig.parks) {
            mapConfig.parks.forEach(park => {
                this._drawPark(park);
            });
        }
        
        if (mapConfig.waters) {
            mapConfig.waters.forEach(water => {
                this._drawWater(water);
            });
        }
        
        if (mapConfig.entrances) {
            mapConfig.entrances.forEach(entrance => {
                this._drawEntrance(entrance);
            });
        }
    }

    _drawRoad(road) {
        const ctx = this.ctx;
        const x = road.x * this.gridSize;
        const y = road.y * this.gridSize;
        const width = road.width * this.gridSize;
        const height = road.height * this.gridSize;
        
        ctx.fillStyle = CONFIG.COLORS.ROAD;
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#9e9e9e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
    }

    _drawBuilding(building) {
        const ctx = this.ctx;
        const x = building.x * this.gridSize;
        const y = building.y * this.gridSize;
        const width = building.width * this.gridSize;
        const height = building.height * this.gridSize;
        
        ctx.fillStyle = CONFIG.COLORS.BUILDING;
        ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
        
        ctx.strokeStyle = '#78909c';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
        
        ctx.fillStyle = '#546e7a';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(building.name, x + width / 2, y + height / 2);
    }

    _drawPark(park) {
        const ctx = this.ctx;
        const x = park.x * this.gridSize;
        const y = park.y * this.gridSize;
        const width = park.width * this.gridSize;
        const height = park.height * this.gridSize;
        
        ctx.fillStyle = CONFIG.COLORS.PARK;
        ctx.fillRect(x, y, width, height);
        
        ctx.fillStyle = '#81c784';
        for (let i = 0; i < 5; i++) {
            const treeX = x + Math.random() * (width - 10) + 5;
            const treeY = y + Math.random() * (height - 10) + 5;
            ctx.beginPath();
            ctx.arc(treeX, treeY, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawWater(water) {
        const ctx = this.ctx;
        const x = water.x * this.gridSize;
        const y = water.y * this.gridSize;
        const width = water.width * this.gridSize;
        const height = water.height * this.gridSize;
        
        ctx.fillStyle = CONFIG.COLORS.WATER;
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#90caf9';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    }

    _drawEntrance(entrance) {
        const ctx = this.ctx;
        const x = entrance.x * this.gridSize;
        const y = entrance.y * this.gridSize;
        
        ctx.fillStyle = '#4caf50';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('入口', x + this.gridSize / 2, y + this.gridSize / 2);
    }

    _renderPaths() {
        if (!this.gameInstance) return;
        
        const ctx = this.ctx;
        
        if (this.gameInstance.volunteer && this.gameInstance.volunteer.path.length > 1) {
            this._drawPath(this.gameInstance.volunteer.path, CONFIG.COLORS.PATH_VOLUNTEER);
        }
        
        if (this.gameInstance.ambulance && this.gameInstance.ambulance.path.length > 1) {
            this._drawPath(this.gameInstance.ambulance.path, CONFIG.COLORS.PATH_AMBULANCE);
        }
    }

    _drawPath(path, color) {
        if (!path || path.length < 2) return;
        
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([8, 4]);
        
        ctx.beginPath();
        const startPoint = path[0];
        const startPixel = this.gameMap.getPixelPosition(startPoint.x, startPoint.y);
        ctx.moveTo(startPixel.x, startPixel.y);
        
        for (let i = 1; i < path.length; i++) {
            const point = path[i];
            const pixel = this.gameMap.getPixelPosition(point.x, point.y);
            ctx.lineTo(pixel.x, pixel.y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _renderEvents() {
        if (!this.gameInstance || !this.gameInstance.eventManager) return;
        
        const events = this.gameInstance.eventManager.getAllEvents();
        events.forEach(event => {
            if (!event.handled) {
                this._drawEvent(event);
            }
        });
    }

    _drawEvent(event) {
        const ctx = this.ctx;
        const pixel = this.gameMap.getPixelPosition(event.x, event.y);
        const radius = this.gridSize / 3;
        
        ctx.fillStyle = event.color;
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = event.triggered ? '#ff0000' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(event.icon, pixel.x, pixel.y);
    }

    _renderAEDLocations() {
        const aedLocations = this.gameMap.getAllAEDLocations();
        aedLocations.forEach(location => {
            this._drawAEDLocation(location);
        });
    }

    _drawAEDLocation(location) {
        const ctx = this.ctx;
        const pixel = this.gameMap.getPixelPosition(location.x, location.y);
        const radius = this.gridSize / 2.5;
        
        ctx.fillStyle = CONFIG.COLORS.AED_LOCATION;
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#e64a19';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AED', pixel.x, pixel.y);
    }

    _renderPatient() {
        const patient = this.gameMap.getPatientPosition();
        if (!patient) return;
        
        const ctx = this.ctx;
        const pixel = this.gameMap.getPixelPosition(patient.x, patient.y);
        const radius = this.gridSize / 2.5;
        
        const isUrgent = this.gameInstance && 
            this.gameInstance.timer && 
            this.gameInstance.timer.getTime() > 120;
        
        const pulseScale = isUrgent ? 1 + Math.sin(Date.now() / 200) * 0.1 : 1;
        
        ctx.fillStyle = isUrgent ? CONFIG.COLORS.PATIENT_URGENT : CONFIG.COLORS.PATIENT;
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius * pulseScale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#b71c1c';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('患', pixel.x, pixel.y);
    }

    _renderResources() {
        if (!this.gameInstance) return;
        
        if (this.gameInstance.volunteer) {
            this._drawVolunteer(this.gameInstance.volunteer);
        }
        
        if (this.gameInstance.ambulance) {
            this._drawAmbulance(this.gameInstance.ambulance);
        }
        
        if (this.gameInstance.aed && !this.gameInstance.volunteer?.hasAED) {
            this._drawAED(this.gameInstance.aed);
        }
    }

    _drawVolunteer(volunteer) {
        const ctx = this.ctx;
        const pixel = volunteer.getPixelPosition(this.gridSize);
        const radius = this.gridSize / 2.8;
        
        ctx.fillStyle = CONFIG.COLORS.VOLUNTEER;
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#2e7d32';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('志', pixel.x, pixel.y);
        
        if (volunteer.hasAED) {
            ctx.fillStyle = '#f44336';
            ctx.font = 'bold 8px sans-serif';
            ctx.fillText('+AED', pixel.x, pixel.y + radius + 8);
        }
        
        if (volunteer.isDelayed) {
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(`等待${Math.ceil(volunteer.delayTime)}s`, pixel.x, pixel.y - radius - 5);
        }
    }

    _drawAmbulance(ambulance) {
        const ctx = this.ctx;
        const pixel = ambulance.getPixelPosition(this.gridSize);
        const radius = this.gridSize / 2.5;
        
        ctx.fillStyle = CONFIG.COLORS.AMBULANCE;
        ctx.beginPath();
        ctx.roundRect(pixel.x - radius, pixel.y - radius * 0.6, radius * 2, radius * 1.2, 4);
        ctx.fill();
        
        ctx.strokeStyle = '#1565c0';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('救护车', pixel.x, pixel.y);
        
        if (ambulance.isDelayed) {
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(`等待${Math.ceil(ambulance.delayTime)}s`, pixel.x, pixel.y - radius - 5);
        }
    }

    _drawAED(aed) {
        const ctx = this.ctx;
        const pixel = aed.getPixelPosition(this.gridSize);
        const radius = this.gridSize / 3;
        
        ctx.fillStyle = aed.disabled ? '#9e9e9e' : CONFIG.COLORS.AED;
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = aed.disabled ? '#757575' : '#c62828';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AED', pixel.x, pixel.y);
    }

    getCanvas() {
        return this.canvas;
    }

    getContext() {
        return this.ctx;
    }
}

window.GameRenderer = GameRenderer;