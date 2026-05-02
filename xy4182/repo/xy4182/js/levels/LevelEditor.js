/**
 * 关卡编辑器
 * 管理关卡编辑状态、工具选择、编辑操作
 */

const EditTool = {
    SELECT: 'select',
    DEEP_WATER: 'deep_water',
    SHALLOW_WATER: 'shallow_water',
    SPEED_LIMIT: 'speed_limit',
    BERTH: 'berth',
    CURRENT: 'current',
    TUG: 'tug',
    CARGO: 'cargo',
    OTHER: 'other_ship'
};

class LevelEditor {
    constructor(engine) {
        this.engine = engine;
        this.currentTool = null;
        this.currentLevel = null;
        
        this.editConfig = {
            speedLimit: 1,
            currentDx: 1,
            currentDy: 0,
            currentSpeed: 1,
            currentWidth: 1,
            currentHeight: 1,
            berthWidth: 1,
            berthHeight: 1,
            shipName: '',
            shipType: ShipType.OTHER,
            shipMode: MovementMode.PLAYER_CONTROLLED,
            targetBerthId: null,
            route: []
        };
        
        this.isDrawing = false;
        this.startPos = null;
        this.selection = null;
    }

    setLevel(level) {
        this.currentLevel = level;
    }

    getLevel() {
        return this.currentLevel;
    }

    setTool(tool) {
        this.currentTool = tool;
        this.selection = null;
    }

    getTool() {
        return this.currentTool;
    }

    setEditConfig(config) {
        this.editConfig = { ...this.editConfig, ...config };
    }

    getEditConfig() {
        return this.editConfig;
    }

    handleCanvasClick(gridX, gridY) {
        if (!this.currentLevel) return;
        
        switch (this.currentTool) {
            case EditTool.DEEP_WATER:
                this.setTerrain(gridX, gridY, TerrainType.DEEP_WATER);
                break;
            case EditTool.SHALLOW_WATER:
                this.setTerrain(gridX, gridY, TerrainType.SHALLOW_WATER);
                break;
            case EditTool.SPEED_LIMIT:
                this.setTerrain(gridX, gridY, TerrainType.SPEED_LIMIT, {
                    speedLimit: this.editConfig.speedLimit
                });
                break;
            case EditTool.BERTH:
                this.addBerth(gridX, gridY);
                break;
            case EditTool.CURRENT:
                this.addCurrent(gridX, gridY);
                break;
            case EditTool.TUG:
                this.addShip(gridX, gridY, ShipType.TUG);
                break;
            case EditTool.CARGO:
                this.addShip(gridX, gridY, ShipType.CARGO);
                break;
            case EditTool.OTHER:
                this.addShip(gridX, gridY, ShipType.OTHER);
                break;
            case EditTool.SELECT:
                this.selectAt(gridX, gridY);
                break;
        }
    }

    setTerrain(x, y, terrain, options = {}) {
        if (!this.currentLevel) return false;
        
        const boardData = this.currentLevel.boardData;
        if (y < 0 || y >= boardData.height || x < 0 || x >= boardData.width) {
            return false;
        }
        
        if (!boardData.grid[y]) {
            boardData.grid[y] = [];
        }
        if (!boardData.grid[y][x]) {
            boardData.grid[y][x] = {
                terrain: 'deep_water',
                speedLimit: 2,
                berthId: null,
                currentId: null
            };
        }
        
        boardData.grid[y][x].terrain = terrain;
        
        switch (terrain) {
            case TerrainType.SPEED_LIMIT:
                boardData.grid[y][x].speedLimit = options.speedLimit || 1;
                break;
            default:
                boardData.grid[y][x].speedLimit = 2;
        }
        
        this.currentLevel.updatedAt = new Date().toISOString();
        return true;
    }

    addBerth(x, y) {
        if (!this.currentLevel) return;
        
        const berth = {
            x: x,
            y: y,
            width: this.editConfig.berthWidth || 1,
            height: this.editConfig.berthHeight || 1,
            name: `泊位${(this.currentLevel.boardData.berths?.length || 0) + 1}`,
            shipType: null
        };
        
        this.currentLevel.addBerth(berth);
    }

    addCurrent(x, y) {
        if (!this.currentLevel) return;
        
        const current = {
            x: x,
            y: y,
            width: this.editConfig.currentWidth || 1,
            height: this.editConfig.currentHeight || 1,
            dx: this.editConfig.currentDx || 0,
            dy: this.editConfig.currentDy || 0,
            speed: this.editConfig.currentSpeed || 1,
            name: `潮流${(this.currentLevel.boardData.currents?.length || 0) + 1}`
        };
        
        this.currentLevel.addCurrent(current);
    }

    addShip(x, y, type) {
        if (!this.currentLevel) return;
        
        const shipCount = this.currentLevel.ships.filter(s => s.type === type).length + 1;
        let defaultName;
        switch (type) {
            case ShipType.TUG:
                defaultName = `拖轮${shipCount}`;
                break;
            case ShipType.CARGO:
                defaultName = `货船${shipCount}`;
                break;
            case ShipType.OTHER:
                defaultName = `来船${shipCount}`;
                break;
        }
        
        const shipData = {
            name: this.editConfig.shipName || defaultName,
            type: type,
            x: x,
            y: y,
            mode: this.editConfig.shipMode,
            targetBerthId: this.editConfig.targetBerthId,
            route: [...this.editConfig.route]
        };
        
        this.currentLevel.addShip(shipData);
    }

