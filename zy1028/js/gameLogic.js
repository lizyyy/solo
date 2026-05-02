import { gameState, GameStates, CustomerState } from './gameState.js';
import { defaultLevels, LevelParser, ValidationError } from './levelParser.js';

export class GameLogic {
    constructor() {
        this.gameState = gameState;
        this.levels = [...defaultLevels];
        this.lastUpdateTime = 0;
        this.nextCustomerTime = 0;
        this.isRunning = false;
        this.messageTimeout = null;
    }

    init() {
        this.loadLevels();
    }

    loadLevels() {
        const savedLevels = localStorage.getItem('nightMarket_levels');
        if (savedLevels) {
            try {
                const parsedLevels = JSON.parse(savedLevels);
                if (Array.isArray(parsedLevels) && parsedLevels.length > 0) {
                    let allValid = true;
                    for (const level of parsedLevels) {
                        try {
                            LevelParser.validateLevel(level);
                        } catch (e) {
                            allValid = false;
                            break;
                        }
                    }
                    if (allValid) {
                        this.levels = parsedLevels;
                        return;
                    }
                }
            } catch (e) {
                console.error('Failed to load saved levels:', e);
            }
        }
        this.levels = [...defaultLevels];
    }

    saveLevels() {
        localStorage.setItem('nightMarket_levels', JSON.stringify(this.levels));
    }

    getLevels() {
        return this.levels;
    }

    getLevelById(levelId) {
        return this.levels.find(l => l.id === levelId);
    }

    addLevel(levelJson) {
        try {
            const level = LevelParser.parse(levelJson);
            
            if (this.levels.find(l => l.id === level.id)) {
                throw new ValidationError(
                    'duplicate_id',
                    `关卡ID ${level.id} 已存在`,
                    'id'
                );
            }
            
            this.levels.push(level);
            this.saveLevels();
            return { success: true, level };
        } catch (error) {
            return { 
                success: false, 
                error: error,
                errorType: error.type || 'unknown',
                message: error.message || '未知错误'
            };
        }
    }

    importLevels(jsonString) {
        try {
            const newLevels = LevelParser.parseMultiple(jsonString);
            
            const existingIds = new Set(this.levels.map(l => l.id));
            const duplicates = [];
            const validLevels = [];
            
            for (const level of newLevels) {
                if (existingIds.has(level.id)) {
                    duplicates.push(level.id);
                } else {
                    validLevels.push(level);
                    existingIds.add(level.id);
                }
            }
            
            if (validLevels.length > 0) {
                this.levels = [...this.levels, ...validLevels];
                this.saveLevels();
            }
            
            return {
                success: validLevels.length > 0,
                imported: validLevels.length,
                duplicates: duplicates,
                message: duplicates.length > 0 
                    ? `成功导入 ${validLevels.length} 个关卡，${duplicates.length} 个关卡ID重复已跳过` 
                    : `成功导入 ${validLevels.length} 个关卡`
            };
        } catch (error) {
            return {
                success: false,
                error: error,
                errorType: error.type || 'unknown',
                message: error.message || '导入失败'
            };
        }
    }

    exportLevel(levelId) {
        const level = this.getLevelById(levelId);
        if (!level) {
            return { success: false, message: '关卡不存在' };
        }
        return { success: true, json: LevelParser.toJSON(level) };
    }

    resetToDefaultLevels() {
        this.levels = [...defaultLevels];
        this.saveLevels();
        return { success: true, message: '已重置为默认关卡' };
    }

    startGame(levelId) {
        const level = this.getLevelById(levelId);
        if (!level) {
            return { success: false, message: '关卡不存在' };
        }
        
        this.gameState.initFromLevel(level);
        this.gameState.setState(GameStates.PLAYING);
        
        this.lastUpdateTime = performance.now();
        this.nextCustomerTime = 0;
        this.isRunning = true;
        
        this.generateCustomer();
        
        return { success: true };
    }

    pauseGame() {
        if (this.gameState.gameState !== GameStates.PLAYING) {
            return { success: false, message: '游戏未在运行' };
        }
        
        this.gameState.setState(GameStates.PAUSED);
        this.isRunning = false;
        
        return { success: true };
    }

    resumeGame() {
        if (this.gameState.gameState !== GameStates.PAUSED) {
            return { success: false, message: '游戏未暂停' };
        }
        
        this.gameState.setState(GameStates.PLAYING);
        this.lastUpdateTime = performance.now();
        this.isRunning = true;
        
        return { success: true };
    }

    quitGame() {
        this.isRunning = false;
        this.gameState.setState(GameStates.MENU);
        return { success: true };
    }

    update() {
        if (!this.isRunning || this.gameState.gameState !== GameStates.PLAYING) {
            return;
        }
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;
        
        const gameEnded = this.gameState.updateGameTime(deltaTime);
        if (gameEnded) {
            this.endGame();
            return;
        }
        
        this.nextCustomerTime -= deltaTime;
        if (this.nextCustomerTime <= 0) {
            this.generateCustomer();
            this.nextCustomerTime = this.gameState.currentLevel.customerSpawnRate;
        }
        
        this.gameState.updateCustomerWaitTime(deltaTime);
        this.gameState.updateCookingProgress(deltaTime);
    }

