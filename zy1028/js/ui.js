import { gameState, GameStates, CustomerState, WokState, PackingState } from './gameState.js';
import { gameLogic } from './gameLogic.js';
import { ValidationErrorTypes } from './levelParser.js';

export class UI {
    constructor() {
        this.gameState = gameState;
        this.gameLogic = gameLogic;
        this.selectedCustomerId = null;
        this.selectedPackingStationId = null;
        this.gameLoopId = null;
    }

    init() {
        this.bindEvents();
        this.gameState.subscribe(() => this.render());
        this.gameLogic.init();
        this.render();
        this.startGameLoop();
    }

    bindEvents() {
        document.getElementById('btn-start-game')?.addEventListener('click', () => {
            this.showScreen('level-select-screen');
            this.renderLevelSelect();
        });

        document.getElementById('btn-select-level')?.addEventListener('click', () => {
            this.showScreen('level-select-screen');
            this.renderLevelSelect();
        });

        document.getElementById('btn-manage-levels')?.addEventListener('click', () => {
            this.showScreen('level-manage-screen');
            this.renderLevelManage();
        });

        document.getElementById('btn-back-from-level-select')?.addEventListener('click', () => {
            this.showScreen('menu-screen');
        });

        document.getElementById('btn-back-from-manage')?.addEventListener('click', () => {
            this.showScreen('menu-screen');
        });

        document.getElementById('btn-pause-game')?.addEventListener('click', () => {
            this.gameLogic.pauseGame();
        });

        document.getElementById('btn-resume-game')?.addEventListener('click', () => {
            this.gameLogic.resumeGame();
        });

        document.getElementById('btn-restart-game')?.addEventListener('click', () => {
            const levelId = this.gameState.currentLevel?.id;
            if (levelId) {
                this.gameLogic.startGame(levelId);
            }
        });

        document.getElementById('btn-quit-game')?.addEventListener('click', () => {
            this.gameLogic.quitGame();
            this.showScreen('menu-screen');
        });

        document.getElementById('btn-play-again')?.addEventListener('click', () => {
            const levelId = this.gameState.currentLevel?.id;
            if (levelId) {
                this.gameLogic.startGame(levelId);
            }
        });

        document.getElementById('btn-select-level-again')?.addEventListener('click', () => {
            this.showScreen('level-select-screen');
            this.renderLevelSelect();
        });

        document.getElementById('btn-back-to-menu')?.addEventListener('click', () => {
            this.showScreen('menu-screen');
        });

        document.getElementById('btn-restock-noodles')?.addEventListener('click', () => {
            const result = this.gameLogic.restockIngredients('noodles');
            if (result) {
                this.gameLogic.showMessage('米粉补充成功！', 'success');
            } else {
                this.gameLogic.showMessage('米粉库存已满！', 'warning');
            }
        });

        document.getElementById('btn-restock-toppings')?.addEventListener('click', () => {
            const result = this.gameLogic.restockIngredients('toppings');
            if (result) {
                this.gameLogic.showMessage('配菜补充成功！', 'success');
            } else {
                this.gameLogic.showMessage('配菜库存已满！', 'warning');
            }
        });

        document.getElementById('btn-import-level')?.addEventListener('click', () => {
            this.handleImportLevel();
        });

        document.getElementById('btn-export-level')?.addEventListener('click', () => {
            this.handleExportLevel();
        });

        document.getElementById('btn-copy-export')?.addEventListener('click', () => {
            this.handleCopyExport();
        });

        document.getElementById('btn-reset-levels')?.addEventListener('click', () => {
            if (confirm('确定要重置所有关卡为默认值吗？')) {
                const result = this.gameLogic.resetToDefaultLevels();
                this.gameLogic.showMessage(result.message, 'success');
                this.renderLevelManage();
            }
        });

        document.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('level-card')) {
                const levelId = target.dataset.levelId;
                if (levelId) {
                    const progress = this.gameLogic.getLevelProgress(levelId);
                    if (progress?.unlocked) {
                        this.gameLogic.startGame(levelId);
                    } else {
                        this.gameLogic.showMessage('此关卡尚未解锁！', 'warning');
                    }
                }
            }
            
            if (target.closest('.customer-card')) {
                const card = target.closest('.customer-card');
                const customerId = parseInt(card.dataset.customerId);
                this.handleCustomerClick(customerId);
            }
            
