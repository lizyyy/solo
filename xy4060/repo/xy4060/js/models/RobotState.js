var RobotState = function(level) {
    this.level = level;
    this.x = 0;
    this.y = 0;
    this.direction = Constants.DIRECTION.UP;
    this.energy = Constants.DEFAULT_ENERGY;
    this.maxEnergy = Constants.MAX_ENERGY;
    this.visitedCheckpoints = [];
    this.sampledPoints = [];
    this.visitedCells = [];
    this.isDead = false;
    this.deathReason = null;
    this.visitedPath = [];
    
    if (level) {
        this.initFromLevel(level);
    }
};

RobotState.prototype.initFromLevel = function(level) {
    if (level.startPosition) {
        this.x = level.startPosition.x;
        this.y = level.startPosition.y;
    }
    this.direction = level.startDirection;
    this.energy = level.initialEnergy;
    this.maxEnergy = level.initialEnergy * 2;
    this.visitedCheckpoints = [];
    this.sampledPoints = [];
    this.visitedCells = [];
    this.isDead = false;
    this.deathReason = null;
    this.visitedPath = [this._createPathPoint()];
};

RobotState.prototype._createPathPoint = function() {
    return {
        x: this.x,
        y: this.y,
        direction: this.direction,
        energy: this.energy
    };
};

RobotState.prototype.getDirectionName = function() {
    return Constants.DIRECTION_NAMES[this.direction];
};

RobotState.prototype.getPositionKey = function() {
    return this.x + ',' + this.y;
};

RobotState.prototype.getNextPosition = function() {
    var delta = Constants.DIRECTION_DELTA[this.direction];
    return {
        x: this.x + delta.x,
        y: this.y + delta.y
    };
};

RobotState.prototype.canMoveForward = function() {
    if (this.isDead) return false;
    if (this.energy < Constants.ENERGY_COST.forward) return false;
    
    var nextPos = this.getNextPosition();
    return this.level.isPassable(nextPos.x, nextPos.y);
};

RobotState.prototype.moveForward = function() {
    if (this.isDead) return { success: false, error: '机器人已停止' };
    
    var cost = Constants.ENERGY_COST.forward;
    if (this.energy < cost) {
        this.isDead = true;
        this.deathReason = Constants.ERROR_TYPE.ENERGY_DEPLETED;
        return {
            success: false,
            error: Constants.ERROR_TYPE.ENERGY_DEPLETED,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.ENERGY_DEPLETED]
        };
    }
    
    var nextPos = this.getNextPosition();
    
    if (!this.level.isValidPosition(nextPos.x, nextPos.y)) {
        this.isDead = true;
        this.deathReason = Constants.ERROR_TYPE.OUT_OF_BOUNDS;
        return {
            success: false,
            error: Constants.ERROR_TYPE.OUT_OF_BOUNDS,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.OUT_OF_BOUNDS]
        };
    }
    
    if (!this.level.isPassable(nextPos.x, nextPos.y)) {
        this.isDead = true;
        this.deathReason = Constants.ERROR_TYPE.HIT_WALL;
        return {
            success: false,
            error: Constants.ERROR_TYPE.HIT_WALL,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.HIT_WALL]
        };
    }
    
    this.energy -= cost;
    this.x = nextPos.x;
    this.y = nextPos.y;
    this.visitedCells.push(this.getPositionKey());
    this.visitedPath.push(this._createPathPoint());
    
    var cellType = this.level.getCell(this.x, this.y);
    if (cellType === Constants.CELL_TYPE.CHECKPOINT) {
        this._addCheckpoint(this.x, this.y);
    }
    
    if (cellType === Constants.CELL_TYPE.DANGER) {
        this.isDead = true;
        this.deathReason = Constants.ERROR_TYPE.DANGER_ZONE;
        return {
            success: false,
            error: Constants.ERROR_TYPE.DANGER_ZONE,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.DANGER_ZONE]
        };
    }
    
    return {
        success: true,
        energy: this.energy,
        position: { x: this.x, y: this.y }
    };
};

RobotState.prototype.turnLeft = function() {
    if (this.isDead) return { success: false, error: '机器人已停止' };
    
    var cost = Constants.ENERGY_COST.turnLeft;
    if (this.energy < cost) {
        this.isDead = true;
        this.deathReason = Constants.ERROR_TYPE.ENERGY_DEPLETED;
        return {
            success: false,
            error: Constants.ERROR_TYPE.ENERGY_DEPLETED,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.ENERGY_DEPLETED]
        };
    }
    
    this.energy -= cost;
    this.direction = (this.direction + 3) % 4;
    this.visitedPath.push(this._createPathPoint());
    
    return {
        success: true,
        energy: this.energy,
        direction: this.direction
    };
};

RobotState.prototype.turnRight = function() {
    if (this.isDead) return { success: false, error: '机器人已停止' };
    
    var cost = Constants.ENERGY_COST.turnRight;
    if (this.energy < cost) {
        this.isDead = true;
        this.deathReason = Constants.ERROR_TYPE.ENERGY_DEPLETED;
        return {
            success: false,
            error: Constants.ERROR_TYPE.ENERGY_DEPLETED,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.ENERGY_DEPLETED]
        };
    }
    
    this.energy -= cost;
    this.direction = (this.direction + 1) % 4;
    this.visitedPath.push(this._createPathPoint());
    
    return {
        success: true,
        energy: this.energy,
        direction: this.direction
    };
};