    generateCustomer() {
        const level = this.gameState.currentLevel;
        if (!level) return;
        
        if (this.gameState.customers.length >= level.maxCustomers) {
            return;
        }
        
        const waitingCustomers = this.gameState.customers.filter(
            c => c.state === CustomerState.WAITING || c.state === CustomerState.ANGRY
        );
        if (waitingCustomers.length >= level.maxCustomers) {
            return;
        }
        
        const customerPool = level.customerPool;
        const randomIndex = Math.floor(Math.random() * customerPool.length);
        const customerTemplate = customerPool[randomIndex];
        
        const dishIndex = Math.floor(Math.random() * customerTemplate.dishes.length);
        const selectedDish = customerTemplate.dishes[dishIndex];
        
        const customer = {
            name: customerTemplate.name,
            dish: selectedDish,
            patience: customerTemplate.patience,
            tipMultiplier: customerTemplate.tipMultiplier
        };
        
        this.gameState.addCustomer(customer);
    }

    startCooking(customerId) {
        const customer = this.gameState.customers.find(c => c.id === customerId);
        if (!customer) {
            return { success: false, message: '顾客不存在' };
        }
        
        if (customer.state !== CustomerState.WAITING && customer.state !== CustomerState.ANGRY) {
            return { success: false, message: '顾客已离开或已服务' };
        }
        
        const result = this.gameState.startCooking(customer.dish, customerId);
        return result;
    }

    moveToPacking(wokId) {
        return this.gameState.moveToPacking(wokId);
    }

    serveOrder(stationId, customerId) {
        return this.gameState.serveOrder(stationId, customerId);
    }

    restockIngredients(type) {
        return this.gameState.restockIngredients(type);
    }

    discardWok(wokId) {
        return this.gameState.discardWok(wokId);
    }

    discardPacking(stationId) {
        return this.gameState.discardPacking(stationId);
    }

    endGame() {
        this.isRunning = false;
        
        while (this.gameState.customers.length > 0) {
            const customer = this.gameState.customers[0];
            if (customer.state === CustomerState.WAITING || customer.state === CustomerState.ANGRY) {
                this.gameState.badReviews++;
                this.gameState.lostCustomers.push({
                    id: customer.id,
                    name: customer.name,
                    dish: customer.dish,
                    reason: '游戏结束未服务'
                });
                this.gameState.badReasons.push({
                    type: 'game_end',
                    customer: customer.name,
                    dish: customer.dish,
                    time: this.gameState.gameTime
                });
            }
            this.gameState.customers.shift();
        }
        
        for (const wok of this.gameState.woks) {
            if (wok.order) {
                this.gameState.wastedIngredients.noodles += wok.order.dish.ingredients.noodles;
                this.gameState.wastedIngredients.toppings += wok.order.dish.ingredients.toppings;
            }
        }
        
        for (const station of this.gameState.packingStations) {
            if (station.order) {
                this.gameState.wastedIngredients.noodles += station.order.dish.ingredients.noodles;
                this.gameState.wastedIngredients.toppings += station.order.dish.ingredients.toppings;
            }
        }
        
        this.gameState.setState(GameStates.RESULT);
        this.saveGameResult();
    }

    saveGameResult() {
        const levelId = this.gameState.currentLevel?.id;
        if (!levelId) return;
        
        const summary = this.gameState.getGameSummary();
        const progressKey = `nightMarket_progress_${levelId}`;
        
        let progress = {
            unlocked: true,
            highScore: 0,
            bestCombo: 0,
            plays: 0,
            lastPlayed: null
        };
        
        const saved = localStorage.getItem(progressKey);
        if (saved) {
            try {
                progress = { ...progress, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to parse saved progress:', e);
            }
        }
        
        if (summary.score > progress.highScore) {
            progress.highScore = summary.score;
        }
        if (summary.maxCombo > progress.bestCombo) {
            progress.bestCombo = summary.maxCombo;
        }
        progress.plays++;
        progress.lastPlayed = new Date().toISOString();
        progress.lastSummary = summary;
        
        localStorage.setItem(progressKey, JSON.stringify(progress));
        
        const levelIndex = this.levels.findIndex(l => l.id === levelId);
        if (levelIndex >= 0 && levelIndex < this.levels.length - 1) {
            const nextLevelId = this.levels[levelIndex + 1].id;
            const nextProgressKey = `nightMarket_progress_${nextLevelId}`;
            const nextSaved = localStorage.getItem(nextProgressKey);
            if (!nextSaved) {
                localStorage.setItem(nextProgressKey, JSON.stringify({
                    unlocked: true,
                    highScore: 0,
                    bestCombo: 0,
                    plays: 0,
                    lastPlayed: null
                }));
            }
        }
    }

    getLevelProgress(levelId) {
        const progressKey = `nightMarket_progress_${levelId}`;
        const saved = localStorage.getItem(progressKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        
        const levelIndex = this.levels.findIndex(l => l.id === levelId);
        if (levelIndex === 0) {
            const defaultProgress = {
                unlocked: true,
                highScore: 0,
                bestCombo: 0,
                plays: 0,
                lastPlayed: null
            };
            localStorage.setItem(progressKey, JSON.stringify(defaultProgress));
            return defaultProgress;
        }
        
        return {
            unlocked: false,
            highScore: 0,
            bestCombo: 0,
            plays: 0,
            lastPlayed: null
        };
    }

    showMessage(message, type = 'info') {
        const messageElement = document.getElementById('game-message');
        if (!messageElement) return;
        
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        messageElement.textContent = message;
        messageElement.className = `game-message message-${type}`;
        messageElement.style.display = 'block';
        
        this.messageTimeout = setTimeout(() => {
            messageElement.style.display = 'none';
            this.messageTimeout = null;
        }, 3000);
    }
}

export const gameLogic = new GameLogic();