            if (target.closest('.wok-card')) {
                const card = target.closest('.wok-card');
                const wokId = parseInt(card.dataset.wokId);
                const action = target.dataset.action;
                this.handleWokClick(wokId, action);
            }
            
            if (target.closest('.packing-card')) {
                const card = target.closest('.packing-card');
                const stationId = parseInt(card.dataset.stationId);
                const action = target.dataset.action;
                this.handlePackingClick(stationId, action);
            }
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }

    handleCustomerClick(customerId) {
        if (this.selectedCustomerId === customerId) {
            this.selectedCustomerId = null;
            this.selectedPackingStationId = null;
        } else {
            if (this.selectedPackingStationId !== null) {
                const result = this.gameLogic.serveOrder(this.selectedPackingStationId, customerId);
                if (result.success) {
                    let message = `成功出餐！+${result.score}分`;
                    if (result.comboBonus > 0) {
                        message += ` (连击奖励: +${result.comboBonus})`;
                    }
                    if (result.tipBonus > 0) {
                        message += ` (小费: +${result.tipBonus})`;
                    }
                    if (result.isOnTime && result.combo > 0) {
                        message += ` 当前连击: ${result.combo}`;
                    }
                    this.gameLogic.showMessage(message, 'success');
                } else {
                    this.gameLogic.showMessage(result.reason || '操作失败', 'error');
                }
                this.selectedPackingStationId = null;
                this.selectedCustomerId = null;
            } else {
                const result = this.gameLogic.startCooking(customerId);
                if (result.success) {
                    this.gameLogic.showMessage(`${result.wok.order.dish.name} 开始炒制！`, 'info');
                } else {
                    this.gameLogic.showMessage(result.reason || '操作失败', 'error');
                }
                this.selectedCustomerId = null;
            }
        }
        this.renderCustomers();
    }

    handleWokClick(wokId, action) {
        if (action === 'move') {
            const result = this.gameLogic.moveToPacking(wokId);
            if (result.success) {
                this.gameLogic.showMessage('已移至打包台！', 'success');
            } else {
                this.gameLogic.showMessage(result.reason || '操作失败', 'error');
            }
        } else if (action === 'discard') {
            if (confirm('确定要倒掉这个炒粉吗？这会浪费食材！')) {
                const result = this.gameLogic.discardWok(wokId);
                if (result.success) {
                    this.gameLogic.showMessage('已倒掉炒粉', 'warning');
                } else {
                    this.gameLogic.showMessage(result.reason || '操作失败', 'error');
                }
            }
        }
    }

    handlePackingClick(stationId, action) {
        if (action === 'select') {
            if (this.selectedPackingStationId === stationId) {
                this.selectedPackingStationId = null;
            } else {
                this.selectedPackingStationId = stationId;
                this.gameLogic.showMessage('已选中打包台，请点击要出餐的顾客', 'info');
            }
        } else if (action === 'discard') {
            if (confirm('确定要倒掉这个打包好的炒粉吗？这会浪费食材！')) {
                const result = this.gameLogic.discardPacking(stationId);
                if (result.success) {
                    this.gameLogic.showMessage('已倒掉炒粉', 'warning');
                } else {
                    this.gameLogic.showMessage(result.reason || '操作失败', 'error');
                }
            }
        }
        this.renderPacking();
    }

    handleImportLevel() {
        const textarea = document.getElementById('import-textarea');
        const errorDiv = document.getElementById('import-error');
        
        if (!textarea || !errorDiv) return;
        
        const jsonString = textarea.value.trim();
        if (!jsonString) {
            errorDiv.textContent = '请输入关卡JSON数据';
            errorDiv.style.display = 'block';
            return;
        }
        
        const result = this.gameLogic.importLevels(jsonString);
        
        if (result.success) {
            errorDiv.style.display = 'none';
            this.gameLogic.showMessage(result.message, 'success');
            textarea.value = '';
            this.renderLevelManage();
        } else {
            let errorMessage = result.message;
            if (result.errorType) {
                const typeMessages = {
                    [ValidationErrorTypes.INVALID_JSON]: 'JSON格式错误',
                    [ValidationErrorTypes.MISSING_FIELD]: '缺少必填字段',
                    [ValidationErrorTypes.INVALID_TYPE]: '类型错误',
                    [ValidationErrorTypes.INVALID_VALUE]: '值错误',
                    [ValidationErrorTypes.EMPTY_ARRAY]: '数组为空',
                    [ValidationErrorTypes.DUPLICATE_ID]: 'ID重复'
                };
                const typeMsg = typeMessages[result.errorType] || '未知错误';
                errorMessage = `${typeMsg}: ${result.message}`;
            }
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
    }

    handleExportLevel() {
        const select = document.getElementById('export-level-select');
        const textarea = document.getElementById('export-textarea');
        
        if (!select || !textarea) return;
        
        const levelId = select.value;
        if (!levelId) {
            this.gameLogic.showMessage('请选择要导出的关卡', 'warning');
            return;
        }
        
        const result = this.gameLogic.exportLevel(levelId);
        if (result.success) {
            textarea.value = result.json;
            this.gameLogic.showMessage('关卡已导出', 'success');
        } else {
            this.gameLogic.showMessage(result.message, 'error');
        }
    }

    handleCopyExport() {
        const textarea = document.getElementById('export-textarea');
        if (!textarea) return;
        
        if (!textarea.value) {
            this.gameLogic.showMessage('没有可复制的内容', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(textarea.value).then(() => {
            this.gameLogic.showMessage('已复制到剪贴板', 'success');
        }).catch(() => {
            this.gameLogic.showMessage('复制失败，请手动复制', 'error');
        });
    }

    startGameLoop() {
        const loop = () => {
            this.gameLogic.update();
            this.gameLoopId = requestAnimationFrame(loop);
        };
        this.gameLoopId = requestAnimationFrame(loop);
    }

    render() {
        const state = this.gameState.gameState;
        
        switch (state) {
            case GameStates.MENU:
                this.showScreen('menu-screen');
                break;
            case GameStates.PLAYING:
                this.showScreen('game-screen');
                this.renderGame();
                break;
            case GameStates.PAUSED:
                this.showScreen('pause-screen');
                break;
            case GameStates.RESULT:
                this.showScreen('result-screen');
                this.renderResult();
                break;
        }
    }

    renderGame() {
        this.renderGameInfo();
        this.renderCustomers();
        this.renderIngredients();
        this.renderWoks();
        this.renderPacking();
    }

    renderGameInfo() {
        const levelNameEl = document.getElementById('current-level-name');
        const gameTimeEl = document.getElementById('game-time');
        const gameScoreEl = document.getElementById('game-score');
        const gameComboEl = document.getElementById('game-combo');
        const gameBadReviewsEl = document.getElementById('game-bad-reviews');
        
        if (levelNameEl) {
            levelNameEl.textContent = this.gameState.currentLevel?.name || '未知关卡';
        }
        
        if (gameTimeEl) {
            const remaining = Math.max(0, this.gameState.maxGameTime - this.gameState.gameTime);
            const minutes = Math.floor(remaining / 60);
            const seconds = Math.floor(remaining % 60);
            gameTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            gameTimeEl.className = `info-value ${remaining < 30 ? 'warning' : ''}`;
        }
        
        if (gameScoreEl) {
            gameScoreEl.textContent = this.gameState.score;
        }
        
        if (gameComboEl) {
            gameComboEl.textContent = this.gameState.combo;
            gameComboEl.className = `info-value ${this.gameState.combo > 0 ? 'combo-active' : ''}`;
        }
        
        if (gameBadReviewsEl) {
            gameBadReviewsEl.textContent = this.gameState.badReviews;
        }
    }

    renderCustomers() {
        const container = document.getElementById('customers-queue');
        if (!container) return;
        
        if (this.gameState.customers.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无顾客</div>';
            return;
        }
        
        container.innerHTML = this.gameState.customers.map(customer => {
            const waitRatio = customer.waitTime / customer.maxWaitTime;
            const isAngry = customer.state === CustomerState.ANGRY;
            const isSelected = this.selectedCustomerId === customer.id;
            const isWaitingForPacking = this.selectedPackingStationId !== null;
            
            let stateClass = 'customer-normal';
            if (isAngry) stateClass = 'customer-angry';
            if (isSelected) stateClass += ' customer-selected';
            if (isWaitingForPacking) stateClass += ' customer-selectable';
            
            return `
                <div class="customer-card ${stateClass}" data-customer-id="${customer.id}">
                    <div class="customer-header">
                        <span class="customer-name">${customer.name}</span>
                        <span class="customer-state">${isAngry ? '😠' : '😊'}</span>
                    </div>
                    <div class="customer-dish">
                        <span class="dish-label">点单：</span>
                        <span class="dish-name">${customer.dish}</span>
                    </div>
                    <div class="customer-patience">
                        <div class="patience-bar">
                            <div class="patience-fill" style="width: ${Math.max(0, (1 - waitRatio) * 100)}%"></div>
                        </div>
                        <span class="patience-text">${Math.ceil(customer.maxWaitTime - customer.waitTime)}秒</span>
                    </div>
                    <div class="customer-hint">
                        ${isWaitingForPacking ? '点击出餐' : '点击开始炒制'}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderIngredients() {
        const container = document.getElementById('ingredients-stock');
        if (!container) return;
        
        const { noodles, toppings } = this.gameState.ingredients;
        const { noodles: maxNoodles, toppings: maxToppings } = this.gameState.maxIngredients;
        
        container.innerHTML = `
            <div class="ingredient-item">
                <div class="ingredient-name">米粉</div>
                <div class="ingredient-bar">
                    <div class="ingredient-fill" style="width: ${(noodles / maxNoodles) * 100}%"></div>
                </div>
                <div class="ingredient-count">${noodles} / ${maxNoodles}</div>
            </div>
            <div class="ingredient-item">
                <div class="ingredient-name">配菜</div>
                <div class="ingredient-bar">
                    <div class="ingredient-fill" style="width: ${(toppings / maxToppings) * 100}%"></div>
                </div>
                <div class="ingredient-count">${toppings} / ${maxToppings}</div>
            </div>
        `;
    }

    renderWoks() {
        const container = document.getElementById('woks-area');
        if (!container) return;
        
        container.innerHTML = this.gameState.woks.map(wok => {
            let stateClass = 'wok-empty';
            let content = '空闲';
            let actions = '';
            
            if (wok.state === WokState.COOKING) {
                stateClass = 'wok-cooking';
                const progress = (wok.progress / wok.maxProgress) * 100;
                content = `
                    <div class="wok-order">${wok.order?.name || '炒制中'}</div>
                    <div class="wok-progress-bar">
                        <div class="wok-progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="wok-time">${Math.ceil(wok.maxProgress - wok.progress)}秒</div>
                `;
            } else if (wok.state === WokState.DONE) {
                stateClass = 'wok-done';
                content = `
                    <div class="wok-order">${wok.order?.name || '已完成'}</div>
                    <div class="wok-ready">✓ 可以打包</div>
                `;
                actions = `
                    <button class="wok-action" data-action="move">移至打包台</button>
                    <button class="wok-action danger" data-action="discard">倒掉</button>
                `;
            }
            
            return `
                <div class="wok-card ${stateClass}" data-wok-id="${wok.id}">
                    <div class="wok-header">炒锅 #${wok.id + 1}</div>
                    <div class="wok-content">${content}</div>
                    <div class="wok-actions">${actions}</div>
                </div>
            `;
        }).join('');
    }

    renderPacking() {
        const container = document.getElementById('packing-area');
        if (!container) return;
        
        container.innerHTML = this.gameState.packingStations.map(station => {
            let stateClass = 'packing-empty';
            let content = '空闲';
            let actions = '';
            
            if (station.state === PackingState.WAITING) {
                const isSelected = this.selectedPackingStationId === station.id;
                stateClass = `packing-waiting ${isSelected ? 'packing-selected' : ''}`;
                content = `
                    <div class="packing-order">${station.order?.name || '待出餐'}</div>
                    <div class="packing-hint">点击选中后，再点击顾客出餐</div>
                `;
                actions = `
                    <button class="packing-action" data-action="select">
                        ${isSelected ? '取消选择' : '选择出餐'}
                    </button>
                    <button class="packing-action danger" data-action="discard">倒掉</button>
                `;
            }
            
            return `
                <div class="packing-card ${stateClass}" data-station-id="${station.id}">
                    <div class="packing-header">打包台 #${station.id + 1}</div>
                    <div class="packing-content">${content}</div>
                    <div class="packing-actions">${actions}</div>
                </div>
            `;
        }).join('');
    }

    renderLevelSelect() {
        const container = document.getElementById('level-list');
        if (!container) return;
        
        const levels = this.gameLogic.getLevels();
        
        container.innerHTML = levels.map((level, index) => {
            const progress = this.gameLogic.getLevelProgress(level.id);
            const isUnlocked = progress?.unlocked || index === 0;
            
            let cardClass = 'level-card';
            if (!isUnlocked) cardClass += ' level-locked';
            
            return `
                <div class="${cardClass}" data-level-id="${level.id}">
                    <div class="level-difficulty">难度: ${'⭐'.repeat(level.difficulty)}</div>
                    <div class="level-name">${level.name}</div>
                    <div class="level-description">${level.description}</div>
                    <div class="level-stats">
                        ${progress ? `
                            <span>最高分: ${progress.highScore}</span>
                            <span>最佳连击: ${progress.bestCombo}</span>
                            <span>游玩次数: ${progress.plays}</span>
                        ` : ''}
                    </div>
                    ${!isUnlocked ? '<div class="level-lock">🔒 完成前一关解锁</div>' : ''}
                </div>
            `;
        }).join('');
    }

    renderLevelManage() {
        const container = document.getElementById('manage-level-list');
        const exportSelect = document.getElementById('export-level-select');
        
        if (!container || !exportSelect) return;
        
        const levels = this.gameLogic.getLevels();
        
        container.innerHTML = levels.map((level, index) => `
            <div class="level-card" data-level-id="${level.id}">
                <div class="level-difficulty">难度: ${'⭐'.repeat(level.difficulty)}</div>
                <div class="level-name">${level.name} (ID: ${level.id})</div>
                <div class="level-description">${level.description}</div>
                <div class="level-details">
                    <span>时长: ${level.duration}秒</span>
                    <span>炒锅: ${level.wokCount}个</span>
                    <span>打包台: ${level.packingCount}个</span>
                    <span>菜品: ${level.dishes.length}种</span>
                </div>
            </div>
        `).join('');
        
        exportSelect.innerHTML = `
            <option value="">选择关卡导出</option>
            ${levels.map(level => `
                <option value="${level.id}">${level.name}</option>
            `).join('')}
        `;
    }

    renderResult() {
        const summary = this.gameState.getGameSummary();
        
        const scoreEl = document.getElementById('result-score');
        const completedEl = document.getElementById('result-completed');
        const lostEl = document.getElementById('result-lost');
        const maxComboEl = document.getElementById('result-max-combo');
        const wastedEl = document.getElementById('result-wasted');
        const badReviewsEl = document.getElementById('result-bad-reviews');
        const badReasonsEl = document.getElementById('result-bad-reasons');
        const titleEl = document.getElementById('result-title');
        
        if (titleEl) {
            if (summary.badReviews === 0 && summary.score > 0) {
                titleEl.textContent = '🎉 完美收官！';
            } else if (summary.score > 500) {
                titleEl.textContent = '👏 表现不错！';
            } else {
                titleEl.textContent = '游戏结束';
            }
        }
        
        if (scoreEl) scoreEl.textContent = summary.score;
        if (completedEl) completedEl.textContent = summary.completedOrders;
        if (lostEl) lostEl.textContent = summary.lostCustomers;
        if (maxComboEl) maxComboEl.textContent = summary.maxCombo;
        if (wastedEl) wastedEl.textContent = `米粉: ${summary.wastedNoodles}, 配菜: ${summary.wastedToppings}`;
        if (badReviewsEl) badReviewsEl.textContent = summary.badReviews;
        
        if (badReasonsEl) {
            if (summary.badReasons.length === 0) {
                badReasonsEl.innerHTML = '<div class="no-reasons">没有差评，太棒了！</div>';
            } else {
                const reasonCounts = {};
                summary.badReasons.forEach(reason => {
                    const key = reason.type;
                    if (!reasonCounts[key]) {
                        reasonCounts[key] = { count: 0, examples: [] };
                    }
                    reasonCounts[key].count++;
                    if (reasonCounts[key].examples.length < 3) {
                        reasonCounts[key].examples.push(`${reason.customer} - ${reason.dish}`);
                    }
                });
                
                const typeLabels = {
                    'timeout': '超时等待',
                    'game_end': '游戏结束未服务',
                    'wrong_order': '做错订单'
                };
                
                badReasonsEl.innerHTML = Object.entries(reasonCounts).map(([type, data]) => `
                    <div class="bad-reason-item">
                        <span class="reason-type">${typeLabels[type] || type}:</span>
                        <span class="reason-count">${data.count}次</span>
                        <div class="reason-examples">
                            ${data.examples.map(ex => `<span>${ex}</span>`).join(', ')}
                            ${data.count > 3 ? `... 等${data.count - 3}个` : ''}
                        </div>
                    </div>
                `).join('');
            }
        }
    }
}

export const ui = new UI();
