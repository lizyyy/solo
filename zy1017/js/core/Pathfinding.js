class Pathfinding {
    constructor(gridMap) {
        this.gridMap = gridMap;
    }

    findPath(startX, startY, endX, endY, additionalBlocked = new Set()) {
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        
        const startKey = `${startX},${startY}`;
        const endKey = `${endX},${endY}`;
        
        const gScore = new Map();
        const fScore = new Map();
        
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, endX, endY));
        
        openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });
        
        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;
            
            if (current.x === endX && current.y === endY) {
                return this.reconstructPath(cameFrom, current);
            }
            
            closedSet.add(currentKey);
            
            const neighbors = this.getNeighbors(current.x, current.y, additionalBlocked);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                if (closedSet.has(neighborKey)) continue;
                
                const tentativeGScore = (gScore.get(currentKey) || 0) + 1;
                
                const inOpenSet = openSet.some(n => n.x === neighbor.x && n.y === neighbor.y);
                
                if (!inOpenSet || tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor.x, neighbor.y, endX, endY));
                    
                    if (!inOpenSet) {
                        openSet.push({ x: neighbor.x, y: neighbor.y, f: fScore.get(neighborKey) });
                    }
                }
            }
        }
        
        return null;
    }

    heuristic(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    getNeighbors(x, y, additionalBlocked) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 }
        ];
        
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            
            if (this.isWalkable(nx, ny, additionalBlocked)) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        
        return neighbors;
    }

    isWalkable(x, y, additionalBlocked) {
        if (!this.gridMap.isInBounds(x, y)) return false;
        
        const tile = this.gridMap.getTile(x, y);
        if (tile === CONSTANTS.TILE_TYPES.WALL || tile === CONSTANTS.TILE_TYPES.OBSTACLE) {
            return false;
        }
        
        if (tile === CONSTANTS.TILE_TYPES.GATE) {
            const gate = this.gridMap.getGate(x, y);
            if (gate && !gate.open) {
                return false;
            }
        }
        
        const key = `${x},${y}`;
        if (additionalBlocked.has(key)) {
            return false;
        }
        
        return true;
    }

    reconstructPath(cameFrom, current) {
        const path = [{ x: current.x, y: current.y }];
        let currentKey = `${current.x},${current.y}`;
        
        while (cameFrom.has(currentKey)) {
            const prev = cameFrom.get(currentKey);
            path.unshift({ x: prev.x, y: prev.y });
            currentKey = `${prev.x},${prev.y}`;
        }
        
        return path;
    }

    findPathToAnyExit(startX, startY, targetColor, additionalBlocked = new Set()) {
        const exits = this.gridMap.getExitsByColor(targetColor);
        
        if (exits.length === 0) {
            return null;
        }
        
        let bestPath = null;
        let bestDistance = Infinity;
        
        for (const exit of exits) {
            const path = this.findPath(startX, startY, exit.x, exit.y, additionalBlocked);
            if (path && path.length < bestDistance) {
                bestPath = path;
                bestDistance = path.length;
            }
        }
        
        return bestPath;
    }
}

if (typeof module !== 'undefined') {
    module.exports = Pathfinding;
}
