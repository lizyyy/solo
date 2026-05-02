class GameEngine {
    constructor() {
        this.state = 'menu';
        this.currentLevelIndex = -1;
        this.currentLevel = null;
        
        this.gridMap = null;
        this.pathfinding = null;
        this.eventRecorder = new EventRecorder();
        
        this.passengers = [];
        this.score = 0;
        this.gameTime = 0;
        this.gameSpeed = 1;
        
        this.lastTime = 0;
        this.isRunning = false;
        this.animationId = null;
        
        this.spawnTimer = 0;
        this.spawnIndex = 0;
        this.totalPassengersToSpawn = 0;
        this.spawnedCount = 0;
        
        this.goalProgress = {};
        this.goalTargets = {};
        
        this.toolCounts = { fence: 0, staff: 0 };
        
        this.congestionReported = false;
        this.currentCongestionLocation = null;
        
        this.callbacks = {
            onUpdate: null,
            onGameEnd: null,
            onEvent: null
        };
    }

    initLevel(levelData, levelIndex = 0) {
        this.currentLevel = Helpers.deepClone(levelData);
        this.currentLevelIndex = levelIndex;
        
        this.gridMap = new GridMap(levelData);
        this.pathfinding = new Pathfinding(this.gridMap);
        this.eventRecorder.clear();
        
        this.passengers = [];
        this.score = 0;
        this.gameTime = 0;
        this.spawnTimer = 0;
        this.spawnIndex = 0;
        this.spawnedCount = 0;
        
        this.congestionReported = false;
        this.currentCongestionLocation = null;
        
        this.toolCounts = {
            fence: levelData.tools?.fence || 5,
            staff: levelData.tools?.staff || 3
        };
        
        this.goalProgress = {};
        this.goalTargets = {};
        if (levelData.goals) {
            levelData.goals.forEach((goal, idx) => {
                this.goalProgress[goal.color] = 0;
                this.goalTargets[goal.color] = goal.count;
            });
        }
        
        if (levelData.spawnConfig) {
            this.totalPassengersToSpawn = levelData.spawnConfig.total || 20;
        }
        
        this.eventRecorder.record(
            CONSTANTS.EVENT_TYPES.INFO,
            `关卡 ${levelIndex + 1} 开始: ${levelData.name}`,
            0,
            { levelIndex, levelName: levelData.name }
        );
    }

    start() {
        if (this.state !== 'playing') {
            this.state = 'playing';
            this.isRunning = true;
            this.lastTime = performance.now();
            this.gameLoop();
        }
    }

    pause() {
        this.state = 'paused';
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    resume() {
        if (this.state === 'paused') {
            this.state = 'playing';
            this.isRunning = true;
            this.lastTime = performance.now();
            this.gameLoop();
        }
    }

    togglePause() {
        if (this.state === 'playing') {
            this.pause();
        } else if (this.state === 'paused') {
            this.resume();
        }
    }

    restart() {
        this.pause();
        if (this.currentLevel) {
            this.initLevel(this.currentLevel, this.currentLevelIndex);
            this.start();
        }
    }

    gameLoop() {
        if (!this.isRunning) return;
        
        const now = performance.now();
        const rawDelta = (now - this.lastTime) / 1000;
        const deltaTime = rawDelta * this.gameSpeed;
        
        this.lastTime = now;
        
        this.update(deltaTime);
        
        if (this.callbacks.onUpdate) {
            this.callbacks.onUpdate();
        }
        
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        this.gameTime += deltaTime;
        
        this.updateSpawner(deltaTime);
        this.updatePassengers(deltaTime);
        this.checkConditions();
        this.updateCongestionMonitoring();
    }

    updateSpawner(deltaTime) {
        if (!this.currentLevel?.spawnConfig) return;
        
        const config = this.currentLevel.spawnConfig;
        const spawnRate = config.rate || 2;
        
        this.spawnTimer += deltaTime;
        
        if (this.spawnTimer >= spawnRate && this.spawnedCount < this.totalPassengersToSpawn) {
            this.spawnTimer = 0;
            this.spawnPassenger();
        }
    }

    spawnPassenger() {
        if (!this.currentLevel?.spawnConfig) return;
        
        const config = this.currentLevel.spawnConfig;
        
        let entrance;
        if (config.entranceWeights) {
            const totalWeight = Object.values(config.entranceWeights).reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            for (const [idx, weight] of Object.entries(config.entranceWeights)) {
                random -= weight;
                if (random <= 0) {
                    const entranceIdx = parseInt(idx);
                    entrance = this.gridMap.entrances[entranceIdx];
                    break;
                }
            }
        }
        
        if (!entrance) {
            entrance = Helpers.randomChoice(this.gridMap.entrances);
        }
        
        let targetColor;
        if (config.colorWeights) {
            const totalWeight = Object.values(config.colorWeights).reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            for (const [color, weight] of Object.entries(config.colorWeights)) {
                random -= weight;
                if (random <= 0) {
                    targetColor = color;
                    break;
                }
            }
        }
        
        if (!targetColor) {
            const colors = Object.keys(this.goalTargets);
            targetColor = Helpers.randomChoice(colors);
        }
        
        const passenger = new Passenger(
            Helpers.generateId(),
            entrance.x,
            entrance.y,
            targetColor,
            this.gameTime
        );
        
        passenger.recalculatePath(this.gridMap, this.pathfinding);
        
        this.passengers.push(passenger);
        this.spawnedCount++;
        
        this.eventRecorder.record(
            CONSTANTS.EVENT_TYPES.PASSENGER_SPAWN,
            `${Helpers.getColorName(targetColor)} 乘客从入口 (${entrance.x}, ${entrance.y}) 进入`,
            this.gameTime,
            { color: targetColor, x: entrance.x, y: entrance.y }
        );
        
        if (this.callbacks.onEvent) {
            this.callbacks.onEvent(this.eventRecorder.getRecentEvents(1)[0]);
        }
    }

    updatePassengers(deltaTime) {
        for (const passenger of this.passengers) {
            if (passenger.isExited) continue;
            
            const result = passenger.update(
                deltaTime,
                this.gridMap,
                this.pathfinding,
                this.passengers,
                this.gameTime
            );
            
            if (result) {
                this.handlePassengerEvent(result);
            }
        }
        
        this.passengers = this.passengers.filter(p => !p.isExited);
    }

    handlePassengerEvent(event) {
        switch (event.type) {
            case 'correct_exit':
                this.score += CONSTANTS.SCORE.CORRECT_EXIT;
                this.goalProgress[event.exitColor] = (this.goalProgress[event.exitColor] || 0) + 1;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.PASSENGER_EXIT,
                    `${Helpers.getColorName(event.exitColor)} 乘客到达正确出口，+${CONSTANTS.SCORE.CORRECT_EXIT}分`,
                    this.gameTime,
                    { color: event.exitColor, score: CONSTANTS.SCORE.CORRECT_EXIT }
                );
                break;
                
            case 'wrong_exit':
                this.score += CONSTANTS.SCORE.WRONG_EXIT;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.PASSENGER_WRONG_EXIT,
                    `乘客走错出口！目标是 ${Helpers.getColorName(event.expectedColor)}，实际走到 ${Helpers.getColorName(event.actualColor)}，${CONSTANTS.SCORE.WRONG_EXIT}分`,
                    this.gameTime,
                    { expectedColor: event.expectedColor, actualColor: event.actualColor, score: CONSTANTS.SCORE.WRONG_EXIT }
                );
                break;
                
            case 'patience_zero':
                this.score += CONSTANTS.SCORE.PATIENCE_ZERO;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.PASSENGER_PATIENCE_ZERO,
                    `乘客耐心耗尽，${CONSTANTS.SCORE.PATIENCE_ZERO}分`,
                    this.gameTime,
                    { color: event.passenger.targetColor, score: CONSTANTS.SCORE.PATIENCE_ZERO }
                );
                break;
        }
        
        if (this.callbacks.onEvent) {
            this.callbacks.onEvent(this.eventRecorder.getRecentEvents(1)[0]);
        }
    }

    updateCongestionMonitoring() {
        const congestionLevel = this.gridMap.getCongestionLevel(this.passengers);
        
        if (congestionLevel >= 70 && !this.congestionReported) {
            let worstLocation = null;
            let worstCount = 0;
            
            for (let y = 0; y < this.gridMap.height; y++) {
                for (let x = 0; x < this.gridMap.width; x++) {
                    const count = this.gridMap.getTilePassengerCount(x, y, this.passengers);
                    if (count > worstCount) {
                        worstCount = count;
                        worstLocation = { x, y };
                    }
                }
            }
            
            if (worstLocation) {
                this.congestionReported = true;
                this.currentCongestionLocation = worstLocation;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.CONGESTION_START,
                    `位置 (${worstLocation.x}, ${worstLocation.y}) 发生拥堵！当前有 ${worstCount} 名乘客`,
                    this.gameTime,
                    { location: `(${worstLocation.x}, ${worstLocation.y})`, count: worstCount }
                );
                
                if (this.callbacks.onEvent) {
                    this.callbacks.onEvent(this.eventRecorder.getRecentEvents(1)[0]);
                }
            }
        }
        
        if (congestionLevel < 40 && this.congestionReported) {
            this.congestionReported = false;
            
            this.eventRecorder.record(
                CONSTANTS.EVENT_TYPES.CONGESTION_END,
                `拥堵已缓解`,
                this.gameTime,
                {}
            );
            
            if (this.callbacks.onEvent) {
                this.callbacks.onEvent(this.eventRecorder.getRecentEvents(1)[0]);
            }
        }
    }

    checkConditions() {
        let allGoalsMet = true;
        for (const [color, target] of Object.entries(this.goalTargets)) {
            if ((this.goalProgress[color] || 0) < target) {
                allGoalsMet = false;
                break;
            }
        }
        
        const allSpawned = this.spawnedCount >= this.totalPassengersToSpawn;
        const allExited = this.passengers.every(p => p.isExited);
        
        if (allGoalsMet && allSpawned && allExited) {
            this.endGame(true);
            return;
        }
        
        if (this.score <= -500) {
            this.endGame(false);
        }
    }

    endGame(isVictory) {
        this.pause();
        this.state = 'ended';
        
        if (isVictory) {
            const timeBonus = Math.max(0, 180 - this.gameTime) * CONSTANTS.SCORE.TIME_BONUS_MULTIPLIER;
            this.score += Math.floor(timeBonus);
            
            this.eventRecorder.record(
                CONSTANTS.EVENT_TYPES.VICTORY,
                `关卡胜利！最终得分: ${this.score}`,
                this.gameTime,
                { score: this.score, timeBonus }
            );
        } else {
            this.eventRecorder.record(
                CONSTANTS.EVENT_TYPES.DEFEAT,
                `关卡失败！最终得分: ${this.score}`,
                this.gameTime,
                { score: this.score }
            );
        }
        
        if (this.callbacks.onGameEnd) {
            this.callbacks.onGameEnd(isVictory, this.score, this.gameTime);
        }
    }

    useTool(toolType, x, y) {
        if (toolType === 'fence') {
            if (this.toolCounts.fence <= 0) return false;
            if (this.gridMap.addFence(x, y)) {
                this.toolCounts.fence--;
                this.score += CONSTANTS.SCORE.FENCE_USED;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.TOOL_USED,
                    `在 (${x}, ${y}) 放置围栏`,
                    this.gameTime,
                    { tool: 'fence', x, y, score: CONSTANTS.SCORE.FENCE_USED }
                );
                
                this.recalculateAllPassengerPaths();
                return true;
            }
        } else if (toolType === 'staff') {
            if (this.toolCounts.staff <= 0) return false;
            if (this.gridMap.addStaff(x, y)) {
                this.toolCounts.staff--;
                this.score += CONSTANTS.SCORE.STAFF_USED;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.TOOL_USED,
                    `在 (${x}, ${y}) 放置工作人员`,
                    this.gameTime,
                    { tool: 'staff', x, y, score: CONSTANTS.SCORE.STAFF_USED }
                );
                
                return true;
            }
        } else if (toolType === 'gate') {
            const gate = this.gridMap.toggleGate(x, y);
            if (gate) {
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.GATE_TOGGLE,
                    `闸机 (${x}, ${y}) ${gate.open ? '开启' : '关闭'}`,
                    this.gameTime,
                    { x, y, open: gate.open }
                );
                
                this.recalculateAllPassengerPaths();
                return true;
            }
        } else if (toolType === 'remove') {
            if (this.gridMap.hasFence(x, y)) {
                this.gridMap.removeFence(x, y);
                this.toolCounts.fence++;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.TOOL_REMOVED,
                    `移除 (${x}, ${y}) 的围栏`,
                    this.gameTime,
                    { tool: 'fence', x, y }
                );
                
                this.recalculateAllPassengerPaths();
                return true;
            } else if (this.gridMap.hasStaff(x, y)) {
                this.gridMap.removeStaff(x, y);
                this.toolCounts.staff++;
                
                this.eventRecorder.record(
                    CONSTANTS.EVENT_TYPES.TOOL_REMOVED,
                    `移除 (${x}, ${y}) 的工作人员`,
                    this.gameTime,
                    { tool: 'staff', x, y }
                );
                
                return true;
            }
        }
        
        return false;
    }

    recalculateAllPassengerPaths() {
        for (const passenger of this.passengers) {
            if (!passenger.isExited) {
                passenger.recalculatePath(this.gridMap, this.pathfinding);
            }
        }
    }

    getSatisfaction() {
        if (this.passengers.length === 0) return 100;
        
        let totalSatisfaction = 0;
        let activeCount = 0;
        
        for (const p of this.passengers) {
            if (!p.isExited) {
                totalSatisfaction += p.getSatisfaction();
                activeCount++;
            }
        }
        
        if (activeCount === 0) return 100;
        
        return (totalSatisfaction / activeCount) * 100;
    }

    getCongestionLevel() {
        return this.gridMap.getCongestionLevel(this.passengers);
    }

    getRemainingPassengers() {
        const active = this.passengers.filter(p => !p.isExited).length;
        const unspawned = this.totalPassengersToSpawn - this.spawnedCount;
        return active + unspawned;
    }

    calculateStars(maxPossibleScore) {
        const ratio = this.score / maxPossibleScore;
        
        if (ratio >= CONSTANTS.STARS.THREE_STAR) return 3;
        if (ratio >= CONSTANTS.STARS.TWO_STAR) return 2;
        if (ratio >= CONSTANTS.STARS.ONE_STAR) return 1;
        return 0;
    }

    getMaxPossibleScore() {
        if (!this.currentLevel?.goals) return 1000;
        
        let total = 0;
        for (const goal of this.currentLevel.goals) {
            total += goal.count * CONSTANTS.SCORE.CORRECT_EXIT;
        }
        total += 360;
        
        return total;
    }

    setGameSpeed(speed) {
        this.gameSpeed = speed;
    }

    on(eventName, callback) {
        if (this.callbacks.hasOwnProperty(eventName)) {
            this.callbacks[eventName] = callback;
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = GameEngine;
}
