/**
 * 关卡数据结构
 * 管理关卡的完整数据定义
 */

class Level {
    constructor(config = {}) {
        this.id = config.id || `level_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = config.name || '未命名关卡';
        this.description = config.description || '';
        this.author = config.author || '教师';
        this.createdAt = config.createdAt || new Date().toISOString();
        this.updatedAt = config.updatedAt || new Date().toISOString();
        
        this.boardData = config.boardData || {
            width: 20,
            height: 16,
            grid: [],
            currents: [],
            berths: []
        };
        
        this.ships = config.ships || [];
        
        this.settings = {
            totalTurns: config.totalTurns || 20,
            targetBerthId: config.targetBerthId || null,
            objectives: config.objectives || [
                {
                    type: 'arrive_at_berth',
                    description: '将所有可控船舶安全带到泊位',
                    required: true
                }
            ],
            hints: config.hints || []
        };
        
        this.difficulty = config.difficulty || 'medium';
        this.tags = config.tags || [];
    }

    addShip(shipData) {
        const ship = new Ship(shipData);
        this.ships.push(ship.toJSON());
        this.updatedAt = new Date().toISOString();
        return ship;
    }

    removeShip(shipId) {
        this.ships = this.ships.filter(s => s.id !== shipId);
        this.updatedAt = new Date().toISOString();
    }

    updateShip(shipId, updates) {
        const shipIndex = this.ships.findIndex(s => s.id === shipId);
        if (shipIndex >= 0) {
            this.ships[shipIndex] = { ...this.ships[shipIndex], ...updates };
            this.updatedAt = new Date().toISOString();
        }
    }

    addBerth(berth) {
        if (!this.boardData.berths) {
            this.boardData.berths = [];
        }
        const id = this.boardData.berths.length;
        const newBerth = {
            id,
            x: berth.x,
            y: berth.y,
            width: berth.width || 1,
            height: berth.height || 1,
            name: berth.name || `泊位${id + 1}`,
            shipType: berth.shipType || null
        };
        this.boardData.berths.push(newBerth);
        
        for (let y = berth.y; y < berth.y + (berth.height || 1); y++) {
            for (let x = berth.x; x < berth.x + (berth.width || 1); x++) {
                if (y >= 0 && y < this.boardData.height && x >= 0 && x < this.boardData.width) {
                    if (!this.boardData.grid[y]) {
                        this.boardData.grid[y] = [];
                    }
                    if (!this.boardData.grid[y][x]) {
                        this.boardData.grid[y][x] = {
                            terrain: 'deep_water',
                            speedLimit: 2,
                            berthId: null,
                            currentId: null
                        };
                    }
                    this.boardData.grid[y][x].terrain = TerrainType.BERTH;
                    this.boardData.grid[y][x].berthId = id;
                }
            }
        }
        
        this.updatedAt = new Date().toISOString();
        return id;
    }

    addCurrent(current) {
        if (!this.boardData.currents) {
            this.boardData.currents = [];
        }
        const id = this.boardData.currents.length;
        const newCurrent = {
            id,
            x: current.x,
            y: current.y,
            width: current.width || 1,
            height: current.height || 1,
            dx: current.dx || 0,
            dy: current.dy || 0,
            speed: current.speed || 1,
            name: current.name || `潮流${id + 1}`
        };
        this.boardData.currents.push(newCurrent);
        
        for (let y = current.y; y < current.y + (current.height || 1); y++) {
            for (let x = current.x; x < current.x + (current.width || 1); x++) {
                if (y >= 0 && y < this.boardData.height && x >= 0 && x < this.boardData.width) {
                    if (!this.boardData.grid[y]) {
                        this.boardData.grid[y] = [];
                    }
                    if (!this.boardData.grid[y][x]) {
                        this.boardData.grid[y][x] = {
                            terrain: 'deep_water',
                            speedLimit: 2,
                            berthId: null,
                            currentId: null
                        };
                    }
                    this.boardData.grid[y][x].currentId = id;
                }
            }
        }
        
        this.updatedAt = new Date().toISOString();
        return id;
    }

    setTerrain(x, y, terrain, options = {}) {
        if (y < 0 || y >= this.boardData.height || x < 0 || x >= this.boardData.width) {
            return false;
        }
        
        if (!this.boardData.grid[y]) {
            this.boardData.grid[y] = [];
        }
        if (!this.boardData.grid[y][x]) {
            this.boardData.grid[y][x] = {
                terrain: 'deep_water',
                speedLimit: 2,
                berthId: null,
                currentId: null
            };
        }
        
        this.boardData.grid[y][x].terrain = terrain;
        
        switch (terrain) {
            case TerrainType.SPEED_LIMIT:
                this.boardData.grid[y][x].speedLimit = options.speedLimit || 1;
                break;
            default:
                this.boardData.grid[y][x].speedLimit = 2;
        }
        
        this.updatedAt = new Date().toISOString();
        return true;
    }

    validate() {
        const issues = [];
        
        const controllableShips = this.ships.filter(s => 
            s.mode === MovementMode.PLAYER_CONTROLLED
        );
        
        if (controllableShips.length === 0) {
            issues.push({
                type: 'error',
                message: '关卡必须至少有一艘可控船舶'
            });
        }
        
        const berths = this.boardData.berths || [];
        if (berths.length === 0) {
            issues.push({
                type: 'warning',
                message: '关卡没有定义泊位'
            });
        }
        
        for (const ship of this.ships) {
            if (ship.x < 0 || ship.x >= this.boardData.width || 
                ship.y < 0 || ship.y >= this.boardData.height) {
                issues.push({
                    type: 'error',
                    message: `船舶 ${ship.name} 位置超出棋盘范围`
                });
            }
        }
        
        for (let y = 0; y < this.boardData.height; y++) {
            for (let x = 0; x < this.boardData.width; x++) {
                if (!this.boardData.grid[y] || !this.boardData.grid[y][x]) {
                    continue;
                }
                const cell = this.boardData.grid[y][x];
                if (cell.terrain === TerrainType.BERTH) {
                    if (cell.berthId === null) {
                        issues.push({
                            type: 'warning',
                            message: `位置(${x},${y})的泊位缺少泊位ID`
                        });
                    }
                }
            }
        }
        
        return {
            valid: issues.every(i => i.type !== 'error'),
            issues: issues
        };
    }

    clone() {
        return Level.fromJSON(JSON.parse(JSON.stringify(this.toJSON())));
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            author: this.author,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            boardData: this.boardData,
            ships: this.ships,
            settings: this.settings,
            difficulty: this.difficulty,
            tags: this.tags
        };
    }

    static fromJSON(data) {
        const level = new Level({
            id: data.id,
            name: data.name,
            description: data.description,
            author: data.author,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            totalTurns: data.settings?.totalTurns,
            targetBerthId: data.settings?.targetBerthId,
            objectives: data.settings?.objectives,
            hints: data.settings?.hints,
            difficulty: data.difficulty,
            tags: data.tags
        });
        
        level.boardData = data.boardData;
        level.ships = data.ships;
        
        return level;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Level };
}
