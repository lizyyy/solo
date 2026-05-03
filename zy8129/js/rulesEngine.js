/**
 * 规则引擎模块
 * 处理游戏的核心规则：潮汐窗口、闸室容量、等待成本、优先级和违规检测
 */

const RulesEngine = (function() {
    'use strict';

    // 违规类型枚举
    const ViolationTypes = {
        OVER_CAPACITY: 'over_capacity',           // 超出闸室容量
        WRONG_TIDAL_LEVEL: 'wrong_tidal_level',   // 潮汐水位不匹配
        MISSED_DEADLINE: 'missed_deadline',       // 错过截止时间
        PRIORITY_VIOLATION: 'priority_violation', // 优先级违规
        DIRECTION_MISMATCH: 'direction_mismatch', // 方向不匹配
        EMPTY_LOCK_OPERATION: 'empty_lock_operation', // 空闸室操作
        TIME_EXCEEDED: 'time_exceeded'            // 超出时间限制
    };

    // 违规描述
    const ViolationDescriptions = {
        [ViolationTypes.OVER_CAPACITY]: '闸室容量超出限制',
        [ViolationTypes.WRONG_TIDAL_LEVEL]: '当前潮汐水位不支持此操作',
        [ViolationTypes.MISSED_DEADLINE]: '船只错过截止时间',
        [ViolationTypes.PRIORITY_VIOLATION]: '优先级较高的船只未优先处理',
        [ViolationTypes.DIRECTION_MISMATCH]: '船只方向与操作方向不匹配',
        [ViolationTypes.EMPTY_LOCK_OPERATION]: '闸室为空，无法进行操作',
        [ViolationTypes.TIME_EXCEEDED]: '超出关卡时间限制'
    };

    // 违规扣分
    const ViolationPenalties = {
        [ViolationTypes.OVER_CAPACITY]: 20,
        [ViolationTypes.WRONG_TIDAL_LEVEL]: 15,
        [ViolationTypes.MISSED_DEADLINE]: 30,
        [ViolationTypes.PRIORITY_VIOLATION]: 25,
        [ViolationTypes.DIRECTION_MISMATCH]: 10,
        [ViolationTypes.EMPTY_LOCK_OPERATION]: 5,
        [ViolationTypes.TIME_EXCEEDED]: 50
    };

    /**
     * 检查当前时间的潮汐水位
     * @param {Array} tidalWindows - 潮汐窗口数组
     * @param {number} currentTime - 当前时间（分钟）
     * @returns {string|null} - 当前水位 ('high' 或 'low')，如果不在任何窗口内返回 null
     */
    function getCurrentTidalLevel(tidalWindows, currentTime) {
        for (const window of tidalWindows) {
            // 检查时间是否在窗口内（支持跨午夜的情况）
            if (window.start <= window.end) {
                // 正常窗口（不跨午夜）
                if (currentTime >= window.start && currentTime < window.end) {
                    return window.level;
                }
            } else {
                // 跨午夜窗口（start > end）
                if (currentTime >= window.start || currentTime < window.end) {
                    return window.level;
                }
            }
        }
        return null;
    }

    /**
     * 检查潮汐窗口是否允许特定方向的操作
     * @param {string} tidalLevel - 当前潮汐水位 ('high' 或 'low')
     * @param {string} direction - 操作方向 ('up' 上行 或 'down' 下行)
     * @returns {boolean} - 是否允许
     */
    function isDirectionAllowed(tidalLevel, direction) {
        // 高水位允许上行，低水位允许下行
        if (tidalLevel === 'high' && direction === 'up') {
            return true;
        }
        if (tidalLevel === 'low' && direction === 'down') {
            return true;
        }
        return false;
    }

    /**
     * 计算闸室当前使用的容量
     * @param {Array} shipsInLock - 闸室中的船只数组
     * @returns {number} - 已使用的容量
     */
    function calculateUsedCapacity(shipsInLock) {
        return shipsInLock.reduce((total, ship) => total + ship.size, 0);
    }

    /**
     * 检查是否可以添加船只到闸室
     * @param {Object} ship - 要添加的船只
     * @param {Array} shipsInLock - 当前闸室中的船只
     * @param {number} maxCapacity - 闸室最大容量
     * @returns {Object} - 包含 canAdd (boolean) 和 violations (数组)
     */
    function canAddShipToLock(ship, shipsInLock, maxCapacity) {
        const violations = [];
        const usedCapacity = calculateUsedCapacity(shipsInLock);
        const newCapacity = usedCapacity + ship.size;

        if (newCapacity > maxCapacity) {
            violations.push({
                type: ViolationTypes.OVER_CAPACITY,
                description: ViolationDescriptions[ViolationTypes.OVER_CAPACITY],
                details: `闸室容量: ${maxCapacity}, 已使用: ${usedCapacity}, 添加后: ${newCapacity}`,
                penalty: ViolationPenalties[ViolationTypes.OVER_CAPACITY]
            });
        }

        return {
            canAdd: violations.length === 0,
            violations: violations
        };
    }

    /**
     * 检查是否可以执行开闸操作
     * @param {Array} shipsInLock - 闸室中的船只
     * @param {string} direction - 操作方向 ('up' 或 'down')
     * @param {string} tidalLevel - 当前潮汐水位
     * @param {number} currentTime - 当前时间
     * @param {Array} waitingShips - 等待区域的船只（用于优先级检查）
     * @returns {Object} - 包含 canExecute (boolean) 和 violations (数组)
     */
    function canExecuteLockOperation(shipsInLock, direction, tidalLevel, currentTime, waitingShips) {
        const violations = [];

        // 检查闸室是否为空
        if (shipsInLock.length === 0) {
            violations.push({
                type: ViolationTypes.EMPTY_LOCK_OPERATION,
                description: ViolationDescriptions[ViolationTypes.EMPTY_LOCK_OPERATION],
                details: '闸室中没有船只',
                penalty: ViolationPenalties[ViolationTypes.EMPTY_LOCK_OPERATION],
                time: currentTime
            });
        }

        // 检查潮汐水位是否匹配
        if (!isDirectionAllowed(tidalLevel, direction)) {
            violations.push({
                type: ViolationTypes.WRONG_TIDAL_LEVEL,
                description: ViolationDescriptions[ViolationTypes.WRONG_TIDAL_LEVEL],
                details: `当前水位: ${tidalLevel}, 操作方向: ${direction}`,
                penalty: ViolationPenalties[ViolationTypes.WRONG_TIDAL_LEVEL],
                time: currentTime
            });
        }

        // 检查船只方向是否匹配
        for (const ship of shipsInLock) {
            if (ship.targetDirection !== direction) {
                violations.push({
                    type: ViolationTypes.DIRECTION_MISMATCH,
                    description: ViolationDescriptions[ViolationTypes.DIRECTION_MISMATCH],
                    details: `船只 ${ship.name} 方向: ${ship.targetDirection}, 操作方向: ${direction}`,
                    penalty: ViolationPenalties[ViolationTypes.DIRECTION_MISMATCH],
                    time: currentTime,
                    shipId: ship.id
                });
            }
        }

        // 检查优先级违规（是否有更高优先级的船只在等待）
        const maxPriorityInLock = Math.max(...shipsInLock.map(s => s.priority), 0);
        const higherPriorityWaiting = waitingShips.filter(s => s.priority > maxPriorityInLock);
        
        if (higherPriorityWaiting.length > 0) {
            violations.push({
                type: ViolationTypes.PRIORITY_VIOLATION,
                description: ViolationDescriptions[ViolationTypes.PRIORITY_VIOLATION],
                details: `有 ${higherPriorityWaiting.length} 艘优先级更高的船只在等待`,
                penalty: ViolationPenalties[ViolationTypes.PRIORITY_VIOLATION],
                time: currentTime
            });
        }

        return {
            canExecute: violations.length === 0,
            violations: violations
        };
    }

    /**
     * 计算单艘船的等待成本
     * @param {Object} ship - 船只对象
     * @param {number} currentTime - 当前时间
     * @returns {number} - 等待成本
     */
    function calculateWaitCost(ship, currentTime) {
        const waitTime = currentTime - ship.arrivalTime;
        return Math.max(0, waitTime * ship.waitCost);
    }

    /**
     * 计算所有等待船只的总等待成本
     * @param {Array} waitingShips - 等待区域的船只
     * @param {Array} shipsInLock - 闸室中的船只
     * @param {number} currentTime - 当前时间
     * @returns {number} - 总等待成本
     */
    function calculateTotalWaitCost(waitingShips, shipsInLock, currentTime) {
        const allWaiting = [...waitingShips, ...shipsInLock];
        return allWaiting.reduce((total, ship) => total + calculateWaitCost(ship, currentTime), 0);
    }

    /**
     * 检查船只是否错过截止时间
     * @param {Object} ship - 船只对象
     * @param {number} currentTime - 当前时间
     * @returns {Object|null} - 违规对象或 null
     */
    function checkDeadlineViolation(ship, currentTime) {
        if (currentTime > ship.deadline) {
            return {
                type: ViolationTypes.MISSED_DEADLINE,
                description: ViolationDescriptions[ViolationTypes.MISSED_DEADLINE],
                details: `船只 ${ship.name} 截止时间: ${ship.deadline}, 当前时间: ${currentTime}`,
                penalty: ViolationPenalties[ViolationTypes.MISSED_DEADLINE],
                time: currentTime,
                shipId: ship.id
            };
        }
        return null;
    }

    /**
     * 检查所有船只的截止时间违规
     * @param {Array} waitingShips - 等待区域的船只
     * @param {Array} shipsInLock - 闸室中的船只
     * @param {number} currentTime - 当前时间
     * @returns {Array} - 违规数组
     */
    function checkAllDeadlineViolations(waitingShips, shipsInLock, currentTime) {
        const violations = [];
        const allShips = [...waitingShips, ...shipsInLock];
        
        for (const ship of allShips) {
            const violation = checkDeadlineViolation(ship, currentTime);
            if (violation) {
                violations.push(violation);
            }
        }
        
        return violations;
    }

    /**
     * 计算船只完成过闸的得分
     * @param {Object} ship - 船只对象
     * @param {number} currentTime - 当前时间
     * @param {Array} violations - 与该船相关的违规记录
     * @returns {Object} - 包含 baseScore, bonus, penalties, totalScore
     */
    function calculateShipScore(ship, currentTime, violations = []) {
        const baseScore = ship.baseScore;
        
        // 计算提前完成奖励
        const timeBonus = Math.max(0, ship.deadline - currentTime) * 0.5;
        
        // 计算与该船相关的违规扣分
        const shipViolations = violations.filter(v => v.shipId === ship.id);
        const penalties = shipViolations.reduce((total, v) => total + v.penalty, 0);
        
        const totalScore = Math.max(0, baseScore + timeBonus - penalties);
        
        return {
            baseScore,
            timeBonus,
            penalties,
            totalScore
        };
    }

    /**
     * 计算关卡最终得分
     * @param {Array} completedShips - 已完成的船只
     * @param {Array} remainingShips - 剩余未完成的船只
     * @param {Array} allViolations - 所有违规记录
     * @param {number} currentTime - 当前时间
     * @param {number} timeLimit - 时间限制
     * @returns {Object} - 最终得分详情
     */
    function calculateFinalScore(completedShips, remainingShips, allViolations, currentTime, timeLimit) {
        let totalBaseScore = 0;
        let totalTimeBonus = 0;
        let totalShipPenalties = 0;
        let totalGeneralPenalties = 0;
        
        // 计算已完成船只的得分
        for (const ship of completedShips) {
            const shipScore = calculateShipScore(ship, ship.completedTime || currentTime, allViolations);
            totalBaseScore += shipScore.baseScore;
            totalTimeBonus += shipScore.timeBonus;
            totalShipPenalties += shipScore.penalties;
        }
        
        // 计算未完成船只的惩罚
        for (const ship of remainingShips) {
            totalGeneralPenalties += ship.baseScore * 0.5; // 未完成扣50%基础分
        }
        
        // 计算一般违规的惩罚（不针对特定船只的）
        const generalViolations = allViolations.filter(v => !v.shipId);
        totalGeneralPenalties += generalViolations.reduce((total, v) => total + v.penalty, 0);
        
        // 检查时间限制
        if (currentTime > timeLimit) {
            totalGeneralPenalties += ViolationPenalties[ViolationTypes.TIME_EXCEEDED];
        }
        
        const finalScore = Math.max(0, totalBaseScore + totalTimeBonus - totalShipPenalties - totalGeneralPenalties);
        
        return {
            totalBaseScore,
            totalTimeBonus,
            totalShipPenalties,
            totalGeneralPenalties,
            finalScore,
            completedCount: completedShips.length,
            remainingCount: remainingShips.length
        };
    }

    /**
     * 推进时间
     * @param {number} currentTime - 当前时间
     * @param {number} minutes - 要推进的分钟数
     * @param {number} timeLimit - 时间限制
     * @returns {Object} - 包含 newTime 和 isTimeExceeded
     */
    function advanceTime(currentTime, minutes, timeLimit) {
        const newTime = currentTime + minutes;
        const isTimeExceeded = newTime >= timeLimit;
        
        return {
            newTime,
            isTimeExceeded
        };
    }

    /**
     * 检查关卡是否结束
     * @param {Array} waitingShips - 等待区域的船只
     * @param {Array} shipsInLock - 闸室中的船只
     * @param {number} currentTime - 当前时间
     * @param {number} timeLimit - 时间限制
     * @returns {boolean} - 是否结束
     */
    function isLevelComplete(waitingShips, shipsInLock, currentTime, timeLimit) {
        // 所有船只都已完成过闸，或者时间已到
        return (waitingShips.length === 0 && shipsInLock.length === 0) || currentTime >= timeLimit;
    }

    // 公开API
    return {
        ViolationTypes,
        ViolationDescriptions,
        ViolationPenalties,
        
        getCurrentTidalLevel,
        isDirectionAllowed,
        calculateUsedCapacity,
        canAddShipToLock,
        canExecuteLockOperation,
        calculateWaitCost,
        calculateTotalWaitCost,
        checkDeadlineViolation,
        checkAllDeadlineViolations,
        calculateShipScore,
        calculateFinalScore,
        advanceTime,
        isLevelComplete
    };
})();
