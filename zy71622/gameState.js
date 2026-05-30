const GameState = (function() {
    const STORAGE_KEY = 'breakfast_fund_manager_v1';
    const HISTORY_KEY = 'breakfast_fund_manager_history_v1';
    const MAX_HISTORY_SNAPSHOTS = 50;

    const INGREDIENTS_DATA = {
        egg: { name: '鸡蛋', emoji: '🥚', basePrice: 2, perishTime: 3, category: 'protein' },
        flour: { name: '面粉', emoji: '🌾', basePrice: 1, perishTime: 7, category: 'staple' },
        milk: { name: '牛奶', emoji: '🥛', basePrice: 3, perishTime: 2, category: 'dairy' },
        vegetable: { name: '蔬菜', emoji: '🥬', basePrice: 2, perishTime: 2, category: 'vegetable' },
        meat: { name: '肉类', emoji: '🥓', basePrice: 5, perishTime: 2, category: 'protein' },
        bread: { name: '面包', emoji: '🍞', basePrice: 2, perishTime: 3, category: 'staple' }
    };

    const FUNDS_DATA = {
        conservative: { 
            name: '稳健债基', 
            emoji: '🔵', 
            volatility: 0.02, 
            expectedReturn: 0.01,
            description: '低风险，收益稳定',
            category: 'fixed_income'
        },
        balanced: { 
            name: '混合基金', 
            emoji: '🟢', 
            volatility: 0.05, 
            expectedReturn: 0.03,
            description: '中等风险，收益适中',
            category: 'hybrid'
        },
        aggressive: { 
            name: '成长股票', 
            emoji: '🔴', 
            volatility: 0.10, 
            expectedReturn: 0.05,
            description: '高风险，高收益',
            category: 'equity'
        }
    };

    const RECIPES = {
        sandwich: {
            name: '三明治',
            emoji: '🥪',
            ingredients: { bread: 2, egg: 1, vegetable: 1 },
            basePrice: 15
        },
        pancake: {
            name: '煎饼',
            emoji: '🥞',
            ingredients: { flour: 2, egg: 1, milk: 1 },
            basePrice: 12
        },
        breakfastSet: {
            name: '早餐套餐',
            emoji: '🍳',
            ingredients: { egg: 2, meat: 1, bread: 1, milk: 1 },
            basePrice: 25
        },
        veggieWrap: {
            name: '蔬菜卷',
            emoji: '🌯',
            ingredients: { flour: 1, vegetable: 2, egg: 1 },
            basePrice: 18
        }
    };

    const MARKET_EVENTS = [
        { 
            id: 'normal', 
            name: '平稳市场', 
            effect: '市场平稳，一切正常',
            impact: { priceMultiplier: 1, fundReturnMultiplier: 1, orderBonus: 0 },
            probability: 0.4
        },
        { 
            id: 'ingredient_shortage', 
            name: '食材涨价', 
            effect: '供应链紧张，食材价格上涨20%',
            impact: { priceMultiplier: 1.2, fundReturnMultiplier: 1, orderBonus: 0 },
            probability: 0.15
        },
        { 
            id: 'ingredient_sale', 
            name: '食材促销', 
            effect: '供应商促销，食材价格下降20%',
            impact: { priceMultiplier: 0.8, fundReturnMultiplier: 1, orderBonus: 0 },
            probability: 0.15
        },
        { 
            id: 'bull_market', 
            name: '牛市', 
            effect: '股市大涨，基金收益提升',
            impact: { priceMultiplier: 1, fundReturnMultiplier: 2, orderBonus: 0 },
            probability: 0.1
        },
        { 
            id: 'bear_market', 
            name: '熊市', 
            effect: '股市下跌，基金收益承压',
            impact: { priceMultiplier: 1, fundReturnMultiplier: -0.5, orderBonus: 0 },
            probability: 0.1
        },
        { 
            id: 'peak_hour', 
            name: '早餐高峰', 
            effect: '订单量增加，顾客愿意多付钱',
            impact: { priceMultiplier: 1, fundReturnMultiplier: 1, orderBonus: 5 },
            probability: 0.1
        }
    ];

    let state = null;
    let historySnapshots = [];
    let pendingRecords = [];

    function createInitialState() {
        return {
            round: 1,
            phase: 'preparation',
            cash: 1000,
            initialCash: 1000,
            inventory: {},
            funds: {
                conservative: { shares: 0, avgCost: 0, currentPrice: 10 },
                balanced: { shares: 0, avgCost: 0, currentPrice: 10 },
                aggressive: { shares: 0, avgCost: 0, currentPrice: 10 }
            },
            orders: [],
            currentEvent: MARKET_EVENTS[0],
            ingredientPrices: {},
            logs: [],
            statistics: {
                totalOrdersCompleted: 0,
                totalOrdersFailed: 0,
                totalRevenue: 0,
                totalCost: 0,
                fundRealizedGain: 0,
                fundUnrealizedGain: 0,
                ingredientsWasted: 0
            },
            gameStartTime: Date.now(),
            lastUpdate: Date.now()
        };
    }

    function init() {
        loadFromStorage();
        if (!state) {
            reset();
        }
        loadHistory();
    }

    function reset() {
        state = createInitialState();
        initializePrices();
        generateOrders();
        pendingRecords = [];
        saveToStorage();
        saveSnapshot();
    }

    function initializePrices() {
        Object.keys(INGREDIENTS_DATA).forEach(key => {
            state.ingredientPrices[key] = INGREDIENTS_DATA[key].basePrice;
        });
    }

    function loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                state = JSON.parse(stored);
                return true;
            }
        } catch (e) {
            console.error('Failed to load game state:', e);
        }
        return false;
    }

    function saveToStorage() {
        try {
            state.lastUpdate = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save game state:', e);
        }
    }

    function loadHistory() {
        try {
            const stored = localStorage.getItem(HISTORY_KEY);
            if (stored) {
                historySnapshots = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load history:', e);
            historySnapshots = [];
        }
    }

    function saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(historySnapshots));
        } catch (e) {
            console.error('Failed to save history:', e);
        }
    }

    function saveSnapshot(label = null) {
        const snapshot = {
            id: Date.now(),
            label: label || `回合 ${state.round}`,
            timestamp: Date.now(),
            round: state.round,
            state: JSON.parse(JSON.stringify(state))
        };
        historySnapshots.unshift(snapshot);
        if (historySnapshots.length > MAX_HISTORY_SNAPSHOTS) {
            historySnapshots = historySnapshots.slice(0, MAX_HISTORY_SNAPSHOTS);
        }
        saveHistory();
        return snapshot;
    }

    function getSnapshot(id) {
        return historySnapshots.find(s => s.id === id);
    }

    function getAllSnapshots() {
        return historySnapshots;
    }

    function restoreSnapshot(id) {
        const snapshot = getSnapshot(id);
        if (snapshot) {
            state = JSON.parse(JSON.stringify(snapshot.state));
            saveToStorage();
            return true;
        }
        return false;
    }

    function addPendingRecord(type, data, reason) {
        const record = {
            id: Date.now() + Math.random(),
            type,
            data,
            reason,
            timestamp: Date.now(),
            round: state.round
        };
        pendingRecords.push(record);
        addLog(`⚠️ 待处理: ${reason}`, 'warning');
        return record;
    }

    function resolvePendingRecord(id, action) {
        const index = pendingRecords.findIndex(r => r.id === id);
        if (index === -1) return false;
        
        const record = pendingRecords[index];
        if (action === 'accept') {
            if (record.type === 'overdraft') {
                state.cash = record.data.newCash;
                addLog(`✅ 已接受现金透支: ¥${Math.abs(record.data.amount).toFixed(2)}`, 'success');
            }
        } else if (action === 'reject') {
            addLog(`❌ 已拒绝操作`, 'info');
        }
        
        pendingRecords.splice(index, 1);
        saveToStorage();
        return true;
    }

    function getPendingRecords() {
        return pendingRecords;
    }

    function addLog(message, type = 'info') {
        const log = {
            id: Date.now() + Math.random(),
            message,
            type,
            timestamp: Date.now(),
            round: state.round
        };
        state.logs.unshift(log);
        if (state.logs.length > 100) {
            state.logs = state.logs.slice(0, 100);
        }
        saveToStorage();
    }

    function getIngredientsData() {
        return INGREDIENTS_DATA;
    }

    function getFundsData() {
        return FUNDS_DATA;
    }

    function getRecipes() {
        return RECIPES;
    }

    function getMarketEvents() {
        return MARKET_EVENTS;
    }

    function getState() {
        return state;
    }

    function getPortfolioValue() {
        let ingredientsValue = 0;
        Object.keys(state.inventory).forEach(key => {
            const items = state.inventory[key] || [];
            items.forEach(item => {
                ingredientsValue += item.quantity * item.price;
            });
        });

        let fundsValue = 0;
        Object.keys(state.funds).forEach(key => {
            fundsValue += state.funds[key].shares * state.funds[key].currentPrice;
        });

        return {
            cash: state.cash,
            ingredientsValue,
            fundsValue,
            total: state.cash + ingredientsValue + fundsValue
        };
    }

    function exportData() {
        return {
            version: '1.0',
            exportTime: Date.now(),
            currentState: state,
            history: historySnapshots,
            pendingRecords: pendingRecords
        };
    }

    function importData(data) {
        try {
            if (data.currentState) {
                state = data.currentState;
                saveToStorage();
            }
            if (data.history) {
                historySnapshots = data.history;
                saveHistory();
            }
            if (data.pendingRecords) {
                pendingRecords = data.pendingRecords;
            }
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }

    function generateOrders() {
        state.orders = [];
        const recipeKeys = Object.keys(RECIPES);
        const orderCount = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < orderCount; i++) {
            const recipeKey = recipeKeys[Math.floor(Math.random() * recipeKeys.length)];
            const recipe = RECIPES[recipeKey];
            const patience = 1 + Math.floor(Math.random() * 2);
            
            state.orders.push({
                id: Date.now() + i,
                recipeKey,
                recipeName: recipe.name,
                emoji: recipe.emoji,
                price: recipe.basePrice + (state.currentEvent?.impact?.orderBonus || 0),
                patience,
                maxPatience: patience,
                status: 'pending'
            });
        }
    }

    return {
        init,
        reset,
        getState,
        saveToStorage,
        saveSnapshot,
        getSnapshot,
        getAllSnapshots,
        restoreSnapshot,
        addPendingRecord,
        resolvePendingRecord,
        getPendingRecords,
        addLog,
        getIngredientsData,
        getFundsData,
        getRecipes,
        getMarketEvents,
        getPortfolioValue,
        exportData,
        importData,
        generateOrders,
        initializePrices
    };
})();
