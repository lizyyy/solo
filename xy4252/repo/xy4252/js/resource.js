class Resource {
    constructor(type, config) {
        this.type = type;
        this.config = config || {};
        this.id = Utils.generateId();
        this.x = 0;
        this.y = 0;
        this.gridX = 0;
        this.gridY = 0;
        this.path = [];
        this.currentPathIndex = 0;
        this.isMoving = false;
        this.moveProgress = 0;
        this.speed = this._getDefaultSpeed();
        this.delayTime = 0;
        this.isDelayed = false;
    }

    _getDefaultSpeed() {
        switch (this.type) {
            case 'volunteer':
                return CONFIG.RESOURCES.VOLUNTEER.baseSpeed;
            case 'ambulance':
                return CONFIG.RESOURCES.AMBULANCE.baseSpeed;
            case 'aed':
                return 0;
            default:
                return 60;
        }
    }

    setPosition(gridX, gridY) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.x = gridX;
        this.y = gridY;
    }

    getPixelPosition(gridSize) {
        return {
            x: this.x * gridSize + gridSize / 2,
            y: this.y * gridSize + gridSize / 2
        };
    }

    setPath(path) {
        if (!path || path.length === 0) return false;
        
        this.path = [...path];
        this.currentPathIndex = 0;
        this.isMoving = true;
        this.moveProgress = 0;
        
        if (path.length > 0) {
            const startPoint = path[0];
            this.gridX = startPoint.x;
            this.gridY = startPoint.y;
            this.x = startPoint.x;
            this.y = startPoint.y;
        }
        
        return true;
    }

    clearPath() {
        this.path = [];
        this.currentPathIndex = 0;
        this.isMoving = false;
        this.moveProgress = 0;
    }

    move(deltaTime) {
        if (!this.isMoving || this.isDelayed || this.path.length === 0) return false;
        
        const currentTarget = this.path[this.currentPathIndex + 1];
        
        if (!currentTarget) {
            this.isMoving = false;
            return true;
        }
        
        const speedPerSecond = this.speed / 1000;
        const moveAmount = speedPerSecond * deltaTime;
        
        const currentX = this.x;
        const currentY = this.y;
        const targetX = currentTarget.x;
        const targetY = currentTarget.y;
        
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= moveAmount) {
            this.x = targetX;
            this.y = targetY;
            this.gridX = targetX;
            this.gridY = targetY;
            this.currentPathIndex++;
            
            if (this.currentPathIndex >= this.path.length - 1) {
                this.isMoving = false;
                return true;
            }
        } else {
            const ratio = moveAmount / distance;
            this.x += dx * ratio;
            this.y += dy * ratio;
        }
        
        return false;
    }

    addDelay(seconds) {
        this.delayTime += seconds;
        this.isDelayed = true;
    }

    updateDelay(deltaTime) {
        if (!this.isDelayed || this.delayTime <= 0) {
            this.isDelayed = false;
            this.delayTime = 0;
            return false;
        }
        
        this.delayTime -= deltaTime / 1000;
        
        if (this.delayTime <= 0) {
            this.delayTime = 0;
            this.isDelayed = false;
            return true;
        }
        
        return false;
    }

    isAtPosition(gridX, gridY) {
        return Math.round(this.x) === gridX && Math.round(this.y) === gridY;
    }

    reset() {
        this.clearPath();
        this.delayTime = 0;
        this.isDelayed = false;
    }

    getState() {
        return {
            type: this.type,
            id: this.id,
            x: this.x,
            y: this.y,
            gridX: this.gridX,
            gridY: this.gridY,
            path: [...this.path],
            currentPathIndex: this.currentPathIndex,
            isMoving: this.isMoving,
            moveProgress: this.moveProgress,
            speed: this.speed,
            delayTime: this.delayTime,
            isDelayed: this.isDelayed
        };
    }

    restoreState(state) {
        if (state) {
            this.type = state.type || this.type;
            this.id = state.id || this.id;
            this.x = state.x || 0;
            this.y = state.y || 0;
            this.gridX = state.gridX || 0;
            this.gridY = state.gridY || 0;
            this.path = state.path ? [...state.path] : [];
            this.currentPathIndex = state.currentPathIndex || 0;
            this.isMoving = state.isMoving || false;
            this.moveProgress = state.moveProgress || 0;
            this.speed = state.speed || this.speed;
            this.delayTime = state.delayTime || 0;
            this.isDelayed = state.isDelayed || false;
        }
    }
}

class AEDResource extends Resource {
    constructor(config) {
        super('aed', config);
        this.battery = CONFIG.RESOURCES.AED.baseBattery;
        this.used = false;
        this.disabled = false;
        this.defibrillationTime = CONFIG.RESOURCES.AED.defibrillationTime;
        this.isDefibrillating = false;
        this.defibrillationProgress = 0;
        this.locationName = '';
    }

    useBattery(amount) {
        this.battery -= amount;
        if (this.battery <= 0) {
            this.battery = 0;
            this.disabled = true;
            return false;
        }
        return true;
    }

    startDefibrillation() {
        if (this.disabled || this.battery <= 0) {
            return false;
        }
        this.isDefibrillating = true;
        this.defibrillationProgress = 0;
        return true;
    }

