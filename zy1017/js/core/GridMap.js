class GridMap {
    constructor(levelData) {
        this.width = levelData.width;
        this.height = levelData.height;
        this.grid = Helpers.deepClone(levelData.grid);
        
        this.entrances = Helpers.deepClone(levelData.entrances);
        this.exits = Helpers.deepClone(levelData.exits);
        this.gates = [];
        this.obstacles = [];
        
        this.fences = [];
        this.staffMembers = [];
        
        if (levelData.gates) {
            this.gates = Helpers.deepClone(levelData.gates);
        }
        if (levelData.obstacles) {
            this.obstacles = Helpers.deepClone(levelData.obstacles);
        }
    }

    getTile(x, y) {
        if (!this.isInBounds(x, y)) return CONSTANTS.TILE_TYPES.WALL;
        return this.grid[y][x];
    }

    setTile(x, y, type) {
        if (this.isInBounds(x, y)) {
            this.grid[y][x] = type;
        }
    }

    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    getEntrance(x, y) {
        return this.entrances.find(e => e.x === x && e.y === y);
    }

    getEntrancesByColor(color) {
        return this.entrances.filter(e => e.color === color);
    }

    getExit(x, y) {
        return this.exits.find(e => e.x === x && e.y === y);
    }

    getExitsByColor(color) {
        return this.exits.filter(e => e.color === color);
    }

    getGate(x, y) {
        return this.gates.find(g => g.x === x && g.y === y);
    }

    toggleGate(x, y) {
        const gate = this.getGate(x, y);
        if (gate) {
            gate.open = !gate.open;
            return gate;
        }
        return null;
    }

    addFence(x, y) {
        if (!this.isInBounds(x, y)) return false;
        if (this.hasFence(x, y)) return false;
        
        const tile = this.getTile(x, y);
        if (tile === CONSTANTS.TILE_TYPES.WALL || 
            tile === CONSTANTS.TILE_TYPES.ENTRANCE || 
            tile === CONSTANTS.TILE_TYPES.EXIT ||
            tile === CONSTANTS.TILE_TYPES.OBSTACLE) {
            return false;
        }
        
        this.fences.push({ x, y, placedAt: Date.now() });
        return true;
    }

    removeFence(x, y) {
        const index = this.fences.findIndex(f => f.x === x && f.y === y);
        if (index !== -1) {
            this.fences.splice(index, 1);
            return true;
        }
        return false;
    }

    hasFence(x, y) {
        return this.fences.some(f => f.x === x && f.y === y);
    }

    addStaff(x, y) {
        if (!this.isInBounds(x, y)) return false;
        if (this.hasStaff(x, y)) return false;
        
        const tile = this.getTile(x, y);
        if (tile === CONSTANTS.TILE_TYPES.WALL || 
            tile === CONSTANTS.TILE_TYPES.ENTRANCE || 
            tile === CONSTANTS.TILE_TYPES.EXIT ||
            tile === CONSTANTS.TILE_TYPES.OBSTACLE) {
            return false;
        }
        
        if (this.hasFence(x, y)) {
            return false;
        }
        
        this.staffMembers.push({ x, y, placedAt: Date.now() });
        return true;
    }

    removeStaff(x, y) {
        const index = this.staffMembers.findIndex(s => s.x === x && s.y === y);
        if (index !== -1) {
            this.staffMembers.splice(index, 1);
            return true;
        }
        return false;
    }

    hasStaff(x, y) {
        return this.staffMembers.some(s => s.x === x && s.y === y);
    }

    canPlaceTool(x, y, toolType) {
        if (!this.isInBounds(x, y)) return false;
        
        const tile = this.getTile(x, y);
        
        if (tile === CONSTANTS.TILE_TYPES.WALL || 
            tile === CONSTANTS.TILE_TYPES.ENTRANCE || 
            tile === CONSTANTS.TILE_TYPES.EXIT ||
            tile === CONSTANTS.TILE_TYPES.OBSTACLE) {
            return false;
        }
        
        if (toolType === 'fence') {
            if (this.hasFence(x, y)) return false;
            if (this.hasStaff(x, y)) return false;
        } else if (toolType === 'staff') {
            if (this.hasStaff(x, y)) return false;
            if (this.hasFence(x, y)) return false;
        } else if (toolType === 'gate') {
            if (tile !== CONSTANTS.TILE_TYPES.GATE) return false;
        }
        
        return true;
    }

    getTilePassengerCount(x, y, passengers) {
        return passengers.filter(p => 
            !p.isExited &&
            Math.floor(p.getRenderX()) === x && 
            Math.floor(p.getRenderY()) === y
        ).length;
    }

    getCongestionLevel(passengers) {
        let maxCongestion = 0;
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.getTile(x, y);
                if (tile !== CONSTANTS.TILE_TYPES.WALL && 
                    tile !== CONSTANTS.TILE_TYPES.OBSTACLE) {
                    const count = this.getTilePassengerCount(x, y, passengers);
                    const congestion = Math.min(100, count * 25);
                    maxCongestion = Math.max(maxCongestion, congestion);
                }
            }
        }
        
        return maxCongestion;
    }

    reset() {
        this.fences = [];
        this.staffMembers = [];
        
        if (this.gates) {
            this.gates.forEach(gate => {
                if (gate.defaultOpen !== undefined) {
                    gate.open = gate.defaultOpen;
                }
            });
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = GridMap;
}
