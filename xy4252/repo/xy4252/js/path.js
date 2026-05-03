class PathFinder {
    constructor(gameMap) {
        this.gameMap = gameMap;
    }

    findPath(startX, startY, endX, endY) {
        if (!this.gameMap.isWalkable(startX, startY) || !this.gameMap.isWalkable(endX, endY)) {
            return null;
        }
        
        if (startX === endX && startY === endY) {
            return [{ x: startX, y: startY }];
        }
        
        return this._aStar(startX, startY, endX, endY);
    }

    _aStar(startX, startY, endX, endY) {
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        
        const gScore = new Map();
        const fScore = new Map();
        
        const startKey = this._getKey(startX, startY);
        gScore.set(startKey, 0);
        fScore.set(startKey, this._heuristic(startX, startY, endX, endY));
        
        openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });
        
        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = this._getKey(current.x, current.y);
            
            if (current.x === endX && current.y === endY) {
                return this._reconstructPath(cameFrom, current);
            }
            
            closedSet.add(currentKey);
            
            const neighbors = this.gameMap.getNeighbors(current.x, current.y);
            
            for (const neighbor of neighbors) {
                const neighborKey = this._getKey(neighbor.x, neighbor.y);
                
                if (closedSet.has(neighborKey)) {
                    continue;
                }
                
                const tentativeGScore = gScore.get(currentKey) + 1;
                
                const inOpenSet = openSet.some(n => n.x === neighbor.x && n.y === neighbor.y);
                
                if (!inOpenSet || tentativeGScore < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    fScore.set(neighborKey, tentativeGScore + this._heuristic(neighbor.x, neighbor.y, endX, endY));
                    
                    if (!inOpenSet) {
                        openSet.push({ 
                            x: neighbor.x, 
                            y: neighbor.y, 
                            f: fScore.get(neighborKey) 
                        });
                    }
                }
            }
        }
        
        return null;
    }

    _heuristic(x1, y1, x2, y2) {
        return Math.abs(x2 - x1) + Math.abs(y2 - y1);
    }

    _getKey(x, y) {
        return `${x},${y}`;
    }

    _reconstructPath(cameFrom, current) {
        const path = [{ x: current.x, y: current.y }];
        let currentKey = this._getKey(current.x, current.y);
        
        while (cameFrom.has(currentKey)) {
            const prev = cameFrom.get(currentKey);
            path.unshift({ x: prev.x, y: prev.y });
            currentKey = this._getKey(prev.x, prev.y);
        }
        
        return path;
    }

    getPathLength(path) {
        if (!path || path.length === 0) return 0;
        return path.length - 1;
    }

    simplifyPath(path) {
        if (!path || path.length <= 2) {
            return path ? [...path] : [];
        }
        
        const simplified = [path[0]];
        let lastDirection = null;
        
        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1];
            const current = path[i];
            const next = path[i + 1];
            
            const dx1 = current.x - prev.x;
            const dy1 = current.y - prev.y;
            const dx2 = next.x - current.x;
            const dy2 = next.y - current.y;
            
            const direction = `${Math.sign(dx1)},${Math.sign(dy1)}`;
            const nextDirection = `${Math.sign(dx2)},${Math.sign(dy2)}`;
            
            if (direction !== nextDirection) {
                simplified.push(current);
            }
            
            lastDirection = nextDirection;
        }
        
        simplified.push(path[path.length - 1]);
        
        return simplified;
    }
}

class GameTimer {
    constructor() {
        this.gameTime = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.intervalId = null;
        this.tickListeners = [];
        this.startTime = null;
        this.elapsedWhenPaused = 0;
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = Date.now();
        
        this.intervalId = setInterval(() => {
            if (!this.isPaused) {
                this.gameTime++;
                this._emitTick();
            }
        }, CONFIG.GAME.TICK_INTERVAL);
    }

    pause() {
        if (!this.isRunning || this.isPaused) return;
        
        this.isPaused = true;
        this.elapsedWhenPaused = this.gameTime;
    }

    resume() {
        if (!this.isPaused) return;
        
        this.isPaused = false;
        this.startTime = Date.now();
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    reset() {
        this.stop();
        this.gameTime = 0;
        this.startTime = null;
        this.elapsedWhenPaused = 0;
    }

    addTime(seconds) {
        this.gameTime += seconds;
    }

    getTime() {
        return this.gameTime;
    }

    getFormattedTime() {
        return Utils.formatTime(this.gameTime);
    }

    isTimeUp() {
        return this.gameTime >= CONFIG.GAME.MAX_TIME;
    }

    onTick(callback) {
        this.tickListeners.push(callback);
    }

    offTick(callback) {
        this.tickListeners = this.tickListeners.filter(cb => cb !== callback);
    }

    _emitTick() {
        this.tickListeners.forEach(callback => {
            try {
                callback(this.gameTime);
            } catch (error) {
                console.error('Error in timer tick callback:', error);
            }
        });
    }

    getState() {
        return {
            gameTime: this.gameTime,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            elapsedWhenPaused: this.elapsedWhenPaused
        };
    }

    restoreState(state) {
        if (state) {
            this.gameTime = state.gameTime || 0;
            this.isRunning = state.isRunning || false;
            this.isPaused = state.isPaused || false;
            this.elapsedWhenPaused = state.elapsedWhenPaused || 0;
        }
    }
}

window.PathFinder = PathFinder;
window.GameTimer = GameTimer;