    updateDefibrillation(deltaTime) {
        if (!this.isDefibrillating) return false;
        
        this.defibrillationProgress += deltaTime;
        
        if (this.defibrillationProgress >= this.defibrillationTime * 1000) {
            this.isDefibrillating = false;
            this.used = true;
            this.defibrillationProgress = 0;
            return true;
        }
        
        return false;
    }

    reset() {
        super.reset();
        this.battery = CONFIG.RESOURCES.AED.baseBattery;
        this.used = false;
        this.disabled = false;
        this.isDefibrillating = false;
        this.defibrillationProgress = 0;
    }

    getState() {
        return {
            ...super.getState(),
            battery: this.battery,
            used: this.used,
            disabled: this.disabled,
            defibrillationTime: this.defibrillationTime,
            isDefibrillating: this.isDefibrillating,
            defibrillationProgress: this.defibrillationProgress,
            locationName: this.locationName
        };
    }

    restoreState(state) {
        super.restoreState(state);
        if (state) {
            this.battery = state.battery !== undefined ? state.battery : this.battery;
            this.used = state.used !== undefined ? state.used : this.used;
            this.disabled = state.disabled !== undefined ? state.disabled : this.disabled;
            this.defibrillationTime = state.defibrillationTime || this.defibrillationTime;
            this.isDefibrillating = state.isDefibrillating !== undefined ? state.isDefibrillating : this.isDefibrillating;
            this.defibrillationProgress = state.defibrillationProgress || 0;
            this.locationName = state.locationName || this.locationName;
        }
    }
}

class VolunteerResource extends Resource {
    constructor(config) {
        super('volunteer', config);
        this.hasAED = false;
        this.aed = null;
        this.atPatient = false;
        this.fetchTime = CONFIG.RESOURCES.VOLUNTEER.fetchTime;
        this.isFetching = false;
        this.fetchProgress = 0;
    }

    pickUpAED(aed) {
        if (!aed || aed.disabled) return false;
        
        this.hasAED = true;
        this.aed = aed;
        this.isFetching = true;
        this.fetchProgress = 0;
        return true;
    }

    updateFetching(deltaTime) {
        if (!this.isFetching) return false;
        
        this.fetchProgress += deltaTime;
        
        if (this.fetchProgress >= this.fetchTime * 1000) {
            this.isFetching = false;
            this.fetchProgress = 0;
            return true;
        }
        
        return false;
    }

    dropAED() {
        const aed = this.aed;
        this.hasAED = false;
        this.aed = null;
        return aed;
    }

    reset() {
        super.reset();
        this.hasAED = false;
        this.aed = null;
        this.atPatient = false;
        this.isFetching = false;
        this.fetchProgress = 0;
    }

    getState() {
        return {
            ...super.getState(),
            hasAED: this.hasAED,
            atPatient: this.atPatient,
            fetchTime: this.fetchTime,
            isFetching: this.isFetching,
            fetchProgress: this.fetchProgress
        };
    }

    restoreState(state) {
        super.restoreState(state);
        if (state) {
            this.hasAED = state.hasAED !== undefined ? state.hasAED : this.hasAED;
            this.atPatient = state.atPatient !== undefined ? state.atPatient : this.atPatient;
            this.fetchTime = state.fetchTime || this.fetchTime;
            this.isFetching = state.isFetching !== undefined ? state.isFetching : this.isFetching;
            this.fetchProgress = state.fetchProgress || 0;
        }
    }
}

class AmbulanceResource extends Resource {
    constructor(config) {
        super('ambulance', config);
        this.responseTime = CONFIG.RESOURCES.AMBULANCE.responseTime;
        this.handoverTime = CONFIG.RESOURCES.AMBULANCE.handoverTime;
        this.arrived = false;
        this.isResponding = true;
        this.responseProgress = 0;
        this.isHandingOver = false;
        this.handoverProgress = 0;
    }

    startHandover() {
        this.isHandingOver = true;
        this.handoverProgress = 0;
        return true;
    }

    updateHandover(deltaTime) {
        if (!this.isHandingOver) return false;
        
        this.handoverProgress += deltaTime;
        
        if (this.handoverProgress >= this.handoverTime * 1000) {
            this.isHandingOver = false;
            this.handoverProgress = 0;
            return true;
        }
        
        return false;
    }

    reset() {
        super.reset();
        this.arrived = false;
        this.isResponding = true;
        this.responseProgress = 0;
        this.isHandingOver = false;
        this.handoverProgress = 0;
    }

    getState() {
        return {
            ...super.getState(),
            responseTime: this.responseTime,
            handoverTime: this.handoverTime,
            arrived: this.arrived,
            isResponding: this.isResponding,
            responseProgress: this.responseProgress,
            isHandingOver: this.isHandingOver,
            handoverProgress: this.handoverProgress
        };
    }

    restoreState(state) {
        super.restoreState(state);
        if (state) {
            this.responseTime = state.responseTime || this.responseTime;
            this.handoverTime = state.handoverTime || this.handoverTime;
            this.arrived = state.arrived !== undefined ? state.arrived : this.arrived;
            this.isResponding = state.isResponding !== undefined ? state.isResponding : this.isResponding;
            this.responseProgress = state.responseProgress || 0;
            this.isHandingOver = state.isHandingOver !== undefined ? state.isHandingOver : this.isHandingOver;
            this.handoverProgress = state.handoverProgress || 0;
        }
    }
}

window.Resource = Resource;
window.AEDResource = AEDResource;
window.VolunteerResource = VolunteerResource;
window.AmbulanceResource = AmbulanceResource;