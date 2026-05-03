/**
 * 主游戏逻辑模块
 * 整合所有模块，处理游戏状态管理、用户交互和界面渲染
 */

const Game = (function() {
    'use strict';

    // 游戏状态
    let gameState = null;
    let currentLevel = null;
    let isGameRunning = false;
    let selectedShip = null;

    /**
     * 初始化游戏
     */
    function init() {
        console.log('游戏初始化...');

        // 初始化拖拽模块
        DragState.init({
            onDragStart: handleDragStart,
            onDragEnd: handleDragEnd,
            onDrop: handleDrop,
            onInvalidDrop: handleInvalidDrop
        });

        // 绑定事件监听器
        bindEventListeners();

        // 检查是否有存档
        if (SaveLoad.hasSaveGame()) {
            // 可以选择加载存档或开始新游戏
            console.log('检测到存档，可选择加载');
        }

        // 默认加载第一个关卡
        startNewGame(1);

        console.log('游戏初始化完成');
    }

    /**
     * 绑定事件监听器
     */
    function bindEventListeners() {
        // 按钮事件
        document.getElementById('save-btn').addEventListener('click', handleSaveGame);
        document.getElementById('load-btn').addEventListener('click', handleLoadGame);
        document.getElementById('level-select-btn').addEventListener('click', showLevelSelect);
        document.getElementById('close-level-modal').addEventListener('click', hideLevelSelect);
        document.getElementById('lock-up-btn').addEventListener('click', () => handleLockOperation('up'));
        document.getElementById('lock-down-btn').addEventListener('click', () => handleLockOperation('down'));
        document.getElementById('clear-lock-btn').addEventListener('click', handleClearLock);
        document.getElementById('restart-btn').addEventListener('click', handleRestart);
        document.getElementById('back-to-menu-btn').addEventListener('click', handleBackToMenu);

        // 点击模态框外部点击关闭
        document.getElementById('level-select-modal').addEventListener('click', (e) => {
            if (e.target.id === 'level-select-modal') {
                hideLevelSelect();
            }
        });

        document.getElementById('result-modal').addEventListener('click', (e) => {
            if (e.target.id === 'result-modal') {
                hideResultModal();
            }
        });
    }

    /**
     * 开始新游戏
     * @param {number} levelId - 关卡ID
     */
    function startNewGame(levelId) {
        // 获取关卡数据
        const level = LevelData.getLevelById(levelId);
        if (!level) {
            console.error('无法找到关卡:', levelId);
            return;
        }

        currentLevel = level;

        // 创建初始游戏状态
        gameState = SaveLoad.createInitialGameState(level);
        isGameRunning = true;

        // 更新UI
        updateLevelSelect();
        updateGameUI();
        renderTidalTimeline();
        renderShips();
        updateScoreDisplay();
        updateTimeDisplay();
        updateViolationsDisplay();
    }

    /**
     * 处理保存游戏
     */
    function handleSaveGame() {
        if (!gameState) {
            alert('没有游戏状态可保存');
            return;
        }

        const success = SaveLoad.saveGameState(gameState);
        if (success) {
            alert('游戏已保存');
        } else {
            alert('保存失败，请检查控制台');
        }
    }

    /**
     * 处理加载游戏
     */
    function handleLoadGame() {
        const savedState = SaveLoad.loadGameState(LevelData);
        if (!savedState) {
            alert('没有找到存档或存档已损坏');
            return;
        }

        // 获取关卡数据
        const level = LevelData.getLevelById(savedState.levelId);
        if (!level) {
            alert('存档中的关卡不存在');
            return;
        }

        currentLevel = level;
        gameState = savedState;
        isGameRunning = true;

        // 更新UI
        updateGameUI();
        renderTidalTimeline();
        renderShips();
        updateScoreDisplay();
        updateTimeDisplay();
        updateViolationsDisplay();

        alert('游戏已加载');
    }

    /**
     * 显示关卡选择
     */
    function showLevelSelect() {
        const levelList = document.getElementById('level-list');
        levelList.innerHTML = '';

        const levels = LevelData.getAllLevels();
        
        levels.forEach(level => {
            const levelItem = document.createElement('div');
            levelItem.className = 'level-item';
            levelItem.innerHTML = `
                <h3>${level.name}</h3>
                <p>${level.description}</p>
                <p class="level-info">
                    闸室容量: ${level.lockCapacity} | 
                    时间限制: ${LevelData.formatTime(level.timeLimit, Math.floor(level.initialTime / 60))}
                </p>
            `;
            levelItem.addEventListener('click', () => {
                startNewGame(level.id);
                hideLevelSelect();
            });
            levelList.appendChild(levelItem);
        });

        document.getElementById('level-select-modal').classList.remove('hidden');
    }

    /**
     * 隐藏关卡选择
     */
    function hideLevelSelect() {
        document.getElementById('level-select-modal').classList.add('hidden');
    }

    /**
     * 更新关卡选择UI
     */
    function updateLevelSelect() {
        // 更新当前关卡显示
        const levelInfo = document.getElementById('current-level');
        if (currentLevel) {
            levelInfo.textContent = `关卡：${currentLevel.name}`;
        }
    }

    /**
     * 处理拖拽开始
     * @param {Object} ship - 被拖拽的船只
     * @param {string} sourceContainer - 源容器ID
     */
    function handleDragStart(ship, sourceContainer) {
        console.log('开始拖拽:', ship.name);
        selectedShip = ship;
        
        // 显示船只详情
        showShipDetails(ship);
    }

    /**
     * 处理拖拽结束
     * @param {Object} ship - 被拖拽的船只
     * @param {boolean} success - 是否成功放置
     */
    function handleDragEnd(ship, success) {
        console.log('拖拽结束:', ship.name, success ? '成功' : '失败');
    }

    /**
     * 处理放置
     * @param {Object} ship - 被放置的船只
     * @param {string} sourceContainer - 源容器ID
     * @param {number} sourceIndex - 源索引
     * @param {string} targetContainer - 目标容器ID
     * @returns {boolean} - 是否成功放置
     */
    function handleDrop(ship, sourceContainer, sourceIndex, targetContainer) {
        console.log('放置船只:', ship.name, '从', sourceContainer, '到', targetContainer);

        // 根据源数组
        let sourceArray;
        if (sourceContainer === 'waiting-ships') {
            sourceArray = gameState.waitingShips;
        } else if (sourceContainer === 'lock-chamber') {
            sourceArray = gameState.shipsInLock;
        } else {
            return false;
        }

        // 目标数组
        let targetArray;
        if (targetContainer === 'waiting-ships') {
            targetArray = gameState.waitingShips;
        } else if (targetContainer === 'lock-chamber') {
            targetArray = gameState.shipsInLock;
        } else {
            return false;
        }

        // 如果是拖到闸室，检查容量
        if (targetContainer === 'lock-chamber') {
            const check = RulesEngine.canAddShipToLock(ship, gameState.shipsInLock, currentLevel.lockCapacity);
            if (!check.canAdd) {
                // 添加违规记录
                gameState.violations.push(...check.violations);
                updateViolationsDisplay();
                alert('无法放置：闸室容量不足');
                return false;
            }
        }

        // 从源数组移除
        const shipToMove = sourceArray.splice(sourceIndex, 1)[0];
        
        // 添加到目标数组
        targetArray.push(shipToMove);

        // 重新渲染
        renderShips();

        return true;
    }

    /**
     * 处理无效放置
     * @param {Object} ship - 被放置的船只
     * @param {string} sourceContainer - 源容器ID
     * @param {string} targetContainer - 目标容器ID（可能为null）
     */
    function handleInvalidDrop(ship, sourceContainer, targetContainer) {
        console.log('无效放置:', ship.name, '目标:', targetContainer);
    }

    /**
     * 处理开闸操作
     * @param {string} direction - 方向 ('up' 或 'down')
     */
    function handleLockOperation(direction) {
        if (!isGameRunning || gameState.shipsInLock.length === 0) {
            alert('闸室中没有船只');
            return;
        }

        // 获取当前潮汐水位
        const tidalLevel = RulesEngine.getCurrentTidalLevel(
            currentLevel.tidalWindows,
            gameState.currentTime
        );

        // 检查是否可以执行操作
        const check = RulesEngine.canExecuteLockOperation(
            gameState.shipsInLock,
            direction,
            tidalLevel,
            gameState.currentTime,
            gameState.waitingShips
        );

        // 记录违规
        if (check.violations.length > 0) {
            gameState.violations.push(...check.violations);
            updateViolationsDisplay();
        }

        // 即使有违规也允许操作，但会扣分
        // 推进时间（开闸操作需要15分钟）
        const timeAdvance = RulesEngine.advanceTime(
            gameState.currentTime,
            15,
            currentLevel.timeLimit
        );

        gameState.currentTime = timeAdvance.newTime;

        // 检查截止时间违规
        const deadlineViolations = RulesEngine.checkAllDeadlineViolations(
            gameState.waitingShips,
            gameState.shipsInLock,
            gameState.currentTime
        );

        if (deadlineViolations.length > 0) {
            gameState.violations.push(...deadlineViolations);
            updateViolationsDisplay();
        }

        // 处理闸室中的船只
        const completedShips = [];
        const directionName = direction === 'up' ? '上行' : '下行';

        for (const ship of gameState.shipsInLock) {
            // 检查船只方向是否匹配
            if (ship.targetDirection === direction) {
                // 完成过闸
                ship.completedTime = gameState.currentTime;
                completedShips.push(ship);
                
                // 计算得分
                const shipScore = RulesEngine.calculateShipScore(
                    ship,
                    gameState.currentTime,
                    gameState.violations
                );
                
                gameState.score += shipScore.totalScore;
                
                console.log(`船只 ${ship.name} 完成${directionName}，得分:`, shipScore.totalScore);
            } else {
                // 方向不匹配的船只要回到等待区域
                gameState.waitingShips.push(ship);
                console.log(`船只 ${ship.name} 方向不匹配，返回等待区域`);
            }
        }

        // 添加到已完成列表
        gameState.completedShips.push(...completedShips);

        // 清空闸室
        gameState.shipsInLock = [];

        // 更新UI
        renderShips();
        updateScoreDisplay();
        updateTimeDisplay();
        renderTidalTimeline();

        // 检查新到达的船只
        checkNewShipArrivals();

        // 检查游戏是否结束
        checkGameEnd();
    }

    /**
     * 处理清空闸室
     */
    function handleClearLock() {
        if (gameState.shipsInLock.length === 0) {
            return;
        }

        // 将闸室中的船只移回等待区域
        gameState.waitingShips.push(...gameState.shipsInLock);
        gameState.shipsInLock = [];

        renderShips();
    }

    /**
     * 检查新到达的船只
     */
    function checkNewShipArrivals() {
        // 从关卡数据中获取所有船只
        const allShips = currentLevel.ships;
        
        // 找到还没有出现在游戏中的船只
        const existingShipIds = new Set([
            ...gameState.waitingShips.map(s => s.id),
            ...gameState.shipsInLock.map(s => s.id),
            ...gameState.completedShips.map(s => s.id)
        ]);

        for (const ship of allShips) {
            if (!existingShipIds.has(ship.id) && ship.arrivalTime <= gameState.currentTime) {
                // 新船到达
                const newShip = JSON.parse(JSON.stringify(ship));
                gameState.waitingShips.push(newShip);
                console.log(`新船到达: ${newShip.name}`);
            }
        }

        renderShips();
    }

    /**
     * 检查游戏是否结束
     */
    function checkGameEnd() {
        const isComplete = RulesEngine.isLevelComplete(
            gameState.waitingShips,
            gameState.shipsInLock,
            gameState.currentTime,
            currentLevel.timeLimit
        );

        if (isComplete) {
            isGameRunning = false;
            showGameResult();
        }
    }

    /**
     * 显示游戏结果
     */
    function showGameResult() {
        // 创建结算数据
        const result = SaveLoad.createGameResult(
            gameState,
            currentLevel,
            RulesEngine
        );

        // 填充结果模态框
        const resultDetails = document.getElementById('result-details');
        resultDetails.innerHTML = `
            <div class="result-section">
                <h4>关卡信息</h4>
                <p>关卡: ${result.levelName}</p>
                <p>用时: ${LevelData.formatTime(result.totalTime, Math.floor(currentLevel.initialTime / 60))} / ${LevelData.formatTime(result.timeLimit, Math.floor(currentLevel.initialTime / 60))}</p>
            </div>
            <div class="result-section">
                <h4>完成情况</h4>
                <p>完成船只: ${result.efficiencyMetrics.completedCount} / ${result.efficiencyMetrics.totalShips}</p>
                <p>完成率: ${result.efficiencyMetrics.completionRate}%</p>
                <p>平均等待时间: ${result.efficiencyMetrics.averageWaitTime} 分钟</p>
            </div>
            <div class="result-section">
                <h4>得分明细</h4>
                <p>基础分: ${result.finalScore.totalBaseScore}</p>
                <p>时间奖励: +${result.finalScore.totalTimeBonus}</p>
                <p>船只惩罚: -${result.finalScore.totalShipPenalties}</p>
                <p>其他惩罚: -${result.finalScore.totalGeneralPenalties}</p>
            </div>
        `;

        // 显示最终得分
        document.getElementById('final-score').textContent = result.finalScore.finalScore;

        // 显示违规原因
        const violationsList = document.getElementById('result-violations-list');
        violationsList.innerHTML = '';

        if (result.violationAnalysis.totalViolations > 0) {
            for (const [type, data] of Object.entries(result.violationAnalysis.violationTypes)) {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${data.description}</strong>: ${data.count} 次，共扣 ${data.totalPenalty} 分`;
                violationsList.appendChild(li);
            }
        } else {
            const li = document.createElement('li');
            li.textContent = '没有违规记录，做得很好！';
            violationsList.appendChild(li);
        }

        // 显示建议
        if (result.suggestions.length > 0) {
            const suggestionsSection = document.createElement('div');
            suggestionsSection.className = 'result-section';
            suggestionsSection.innerHTML = '<h4>改进建议</h4>';
            
            result.suggestions.forEach(suggestion => {
                const p = document.createElement('p');
                p.className = `suggestion-${suggestion.priority}`;
                p.innerHTML = `
                    <strong>${suggestion.message}</strong><br>
                    <small>${suggestion.details}</small>
                `;
                suggestionsSection.appendChild(p);
            });
            
            resultDetails.appendChild(suggestionsSection);
        }

        // 显示模态框
        document.getElementById('result-modal').classList.remove('hidden');
    }

    /**
     * 隐藏结果模态框
     */
    function hideResultModal() {
        document.getElementById('result-modal').classList.add('hidden');
    }

    /**
     * 处理重新开始
     */
    function handleRestart() {
        hideResultModal();
        if (currentLevel) {
            startNewGame(currentLevel.id);
        }
    }

    /**
     * 处理返回菜单
     */
    function handleBackToMenu() {
        hideResultModal();
        showLevelSelect();
    }

    /**
     * 渲染潮汐时间轴
     */
    function renderTidalTimeline() {
        const timeline = document.getElementById('tidal-timeline');
        timeline.innerHTML = '';

        // 创建时间轴容器
        const timelineContainer = document.createElement('div');
        timelineContainer.className = 'timeline-container';

        // 计算时间轴刻度
        const scale = document.createElement('div');
        scale.className = 'timeline-scale';

        const timeStep = 30; // 每30分钟一个刻度
        for (let time = 0; time <= currentLevel.timeLimit; time += timeStep) {
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.style.left = `${(time / currentLevel.timeLimit) * 100}%`;
            tick.textContent = LevelData.formatTime(time, Math.floor(currentLevel.initialTime / 60));
            scale.appendChild(tick);
        }
        timelineContainer.appendChild(scale);

        // 潮汐窗口
        const windows = document.createElement('div');
        windows.className = 'timeline-windows';

        currentLevel.tidalWindows.forEach(window => {
            const windowEl = document.createElement('div');
            windowEl.className = `tidal-window tidal-${window.level}`;
            windowEl.style.left = `${(window.start / currentLevel.timeLimit) * 100}%`;
            windowEl.style.width = `${((window.end - window.start) / currentLevel.timeLimit) * 100}%`;
            windowEl.innerHTML = `
                <span class="window-level">${window.level === 'high' ? '高水位 (↑)' : '低水位 (↓)'}</span>
                <span class="window-time">${LevelData.formatTime(window.start, Math.floor(currentLevel.initialTime / 60))} - ${LevelData.formatTime(window.end, Math.floor(currentLevel.initialTime / 60))}</span>
            `;
            windows.appendChild(windowEl);
        });
        timelineContainer.appendChild(windows);

        // 当前时间指示器
        const indicator = document.createElement('div');
        indicator.className = 'timeline-indicator';
        indicator.style.left = `${(gameState.currentTime / currentLevel.timeLimit) * 100}%`;
        indicator.title = `当前时间: ${LevelData.formatTime(gameState.currentTime, Math.floor(currentLevel.initialTime / 60))}`;
        timelineContainer.appendChild(indicator);

        timeline.appendChild(timelineContainer);
    }

    /**
     * 渲染船只
     */
    function renderShips() {
        // 渲染等待区域
        DragState.renderShipsToContainer(gameState.waitingShips, 'waiting-ships');
        
        // 渲染闸室
        DragState.renderShipsToContainer(gameState.shipsInLock, 'lock-chamber');
        
        // 渲染已完成区域
        renderCompletedShips();
    }

    /**
     * 渲染已完成的船只
     */
    function renderCompletedShips() {
        const container = document.getElementById('completed-ships');
        container.innerHTML = '';

        gameState.completedShips.forEach(ship => {
            const element = document.createElement('div');
            element.className = `ship-item ship-${ship.type} completed`;
            element.innerHTML = `
                <div class="ship-name">${ship.name}</div>
                <div class="ship-info">
                    <span class="ship-type">${LevelData.getShipTypeName(ship.type)}</span>
                    <span class="ship-direction">${ship.targetDirection === 'up' ? '↑ 上行' : '↓ 下行'}</span>
                </div>
                <div class="ship-completed-time">
                    完成时间: ${LevelData.formatTime(ship.completedTime, Math.floor(currentLevel.initialTime / 60))}
                </div>
            `;
            container.appendChild(element);
        });
    }

    /**
     * 显示船只详情
     * @param {Object} ship - 船只对象
     */
    function showShipDetails(ship) {
        const shipInfo = document.getElementById('ship-info');
        
        const waitCost = RulesEngine.calculateWaitCost(ship, gameState.currentTime);
        
        shipInfo.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">名称:</span>
                <span class="detail-value">${ship.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">类型:</span>
                <span class="detail-value">${LevelData.getShipTypeName(ship.type)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">方向:</span>
                <span class="detail-value">${ship.targetDirection === 'up' ? '上行' : '下行'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">大小:</span>
                <span class="detail-value">${ship.size} 单位</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">优先级:</span>
                <span class="detail-value">${ship.priority}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">到达时间:</span>
                <span class="detail-value">${LevelData.formatTime(ship.arrivalTime, Math.floor(currentLevel.initialTime / 60))}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">截止时间:</span>
                <span class="detail-value">${LevelData.formatTime(ship.deadline, Math.floor(currentLevel.initialTime / 60))}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">等待成本:</span>
                <span class="detail-value">${waitCost} 分/分钟</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">基础分数:</span>
                <span class="detail-value">${ship.baseScore}</span>
            </div>
        `;
    }

    /**
     * 更新分数显示
     */
    function updateScoreDisplay() {
        document.getElementById('current-score').textContent = `得分: ${gameState.score}`;
    }

    /**
     * 更新时间显示
     */
    function updateTimeDisplay() {
        const baseHours = Math.floor(currentLevel.initialTime / 60);
        const timeStr = LevelData.formatTime(gameState.currentTime, baseHours);
        document.getElementById('current-time').textContent = `时间: ${timeStr}`;
    }

    /**
     * 更新违规显示
     */
    function updateViolationsDisplay() {
        const violationsList = document.getElementById('violations');
        violationsList.innerHTML = '';

        // 只显示最近的5条违规
        const recentViolations = gameState.violations.slice(-5);

        recentViolations.forEach(violation => {
            const li = document.createElement('li');
            li.className = 'violation-item';
            li.innerHTML = `
                <span class="violation-time">${LevelData.formatTime(violation.time, Math.floor(currentLevel.initialTime / 60))}</span>
                <span class="violation-desc">${violation.description}</span>
                <span class="violation-penalty">-${violation.penalty}</span>
            `;
            violationsList.appendChild(li);
        });
    }

    /**
     * 更新游戏UI状态
     */
    function updateGameUI() {
        // 更新闸室容量显示
        const lockChamber = document.getElementById('lock-chamber');
        const usedCapacity = RulesEngine.calculateUsedCapacity(gameState.shipsInLock);
        lockChamber.dataset.usedCapacity = usedCapacity;
        lockChamber.dataset.maxCapacity = currentLevel.lockCapacity;
    }

    // 公开API
    return {
        init,
        startNewGame,
        showLevelSelect,
        handleSaveGame,
        handleLoadGame
    };
})();

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
