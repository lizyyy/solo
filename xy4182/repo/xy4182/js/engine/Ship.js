/**
 * 船舶类
 * 管理船舶位置、方向、速度、类型、惯性等属性
 */

const ShipType = {
    TUG: 'tug',
    CARGO: 'cargo',
    OTHER: 'other'
};

const ShipState = {
    ACTIVE: 'active',
    ARRIVED: 'arrived',
    DAMAGED: 'damaged',
    SUNK: 'sunk'
};

const MovementMode = {
    PLAYER_CONTROLLED: 'player_controlled',
    AI_CONTROLLED: 'ai_controlled',
    PRESET_ROUTE: 'preset_route'
};

class Ship {
    constructor(config) {
        this.id = config.id || `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = config.name || '未知船舶';
        this.type = config.type || ShipType.OTHER;
        
        this.x = config.x || 0;
        this.y = config.y || 0;
        
        this.prevX = this.x;
        this.prevY = this.y;
        
        this.dx = config.dx || 0;
        this.dy = config.dy || 0;
        
        this.speed = config.speed || 0;
        this.maxSpeed = config.maxSpeed || 2;
        
        this.heading = config.heading || 0;
        this.prevHeading = this.heading;
        
        this.state = ShipState.ACTIVE;
        this.mode = config.mode || MovementMode.PLAYER_CONTROLLED;
        
        this.length = config.length || 1;
        this.width = config.width || 1;
        
        this.inertia = {
            dx: 0,
            dy: 0,
            decay: config.inertiaDecay || 0.5
        };
        
        this.route = config.route || [];
        this.routeIndex = 0;
        
        this.targetBerthId = config.targetBerthId || null;
        this.arrivedAt = null;
        
        this.controllable = this.mode === MovementMode.PLAYER_CONTROLLED;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    getPrevPosition() {
        return { x: this.prevX, y: this.prevY };
    }

    getVelocity() {
        return { dx: this.dx, dy: this.dy };
    }

    getHeadingName() {
        return DirectionNames[`${this.dx},${this.dy}`] || '静止';
    }

    getDirectionVector() {
        return { dx: this.dx, dy: this.dy };
    }

    setPosition(x, y) {
        this.prevX = this.x;
        this.prevY = this.y;
        this.x = x;
        this.y = y;
    }

    setVelocity(dx, dy) {
        this.dx = dx;
        this.dy = dy;
        
        if (dx !== 0 || dy !== 0) {
            this.heading = Math.atan2(dy, dx);
        }
    }

    setSpeed(speed) {
        this.speed = Math.min(Math.max(speed, 0), this.maxSpeed);
    }

    move(dx, dy) {
        this.prevX = this.x;
        this.prevY = this.y;
        this.prevHeading = this.heading;
        
        this.dx = dx;
        this.dy = dy;
        
        this.x += dx;
        this.y += dy;
        
        if (dx !== 0 || dy !== 0) {
            this.heading = Math.atan2(dy, dx);
        }
        
        this.speed = Math.sqrt(dx * dx + dy * dy);
        
        this.inertia.dx = dx * this.inertia.decay;
        this.inertia.dy = dy * this.inertia.decay;
    }

    applyInertia() {
        if (this.inertia.dx === 0 && this.inertia.dy === 0) return;
        
        this.prevX = this.x;
        this.prevY = this.y;
        
        this.x += this.inertia.dx;
        this.y += this.inertia.dy;
        
        this.inertia.dx *= this.inertia.decay;
        this.inertia.dy *= this.inertia.decay;
        
        if (Math.abs(this.inertia.dx) < 0.1) this.inertia.dx = 0;
        if (Math.abs(this.inertia.dy) < 0.1) this.inertia.dy = 0;
    }

    getNextPosition(dx, dy) {
        return {
            x: this.x + dx,
            y: this.y + dy
        };
    }

    getPossibleMoves(maxSpeed = 2) {
        const moves = [];
        const directions = [
            { dx: 0, dy: 0 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: -1, dy: -1 },
            { dx: 1, dy: -1 },
            { dx: -1, dy: 1 },
            { dx: 1, dy: 1 }
        ];
        
        for (const dir of directions) {
            for (let speed = 1; speed <= maxSpeed; speed++) {
                moves.push({
                    dx: dir.dx * speed,
                    dy: dir.dy * speed,
                    speed: speed
                });
            }
        }
        
        return moves;
    }

    isActive() {
        return this.state === ShipState.ACTIVE;
    }

    isArrived() {
        return this.state === ShipState.ARRIVED;
    }

    isControllable() {
        return this.controllable && this.isActive();
    }

    markArrived(turn) {
        this.state = ShipState.ARRIVED;
        this.arrivedAt = turn;
    }

    markDamaged() {
        this.state = ShipState.DAMAGED;
    }

    markSunk() {
        this.state = ShipState.SUNK;
    }

    getTypeDisplayName() {
        switch (this.type) {
            case ShipType.TUG: return '拖轮';
            case ShipType.CARGO: return '货船';
            case ShipType.OTHER: return '来船';
            default: return '未知';
        }
    }

    getStateDisplayName() {
        switch (this.state) {
            case ShipState.ACTIVE: return '航行中';
            case ShipState.ARRIVED: return '已抵达';
            case ShipState.DAMAGED: return '受损';
            case ShipState.SUNK: return '沉没';
            default: return '未知';
        }
    }

    clone() {
        return new Ship({
            id: this.id,
            name: this.name,
            type: this.type,
            x: this.x,
            y: this.y,
            dx: this.dx,
            dy: this.dy,
            speed: this.speed,
            maxSpeed: this.maxSpeed,
            heading: this.heading,
            length: this.length,
            width: this.width,
            inertiaDecay: this.inertia.decay,
            mode: this.mode,
            route: [...this.route],
            targetBerthId: this.targetBerthId
        });
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            x: this.x,
            y: this.y,
            prevX: this.prevX,
            prevY: this.prevY,
            dx: this.dx,
            dy: this.dy,
            speed: this.speed,
            maxSpeed: this.maxSpeed,
            heading: this.heading,
            state: this.state,
            mode: this.mode,
            length: this.length,
            width: this.width,
            inertia: this.inertia,
            route: this.route,
            routeIndex: this.routeIndex,
            targetBerthId: this.targetBerthId,
            arrivedAt: this.arrivedAt,
            controllable: this.controllable
        };
    }

    static fromJSON(data) {
        const ship = new Ship({
            id: data.id,
            name: data.name,
            type: data.type,
            x: data.x,
            y: data.y,
            dx: data.dx,
            dy: data.dy,
            speed: data.speed,
            maxSpeed: data.maxSpeed,
            heading: data.heading,
            length: data.length,
            width: data.width,
            mode: data.mode,
            route: data.route,
            targetBerthId: data.targetBerthId
        });
        
        ship.prevX = data.prevX;
        ship.prevY = data.prevY;
        ship.state = data.state;
        ship.inertia = data.inertia;
        ship.routeIndex = data.routeIndex;
        ship.arrivedAt = data.arrivedAt;
        ship.controllable = data.controllable;
        
        return ship;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Ship, ShipType, ShipState, MovementMode };
}
