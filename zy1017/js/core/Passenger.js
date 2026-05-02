class Passenger {
    constructor(id, x, y, targetColor, spawnTime) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.targetColor = targetColor;
        this.spawnTime = spawnTime;
        
        this.patience = CONSTANTS.PASSENGER.BASE_PATIENCE;
        this.maxPatience = CONSTANTS.PASSENGER.BASE_PATIENCE;
        
        this.path = [];
        this.pathIndex = 0;
        this.progress = 0;
        
        this.isMoving = false;
        this.isBlocked = false;
        this.isExited = false;
        this.isWrongExit = false;
        this.patienceZeroReported = false;
        
        this.prevX = x;
        this.prevY = y;
    }

    update(deltaTime, gridMap, pathfinding, allPassengers, gameTime) {
        if (this.isExited) return;
        
        this.updatePatience(deltaTime, allPassengers);
        
        if (this.patience <= 0 && !this.patienceZeroReported) {
            this.patienceZeroReported = true;
            return { type: 'patience_zero', passenger: this };
        }
        
        if (!this.path || this.path.length === 0 || this.pathIndex >= this.path.length) {
            this.recalculatePath(gridMap, pathfinding);
        }
        
        if (this.path && this.pathIndex < this.path.length) {
            return this.move(deltaTime, gridMap, allPassengers, gameTime);
        }
        
        return null;
    }

    updatePatience(deltaTime, allPassengers) {
        let decay = CONSTANTS.PASSENGER.PATIENCE_DECAY * deltaTime;
        
        const passengersOnSameTile = allPassengers.filter(p => 
            p.id !== this.id && 
            !p.isExited &&
            Math.floor(p.x) === Math.floor(this.x) && 
            Math.floor(p.y) === Math.floor(this.y)
        );
        
        if (passengersOnSameTile.length >= 2) {
            decay += CONSTANTS.PASSENGER.CONGESTION_PATIENCE_PENALTY * deltaTime;
            this.isBlocked = true;
        } else {
            this.isBlocked = false;
        }
        
        this.patience = Math.max(0, this.patience - decay);
    }

    move(deltaTime, gridMap, allPassengers, gameTime) {
        if (this.pathIndex >= this.path.length) return null;
        
        const targetTile = this.path[this.pathIndex];
        const nextX = targetTile.x;
        const nextY = targetTile.y;
        
        const blockedPassenger = allPassengers.find(p => 
            p.id !== this.id && 
            !p.isExited &&
            Math.floor(p.x) === nextX && 
            Math.floor(p.y) === nextY &&
            p.progress > 0.3
        );
        
        if (blockedPassenger) {
            this.isBlocked = true;
            return null;
        }
        
        this.isBlocked = false;
        
        let speed = CONSTANTS.PASSENGER.BASE_SPEED;
        
        const hasStaff = gridMap.hasStaff(Math.floor(this.x), Math.floor(this.y));
        if (hasStaff) {
            speed *= CONSTANTS.PASSENGER.STAFF_BOOST;
        }
        
        this.progress += speed * deltaTime;
        
        if (this.progress >= 1) {
            this.prevX = this.x;
            this.prevY = this.y;
            
            this.x = nextX;
            this.y = nextY;
            this.progress = 0;
            this.pathIndex++;
            
            const exitCheck = this.checkExit(gridMap);
            if (exitCheck) {
                return exitCheck;
            }
            
            if (this.pathIndex < this.path.length) {
                const nextTile = this.path[this.pathIndex];
                if (!this.isTileWalkable(nextTile.x, nextTile.y, gridMap)) {
                    this.recalculatePath(gridMap, pathfinding);
                }
            }
        }
        
        return null;
    }

    isTileWalkable(x, y, gridMap) {
        if (!gridMap.isInBounds(x, y)) return false;
        
        const tile = gridMap.getTile(x, y);
        if (tile === CONSTANTS.TILE_TYPES.WALL || tile === CONSTANTS.TILE_TYPES.OBSTACLE) {
            return false;
        }
        
        if (tile === CONSTANTS.TILE_TYPES.GATE) {
            const gate = gridMap.getGate(x, y);
            if (gate && !gate.open) {
                return false;
            }
        }
        
        if (gridMap.hasFence(x, y)) {
            return false;
        }
        
        return true;
    }

    checkExit(gridMap) {
        const exit = gridMap.getExit(Math.floor(this.x), Math.floor(this.y));
        
        if (exit) {
            this.isExited = true;
            
            if (exit.color === this.targetColor) {
                return {
                    type: 'correct_exit',
                    passenger: this,
                    exitColor: exit.color
                };
            } else {
                this.isWrongExit = true;
                return {
                    type: 'wrong_exit',
                    passenger: this,
                    expectedColor: this.targetColor,
                    actualColor: exit.color
                };
            }
        }
        
        return null;
    }

    recalculatePath(gridMap, pathfinding) {
        const currentX = Math.floor(this.x);
        const currentY = Math.floor(this.y);
        
        const blockedSet = new Set();
        gridMap.fences.forEach((fence) => {
            blockedSet.add(`${fence.x},${fence.y}`);
        });
        
        this.path = pathfinding.findPathToAnyExit(
            currentX, 
            currentY, 
            this.targetColor, 
            blockedSet
        );
        
        this.pathIndex = 0;
        
        if (this.path && this.path.length > 0) {
            const firstStep = this.path[0];
            if (firstStep.x === currentX && firstStep.y === currentY) {
                this.pathIndex = 1;
            }
        }
    }

    getSatisfaction() {
        return this.patience / this.maxPatience;
    }

    getRenderX() {
        if (this.path && this.pathIndex < this.path.length && this.progress > 0) {
            const target = this.path[this.pathIndex];
            const startX = this.prevX;
            const endX = target.x;
            return startX + (endX - startX) * this.progress;
        }
        return this.x;
    }

    getRenderY() {
        if (this.path && this.pathIndex < this.path.length && this.progress > 0) {
            const target = this.path[this.pathIndex];
            const startY = this.prevY;
            const endY = target.y;
            return startY + (endY - startY) * this.progress;
        }
        return this.y;
    }
}

if (typeof module !== 'undefined') {
    module.exports = Passenger;
}
