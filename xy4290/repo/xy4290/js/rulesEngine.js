// 规则计算模块 - 负责路径查找、资源消耗校验、覆盖范围计算

import { CellType, UnitType, CommandType, GameState } from './types.js';

/**
 * 规则引擎类
 */
export class RulesEngine {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    /**
     * 计算两点之间的曼哈顿距离
     * @param {import('./types.js').Position} a - 点 A
     * @param {import('./types.js').Position} b - 点 B
     * @returns {number} 曼哈顿距离
     */
    manhattanDistance(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    /**
     * 使用 A* 算法查找最短路径
     * @param {import('./types.js').Position} start - 起始位置
     * @param {import('./types.js').Position} end - 目标位置
     * @param {Object} [options] - 选项
     * @param {boolean} [options.ignoreBlocked] - 是否忽略阻断的格子（用于维修时）
     * @returns {import('./types.js').ValidationResult} 包含路径的验证结果
     */
    findPath(start, end, options = {}) {
        const state = this.stateManager.getCurrentState();
        if (!state) {
            return { valid: false, error: '游戏状态未初始化' };
        }

        const { cells } = state;
        const { ignoreBlocked = false } = options;

        const isPassable = (x, y) => {
            if (x < 0 || x >= cells[0].length || y < 0 || y >= cells.length) {
                return false;
            }
            const cell = cells[y][x];
            
            if (ignoreBlocked && cell.type === CellType.BLOCKED) {
                return true;
            }
            
            return cell.isPassable || cell.hasBroadcast;
        };

        const getNeighbors = (x, y) => {
            const neighbors = [];
            const directions = [
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 }
            ];

            for (const { dx, dy } of directions) {
                const nx = x + dx;
                const ny = y + dy;
                if (isPassable(nx, ny)) {
                    neighbors.push({ x: nx, y: ny });
                }
            }

            return neighbors;
        };

        const openSet = [{ x: start.x, y: start.y, g: 0, h: 0, f: 0, parent: null }];
        const closedSet = new Set();

        const key = (x, y) => `${x},${y}`;

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();

            if (current.x === end.x && current.y === end.y) {
                const path = [];
                let node = current;
                while (node) {
                    path.unshift({ x: node.x, y: node.y });
                    node = node.parent;
                }
                return {
                    valid: true,
                    details: {
                        path,
                        distance: path.length - 1,
                        steps: path.length
                    }
                };
            }

            closedSet.add(key(current.x, current.y));

            for (const neighbor of getNeighbors(current.x, current.y)) {
                if (closedSet.has(key(neighbor.x, neighbor.y))) {
                    continue;
                }

                const g = current.g + 1;
                const h = this.manhattanDistance(neighbor, end);
                const f = g + h;

                const existingIndex = openSet.findIndex(
                    n => n.x === neighbor.x && n.y === neighbor.y
                );

                if (existingIndex === -1) {
                    openSet.push({
                        x: neighbor.x,
                        y: neighbor.y,
                        g,
                        h,
                        f,
                        parent: current
                    });
                } else if (g < openSet[existingIndex].g) {
                    openSet[existingIndex] = {
                        ...openSet[existingIndex],
                        g,
                        f,
                        parent: current
                    };
                }
            }
        }

