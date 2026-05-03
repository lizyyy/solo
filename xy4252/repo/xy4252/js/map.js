class GameMap {
    constructor(levelData) {
        this.levelData = levelData;
        this.mapConfig = levelData.map;
        this.gridSize = this.mapConfig.gridSize || CONFIG.GAME.GRID_SIZE;
        this.width = this.mapConfig.width;
        this.height = this.mapConfig.height;
        
        this.buildings = [];
        this.parks = [];
        this.waters = [];
        this.roads = [];
        this.entrances = [];
        
        this.aedLocations = [];
        this.patient = null;
        
        this.obstacles = [];
        
        this._initializeMap();
    }

    _initializeMap() {
        const config = this.mapConfig;
        
        this.buildings = config.buildings || [];
        this.parks = config.parks || [];
        this.waters = config.waters || [];
        this.roads = config.roads || [];
        this.entrances = config.entrances || [];
        
        this.aedLocations = this.levelData.resources?.aedLocations || [];
        this.patient = this.levelData.patient;
        
        this._buildObstacleList();
    }

    _buildObstacleList() {
        this.obstacles = [];
        
        this.buildings.forEach(building => {
            for (let x = building.x; x < building.x + building.width; x++) {
                for (let y = building.y; y < building.y + building.height; y++) {
                    this.obstacles.push({ x, y, type: 'building', name: building.name });
                }
            }
        });
        
        this.waters.forEach(water => {
            for (let x = water.x; x < water.x + water.width; x++) {
                for (let y = water.y; y < water.y + water.height; y++) {
                    this.obstacles.push({ x, y, type: 'water', name: water.name });
                }
            }
        });
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        
        return !this.obstacles.some(obs => obs.x === x && obs.y === y);
    }

    getNeighbors(x, y) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];
        
        directions.forEach(dir => {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (this.isWalkable(nx, ny)) {
                neighbors.push({ x: nx, y: ny });
            }
        });
        
        return neighbors;
    }

    getPixelPosition(gridX, gridY) {
        return {
            x: gridX * this.gridSize + this.gridSize / 2,
            y: gridY * this.gridSize + this.gridSize / 2
        };
    }

    getGridPosition(pixelX, pixelY) {
        return {
            x: Math.floor(pixelX / this.gridSize),
            y: Math.floor(pixelY / this.gridSize)
        };
    }

    getAEDLocation(index = 0) {
        return this.aedLocations[index] || this.aedLocations[0];
    }

    getAllAEDLocations() {
        return [...this.aedLocations];
    }

    getPatientPosition() {
        return this.patient;
    }

    getDimensions() {
        return {
            width: this.width * this.gridSize,
            height: this.height * this.gridSize
        };
    }

    getGridSize() {
        return this.gridSize;
    }
}

window.GameMap = GameMap;