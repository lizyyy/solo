export class GameState {
    constructor() {
        this.grid = [];
        this.maintenanceCars = [];
        this.lastTrains = [];
        this.criticalSegments = [];
        this.blocks = [];
        this.winConditions = {};
        this.timeLimit = Infinity;
        this.currentTurn = 0;
        this.levelId = null;
        this.levelName = null;
    }

    initializeFromLevel(level) {
        this.grid = JSON.parse(JSON.stringify(level.grid));
        this.maintenanceCars = JSON.parse(JSON.stringify(level.maintenanceCars));
        this.lastTrains = JSON.parse(JSON.stringify(level.lastTrains));
        this.criticalSegments = JSON.parse(JSON.stringify(level.criticalSegments));
        this.blocks = [];
        this.winConditions = JSON.parse(JSON.stringify(level.winConditions));
        this.timeLimit = level.timeLimit;
        this.currentTurn = level.startingTurn;
        this.levelId = level.id;
        this.levelName = level.name;
    }

    getGrid() {
        return this.grid;
    }

    getMaintenanceCars() {
        return this.maintenanceCars;
    }

    getCarById(carId) {
        return this.maintenanceCars.find(car => car.id === carId);
    }

    getLastTrains() {
        return this.lastTrains;
    }

    getTrainById(trainId) {
        return this.lastTrains.find(train => train.id === trainId);
    }

    getCriticalSegments() {
        return this.criticalSegments;
    }

    getCriticalSegmentAt(x, y) {
        return this.criticalSegments.find(segment => segment.x === x && segment.y === y);
    }

    getBlocks() {
        return this.blocks;
    }

    getBlockAt(x, y) {
        return this.blocks.find(block => block.x === x && block.y === y);
    }

    addBlock(block) {
        this.blocks.push(block);
    }

    removeBlockAt(x, y) {
        const index = this.blocks.findIndex(block => block.x === x && block.y === y);
        if (index !== -1) {
            this.blocks.splice(index, 1);
        }
    }

    getWinConditions() {
        return this.winConditions;
    }

    getTimeLimit() {
        return this.timeLimit;
    }

    getCurrentTurn() {
        return this.currentTurn;
    }

    setCurrentTurn(turn) {
        this.currentTurn = turn;
    }

    getLevelId() {
        return this.levelId;
    }

    getLevelName() {
        return this.levelName;
    }

    clone() {
        const newState = new GameState();
        newState.grid = JSON.parse(JSON.stringify(this.grid));
        newState.maintenanceCars = JSON.parse(JSON.stringify(this.maintenanceCars));
        newState.lastTrains = JSON.parse(JSON.stringify(this.lastTrains));
        newState.criticalSegments = JSON.parse(JSON.stringify(this.criticalSegments));
        newState.blocks = JSON.parse(JSON.stringify(this.blocks));
        newState.winConditions = JSON.parse(JSON.stringify(this.winConditions));
        newState.timeLimit = this.timeLimit;
        newState.currentTurn = this.currentTurn;
        newState.levelId = this.levelId;
        newState.levelName = this.levelName;
        return newState;
    }

    restoreFrom(stateData) {
        this.grid = JSON.parse(JSON.stringify(stateData.grid));
        this.maintenanceCars = JSON.parse(JSON.stringify(stateData.maintenanceCars));
        this.lastTrains = JSON.parse(JSON.stringify(stateData.lastTrains));
        this.criticalSegments = JSON.parse(JSON.stringify(stateData.criticalSegments));
        this.blocks = JSON.parse(JSON.stringify(stateData.blocks));
        this.winConditions = JSON.parse(JSON.stringify(stateData.winConditions));
        this.timeLimit = stateData.timeLimit;
        this.currentTurn = stateData.currentTurn;
        this.levelId = stateData.levelId;
        this.levelName = stateData.levelName;
    }

    toJSON() {
        return {
            grid: JSON.parse(JSON.stringify(this.grid)),
            maintenanceCars: JSON.parse(JSON.stringify(this.maintenanceCars)),
            lastTrains: JSON.parse(JSON.stringify(this.lastTrains)),
            criticalSegments: JSON.parse(JSON.stringify(this.criticalSegments)),
            blocks: JSON.parse(JSON.stringify(this.blocks)),
            winConditions: JSON.parse(JSON.stringify(this.winConditions)),
            timeLimit: this.timeLimit,
            currentTurn: this.currentTurn,
            levelId: this.levelId,
            levelName: this.levelName
        };
    }

    fromJSON(jsonData) {
        this.restoreFrom(jsonData);
    }

    getCellAt(x, y) {
        if (y >= 0 && y < this.grid.length && x >= 0 && x < this.grid[y].length) {
            return this.grid[y][x];
        }
        return null;
    }

    getAverageBattery() {
        if (this.maintenanceCars.length === 0) return 0;
        
        let total = 0;
        let maxTotal = 0;
        this.maintenanceCars.forEach(car => {
            total += car.battery;
            maxTotal += car.maxBattery;
        });
        
        return Math.floor((total / maxTotal) * 100);
    }

    getRepairedSegmentsCount() {
        return this.criticalSegments.filter(s => s.isRepaired).length;
    }

    getTotalSegmentsCount() {
        return this.criticalSegments.length;
    }
}
