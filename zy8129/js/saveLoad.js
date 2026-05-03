/**
 * 存档和结算复盘模块
 * 处理保存/读取进度、损坏存档恢复和结算复盘功能
 */

const SaveLoad = (function() {
    'use strict';

    // 存储键名
    const STORAGE_KEYS = {
        GAME_STATE: 'lock_operator_game_state',
        SAVE_HISTORY: 'lock_operator_save_history'
    };

    // 当前存档版本
    const CURRENT_VERSION = 1;

    /**
     * 验证游戏状态数据的完整性
     * @param {Object} gameState - 游戏状态对象
     * @returns {Object} - 包含 isValid (boolean) 和 errors (数组)
     */
    function validateGameState(gameState) {
        const errors = [];

        if (!gameState) {
            errors.push('游戏状态为空');
            return { isValid: false, errors };
        }

        // 检查必要的字段
        const requiredFields = [
            'version',
            'levelId',
            'currentTime',
            'waitingShips',
            'shipsInLock',
            'completedShips',
            'violations',
            'score',
            'timestamp'
        ];

        for (const field of requiredFields) {
            if (gameState[field] === undefined) {
                errors.push(`缺少必要字段: ${field}`);
            }
        }

        // 检查版本兼容性
        if (gameState.version !== CURRENT_VERSION) {
            errors.push(`存档版本不兼容: 期望 ${CURRENT_VERSION}, 实际 ${gameState.version}`);
        }

        // 检查船只数组
        if (!Array.isArray(gameState.waitingShips)) {
            errors.push('waitingShips 不是数组');
        }
        if (!Array.isArray(gameState.shipsInLock)) {
            errors.push('shipsInLock 不是数组');
        }
        if (!Array.isArray(gameState.completedShips)) {
            errors.push('completedShips 不是数组');
        }

        // 检查违规记录
        if (!Array.isArray(gameState.violations)) {
            errors.push('violations 不是数组');
        }

        // 检查时间值
        if (typeof gameState.currentTime !== 'number' || gameState.currentTime < 0) {
            errors.push('currentTime 无效');
        }
        if (typeof gameState.score !== 'number') {
            errors.push('score 无效');
        }

        // 检查船只数据
        const allShips = [
            ...(gameState.waitingShips || []),
            ...(gameState.shipsInLock || []),
            ...(gameState.completedShips || [])
        ];

        for (const ship of allShips) {
            if (!ship.id) {
                errors.push('船只缺少 id');
            }
            if (!ship.type) {
                errors.push(`船只 ${ship.id} 缺少 type`);
            }
            if (typeof ship.size !== 'number') {
                errors.push(`船只 ${ship.id} 的 size 无效`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 尝试修复损坏的存档
     * @param {Object} corruptedState - 损坏的游戏状态
     * @param {Object} levelData - 关卡数据模块引用
     * @returns {Object|null} - 修复后的游戏状态，或 null 如果无法修复
     */
    function attemptRepair(corruptedState, levelData) {
        console.log('尝试修复损坏的存档...');

        // 尝试获取关卡ID
        const levelId = corruptedState.levelId || 1;
        const level = levelData.getLevelById(levelId);

        if (!level) {
            console.error('无法找到关卡数据，无法修复存档');
            return null;
        }

        // 创建一个基础的有效状态
        const baseState = createInitialGameState(level);

        // 尝试合并可恢复的数据
        const repairedState = { ...baseState };

        // 恢复时间（如果有效）
        if (typeof corruptedState.currentTime === 'number' && corruptedState.currentTime >= 0) {
            repairedState.currentTime = Math.min(corruptedState.currentTime, level.timeLimit);
        }

        // 恢复分数（如果有效）
        if (typeof corruptedState.score === 'number') {
            repairedState.score = Math.max(0, corruptedState.score);
        }

        // 尝试恢复船只（需要验证每艘船）
        const validateShip = (ship) => {
            if (!ship || typeof ship !== 'object') return false;
            if (!ship.id) return false;
            if (!ship.type || !['cargo', 'passenger', 'emergency'].includes(ship.type)) return false;
            if (typeof ship.size !== 'number' || ship.size <= 0) return false;
            return true;
        };

        // 恢复等待区域的船只
        if (Array.isArray(corruptedState.waitingShips)) {
            repairedState.waitingShips = corruptedState.waitingShips.filter(validateShip);
        }

        // 恢复闸室中的船只
        if (Array.isArray(corruptedState.shipsInLock)) {
            repairedState.shipsInLock = corruptedState.shipsInLock.filter(validateShip);
        }

        // 恢复已完成的船只
        if (Array.isArray(corruptedState.completedShips)) {
            repairedState.completedShips = corruptedState.completedShips.filter(validateShip);
        }

        // 恢复违规记录（如果是数组）
        if (Array.isArray(corruptedState.violations)) {
            repairedState.violations = corruptedState.violations;
        }

        // 验证修复后的状态
        const validation = validateGameState(repairedState);
        if (validation.isValid) {
            console.log('存档修复成功');
            return repairedState;
        } else {
            console.error('存档修复失败:', validation.errors);
            return null;
        }
    }

    /**
     * 创建初始游戏状态
     * @param {Object} level - 关卡对象
     * @returns {Object} - 初始游戏状态
     */
    function createInitialGameState(level) {
        // 深拷贝关卡中的船只数据
        const initialShips = JSON.parse(JSON.stringify(level.ships));

        return {
            version: CURRENT_VERSION,
            levelId: level.id,
            currentTime: level.initialTime,
            waitingShips: initialShips.filter(ship => ship.arrivalTime <= level.initialTime),
            shipsInLock: [],
            completedShips: [],
            violations: [],
            score: 0,
            timestamp: Date.now()
        };
    }

    /**
     * 保存游戏状态到 localStorage
     * @param {Object} gameState - 游戏状态对象
     * @returns {boolean} - 是否保存成功
     */
    function saveGameState(gameState) {
        try {
            // 添加时间戳
            const stateToSave = {
                ...gameState,
                timestamp: Date.now()
            };

            // 验证数据
            const validation = validateGameState(stateToSave);
            if (!validation.isValid) {
                console.error('游戏状态验证失败，无法保存:', validation.errors);
                return false;
            }

            // 保存到 localStorage
            localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(stateToSave));

            // 更新保存历史
            updateSaveHistory(stateToSave);

            console.log('游戏已保存');
            return true;
        } catch (error) {
            console.error('保存游戏失败:', error);
            return false;
        }
    }

    /**
     * 更新保存历史
     * @param {Object} gameState - 游戏状态
     */
    function updateSaveHistory(gameState) {
        try {
            let history = [];

            // 读取现有历史
            const historyStr = localStorage.getItem(STORAGE_KEYS.SAVE_HISTORY);
            if (historyStr) {
                history = JSON.parse(historyStr);
            }

            // 添加新的保存记录
            const historyEntry = {
                timestamp: gameState.timestamp,
                levelId: gameState.levelId,
                currentTime: gameState.currentTime,
                score: gameState.score
            };

            history.push(historyEntry);

            // 只保留最近的5条记录
            if (history.length > 5) {
                history = history.slice(-5);
            }

            // 保存历史
            localStorage.setItem(STORAGE_KEYS.SAVE_HISTORY, JSON.stringify(history));
        } catch (error) {
            console.error('更新保存历史失败:', error);
        }
    }

    /**
     * 从 localStorage 读取游戏状态
     * @param {Object} levelData - 关卡数据模块引用（用于修复存档）
     * @returns {Object|null} - 游戏状态对象，或 null 如果没有存档或无法恢复
     */
    function loadGameState(levelData) {
        try {
            const savedStr = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
            if (!savedStr) {
                console.log('没有找到存档');
                return null;
            }

            // 解析存档
            let gameState;
            try {
                gameState = JSON.parse(savedStr);
            } catch (parseError) {
                console.error('存档解析失败，可能已损坏:', parseError);
                
                // 尝试修复
                if (levelData) {
                    // 尝试从损坏的字符串中提取部分数据
                    const partialState = { levelId: 1 }; // 默认关卡
                    const repaired = attemptRepair(partialState, levelData);
                    if (repaired) {
                        return repaired;
                    }
                }
                
                return null;
            }

            // 验证存档
            const validation = validateGameState(gameState);
            if (validation.isValid) {
                console.log('存档加载成功');
                return gameState;
            } else {
                console.warn('存档验证失败，尝试修复...', validation.errors);
                
                // 尝试修复
                if (levelData) {
                    const repaired = attemptRepair(gameState, levelData);
                    if (repaired) {
                        // 保存修复后的存档
                        saveGameState(repaired);
                        return repaired;
                    }
                }
                
                console.error('存档无法修复');
                return null;
            }
        } catch (error) {
            console.error('读取存档失败:', error);
            return null;
        }
    }

    /**
     * 检查是否有存档
     * @returns {boolean} - 是否有存档
     */
    function hasSaveGame() {
        try {
            return localStorage.getItem(STORAGE_KEYS.GAME_STATE) !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * 删除存档
     */
    function clearSaveGame() {
        try {
            localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
            localStorage.removeItem(STORAGE_KEYS.SAVE_HISTORY);
            console.log('存档已清除');
        } catch (error) {
            console.error('清除存档失败:', error);
        }
    }

    /**
     * 创建结算复盘数据
     * @param {Object} gameState - 最终游戏状态
     * @param {Object} level - 关卡对象
     * @param {Object} rulesEngine - 规则引擎模块引用
     * @returns {Object} - 结算复盘数据
     */
    function createGameResult(gameState, level, rulesEngine) {
        const {
            completedShips,
            waitingShips,
            shipsInLock,
            violations,
            currentTime
        } = gameState;

        const remainingShips = [...waitingShips, ...shipsInLock];

        // 计算最终得分
        const finalScore = rulesEngine.calculateFinalScore(
            completedShips,
            remainingShips,
            violations,
            currentTime,
            level.timeLimit
        );

        // 分析违规原因
        const violationAnalysis = analyzeViolations(violations, completedShips, remainingShips);

        // 计算效率指标
        const efficiencyMetrics = calculateEfficiencyMetrics(
            completedShips,
            remainingShips,
            currentTime,
            level.timeLimit
        );

        // 生成建议
        const suggestions = generateSuggestions(violationAnalysis, efficiencyMetrics, level);

        return {
            levelId: level.id,
            levelName: level.name,
            finalScore,
            violationAnalysis,
            efficiencyMetrics,
            suggestions,
            completedShips: completedShips.map(s => ({
                id: s.id,
                name: s.name,
                type: s.type,
                completedTime: s.completedTime
            })),
            remainingShips: remainingShips.map(s => ({
                id: s.id,
                name: s.name,
                type: s.type
            })),
            totalTime: currentTime,
            timeLimit: level.timeLimit
        };
    }

    /**
     * 分析违规原因
     * @param {Array} violations - 违规记录
     * @param {Array} completedShips - 已完成船只
     * @param {Array} remainingShips - 剩余船只
     * @returns {Object} - 违规分析
     */
    function analyzeViolations(violations, completedShips, remainingShips) {
        const analysis = {
            totalViolations: violations.length,
            violationTypes: {},
            affectedShips: [],
            criticalViolations: [],
            minorViolations: []
        };

        // 统计违规类型
        for (const violation of violations) {
            const type = violation.type;
            if (!analysis.violationTypes[type]) {
                analysis.violationTypes[type] = {
                    count: 0,
                    totalPenalty: 0,
                    description: violation.description
                };
            }
            analysis.violationTypes[type].count++;
            analysis.violationTypes[type].totalPenalty += violation.penalty;

            // 记录受影响的船只
            if (violation.shipId) {
                analysis.affectedShips.push({
                    shipId: violation.shipId,
                    violation: violation
                });
            }

            // 区分严重和轻微违规
            if (violation.penalty >= 20) {
                analysis.criticalViolations.push(violation);
            } else {
                analysis.minorViolations.push(violation);
            }
        }

        return analysis;
    }

    /**
     * 计算效率指标
     * @param {Array} completedShips - 已完成船只
     * @param {Array} remainingShips - 剩余船只
     * @param {number} totalTime - 总用时
     * @param {number} timeLimit - 时间限制
     * @returns {Object} - 效率指标
     */
    function calculateEfficiencyMetrics(completedShips, remainingShips, totalTime, timeLimit) {
        const totalShips = completedShips.length + remainingShips.length;
        const completionRate = totalShips > 0 ? (completedShips.length / totalShips) * 100 : 0;
        const timeEfficiency = timeLimit > 0 ? (1 - (totalTime / timeLimit)) * 100 : 0;

        // 计算平均等待时间（对于已完成的船只）
        let totalWaitTime = 0;
        for (const ship of completedShips) {
            if (ship.completedTime !== undefined && ship.arrivalTime !== undefined) {
                totalWaitTime += ship.completedTime - ship.arrivalTime;
            }
        }
        const averageWaitTime = completedShips.length > 0 ? totalWaitTime / completedShips.length : 0;

        return {
            totalShips,
            completedCount: completedShips.length,
            remainingCount: remainingShips.length,
            completionRate: Math.round(completionRate),
            timeEfficiency: Math.round(Math.max(0, timeEfficiency)),
            averageWaitTime: Math.round(averageWaitTime),
            totalTime,
            timeLimit
        };
    }

    /**
     * 生成改进建议
     * @param {Object} violationAnalysis - 违规分析
     * @param {Object} efficiencyMetrics - 效率指标
     * @param {Object} level - 关卡对象
     * @returns {Array} - 建议列表
     */
    function generateSuggestions(violationAnalysis, efficiencyMetrics, level) {
        const suggestions = [];

        // 检查违规类型并生成建议
        const violationTypes = violationAnalysis.violationTypes;

        if (violationTypes[RulesEngine.ViolationTypes.OVER_CAPACITY]) {
            suggestions.push({
                type: 'capacity',
                priority: 'high',
                message: '注意闸室容量限制，货船占用2个单位空间',
                details: `您有 ${violationTypes[RulesEngine.ViolationTypes.OVER_CAPACITY].count} 次超出容量的操作`
            });
        }

        if (violationTypes[RulesEngine.ViolationTypes.WRONG_TIDAL_LEVEL]) {
            suggestions.push({
                type: 'tidal',
                priority: 'high',
                message: '注意潮汐窗口，高水位只能上行，低水位只能下行',
                details: `您有 ${violationTypes[RulesEngine.ViolationTypes.WRONG_TIDAL_LEVEL].count} 次水位不匹配的操作`
            });
        }

        if (violationTypes[RulesEngine.ViolationTypes.MISSED_DEADLINE]) {
            suggestions.push({
                type: 'deadline',
                priority: 'high',
                message: '优先处理截止时间临近的船只',
                details: `${violationTypes[RulesEngine.ViolationTypes.MISSED_DEADLINE].count} 艘船错过了截止时间`
            });
        }

        if (violationTypes[RulesEngine.ViolationTypes.PRIORITY_VIOLATION]) {
            suggestions.push({
                type: 'priority',
                priority: 'medium',
                message: '应急船优先级最高，客船次之，货船最低',
                details: `您有 ${violationTypes[RulesEngine.ViolationTypes.PRIORITY_VIOLATION].count} 次优先级违规`
            });
        }

        // 检查效率
        if (efficiencyMetrics.completionRate < 70) {
            suggestions.push({
                type: 'efficiency',
                priority: 'medium',
                message: '尝试提高完成率，合理安排船只组合',
                details: `当前完成率: ${efficiencyMetrics.completionRate}%`
            });
        }

        if (efficiencyMetrics.averageWaitTime > 30) {
            suggestions.push({
                type: 'wait_time',
                priority: 'medium',
                message: '减少船只等待时间可以获得更高分数',
                details: `平均等待时间: ${efficiencyMetrics.averageWaitTime} 分钟`
            });
        }

        // 如果没有建议，添加通用建议
        if (suggestions.length === 0) {
            suggestions.push({
                type: 'general',
                priority: 'low',
                message: '做得很好！继续保持良好的调度策略',
                details: '您的操作符合所有规则要求'
            });
        }

        return suggestions;
    }

    // 公开API
    return {
        CURRENT_VERSION,
        
        validateGameState,
        attemptRepair,
        createInitialGameState,
        saveGameState,
        loadGameState,
        hasSaveGame,
        clearSaveGame,
        createGameResult
    };
})();
