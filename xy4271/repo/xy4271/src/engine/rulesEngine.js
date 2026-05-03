export class RulesEngine {
    constructor(gameState) {
        this.gameState = gameState;
    }

    validateMove(move) {
        const { type, carId, targetX, targetY } = move;

        if (type === 'move_car') {
            return this._validateCarMove(carId, targetX, targetY);
        } else if (type === 'place_block') {
            return this._validateBlockPlace(targetX, targetY);
        } else if (type === 'remove_block') {
            return this._validateBlockRemove(targetX, targetY);
        } else if (type === 'repair') {
            return this._validateRepair(carId, targetX, targetY);
        }

        return { valid: false, reason: '未知操作类型' };
    }

    _validateCarMove(carId, targetX, targetY) {
        const car = this.gameState.getCarById(carId);
        if (!car) {
            return { valid: false, reason: '检修车不存在' };
        }

        if (car.battery < car.movementCost) {
            return { valid: false, reason: '电量不足，无法移动' };
        }

        if (car.x === targetX && car.y === targetY) {
            return { valid: false, reason: '目标位置与当前位置相同' };
        }

        const grid = this.gameState.getGrid();
        if (!this._isValidPosition(targetX, targetY, grid)) {
            return { valid: false, reason: '目标位置无效' };
        }

        if (!this._isAdjacent(car.x, car.y, targetX, targetY)) {
            return { valid: false, reason: '只能移动到相邻位置' };
        }

        if (!this._isConnected(car.x, car.y, targetX, targetY, grid)) {
            return { valid: false, reason: '两个位置没有轨道连接' };
        }

        if (this._isPositionBlocked(targetX, targetY)) {
            return { valid: false, reason: '目标位置被封锁' };
        }

        if (this._isCarAtPosition(targetX, targetY)) {
            return { valid: false, reason: '目标位置已有其他检修车' };
        }

        return { valid: true };
    }

    _validateBlockPlace(targetX, targetY) {
        const grid = this.gameState.getGrid();
        if (!this._isValidPosition(targetX, targetY, grid)) {
            return { valid: false, reason: '目标位置无效' };
        }

        if (this._isPositionBlocked(targetX, targetY)) {
            return { valid: false, reason: '该位置已被封锁' };
        }

        if (this._isCarAtPosition(targetX, targetY)) {
            return { valid: false, reason: '不能在检修车位置放置封锁区' };
        }

        if (this._isCriticalSegmentAtPosition(targetX, targetY) && 
            !this._isCriticalSegmentRepaired(targetX, targetY)) {
            return { valid: false, reason: '不能在未修复的关键轨段放置封锁区' };
        }

        return { valid: true };
    }

    _validateBlockRemove(targetX, targetY) {
        if (!this._isPositionBlocked(targetX, targetY)) {
            return { valid: false, reason: '该位置没有封锁区' };
        }

        return { valid: true };
    }

    _validateRepair(carId, targetX, targetY) {
        const car = this.gameState.getCarById(carId);
        if (!car) {
            return { valid: false, reason: '检修车不存在' };
        }

        if (car.battery < car.repairCost) {
            return { valid: false, reason: '电量不足，无法进行维修' };
        }

        if (car.x !== targetX || car.y !== targetY) {
            return { valid: false, reason: '检修车必须在目标位置才能维修' };
        }

        const segment = this.gameState.getCriticalSegmentAt(targetX, targetY);
        if (!segment) {
            return { valid: false, reason: '该位置没有需要维修的关键轨段' };
        }

        if (segment.isRepaired) {
            return { valid: false, reason: '该轨段已经修复完成' };
        }

        return { valid: true };
    }

    executeMove(move) {
        const validation = this.validateMove(move);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }

        const { type, carId, targetX, targetY } = move;

        switch (type) {
            case 'move_car':
                return this._executeCarMove(carId, targetX, targetY);
            case 'place_block':
                return this._executeBlockPlace(targetX, targetY);
            case 'remove_block':
                return this._executeBlockRemove(targetX, targetY);
            case 'repair':
                return this._executeRepair(carId, targetX, targetY);
            default:
                return { success: false, reason: '未知操作类型' };
        }
    }

    _executeCarMove(carId, targetX, targetY) {
        const car = this.gameState.getCarById(carId);
        
        const oldX = car.x;
        const oldY = car.y;
        
        car.x = targetX;
        car.y = targetY;
        car.battery -= car.movementCost;

        return {
            success: true,
            action: {
                type: 'move_car',
                carId,
                from: { x: oldX, y: oldY },
                to: { x: targetX, y: targetY },
                batteryDelta: -car.movementCost
            }
        };
    }

    _executeBlockPlace(targetX, targetY) {
        const block = {
            x: targetX,
            y: targetY,
            placedTurn: this.gameState.getCurrentTurn()
        };
        
        this.gameState.addBlock(block);

        return {
            success: true,
            action: {
                type: 'place_block',
                position: { x: targetX, y: targetY }
            }
        };
    }

    _executeBlockRemove(targetX, targetY) {
        this.gameState.removeBlockAt(targetX, targetY);

        return {
            success: true,
            action: {
                type: 'remove_block',
                position: { x: targetX, y: targetY }
            }
        };
    }

    _executeRepair(carId, targetX, targetY) {
        const car = this.gameState.getCarById(carId);
        const segment = this.gameState.getCriticalSegmentAt(targetX, targetY);
        
        const oldRemainingTime = segment.remainingTime;
        segment.remainingTime -= 1;
        
        if (segment.remainingTime <= 0) {
            segment.isRepaired = true;
        }

        const oldBattery = car.battery;
        car.battery -= car.repairCost;

        return {
            success: true,
            action: {
                type: 'repair',
                carId,
                position: { x: targetX, y: targetY },
                segmentId: segment.id,
                oldRemainingTime,
                newRemainingTime: segment.remainingTime,
                isNowRepaired: segment.isRepaired,
                oldBattery,
                newBattery: car.battery
            }
        };
    }

    advanceTurn() {
        const currentTurn = this.gameState.getCurrentTurn();
        const newTurn = currentTurn + 1;
        
        this.gameState.setCurrentTurn(newTurn);
        
        this._moveLastTrains(newTurn);
        
        const conflictCheck = this._checkConflicts();
        if (conflictCheck.hasConflict) {
            return {
                turnAdvanced: true,
                gameEnded: true,
                endType: 'conflict',
                reason: conflictCheck.reason
            };
        }

        const batteryCheck = this._checkBatteryLevels();
        if (batteryCheck.hasFailure) {
            return {
                turnAdvanced: true,
                gameEnded: true,
                endType: 'battery_depleted',
                reason: batteryCheck.reason
            };
        }

        const deadlineCheck = this._checkDeadlines();
        if (deadlineCheck.hasFailure) {
            return {
                turnAdvanced: true,
                gameEnded: true,
                endType: 'deadline_missed',
                reason: deadlineCheck.reason
            };
        }

        const timeLimitCheck = this._checkTimeLimit(newTurn);
        if (timeLimitCheck.hasFailure) {
            return {
                turnAdvanced: true,
                gameEnded: true,
                endType: 'time_limit_exceeded',
                reason: timeLimitCheck.reason
            };
        }

        const winCheck = this._checkWinConditions();
        if (winCheck.hasWon) {
            return {
                turnAdvanced: true,
                gameEnded: true,
                endType: 'victory',
                reason: winCheck.reason,
                score: this._calculateScore()
            };
        }

        return {
            turnAdvanced: true,
            gameEnded: false
        };
    }

    _moveLastTrains(currentTurn) {
        const trains = this.gameState.getLastTrains();
        
        trains.forEach(train => {
            if (train.status === 'completed') return;
            
            if (currentTurn >= train.startTime) {
                if (train.status === 'waiting') {
                    train.status = 'moving';
                }
                
                const movesRemaining = train.speed;
                for (let i = 0; i < movesRemaining; i++) {
                    if (train.currentPosition < train.route.length - 1) {
                        train.currentPosition += 1;
                    } else {
                        train.status = 'completed';
                        break;
                    }
                }
            }
        });
    }

    _checkConflicts() {
        const cars = this.gameState.getMaintenanceCars();
        const trains = this.gameState.getLastTrains();
        const blocks = this.gameState.getBlocks();

        for (const train of trains) {
            if (train.status !== 'moving') continue;
            
            const trainPos = train.route[train.currentPosition];
            if (!trainPos) continue;

            for (const car of cars) {
                if (car.x === trainPos.x && car.y === trainPos.y) {
                    return {
                        hasConflict: true,
                        reason: `检修车 ${car.name} 与末班车 ${train.name} 在位置 (${trainPos.x}, ${trainPos.y}) 发生冲突！`
                    };
                }
            }

            for (const block of blocks) {
                if (block.x === trainPos.x && block.y === trainPos.y) {
                    return {
                        hasConflict: true,
                        reason: `末班车 ${train.name} 在位置 (${trainPos.x}, ${trainPos.y}) 撞上封锁区！`
                    };
                }
            }
        }

        return { hasConflict: false };
    }

    _checkBatteryLevels() {
        const cars = this.gameState.getMaintenanceCars();
        
        for (const car of cars) {
            if (car.battery <= 0) {
                return {
                    hasFailure: true,
                    reason: `检修车 ${car.name} 电量耗尽！`
                };
            }
        }

        return { hasFailure: false };
    }

    _checkDeadlines() {
        const currentTurn = this.gameState.getCurrentTurn();
        const segments = this.gameState.getCriticalSegments();
        
        for (const segment of segments) {
            if (segment.isRepaired) continue;
            if (segment.deadline === Infinity) continue;
            
            if (currentTurn >= segment.deadline) {
                return {
                    hasFailure: true,
                    reason: `关键轨段 (${segment.x}, ${segment.y}) 维修超时！截止时间为第 ${segment.deadline} 回合。`
                };
            }
        }

        return { hasFailure: false };
    }

    _checkTimeLimit(currentTurn) {
        const timeLimit = this.gameState.getTimeLimit();
        
        if (timeLimit !== Infinity && currentTurn >= timeLimit) {
            return {
                hasFailure: true,
                reason: `超过时间限制！最大回合数为 ${timeLimit}。`
            };
        }

        return { hasFailure: false };
    }

    _checkWinConditions() {
        const winConditions = this.gameState.getWinConditions();
        const segments = this.gameState.getCriticalSegments();

        if (winConditions.repairAllCritical) {
            const allRepaired = segments.every(s => s.isRepaired);
            if (!allRepaired) {
                return { hasWon: false };
            }
        }

        return {
            hasWon: true,
            reason: '所有关键轨段已修复，任务完成！'
        };
    }

    _calculateScore() {
        const currentTurn = this.gameState.getCurrentTurn();
        const cars = this.gameState.getMaintenanceCars();
        const segments = this.gameState.getCriticalSegments();
        const timeLimit = this.gameState.getTimeLimit();

        let score = 100;

        const totalRepairTime = segments.reduce((sum, s) => sum + s.repairTime, 0);
        const timeBonus = Math.max(0, (timeLimit === Infinity ? 20 : (timeLimit - currentTurn)) * 2);
        score += timeBonus;

        let remainingBatterySum = 0;
        let maxBatterySum = 0;
        cars.forEach(car => {
            remainingBatterySum += car.battery;
            maxBatterySum += car.maxBattery;
        });
        const batteryBonus = Math.floor((remainingBatterySum / maxBatterySum) * 20);
        score += batteryBonus;

        let grade = 'C';
        if (score >= 130) grade = 'S';
        else if (score >= 115) grade = 'A';
        else if (score >= 100) grade = 'B';

        return {
            points: score,
            grade,
            breakdown: {
                baseScore: 100,
                timeBonus,
                batteryBonus
            }
        };
    }

    _isValidPosition(x, y, grid) {
        if (y < 0 || y >= grid.length) return false;
        if (x < 0 || x >= grid[y].length) return false;
        if (grid[y][x].type === 'empty') return false;
        return true;
    }

    _isAdjacent(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }

    _isConnected(x1, y1, x2, y2, grid) {
        const cell1 = grid[y1][x1];
        const cell2 = grid[y2][x2];
        
        let direction = '';
        let oppositeDirection = '';
        
        if (y2 < y1) {
            direction = 'N';
            oppositeDirection = 'S';
        } else if (y2 > y1) {
            direction = 'S';
            oppositeDirection = 'N';
        } else if (x2 < x1) {
            direction = 'W';
            oppositeDirection = 'E';
        } else if (x2 > x1) {
            direction = 'E';
            oppositeDirection = 'W';
        }

        return cell1.connections.includes(direction) && cell2.connections.includes(oppositeDirection);
    }

    _isPositionBlocked(x, y) {
        const blocks = this.gameState.getBlocks();
        return blocks.some(b => b.x === x && b.y === y);
    }

    _isCarAtPosition(x, y) {
        const cars = this.gameState.getMaintenanceCars();
        return cars.some(c => c.x === x && c.y === y);
    }

    _isCriticalSegmentAtPosition(x, y) {
        const segments = this.gameState.getCriticalSegments();
        return segments.some(s => s.x === x && s.y === y);
    }

    _isCriticalSegmentRepaired(x, y) {
        const segment = this.gameState.getCriticalSegmentAt(x, y);
        return segment ? segment.isRepaired : true;
    }
}
