/**
 * 游戏引擎核心
 * 管理回合制游戏流程、船舶控制、规则判定集成
 */

const GameMode = {
    EDIT: 'edit',
    PLAY: 'play',
    REPLAY: 'replay'
};

const IncidentType = {
    COLLISION: 'collision',
    SHALLOW: 'shallow',
    SPEED: 'speed',
    GIVE_WAY: 'give_way',
    BOUNDARY: 'boundary'
};

const PenaltyPoints = {
    [IncidentType.COLLISION]: 10,
    [IncidentType.SHALLOW]: 5,
    [IncidentType.SPEED]: 2,
    [IncidentType.GIVE_WAY]: 3,
    [IncidentType.BOUNDARY]: 5
};

class GameEngine {
    constructor(options = {}) {
        this.mode = GameMode.EDIT;
        this.board = options.board || new Board();
        this.ships = [];
        this.level = options.level || null;
        
        this.turn = 1;
        this.totalTurns = options.totalTurns || 20;
        this.penaltyPoints = 0;
        this.incidents = [];
        
        this.selectedShipId = null;
        this.pendingMoves = new Map();
        
        this.currentSystem = new CurrentSystem(this);
        this.inertiaSystem = new InertiaSystem(this);
        this.collisionRules = new CollisionRules(this);
        
        this.gameStarted = false;
        this.gameEnded = false;
        this.winner = null;
        
        this.listeners = {
            turnStart: [],
            turnEnd: [],
            incident: [],
            gameEnd: [],
            shipSelected: [],
            moveExecuted: []
        };
    }

    initLevel(level) {
        this.level = level;
        this.board = Board.fromJSON(level.boardData);
        this.ships = level.ships.map(s => Ship.fromJSON(s));
        this.turn = 1;
        this.penaltyPoints = 0;
        this.incidents = [];
        this.pendingMoves.clear();
        this.selectedShipId = null;
        this.gameStarted = false;
        this.gameEnded = false;
    }

    startGame() {
        this.mode = GameMode.PLAY;
        this.turn = 1;
        this.penaltyPoints = 0;
        this.incidents = [];
        this.pendingMoves.clear();
        this.gameStarted = true;
        this.gameEnded = false;
        this.emit('turnStart', { turn: this.turn });
    }

    setMode(mode) {
        this.mode = mode;
    }

    getMode() {
        return this.mode;
    }

    selectShip(shipId) {
        const ship = this.getShipById(shipId);
        if (ship && ship.isControllable()) {
            this.selectedShipId = shipId;
            this.emit('shipSelected', { ship });
            return true;
        }
        return false;
    }

    getSelectedShip() {
        if (!this.selectedShipId) return null;
        return this.getShipById(this.selectedShipId);
    }

    getShipById(id) {
        return this.ships.find(s => s.id === id);
    }

    getControllableShips() {
        return this.ships.filter(s => s.isControllable());
    }

    getActiveShips() {
        return this.ships.filter(s => s.isActive());
    }

    addShip(ship) {
        this.ships.push(ship);
    }

    removeShip(shipId) {
        this.ships = this.ships.filter(s => s.id !== shipId);
    }

    planMove(shipId, dx, dy) {
        const ship = this.getShipById(shipId);
        if (!ship || !ship.isControllable()) {
            return { valid: false, reason: '船舶不可控' };
        }
        
        const nextPos = ship.getNextPosition(dx, dy);
        const speed = Math.abs(dx) + Math.abs(dy);
        
        const terrain = this.board.getTerrain(nextPos.x, nextPos.y);
        if (terrain === TerrainType.BOUNDARY) {
            return { valid: false, reason: '超出边界' };
        }
        
        if (terrain === TerrainType.SHALLOW_WATER) {
            return { valid: false, reason: '浅滩禁入' };
        }
        
        const maxSpeed = this.board.getMaxSpeed(ship.x, ship.y);
        if (speed > maxSpeed) {
            return { valid: false, reason: `超过限速${maxSpeed}格` };
        }
        
        if (terrain === TerrainType.BERTH) {
            if (!this.board.isBerthAvailable(nextPos.x, nextPos.y, ship.type)) {
                return { valid: false, reason: '泊位不匹配' };
            }
        }
        
        this.pendingMoves.set(shipId, { dx, dy, speed });
        return { valid: true };
    }

    getPendingMove(shipId) {
        return this.pendingMoves.get(shipId);
    }

    clearPendingMoves() {
        this.pendingMoves.clear();
    }

    allControllableShipsMoved() {
        const controllable = this.getControllableShips();
        return controllable.every(s => this.pendingMoves.has(s.id));
    }

    executeTurn() {
        if (!this.gameStarted || this.gameEnded) {
            return false;
        }
        
        this.emit('turnStart', { turn: this.turn });
        
        this.executePlayerMoves();
        
        this.executeAIMoves();
        
        this.currentSystem.applyCurrents();
        
        this.inertiaSystem.applyInertia();
        
        this.processArrivals();
        
        this.checkRules();
        
        this.checkGameEnd();
        
        this.emit('turnEnd', { 
            turn: this.turn, 
            incidents: [...this.incidents],
            penaltyPoints: this.penaltyPoints
        });
        
        this.turn++;
        this.pendingMoves.clear();
        
        return true;
    }

