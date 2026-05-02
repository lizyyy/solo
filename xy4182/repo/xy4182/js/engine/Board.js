/**
 * 棋盘系统
 * 管理网格、地形类型、泊位位置
 */

const TerrainType = {
    DEEP_WATER: 'deep_water',
    SHALLOW_WATER: 'shallow_water',
    SPEED_LIMIT: 'speed_limit',
    BERTH: 'berth',
    BOUNDARY: 'boundary'
};

const Direction = {
    NONE: { dx: 0, dy: 0 },
    UP: { dx: 0, dy: -1 },
    DOWN: { dx: 0, dy: 1 },
    LEFT: { dx: -1, dy: 0 },
    RIGHT: { dx: 1, dy: 0 },
    UP_LEFT: { dx: -1, dy: -1 },
    UP_RIGHT: { dx: 1, dy: -1 },
    DOWN_LEFT: { dx: -1, dy: 1 },
    DOWN_RIGHT: { dx: 1, dy: 1 }
};

const DirectionNames = {
    '0,-1': '北',
    '0,1': '南',
    '-1,0': '西',
    '1,0': '东',
    '-1,-1': '西北',
    '1,-1': '东北',
    '-1,1': '西南',
    '1,1': '东南',
    '0,0': '静止'
};

class Board {
    constructor(width = 20, height = 16) {
        this.width = width;
        this.height = height;
        this.grid = [];
        this.currents = [];
        this.berths = [];
        
        this.initGrid();
        this.initCurrents();
    }

    initGrid() {
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push({
                    terrain: TerrainType.DEEP_WATER,
                    speedLimit: 2,
                    berthId: null,
                    currentId: null
                });
            }
            this.grid.push(row);
        }
    }

    initCurrents() {
        this.currents = [];
    }

    setTerrain(x, y, terrain, options = {}) {
        if (!this.isValidPos(x, y)) return false;
        
        const cell = this.grid[y][x];
        cell.terrain = terrain;
        
        switch (terrain) {
            case TerrainType.SPEED_LIMIT:
                cell.speedLimit = options.speedLimit || 1;
                break;
            case TerrainType.BERTH:
                cell.berthId = options.berthId || null;
                break;
            default:
                cell.speedLimit = 2;
                cell.berthId = null;
        }
        
        return true;
    }

    getTerrain(x, y) {
        if (!this.isValidPos(x, y)) return TerrainType.BOUNDARY;
        return this.grid[y][x].terrain;
    }

    getSpeedLimit(x, y) {
        if (!this.isValidPos(x, y)) return 0;
        return this.grid[y][x].speedLimit;
    }

    getBerthId(x, y) {
        if (!this.isValidPos(x, y)) return null;
        return this.grid[y][x].berthId;
    }

    addCurrent(current) {
        const id = this.currents.length;
        this.currents.push({
            id,
            x: current.x,
            y: current.y,
            width: current.width || 1,
            height: current.height || 1,
            dx: current.dx || 0,
            dy: current.dy || 0,
            speed: current.speed || 1,
            name: current.name || `潮流${id + 1}`
        });
        
        for (let cy = current.y; cy < current.y + (current.height || 1); cy++) {
            for (let cx = current.x; cx < current.x + (current.width || 1); cx++) {
                if (this.isValidPos(cx, cy)) {
                    this.grid[cy][cx].currentId = id;
                }
            }
        }
        
        return id;
    }

    getCurrentAt(x, y) {
        if (!this.isValidPos(x, y)) return null;
        const currentId = this.grid[y][x].currentId;
        if (currentId === null) return null;
        return this.currents[currentId];
    }

    getCurrentEffect(x, y) {
        const current = this.getCurrentAt(x, y);
        if (!current) return { dx: 0, dy: 0 };
        return { dx: current.dx * current.speed, dy: current.dy * current.speed };
    }

    addBerth(berth) {
        const id = this.berths.length;
        const newBerth = {
            id,
            x: berth.x,
            y: berth.y,
            width: berth.width || 1,
            height: berth.height || 1,
            name: berth.name || `泊位${id + 1}`,
            shipType: berth.shipType || null
        };
        this.berths.push(newBerth);
        
        for (let by = berth.y; by < berth.y + (berth.height || 1); by++) {
            for (let bx = berth.x; bx < berth.x + (berth.width || 1); bx++) {
                if (this.isValidPos(bx, by)) {
                    this.grid[by][bx].terrain = TerrainType.BERTH;
                    this.grid[by][bx].berthId = id;
                }
            }
        }
        
        return id;
    }

    getBerth(id) {
        return this.berths[id] || null;
    }

    isBerthAvailable(x, y, shipType = null) {
        const berthId = this.getBerthId(x, y);
        if (berthId === null) return false;
        
        const berth = this.getBerth(berthId);
        if (!berth) return false;
        
        if (berth.shipType && shipType && berth.shipType !== shipType) {
            return false;
        }
        
        return true;
    }

    isValidPos(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    canEnter(x, y, shipType = null) {
        const terrain = this.getTerrain(x, y);
        
        if (terrain === TerrainType.BOUNDARY) return false;
        if (terrain === TerrainType.SHALLOW_WATER) return false;
        
        if (terrain === TerrainType.BERTH) {
            return this.isBerthAvailable(x, y, shipType);
        }
        
        return true;
    }

    getMaxSpeed(x, y) {
        const terrain = this.getTerrain(x, y);
        
        if (terrain === TerrainType.SPEED_LIMIT) {
            return this.getSpeedLimit(x, y);
        }
        
        return 2;
    }

    clone() {
        const newBoard = new Board(this.width, this.height);
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                newBoard.grid[y][x] = { ...this.grid[y][x] };
            }
        }
        
        newBoard.currents = this.currents.map(c => ({ ...c }));
        newBoard.berths = this.berths.map(b => ({ ...b }));
        
        return newBoard;
    }

    toJSON() {
        return {
            width: this.width,
            height: this.height,
            grid: this.grid,
            currents: this.currents,
            berths: this.berths
        };
    }

    static fromJSON(data) {
        const board = new Board(data.width, data.height);
        board.grid = data.grid;
        board.currents = data.currents;
        board.berths = data.berths;
        return board;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Board, TerrainType, Direction, DirectionNames };
}