        return {
            valid: false,
            error: '无法找到到达目标的路径',
            details: { reason: '路径被阻断' }
        };
    }

    /**
     * 验证移动指令
     * @param {string} unitId - 单位 ID
     * @param {import('./types.js').Position} target - 目标位置
     * @returns {import('./types.js').ValidationResult} 验证结果
     */
    validateMove(unitId, target) {
        const unit = this.stateManager.getUnitById(unitId);
        
        if (!unit) {
            return { valid: false, error: '单位不存在' };
        }

        const cell = this.stateManager.getCell(target.x, target.y);
        
        if (!cell) {
            return { valid: false, error: '目标位置超出网格范围' };
        }

        if (!cell.isPassable && cell.type !== CellType.BROADCAST_POINT) {
            return { valid: false, error: '目标位置不可通行' };
        }

        const pathResult = this.findPath(unit.position, target);
        
        if (!pathResult.valid) {
            return pathResult;
        }

        const distance = pathResult.details.distance;
        let fuelCost = 0;
        let timeCost = 0;

        if (unit.type === UnitType.REPAIR_VEHICLE) {
            fuelCost = distance * 2;
            timeCost = distance * unit.moveSpeed;
        } else if (unit.type === UnitType.GENERATOR) {
            timeCost = distance * unit.moveSpeed;
        }

        if (unit.type === UnitType.REPAIR_VEHICLE && unit.fuel < fuelCost) {
            return {
                valid: false,
                error: '维修车油量不足',
                details: {
                    required: fuelCost,
                    available: unit.fuel
                }
            };
        }

        return {
            valid: true,
            details: {
                path: pathResult.details.path,
                distance,
                fuelCost,
                timeCost
            }
        };
    }

    /**
     * 验证维修指令
     * @param {string} unitId - 维修车 ID
     * @param {import('./types.js').Position} target - 目标位置（被阻断的道路）
     * @returns {import('./types.js').ValidationResult} 验证结果
     */
    validateRepair(unitId, target) {
        const unit = this.stateManager.getUnitById(unitId);
        
        if (!unit) {
            return { valid: false, error: '单位不存在' };
        }

        if (unit.type !== UnitType.REPAIR_VEHICLE) {
            return { valid: false, error: '只有维修车可以执行维修操作' };
        }

        const cell = this.stateManager.getCell(target.x, target.y);
        
        if (!cell) {
            return { valid: false, error: '目标位置超出网格范围' };
        }

        if (cell.type !== CellType.BLOCKED) {
            return { valid: false, error: '目标位置不是可维修的阻断区域' };
        }

        if (!cell.isRepairable) {
            return { valid: false, error: '该区域无法修复' };
        }

        const adjacentPositions = [
            { x: target.x, y: target.y - 1 },
            { x: target.x, y: target.y + 1 },
            { x: target.x - 1, y: target.y },
            { x: target.x + 1, y: target.y }
        ];

        let canReach = false;
        let bestPathResult = null;

        for (const adjPos of adjacentPositions) {
            const adjCell = this.stateManager.getCell(adjPos.x, adjPos.y);
            if (adjCell && (adjCell.isPassable || adjCell.hasBroadcast)) {
                const pathResult = this.findPath(unit.position, adjPos);
                if (pathResult.valid) {
                    canReach = true;
                    if (!bestPathResult || pathResult.details.distance < bestPathResult.details.distance) {
                        bestPathResult = pathResult;
                    }
                }
            }
        }

        if (!canReach) {
            return { valid: false, error: '无法到达维修位置附近' };
        }

        const distance = bestPathResult.details.distance;
        const repairTime = cell.repairCost / unit.repairSpeed;
        const moveTime = distance * unit.moveSpeed;
        const totalTime = moveTime + repairTime;
        const fuelCost = distance * 2;

        if (unit.fuel < fuelCost) {
            return {
                valid: false,
                error: '维修车油量不足',
                details: {
                    required: fuelCost,
                    available: unit.fuel
                }
            };
        }

        return {
            valid: true,
            details: {
                path: bestPathResult.details.path,
                targetPosition: target,
                distance,
                fuelCost,
                moveTime,
                repairTime,
                totalTime
            }
        };
    }

    /**
     * 验证补给指令
     * @param {string} unitId - 维修车 ID
     * @param {import('./types.js').Position} target - 目标位置（发电机位置）
     * @returns {import('./types.js').ValidationResult} 验证结果
     */
    validateSupply(unitId, target) {
        const unit = this.stateManager.getUnitById(unitId);
        
        if (!unit) {
            return { valid: false, error: '单位不存在' };
        }

        if (unit.type !== UnitType.REPAIR_VEHICLE) {
            return { valid: false, error: '只有维修车可以执行补给操作' };
        }

        const state = this.stateManager.getCurrentState();
        const targetGenerator = state.units.find(
            u => u.type === UnitType.GENERATOR && 
                 u.position.x === target.x && 
                 u.position.y === target.y
        );

        if (!targetGenerator) {
            return { valid: false, error: '目标位置没有发电机' };
        }

        const moveResult = this.validateMove(unitId, target);
        
        if (!moveResult.valid) {
            return moveResult;
        }

        const supplyTime = 10;
        const totalTime = moveResult.details.timeCost + supplyTime;

        return {
            valid: true,
            details: {
                ...moveResult.details,
                supplyTime,
                totalTime,
                targetGenerator: targetGenerator.id
            }
        };
    }

    /**
     * 验证部署指令
     * @param {string} unitId - 发电机 ID
     * @param {import('./types.js').Position} target - 目标位置（广播点位置）
     * @returns {import('./types.js').ValidationResult} 验证结果
     */
    validateDeploy(unitId, target) {
        const unit = this.stateManager.getUnitById(unitId);
        
        if (!unit) {
            return { valid: false, error: '单位不存在' };
        }

        if (unit.type !== UnitType.GENERATOR) {
            return { valid: false, error: '只有发电机可以执行部署操作' };
        }

        if (unit.isDeployed) {
            return { valid: false, error: '发电机已经部署' };
        }

        const cell = this.stateManager.getCell(target.x, target.y);
        
        if (!cell) {
            return { valid: false, error: '目标位置超出网格范围' };
        }

        if (!cell.hasBroadcast) {
            return { valid: false, error: '目标位置没有广播点' };
        }

        if (cell.isBroadcastActive) {
            return { valid: false, error: '该广播点已经激活' };
        }

        const moveResult = this.validateMove(unitId, target);
        
        if (!moveResult.valid) {
            return moveResult;
        }

        const deployTime = 5;
        const totalTime = moveResult.details.timeCost + deployTime;

        if (unit.fuel <= 0) {
            return { valid: false, error: '发电机没有油量，无法部署' };
        }

        return {
            valid: true,
            details: {
                ...moveResult.details,
                deployTime,
                totalTime,
                broadcastPoint: { x: target.x, y: target.y }
            }
        };
    }

    /**
     * 计算当前广播覆盖范围
     * @returns {Object} 覆盖信息
     */
    calculateCoverage() {
        const state = this.stateManager.getCurrentState();
        if (!state) {
            return {
                coverage: 0,
                coveredCells: new Set(),
                activeBroadcasts: []
            };
        }

        const { cells } = state;
        const coveredCells = new Set();
        const activeBroadcasts = [];

        for (let y = 0; y < cells.length; y++) {
            for (let x = 0; x < cells[0].length; x++) {
                const cell = cells[y][x];
                if (cell.hasBroadcast && cell.isBroadcastActive) {
                    activeBroadcasts.push({ x, y, range: cell.broadcastRange });
                    
                    const range = cell.broadcastRange;
                    for (let dy = -range; dy <= range; dy++) {
                        for (let dx = -range; dx <= range; dx++) {
                            if (Math.abs(dx) + Math.abs(dy) <= range) {
                                const cx = x + dx;
                                const cy = y + dy;
                                if (cx >= 0 && cx < cells[0].length && 
                                    cy >= 0 && cy < cells.length) {
                                    coveredCells.add(`${cx},${cy}`);
                                }
                            }
                        }
                    }
                }
            }
        }

        const totalCells = cells.length * cells[0].length;
        const coverage = Math.round((coveredCells.size / totalCells) * 100);

        return {
            coverage,
            coveredCells,
            activeBroadcasts,
            totalCells,
            coveredCellCount: coveredCells.size
        };
    }

    /**
     * 执行指令并更新游戏状态
     * @param {import('./types.js').Command} command - 要执行的指令
     * @returns {import('./types.js').ValidationResult} 执行结果
     */
    executeCommand(command) {
        const { type, unitId, target } = command;
        
        let validationResult;
        
        switch (type) {
            case CommandType.MOVE:
                validationResult = this.validateMove(unitId, target);
                break;
            case CommandType.REPAIR:
                validationResult = this.validateRepair(unitId, target);
                break;
            case CommandType.SUPPLY:
                validationResult = this.validateSupply(unitId, target);
                break;
            case CommandType.DEPLOY:
                validationResult = this.validateDeploy(unitId, target);
                break;
            default:
                return { valid: false, error: `未知的指令类型: ${type}` };
        }

        if (!validationResult.valid) {
            return validationResult;
        }

        this.applyCommand(command, validationResult.details);

        return {
            valid: true,
            details: validationResult.details
        };
    }

    /**
     * 应用指令到游戏状态
     * @param {import('./types.js').Command} command - 指令
     * @param {Object} details - 验证详情
     */
    applyCommand(command, details) {
        const { type, unitId, target } = command;
        const unit = this.stateManager.getUnitById(unitId);

        this.stateManager.updateTime(details.totalTime || details.timeCost || 0);

        switch (type) {
            case CommandType.MOVE:
                this.stateManager.updateUnit(unitId, {
                    position: { x: target.x, y: target.y }
                });
                if (unit.type === UnitType.REPAIR_VEHICLE) {
                    this.stateManager.updateUnit(unitId, {
                        fuel: unit.fuel - (details.fuelCost || 0)
                    });
                }
                break;

            case CommandType.REPAIR:
                this.stateManager.updateUnit(unitId, {
                    position: { 
                        x: details.path[details.path.length - 1].x, 
                        y: details.path[details.path.length - 1].y 
                    },
                    fuel: unit.fuel - (details.fuelCost || 0)
                });
                this.stateManager.updateCell(target.x, target.y, {
                    type: CellType.ROAD,
                    isPassable: true,
                    isRepairable: false
                });
                break;

            case CommandType.SUPPLY:
                this.stateManager.updateUnit(unitId, {
                    position: { x: target.x, y: target.y },
                    fuel: unit.fuel - (details.fuelCost || 0)
                });
                const generator = this.stateManager.getUnitById(details.targetGenerator);
                if (generator) {
                    this.stateManager.updateUnit(details.targetGenerator, {
                        fuel: Math.min(generator.maxFuel, generator.fuel + 50)
                    });
                }
                break;

            case CommandType.DEPLOY:
                this.stateManager.updateUnit(unitId, {
                    position: { x: target.x, y: target.y },
                    isDeployed: true
                });
                this.stateManager.updateCell(target.x, target.y, {
                    isBroadcastActive: true
                });
                break;
        }

        const coverageInfo = this.calculateCoverage();
        this.stateManager.updateCoverage(coverageInfo.coverage);

        this.checkGameEnd();
    }

    /**
     * 检查游戏是否结束
     */
    checkGameEnd() {
        const state = this.stateManager.getCurrentState();
        const config = this.stateManager.getLevelConfig();
        
        if (!state || !config) return;

        if (state.currentTime >= config.timeLimit) {
            if (state.coverage >= config.targetCoverage) {
                this.stateManager.updateGameState(GameState.WON);
            } else {
                this.stateManager.updateGameState(GameState.LOST);
            }
            return;
        }

        if (state.coverage >= config.targetCoverage) {
            this.stateManager.updateGameState(GameState.WON);
        }
    }

    /**
     * 计算分数
     * @returns {import('./types.js').ScoreResult} 评分结果
     */
    calculateScore() {
        const state = this.stateManager.getCurrentState();
        const config = this.stateManager.getLevelConfig();
        
        if (!state || !config) {
            return {
                totalScore: 0,
                grade: 'D',
                breakdown: {
                    coverageScore: 0,
                    timeScore: 0,
                    efficiencyScore: 0
                }
            };
        }

        const { scoring, timeLimit, targetCoverage } = config;
        const { coverage, currentTime } = state;

        const coverageRatio = Math.min(1, coverage / 100);
        const coverageScore = Math.round(coverageRatio * 500);

        let timeScore = 0;
        if (currentTime <= scoring.perfectTime) {
            timeScore = 300;
        } else if (currentTime <= scoring.goodTime) {
            const perfectRatio = (scoring.goodTime - currentTime) / (scoring.goodTime - scoring.perfectTime);
            timeScore = Math.round(200 + perfectRatio * 100);
        } else if (currentTime < timeLimit) {
            const ratio = (timeLimit - currentTime) / (timeLimit - scoring.goodTime);
            timeScore = Math.round(ratio * 200);
        }

        let efficiencyScore = 0;
        if (coverage >= scoring.perfectCoverage) {
            efficiencyScore = 200;
        } else if (coverage >= scoring.goodCoverage) {
            const ratio = (coverage - scoring.goodCoverage) / (scoring.perfectCoverage - scoring.goodCoverage);
            efficiencyScore = Math.round(100 + ratio * 100);
        } else if (coverage >= targetCoverage) {
            const ratio = (coverage - targetCoverage) / (scoring.goodCoverage - targetCoverage);
            efficiencyScore = Math.round(ratio * 100);
        }

        const totalScore = coverageScore + timeScore + efficiencyScore;

        let grade = 'D';
        if (totalScore >= 900) {
            grade = 'S';
        } else if (totalScore >= 750) {
            grade = 'A';
        } else if (totalScore >= 600) {
            grade = 'B';
        } else if (totalScore >= 400) {
            grade = 'C';
        }

        return {
            totalScore,
            grade,
            breakdown: {
                coverageScore,
                timeScore,
                efficiencyScore
            }
        };
    }
}

export default RulesEngine;