    selectAt(x, y) {
        if (!this.currentLevel) return;
        
        const ship = this.currentLevel.ships.find(s => 
            Math.abs(s.x - x) < 0.5 && Math.abs(s.y - y) < 0.5
        );
        
        if (ship) {
            this.selection = {
                type: 'ship',
                id: ship.id,
                data: ship
            };
            return;
        }
        
        const boardData = this.currentLevel.boardData;
        if (boardData.grid[y] && boardData.grid[y][x]) {
            const cell = boardData.grid[y][x];
            
            if (cell.berthId !== null) {
                const berth = (boardData.berths || [])[cell.berthId];
                if (berth) {
                    this.selection = {
                        type: 'berth',
                        id: cell.berthId,
                        data: berth
                    };
                    return;
                }
            }
            
            if (cell.currentId !== null) {
                const current = (boardData.currents || [])[cell.currentId];
                if (current) {
                    this.selection = {
                        type: 'current',
                        id: cell.currentId,
                        data: current
                    };
                    return;
                }
            }
            
            this.selection = {
                type: 'cell',
                x: x,
                y: y,
                data: cell
            };
        }
    }

    deleteSelection() {
        if (!this.selection || !this.currentLevel) return false;
        
        switch (this.selection.type) {
            case 'ship':
                this.currentLevel.removeShip(this.selection.id);
                this.selection = null;
                return true;
            
            case 'berth':
                const berth = this.selection.data;
                const boardData = this.currentLevel.boardData;
                
                for (let y = berth.y; y < berth.y + berth.height; y++) {
                    for (let x = berth.x; x < berth.x + berth.width; x++) {
                        if (boardData.grid[y] && boardData.grid[y][x]) {
                            boardData.grid[y][x].terrain = TerrainType.DEEP_WATER;
                            boardData.grid[y][x].berthId = null;
                        }
                    }
                }
                
                if (boardData.berths) {
                    boardData.berths.splice(this.selection.id, 1);
                    
                    for (let y = 0; y < boardData.height; y++) {
                        for (let x = 0; x < boardData.width; x++) {
                            if (boardData.grid[y] && boardData.grid[y][x]) {
                                const cell = boardData.grid[y][x];
                                if (cell.berthId !== null && cell.berthId > this.selection.id) {
                                    cell.berthId--;
                                }
                            }
                        }
                    }
                    
                    for (let i = 0; i < boardData.berths.length; i++) {
                        if (boardData.berths[i].id > this.selection.id) {
                            boardData.berths[i].id--;
                        }
                    }
                }
                
                this.currentLevel.updatedAt = new Date().toISOString();
                this.selection = null;
                return true;
            
            case 'current':
                const current = this.selection.data;
                const bData = this.currentLevel.boardData;
                
                for (let y = current.y; y < current.y + current.height; y++) {
                    for (let x = current.x; x < current.x + current.width; x++) {
                        if (bData.grid[y] && bData.grid[y][x]) {
                            bData.grid[y][x].currentId = null;
                        }
                    }
                }
                
                if (bData.currents) {
                    bData.currents.splice(this.selection.id, 1);
                    
                    for (let y = 0; y < bData.height; y++) {
                        for (let x = 0; x < bData.width; x++) {
                            if (bData.grid[y] && bData.grid[y][x]) {
                                const cell = bData.grid[y][x];
                                if (cell.currentId !== null && cell.currentId > this.selection.id) {
                                    cell.currentId--;
                                }
                            }
                        }
                    }
                    
                    for (let i = 0; i < bData.currents.length; i++) {
                        if (bData.currents[i].id > this.selection.id) {
                            bData.currents[i].id--;
                        }
                    }
                }
                
                this.currentLevel.updatedAt = new Date().toISOString();
                this.selection = null;
                return true;
            
            case 'cell':
                this.setTerrain(this.selection.x, this.selection.y, TerrainType.DEEP_WATER);
                this.selection = null;
                return true;
        }
        
        return false;
    }

    clearLevel() {
        this.currentLevel = new Level({
            name: '新关卡',
            description: ''
        });
        
        const boardData = this.currentLevel.boardData;
        boardData.grid = [];
        
        for (let y = 0; y < boardData.height; y++) {
            const row = [];
            for (let x = 0; x < boardData.width; x++) {
                row.push({
                    terrain: TerrainType.DEEP_WATER,
                    speedLimit: 2,
                    berthId: null,
                    currentId: null
                });
            }
            boardData.grid.push(row);
        }
        
        this.selection = null;
    }

    validateLevel() {
        if (!this.currentLevel) return { valid: false, issues: [{ type: 'error', message: '没有加载关卡' }] };
        return this.currentLevel.validate();
    }

    getSelection() {
        return this.selection;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LevelEditor, EditTool };
}