RobotState.prototype.sample = function() {
    if (this.isDead) return { success: false, error: '机器人已停止' };
    
    var cost = Constants.ENERGY_COST.sample;
    if (this.energy < cost) {
        this.isDead = true;
        this.deathReason = Constants.ERROR_TYPE.ENERGY_DEPLETED;
        return {
            success: false,
            error: Constants.ERROR_TYPE.ENERGY_DEPLETED,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.ENERGY_DEPLETED]
        };
    }
    
    var cellType = this.level.getCell(this.x, this.y);
    if (cellType !== Constants.CELL_TYPE.SAMPLE) {
        return {
            success: false,
            error: Constants.ERROR_TYPE.INVALID_SAMPLE,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.INVALID_SAMPLE]
        };
    }
    
    var posKey = this.getPositionKey();
    if (this.sampledPoints.indexOf(posKey) !== -1) {
        return {
            success: false,
            error: Constants.ERROR_TYPE.DUPLICATE_SAMPLE,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.DUPLICATE_SAMPLE]
        };
    }
    
    this.energy -= cost;
    this.sampledPoints.push(posKey);
    this.visitedPath.push(this._createPathPoint());
    
    return {
        success: true,
        energy: this.energy,
        sampledCount: this.sampledPoints.length
    };
};

RobotState.prototype.charge = function() {
    if (this.isDead) return { success: false, error: '机器人已停止' };
    
    var cellType = this.level.getCell(this.x, this.y);
    if (cellType !== Constants.CELL_TYPE.CHARGE) {
        return {
            success: false,
            error: Constants.ERROR_TYPE.INVALID_CHARGE,
            message: Constants.ERROR_MESSAGES[Constants.ERROR_TYPE.INVALID_CHARGE]
        };
    }
    
    var chargeAmount = Constants.CHARGE_AMOUNT;
    this.energy = Math.min(this.maxEnergy, this.energy + chargeAmount);
    this.visitedPath.push(this._createPathPoint());
    
    return {
        success: true,
        energy: this.energy,
        charged: chargeAmount
    };
};

RobotState.prototype._addCheckpoint = function(x, y) {
    var posKey = x + ',' + y;
    if (this.visitedCheckpoints.indexOf(posKey) === -1) {
        this.visitedCheckpoints.push(posKey);
    }
};

RobotState.prototype.hasVisitedAllCheckpoints = function() {
    var allCheckpoints = this.level.getCheckpoints();
    if (allCheckpoints.length === 0) return true;
    
    for (var i = 0; i < allCheckpoints.length; i++) {
        var cp = allCheckpoints[i];
        var key = cp.x + ',' + cp.y;
        if (this.visitedCheckpoints.indexOf(key) === -1) {
            return false;
        }
    }
    return true;
};

RobotState.prototype.hasSampledAll = function() {
    var allSamples = this.level.getSamplePoints();
    if (allSamples.length === 0) return true;
    
    for (var i = 0; i < allSamples.length; i++) {
        var sp = allSamples[i];
        var key = sp.x + ',' + sp.y;
        if (this.sampledPoints.indexOf(key) === -1) {
            return false;
        }
    }
    return true;
};

RobotState.prototype.getStats = function() {
    var allCheckpoints = this.level.getCheckpoints();
    var allSamples = this.level.getSamplePoints();
    
    return {
        position: { x: this.x, y: this.y },
        direction: this.direction,
        directionName: this.getDirectionName(),
        energy: this.energy,
        maxEnergy: this.maxEnergy,
        energyPercent: (this.energy / this.maxEnergy) * 100,
        visitedCheckpoints: this.visitedCheckpoints.length,
        totalCheckpoints: allCheckpoints.length,
        sampledPoints: this.sampledPoints.length,
        totalSamples: allSamples.length,
        pathLength: this.visitedPath.length,
        isDead: this.isDead,
        deathReason: this.deathReason
    };
};

RobotState.prototype.clone = function() {
    var newState = new RobotState(this.level);
    newState.x = this.x;
    newState.y = this.y;
    newState.direction = this.direction;
    newState.energy = this.energy;
    newState.maxEnergy = this.maxEnergy;
    newState.visitedCheckpoints = this.visitedCheckpoints.slice();
    newState.sampledPoints = this.sampledPoints.slice();
    newState.visitedCells = this.visitedCells.slice();
    newState.isDead = this.isDead;
    newState.deathReason = this.deathReason;
    newState.visitedPath = JSON.parse(JSON.stringify(this.visitedPath));
    return newState;
};

RobotState.prototype.toJSON = function() {
    return {
        x: this.x,
        y: this.y,
        direction: this.direction,
        energy: this.energy,
        maxEnergy: this.maxEnergy,
        visitedCheckpoints: this.visitedCheckpoints,
        sampledPoints: this.sampledPoints,
        visitedCells: this.visitedCells,
        isDead: this.isDead,
        deathReason: this.deathReason,
        visitedPath: this.visitedPath
    };
};

RobotState.fromJSON = function(json, level) {
    var state = new RobotState(level);
    state.x = json.x;
    state.y = json.y;
    state.direction = json.direction;
    state.energy = json.energy;
    state.maxEnergy = json.maxEnergy;
    state.visitedCheckpoints = json.visitedCheckpoints;
    state.sampledPoints = json.sampledPoints;
    state.visitedCells = json.visitedCells;
    state.isDead = json.isDead;
    state.deathReason = json.deathReason;
    state.visitedPath = json.visitedPath;
    return state;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RobotState;
}
