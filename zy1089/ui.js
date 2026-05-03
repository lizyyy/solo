class GameUI {
    constructor(game) {
        this.game = game;
        this.currentScreen = 'menu';
        this.lastReport = null;
        
        this._initElements();
        this._initEventListeners();
        this._initGameEvents();
    }
    
    _initElements() {
        this.elements = {
            mainMenu: document.getElementById('main-menu'),
            levelSelect: document.getElementById('level-select'),
            gameScreen: document.getElementById('game-screen'),
            reportScreen: document.getElementById('report-screen'),
            helpScreen: document.getElementById('help-screen'),
            highscoreScreen: document.getElementById('highscore-screen'),
            
            btnNewGame: document.getElementById('btn-new-game'),
            btnContinue: document.getElementById('btn-continue'),
            btnLevels: document.getElementById('btn-levels'),
            btnHighscores: document.getElementById('btn-highscores'),
            btnHelp: document.getElementById('btn-help'),
            btnBackToMenu: document.getElementById('btn-back-to-menu'),
            
            btnPause: document.getElementById('btn-pause'),
            btnSpeed1: document.getElementById('btn-speed-1'),
            btnSpeed2: document.getElementById('btn-speed-2'),
            btnSpeed3: document.getElementById('btn-speed-3'),
            btnUndo: document.getElementById('btn-undo'),
            btnRestart: document.getElementById('btn-restart'),
            btnExit: document.getElementById('btn-exit'),
            
            gameTime: document.getElementById('game-time'),
            totalTime: document.getElementById('total-time'),
            currentScore: document.getElementById('current-score'),
            levelName: document.getElementById('level-name'),
            
            orderQueue: document.getElementById('order-queue'),
            coffeeMachines: document.getElementById('coffee-machines'),
            grinders: document.getElementById('grinders'),
            freezers: document.getElementById('freezers'),
            staff: document.getElementById('staff'),
            
            stockDisplay: document.getElementById('stock-display'),
            selectedOrderDetail: document.getElementById('selected-order-detail'),
            queueEstimate: document.getElementById('queue-estimate'),
            
            statCompleted: document.getElementById('stat-completed'),
            statOverdue: document.getElementById('stat-overdue'),
            statTips: document.getElementById('stat-tips'),
            statWasted: document.getElementById('stat-wasted'),
            
            actionHint: document.getElementById('action-hint'),
            bestScore: document.getElementById('best-score'),
            levelList: document.getElementById('level-list'),
            
            reportContent: document.getElementById('report-content'),
            btnExportMarkdown: document.getElementById('btn-export-markdown'),
            btnExportJson: document.getElementById('btn-export-json'),
            btnReplay: document.getElementById('btn-replay'),
            btnMenuFromReport: document.getElementById('btn-menu-from-report'),
            
            btnHelpBack: document.getElementById('btn-help-back'),
            highscoreList: document.getElementById('highscore-list'),
            btnHighscoreBack: document.getElementById('btn-highscore-back')
        };
    }
    
    _initEventListeners() {
        this.elements.btnNewGame.addEventListener('click', () => this._startNewGame(0));
        this.elements.btnContinue.addEventListener('click', () => this._continueGame());
        this.elements.btnLevels.addEventListener('click', () => this._showScreen('levels'));
        this.elements.btnHighscores.addEventListener('click', () => this._showScreen('highscores'));
        this.elements.btnHelp.addEventListener('click', () => this._showScreen('help'));
        this.elements.btnBackToMenu.addEventListener('click', () => this._showScreen('menu'));
        
        this.elements.btnPause.addEventListener('click', () => this._togglePause());
        this.elements.btnSpeed1.addEventListener('click', () => this._setSpeed(1));
        this.elements.btnSpeed2.addEventListener('click', () => this._setSpeed(2));
        this.elements.btnSpeed3.addEventListener('click', () => this._setSpeed(3));
        this.elements.btnUndo.addEventListener('click', () => this._undoAction());
        this.elements.btnRestart.addEventListener('click', () => this._restartLevel());
        this.elements.btnExit.addEventListener('click', () => this._exitGame());
        
        this.elements.btnExportMarkdown.addEventListener('click', () => this._exportMarkdown());
        this.elements.btnExportJson.addEventListener('click', () => this._exportJson());
        this.elements.btnReplay.addEventListener('click', () => this._restartLevel());
        this.elements.btnMenuFromReport.addEventListener('click', () => this._showScreen('menu'));
        
        this.elements.btnHelpBack.addEventListener('click', () => this._showScreen('menu'));
        this.elements.btnHighscoreBack.addEventListener('click', () => this._showScreen('menu'));
        
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
    }
    
    _initGameEvents() {
        EventBus.on(EVENTS.UI_UPDATE, () => this.update());
        
        EventBus.on(EVENTS.GAME_OVER, (data) => {
            this.lastReport = data.report;
            this._showScreen('report');
            this._renderReport(data.report);
        });
        
        EventBus.on(EVENTS.ORDER_COMPLETED, (data) => {
            this._showNotification(`订单 ${data.order.drinkName} 完成! +${data.score + data.bonus}分`);
        });
        
        EventBus.on(EVENTS.ORDER_MISSED, (data) => {
            this._showNotification(`漏单! ${data.order.drinkName}`, 'error');
        });
        
        EventBus.on(EVENTS.EQUIPMENT_OVERHEAT, (data) => {
            this._showNotification(`${data.equipment.name} 过热!`, 'warning');
        });
        
        EventBus.on(EVENTS.COMBO_ACHIEVED, (data) => {
            this._showNotification(`连单 ${data.combo}! 额外加分!`, 'success');
        });
    }
    
    init() {
        this._updateMenuState();
        this._renderLevels();
        this._renderHighscores();
    }
    
    _updateMenuState() {
        const hasSave = Storage.hasSavedGame();
        this.elements.btnContinue.disabled = !hasSave;
        this.elements.bestScore.textContent = Storage.getBestScore();
    }
    
    _showScreen(screen) {
        this.elements.mainMenu.classList.add('hidden');
        this.elements.levelSelect.classList.add('hidden');
        this.elements.gameScreen.classList.add('hidden');
        this.elements.reportScreen.classList.add('hidden');
        this.elements.helpScreen.classList.add('hidden');
        this.elements.highscoreScreen.classList.add('hidden');
        
        this.currentScreen = screen;
        
        switch (screen) {
            case 'menu':
                this.elements.mainMenu.classList.remove('hidden');
                this._updateMenuState();
                break;
            case 'levels':
                this.elements.levelSelect.classList.remove('hidden');
                this._renderLevels();
                break;
            case 'game':
                this.elements.gameScreen.classList.remove('hidden');
                break;
            case 'report':
                this.elements.reportScreen.classList.remove('hidden');
                break;
            case 'help':
                this.elements.helpScreen.classList.remove('hidden');
                break;
            case 'highscores':
                this.elements.highscoreScreen.classList.remove('hidden');
                this._renderHighscores();
                break;
        }
    }
    
    _renderLevels() {
        this.elements.levelList.innerHTML = '';
        
        LEVELS.forEach(level => {
            const card = document.createElement('div');
            card.className = `level-card ${level.unlocked ? '' : 'locked'}`;
            
            const difficultyClass = Utils.getDifficultyClass(level.difficulty);
            const difficultyText = level.difficulty === 'easy' ? '简单' : 
                                   level.difficulty === 'medium' ? '中等' : '困难';
            
            card.innerHTML = `
                <div class="level-name">${level.name}</div>
                <div class="level-difficulty ${difficultyClass}">${difficultyText}</div>
                <div class="level-stats">
                    <span>📋 订单频率: ${(level.config.orderFrequency * 100).toFixed(0)}%</span>
                    <span>☕ 咖啡机: ${level.config.coffeeMachines}台</span>
                    <span>👨‍🍳 店员: ${level.config.staff}人</span>
                    <span>🔥 故障概率: ${(level.config.breakdownChance * 100).toFixed(1)}%</span>
                </div>
            `;
            
            if (level.unlocked) {
                card.addEventListener('click', () => this._startNewGame(level.id));
            }
            
            this.elements.levelList.appendChild(card);
        });
    }
    
    _renderHighscores() {
        const scores = Storage.getHighScores();
        
        if (scores.length === 0) {
            this.elements.highscoreList.innerHTML = `
                <div class="highscore-empty">
                    暂无记录，快去挑战吧！
                </div>
            `;
            return;
        }
        
        this.elements.highscoreList.innerHTML = '';
        
        scores.forEach((score, index) => {
            const rank = index + 1;
            const rankClass = Utils.getRankClass(rank);
            
            const item = document.createElement('div');
            item.className = 'highscore-item';
            item.innerHTML = `
                <div class="highscore-rank ${rankClass}">${rank}</div>
                <div class="highscore-info">
                    <div class="highscore-level">${score.levelName}</div>
                    <div class="highscore-date">${score.date}</div>
                </div>
                <div class="highscore-score">${score.score}</div>
            `;
            
            this.elements.highscoreList.appendChild(item);
        });
    }
    
    _startNewGame(levelId) {
        this.game.reset();
        this.game.initLevel(levelId);
        this._showScreen('game');
        this.game.start();
        this.update();
    }
    
    _continueGame() {
        const savedState = Storage.loadGame();
        if (savedState) {
            this.game.loadState(savedState);
            this._showScreen('game');
            this.game.start();
            this.update();
        }
    }
    
    _togglePause() {
        if (this.game.gameState.paused) {
            this.game.resume();
            this.elements.btnPause.textContent = '⏸️ 暂停';
        } else {
            this.game.pause();
            this.elements.btnPause.textContent = '▶️ 继续';
        }
    }
    
    _setSpeed(speed) {
        this.game.setSpeed(speed);
        
        this.elements.btnSpeed1.classList.remove('active');
        this.elements.btnSpeed2.classList.remove('active');
        this.elements.btnSpeed3.classList.remove('active');
        
        const btn = this.elements[`btnSpeed${speed}`];
        if (btn) btn.classList.add('active');
    }
    
    _undoAction() {
        const result = this.game.undo();
        if (result.success) {
            this._showNotification('已撤销上一步操作');
        } else {
            this._showNotification('没有可撤销的操作', 'warning');
        }
    }
    
    _restartLevel() {
        if (this.game.gameState.level) {
            this._startNewGame(this.game.gameState.level.id);
        }
    }
    
    _exitGame() {
        if (confirm('确定要退出吗？进度将保存。')) {
            this.game.saveState();
            this.game.gameState.running = false;
            this._showScreen('menu');
        }
    }
    
    _handleKeyboard(e) {
        if (this.currentScreen !== 'game') return;
        
        switch (e.key) {
            case ' ':
            case 'p':
            case 'P':
                e.preventDefault();
                this._togglePause();
                break;
            case '1':
                this._setSpeed(1);
                break;
            case '2':
                this._setSpeed(2);
                break;
            case '3':
                this._setSpeed(3);
                break;
            case 'z':
            case 'Z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this._undoAction();
                }
                break;
            case 'Escape':
                this._exitGame();
                break;
        }
    }
    
    update() {
        const state = this.game.getState();
        
        this._updateTimeDisplay(state);
        this._updateScoreDisplay(state);
        this._renderOrderQueue(state);
        this._renderEquipment(state);
        this._renderStaff(state);
        this._renderStock(state);
        this._renderStats(state);
        this._updateEstimate(state);
        this._renderSelectedOrder(state);
    }
    
    _updateTimeDisplay(state) {
        this.elements.gameTime.textContent = Utils.formatTime(state.gameState.currentTime);
        this.elements.totalTime.textContent = Utils.formatTime(state.gameState.totalTime);
        this.elements.levelName.textContent = state.gameState.level?.name || '';
        
        if (state.gameState.paused) {
            this.elements.btnPause.textContent = '▶️ 继续';
        } else {
            this.elements.btnPause.textContent = '⏸️ 暂停';
        }
    }
    
    _updateScoreDisplay(state) {
        this.elements.currentScore.textContent = state.scoring.totalScore;
    }
    
    _renderOrderQueue(state) {
        const allOrders = [
            ...state.orders.queue,
            ...state.orders.inProgress
        ].sort((a, b) => {
            if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
            return a.deadline - b.deadline;
        });
        
        this.elements.orderQueue.innerHTML = '';
        
        if (allOrders.length === 0) {
            this.elements.orderQueue.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">暂无订单</p>';
            return;
        }
        
        allOrders.forEach(order => {
            const card = this._createOrderCard(order, state);
            this.elements.orderQueue.appendChild(card);
        });
    }
    
    _createOrderCard(order, state) {
        const card = document.createElement('div');
        
        let classes = ['order-card'];
        if (order.isUrgent) classes.push('urgent');
        if (order.isIced) classes.push('iced');
        if (order.isTakeaway) classes.push('takeaway');
        if (order.status === 'in_progress') classes.push('in-progress');
        if (order.status === 'completed') classes.push('completed');
        if (order.isOverdue) classes.push('overdue');
        
        if (state.uiSelections.selectedOrderId === order.id) {
            classes.push('selected');
        }
        
        card.className = classes.join(' ');
        card.dataset.orderId = order.id;
        
        const timeLeft = Math.max(0, order.deadline - state.gameState.currentTime);
        const patiencePercent = (order.patience / order.maxPatience) * 100;
        const patienceClass = Utils.getPatienceColorClass(order.patience);
        
        let tagsHtml = '';
        if (order.isUrgent) tagsHtml += '<span class="tag urgent">加急</span>';
        if (order.isIced) tagsHtml += '<span class="tag iced">冰饮</span>';
        if (order.isTakeaway) tagsHtml += '<span class="tag takeaway">外带</span>';
        
        card.innerHTML = `
            <div class="order-header">
                <span class="order-id">#${order.id.split('_')[1]}</span>
                <div class="order-tags">${tagsHtml}</div>
            </div>
            <div class="order-name">${order.drinkName}</div>
            <div class="order-patience">
                <span class="patience-label">耐心:</span>
                <div class="patience-bar">
                    <div class="patience-fill ${patienceClass}" style="width: ${patiencePercent}%"></div>
                </div>
            </div>
            <div class="order-time">
                <span>剩余: ${Utils.formatTime(timeLeft)}</span>
                <span>${order.status === 'in_progress' ? '制作中' : '排队中'}</span>
            </div>
        `;
        
        card.addEventListener('click', () => {
            if (order.status === 'queued') {
                this.game.selectOrder(order.id);
                this._checkQuickAssign();
            } else {
                this.game.selectOrder(order.id);
            }
            this.update();
        });
        
        return card;
    }
    
    _renderEquipment(state) {
        this._renderEquipmentList(
            state.equipment.coffeeMachines,
            this.elements.coffeeMachines,
            'coffee_machine'
        );
        
        this._renderEquipmentList(
            state.equipment.grinders,
            this.elements.grinders,
            'grinder'
        );
        
        this._renderEquipmentList(
            state.equipment.freezers,
            this.elements.freezers,
            'freezer'
        );
    }
    
    _renderEquipmentList(equipmentList, container, type) {
        container.innerHTML = '';
        
        equipmentList.forEach(equipment => {
            const card = document.createElement('div');
            
            let classes = ['equipment-card', equipment.status];
            card.className = classes.join(' ');
            
            const config = CONFIG.EQUIPMENT[type.toUpperCase()];
            const tempPercent = config ? (equipment.temperature / config.MAX_TEMP) * 100 : 0;
            const tempClass = Utils.getTempColorClass(equipment.temperature, config?.MAX_TEMP || 100);
            
            let statusText = '';
            switch (equipment.status) {
                case 'idle': statusText = '空闲'; break;
                case 'busy': statusText = `使用中 (${STEP_NAMES[equipment.currentStep] || '...'})`; break;
                case 'overheating': statusText = '过热!'; break;
                case 'broken': statusText = '维修中'; break;
            }
            
            card.innerHTML = `
                <div class="equipment-name">${equipment.name}</div>
                <div class="equipment-status ${equipment.status}">${statusText}</div>
                ${type !== 'freezer' ? `
                    <div class="equipment-temp">
                        <div class="equipment-temp-fill ${tempClass}" style="width: ${tempPercent}%"></div>
                    </div>
                ` : ''}
            `;
            
            container.appendChild(card);
        });
    }
    
    _renderStaff(state) {
        this.elements.staff.innerHTML = '';
        
        state.staff.forEach(staff => {
            const card = document.createElement('div');
            
            let classes = ['staff-card', staff.status];
            if (state.uiSelections.selectedStaffId === staff.id) {
                classes.push('selected');
            }
            card.className = classes.join(' ');
            
            let statusText = staff.status === 'idle' ? '空闲' : '忙碌';
            let taskText = '';
            
            if (staff.status === 'busy') {
                const order = this.game._findOrderById(staff.currentOrderId);
                if (order) {
                    const step = order.drink.steps[staff.currentStepIndex];
                    taskText = step ? STEP_NAMES[step.type] || step.type : '';
                }
            }
            
            card.innerHTML = `
                <div class="staff-name">${staff.name}</div>
                <div class="staff-status ${staff.status}">${statusText}</div>
                ${taskText ? `<div class="staff-task">${taskText}</div>` : ''}
            `;
            
            card.addEventListener('click', () => {
                if (staff.status === 'idle') {
                    this.game.selectStaff(staff.id);
                    this._checkQuickAssign();
                } else {
                    this.game.selectStaff(staff.id);
                }
                this.update();
            });
            
            this.elements.staff.appendChild(card);
        });
    }
    
    _checkQuickAssign() {
        const order = this.game.getSelectedOrder();
        const staff = this.game.getSelectedStaff();
        
        if (order && staff && order.status === 'queued' && staff.status === 'idle') {
            const result = this.game.assignOrderToStaff(order.id, staff.id);
            if (result.success) {
                this.game.selectOrder(null);
                this.game.selectStaff(null);
                this._showNotification(`已分配 ${order.drinkName} 给 ${staff.name}`);
            } else {
                this._showNotification(result.reason, 'error');
            }
        }
    }
    
    _renderStock(state) {
        this.elements.stockDisplay.innerHTML = '';
        
        const initialStock = state.gameState.levelConfig?.initialStock || {};
        
        Object.entries(state.stock).forEach(([ingredient, amount]) => {
            const initial = initialStock[ingredient] || 0;
            const isLow = amount < 5;
            
            const item = document.createElement('div');
            item.className = 'stock-item';
            item.innerHTML = `
                <span class="stock-name">${INGREDIENT_NAMES[ingredient] || ingredient}</span>
                <span class="stock-value ${isLow ? 'low' : ''}">${amount}</span>
            `;
            
            this.elements.stockDisplay.appendChild(item);
        });
    }
    
    _renderStats(state) {
        this.elements.statCompleted.textContent = state.scoring.completedCount;
        this.elements.statOverdue.textContent = state.scoring.overdueCount;
        this.elements.statTips.textContent = state.scoring.tipsTotal;
        this.elements.statWasted.textContent = state.scoring.wasteTotal;
    }
    
    _updateEstimate(state) {
        const queuedOrders = state.orders.queue.length;
        const inProgress = state.orders.inProgress.length;
        
        if (queuedOrders === 0 && inProgress === 0) {
            this.elements.queueEstimate.innerHTML = '<p class="placeholder">当前无订单</p>';
            return;
        }
        
        let avgMakeTime = 60;
        const idleStaff = state.staff.filter(s => s.status === 'idle').length;
        const busyStaff = state.staff.length - idleStaff;
        
        let estimate = 0;
        if (queuedOrders > 0) {
            const parallelCapacity = Math.max(1, idleStaff + busyStaff);
            estimate = queuedOrders * avgMakeTime / parallelCapacity;
        }
        
        this.elements.queueEstimate.innerHTML = `
            <div class="estimate-info">
                <p>等待中: ${queuedOrders} 单</p>
                <p>制作中: ${inProgress} 单</p>
                <p class="estimate-time">预计等待: ~${Math.round(estimate)}秒</p>
            </div>
        `;
    }
    
    _renderSelectedOrder(state) {
        const order = this.game.getSelectedOrder();
        
        if (!order) {
            this.elements.selectedOrderDetail.innerHTML = '<p class="placeholder">点击订单查看详情</p>';
            return;
        }
        
        const timeLeft = Math.max(0, order.deadline - state.gameState.currentTime);
        const isOverdue = order.isOverdue;
        
        let tags = [];
        if (order.isUrgent) tags.push('加急');
        if (order.isIced) tags.push('冰饮');
        if (order.isTakeaway) tags.push('外带');
        
        let stepsHtml = '';
        order.drink.steps.forEach((step, index) => {
            const isCurrentStep = order.status === 'in_progress' && index === order.currentStepIndex;
            const isCompleted = order.status === 'in_progress' && index < order.currentStepIndex;
            
            stepsHtml += `
                <div class="recipe-step ${isCompleted ? 'completed' : ''} ${isCurrentStep ? 'current' : ''}">
                    <span class="step-number">${index + 1}</span>
                    <span class="step-name">${STEP_NAMES[step.type] || step.type}</span>
                    <span class="step-time">${step.duration}秒</span>
                </div>
            `;
        });
        
        let ingredientsHtml = '';
        Object.entries(order.drink.ingredients).forEach(([ingredient, amount]) => {
            ingredientsHtml += `
                <div class="detail-item">
                    <span class="detail-label">${INGREDIENT_NAMES[ingredient] || ingredient}</span>
                    <span class="detail-value">x${amount}</span>
                </div>
            `;
        });
        
        this.elements.selectedOrderDetail.innerHTML = `
            <div class="order-detail-content">
                <div class="detail-item">
                    <span class="detail-label">饮品</span>
                    <span class="detail-value">${order.drinkName}</span>
                </div>
                ${tags.length > 0 ? `
                    <div class="detail-item">
                        <span class="detail-label">标签</span>
                        <span class="detail-value">${tags.join(', ')}</span>
                    </div>
                ` : ''}
                <div class="detail-item">
                    <span class="detail-label">状态</span>
                    <span class="detail-value ${isOverdue ? 'overdue' : ''}">
                        ${order.status === 'queued' ? '排队中' : 
                          order.status === 'in_progress' ? '制作中' : 
                          order.status === 'completed' ? '已完成' : '已取消'}
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">剩余时间</span>
                    <span class="detail-value ${isOverdue ? 'overdue' : ''}">
                        ${isOverdue ? '已超时' : Utils.formatTime(timeLeft)}
                    </span>
                </div>
                
                <div class="order-recipe">
                    <h5>制作步骤</h5>
                    ${stepsHtml}
                </div>
                
                <div class="order-recipe">
                    <h5>所需原料</h5>
                    ${ingredientsHtml}
                </div>
            </div>
        `;
    }
    
    _renderReport(report) {
        const gradeClass = report.scoring.grade.class;
        
        this.elements.reportContent.innerHTML = `
            <div class="report-header">
                <div class="report-title">${report.level.name} 营业报告</div>
                <div class="report-date">${report.timestamp}</div>
                <div class="report-score">${report.scoring.totalScore} 分</div>
                <div class="report-grade ${gradeClass}">评级: ${report.scoring.grade.letter}</div>
            </div>
            
            <div class="report-stats">
                <div class="stat-group">
                    <h4>📊 订单统计</h4>
                    <div class="stat-row">
                        <span class="label">总订单数</span>
                        <span class="value">${report.orders.total}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">已完成</span>
                        <span class="value positive">${report.orders.completed}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">超时完成</span>
                        <span class="value negative">${report.orders.overdue}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">漏单</span>
                        <span class="value negative">${report.orders.missed}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">完成率</span>
                        <span class="value ${report.orders.completionRate > 70 ? 'positive' : 'negative'}">${report.orders.completionRate}%</span>
                    </div>
                </div>
                
                <div class="stat-group">
                    <h4>⏱️ 运营效率</h4>
                    <div class="stat-row">
                        <span class="label">平均等待时间</span>
                        <span class="value">${report.performance.averageWaitTime}秒</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">最高连单</span>
                        <span class="value positive">${report.performance.maxCombo}单</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">获得小费</span>
                        <span class="value positive">${report.performance.totalTips}分</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">设备过热</span>
                        <span class="value negative">${report.performance.overheatCount}次</span>
                    </div>
                </div>
            </div>
            
            <div class="report-summary">
                ${this._getSummaryText(report)}
            </div>
        `;
    }
    
    _getSummaryText(report) {
        const grade = report.scoring.grade.letter;
        const completionRate = report.orders.completionRate;
        
        if (grade === 'S') {
            return '🌟 完美表现！你是一位出色的咖啡店店长！顾客们都非常满意！';
        } else if (grade === 'A') {
            return '👍 表现优秀！大部分顾客都很满意，继续保持！';
        } else if (grade === 'B') {
            return '💪 表现尚可，但还有提升空间。注意优化设备使用和订单排序。';
        } else {
            return '😅 需要改进！建议多练习，合理安排店员和设备。';
        }
    }
    
    _exportMarkdown() {
        if (!this.lastReport) return;
        
        const markdown = this.game.generateMarkdownReport(this.lastReport);
        const filename = `coffee_report_${new Date().toISOString().slice(0, 10)}.md`;
        
        Utils.downloadFile(markdown, filename, 'text/markdown');
        this._showNotification('Markdown 报告已导出');
    }
    
    _exportJson() {
        if (!this.lastReport) return;
        
        const json = JSON.stringify(this.lastReport, null, 2);
        const filename = `coffee_report_${new Date().toISOString().slice(0, 10)}.json`;
        
        Utils.downloadFile(json, filename, 'application/json');
        this._showNotification('JSON 报告已导出');
    }
    
    _showNotification(message, type = 'info') {
        let existing = document.querySelector('.game-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `game-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 10000;
            animation: slideDown 0.3s ease;
            ${type === 'error' ? 'background: #FF5252; color: white;' : 
              type === 'warning' ? 'background: #FFC107; color: #333;' : 
              type === 'success' ? 'background: #4CAF50; color: white;' :
              'background: #2196F3; color: white;'}
        `;
        
        if (!document.getElementById('notification-style')) {
            const style = document.createElement('style');
            style.id = 'notification-style';
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(0); opacity: 1; }
                    to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}