    executePlayerMoves() {
        for (const [shipId, move] of this.pendingMoves) {
            const ship = this.getShipById(shipId);
            if (ship && ship.isControllable()) {
                ship.move(move.dx, move.dy);
                this.emit('moveExecuted', { ship, dx: move.dx, dy: move.dy });
            }
        }
    }

    executeAIMoves() {
        for (const ship of this.ships) {
            if (ship.mode === MovementMode.PRESET_ROUTE && ship.isActive()) {
                this.executePresetRouteMove(ship);
            } else if (ship.mode === MovementMode.AI_CONTROLLED && ship.isActive()) {
                this.executeAIMove(ship);
            }
        }
    }

    executePresetRouteMove(ship) {
        if (ship.route.length === 0 || ship.routeIndex >= ship.route.length) {
            return;
        }
        
        const nextMove = ship.route[ship.routeIndex];
        const nextPos = ship.getNextPosition(nextMove.dx, nextMove.dy);
        
        if (this.board.canEnter(nextPos.x, nextPos.y, ship.type)) {
            ship.move(nextMove.dx, nextMove.dy);
            ship.routeIndex++;
        }
    }

    executeAIMove(ship) {
        const possibleMoves = ship.getPossibleMoves(1);
        const validMoves = [];
        
        for (const move of possibleMoves) {
            const nextPos = ship.getNextPosition(move.dx, move.dy);
            if (this.board.canEnter(nextPos.x, nextPos.y, ship.type)) {
                validMoves.push(move);
            }
        }
        
        if (validMoves.length > 0) {
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            ship.move(move.dx, move.dy);
        }
    }

    processArrivals() {
        for (const ship of this.ships) {
            if (!ship.isActive()) continue;
            
            const terrain = this.board.getTerrain(ship.x, ship.y);
            if (terrain === TerrainType.BERTH) {
                const berthId = this.board.getBerthId(ship.x, ship.y);
                const berth = this.board.getBerth(berthId);
                
                if (berth) {
                    if (ship.targetBerthId !== null) {
                        if (ship.targetBerthId === berthId) {
                            ship.markArrived(this.turn);
                        }
                    } else {
                        if (!berth.shipType || berth.shipType === ship.type) {
                            ship.markArrived(this.turn);
                        }
                    }
                }
            }
        }
    }

    checkRules() {
        this.collisionRules.checkCollisions();
        this.collisionRules.checkGiveWayViolations();
        this.checkShallowWater();
        this.checkBoundary();
    }

    checkShallowWater() {
        for (const ship of this.ships) {
            if (!ship.isActive()) continue;
            
            const terrain = this.board.getTerrain(ship.x, ship.y);
            if (terrain === TerrainType.SHALLOW_WATER) {
                this.addIncident({
                    type: IncidentType.SHALLOW,
                    turn: this.turn,
                    ships: [ship.id],
                    description: `${ship.name} 驶入浅滩区域 (${ship.x}, ${ship.y})`
                });
            }
        }
    }

    checkBoundary() {
        for (const ship of this.ships) {
            if (!ship.isActive()) continue;
            
            if (!this.board.isValidPos(ship.x, ship.y)) {
                this.addIncident({
                    type: IncidentType.BOUNDARY,
                    turn: this.turn,
                    ships: [ship.id],
                    description: `${ship.name} 驶出边界 (${ship.x}, ${ship.y})`
                });
            }
        }
    }

    addIncident(incident) {
        incident.points = PenaltyPoints[incident.type] || 0;
        this.incidents.push(incident);
        this.penaltyPoints += incident.points;
        this.emit('incident', incident);
    }

    checkGameEnd() {
        const controllableShips = this.getControllableShips();
        const allArrived = controllableShips.every(s => s.isArrived());
        
        if (allArrived) {
            this.gameEnded = true;
            this.winner = 'success';
            this.emit('gameEnd', { 
                result: 'success', 
                turns: this.turn,
                penaltyPoints: this.penaltyPoints,
                message: '所有船舶安全抵达泊位！'
            });
        } else if (this.turn >= this.totalTurns) {
            this.gameEnded = true;
            this.winner = 'timeout';
            this.emit('gameEnd', { 
                result: 'timeout', 
                turns: this.turn,
                penaltyPoints: this.penaltyPoints,
                message: '回合用完，任务未完成！'
            });
        }
    }

    undoTurn() {
        return false;
    }

    getGameState() {
        return {
            mode: this.mode,
            turn: this.turn,
            totalTurns: this.totalTurns,
            penaltyPoints: this.penaltyPoints,
            incidents: [...this.incidents],
            selectedShipId: this.selectedShipId,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded,
            winner: this.winner
        };
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.listeners[event]) {
            for (const callback of this.listeners[event]) {
                callback(data);
            }
        }
    }

    toJSON() {
        return {
            mode: this.mode,
            board: this.board.toJSON(),
            ships: this.ships.map(s => s.toJSON()),
            turn: this.turn,
            totalTurns: this.totalTurns,
            penaltyPoints: this.penaltyPoints,
            incidents: [...this.incidents],
            selectedShipId: this.selectedShipId,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded,
            winner: this.winner
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        GameEngine, 
        GameMode, 
        IncidentType, 
        PenaltyPoints 
    };
}
