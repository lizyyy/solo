var Level = function(id, name) {
    this.id = id || 'level_' + Date.now();
    this.name = name || '未命名关卡';
    this.description = '';
    this.mapWidth = Constants.DEFAULT_MAP_SIZE.width;
    this.mapHeight = Constants.DEFAULT_MAP_SIZE.height;
    this.initialEnergy = Constants.DEFAULT_ENERGY;
    this.map = [];
    this.startPosition = null;
    this.startDirection = Constants.DIRECTION.UP;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    
    this._initMap();
};

Level.prototype._initMap = function() {
    this.map = [];
    for (var y = 0; y < this.mapHeight; y++) {
        var row = [];
        for (var x = 0; x < this.mapWidth; x++) {
            row.push(Constants.CELL_TYPE.EMPTY);
        }
        this.map.push(row);
    }
};

Level.prototype.setCell = function(x, y, cellType) {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
        return false;
    }
    
    if (cellType === Constants.CELL_TYPE.START) {
        if (this.startPosition) {
            var oldX = this.startPosition.x;
            var oldY = this.startPosition.y;
            this.map[oldY][oldX] = Constants.CELL_TYPE.EMPTY;
        }
        this.startPosition = { x: x, y: y };
    }
    
    if (this.map[y][x] === Constants.CELL_TYPE.START && cellType !== Constants.CELL_TYPE.START) {
        this.startPosition = null;
    }
    
    this.map[y][x] = cellType;
    this.updatedAt = new Date().toISOString();
    return true;
};

Level.prototype.getCell = function(x, y) {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
        return null;
    }
    return this.map[y][x];
};

Level.prototype.isValidPosition = function(x, y) {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight;
};

Level.prototype.isPassable = function(x, y) {
    if (!this.isValidPosition(x, y)) {
        return false;
    }
    var cellType = this.getCell(x, y);
    return cellType !== Constants.CELL_TYPE.OBSTACLE;
};

Level.prototype.getCheckpoints = function() {
    var checkpoints = [];
    for (var y = 0; y < this.mapHeight; y++) {
        for (var x = 0; x < this.mapWidth; x++) {
            if (this.map[y][x] === Constants.CELL_TYPE.CHECKPOINT) {
                checkpoints.push({ x: x, y: y });
            }
        }
    }
    return checkpoints;
};

Level.prototype.getSamplePoints = function() {
    var samples = [];
    for (var y = 0; y < this.mapHeight; y++) {
        for (var x = 0; x < this.mapWidth; x++) {
            if (this.map[y][x] === Constants.CELL_TYPE.SAMPLE) {
                samples.push({ x: x, y: y });
            }
        }
    }
    return samples;
};

Level.prototype.getChargePoints = function() {
    var charges = [];
    for (var y = 0; y < this.mapHeight; y++) {
        for (var x = 0; x < this.mapWidth; x++) {
            if (this.map[y][x] === Constants.CELL_TYPE.CHARGE) {
                charges.push({ x: x, y: y });
            }
        }
    }
    return charges;
};

Level.prototype.getDangerPoints = function() {
    var dangers = [];
    for (var y = 0; y < this.mapHeight; y++) {
        for (var x = 0; x < this.mapWidth; x++) {
            if (this.map[y][x] === Constants.CELL_TYPE.DANGER) {
                dangers.push({ x: x, y: y });
            }
        }
    }
    return dangers;
};

Level.prototype.getObstacles = function() {
    var obstacles = [];
    for (var y = 0; y < this.mapHeight; y++) {
        for (var x = 0; x < this.mapWidth; x++) {
            if (this.map[y][x] === Constants.CELL_TYPE.OBSTACLE) {
                obstacles.push({ x: x, y: y });
            }
        }
    }
    return obstacles;
};

Level.prototype.validate = function() {
    var errors = [];
    
    if (!this.startPosition) {
        errors.push('关卡缺少起点');
    }
    
    var checkpoints = this.getCheckpoints();
    if (checkpoints.length === 0) {
        errors.push('关卡至少需要一个检查点');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
};

Level.prototype.clone = function() {
    var newLevel = new Level(this.id, this.name);
    newLevel.description = this.description;
    newLevel.mapWidth = this.mapWidth;
    newLevel.mapHeight = this.mapHeight;
    newLevel.initialEnergy = this.initialEnergy;
    newLevel.map = JSON.parse(JSON.stringify(this.map));
    newLevel.startPosition = this.startPosition ? { x: this.startPosition.x, y: this.startPosition.y } : null;
    newLevel.startDirection = this.startDirection;
    newLevel.createdAt = this.createdAt;
    newLevel.updatedAt = this.updatedAt;
    return newLevel;
};

Level.prototype.toJSON = function() {
    return {
        id: this.id,
        name: this.name,
        description: this.description,
        mapWidth: this.mapWidth,
        mapHeight: this.mapHeight,
        initialEnergy: this.initialEnergy,
        map: this.map,
        startPosition: this.startPosition,
        startDirection: this.startDirection,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

Level.fromJSON = function(json) {
    var level = new Level(json.id, json.name);
    level.description = json.description || '';
    level.mapWidth = json.mapWidth;
    level.mapHeight = json.mapHeight;
    level.initialEnergy = json.initialEnergy;
    level.map = json.map;
    level.startPosition = json.startPosition;
    level.startDirection = json.startDirection;
    level.createdAt = json.createdAt;
    level.updatedAt = json.updatedAt;
    return level;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Level;
}
