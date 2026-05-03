class GameEngine {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.gameState = {
            running: false,
            paused: false,
            currentTime: 0,
            totalTime: CONFIG.GAME_DURATION,
            speed: 1,
            lastTickTime: 0,
            level: null,
            levelConfig: null
        };
        
        this.orders = {
            queue: [],
            inProgress: [],
            completed: [],
            overdue: [],
            missed: [],
            nextOrderId: 1
        };
        
        this.equipment = {
            coffeeMachines: [],
            grinders: [],
            freezers: []
        };
        
        this.staff = [];
        
        this.stock = {};
        
        this.scoring = {
            totalScore: 0,
            combo: 0,
            maxCombo: 0,
            completedCount: 0,
            overdueCount: 0,
            missedCount: 0,
            tipsTotal: 0,
            wasteTotal: 0,
            overheatCount: 0
        };
        
        this.stats = {
            waitTimes: [],
            completedDrinks: {},
            equipmentUsage: {
                coffeeMachine: 0,
                grinder: 0,
                freezer: 0
            }
        };
        
        this.history = [];
        this.maxHistory = 50;
        
        this.uiSelections = {
            selectedOrderId: null,
            selectedStaffId: null
        };
        
        this.timerId = null;
    }
    
    initLevel(levelId) {
        const level = LEVELS.find(l => l.id === levelId);
        if (!level) {
            throw new Error(`Level ${levelId} not found`);
        }
        
        this.gameState.level = level;
        this.gameState.levelConfig = Utils.deepClone(level.config);
        
        this._initEquipment();
        this._initStaff();
        this._initStock();
        this._resetScoring();
        
        this.history = [];
    }
    
    _initEquipment() {
        const config = this.gameState.levelConfig;
        
        this.equipment.coffeeMachines = [];
        for (let i = 0; i < config.coffeeMachines; i++) {
            this.equipment.coffeeMachines.push({
                id: `cm_${i}`,
                name: `咖啡机 ${i + 1}`,
                type: 'coffee_machine',
                status: 'idle',
                temperature: 0,
                currentOrderId: null,
                currentStep: null,
                stepEndTime: 0
            });
        }
        
        this.equipment.grinders = [];
        for (let i = 0; i < config.grinders; i++) {
            this.equipment.grinders.push({
                id: `gr_${i}`,
                name: `磨豆机 ${i + 1}`,
                type: 'grinder',
                status: 'idle',
                temperature: 0,
                currentOrderId: null,
                currentStep: null,
                stepEndTime: 0
            });
        }
        
        this.equipment.freezers = [];
        for (let i = 0; i < config.freezers; i++) {
            this.equipment.freezers.push({
                id: `fz_${i}`,
                name: `冰柜 ${i + 1}`,
                type: 'freezer',
                status: 'idle',
                temperature: 0,
                currentOrderId: null,
                currentStep: null,
                stepEndTime: 0
            });
        }
    }
    
    _initStaff() {
        const config = this.gameState.levelConfig;
        this.staff = [];
        
        for (let i = 0; i < config.staff; i++) {
            this.staff.push({
                id: `st_${i}`,
                name: STAFF_NAMES[i % STAFF_NAMES.length],
                status: 'idle',
                currentOrderId: null,
                currentStepIndex: -1,
                taskEndTime: 0
            });
        }
    }
    
    _initStock() {
        this.stock = Utils.deepClone(this.gameState.levelConfig.initialStock);
    }
    
    _resetScoring() {
        this.scoring = {
            totalScore: 0,
            combo: 0,
            maxCombo: 0,
            completedCount: 0,
            overdueCount: 0,
            missedCount: 0,
            tipsTotal: 0,
            wasteTotal: 0,
            overheatCount: 0
        };
        
        this.stats = {
            waitTimes: [],
            completedDrinks: {},
            equipmentUsage: {
                coffeeMachine: 0,
                grinder: 0,
                freezer: 0
            }
        };
    }
    
    start() {
        if (this.gameState.running) return;
        
        this.gameState.running = true;
        this.gameState.paused = false;
        this.gameState.lastTickTime = Utils.now();
        
        EventBus.emit(EVENTS.GAME_START);
        this._startGameLoop();
    }
    
    pause() {
        this.gameState.paused = true;
        EventBus.emit(EVENTS.GAME_PAUSE);
    }
    
    resume() {
        this.gameState.paused = false;
        this.gameState.lastTickTime = Utils.now();
        EventBus.emit(EVENTS.GAME_RESUME);
    }
    
    setSpeed(speed) {
        this.gameState.speed = speed;
        EventBus.emit(EVENTS.GAME_SPEED_CHANGE, { speed });
    }
    
    _startGameLoop() {
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
        }
        
        const loop = () => {
            if (this.gameState.running) {
                this._tick();
                this.timerId = requestAnimationFrame(loop);
            }
        };
        
        this.timerId = requestAnimationFrame(loop);
    }
    
    _tick() {
        if (this.gameState.paused) return;
        
        const now = Utils.now();
        const deltaMs = now - this.gameState.lastTickTime;
        const deltaSeconds = (deltaMs / 1000) * this.gameState.speed;
        
        this.gameState.currentTime += deltaSeconds;
        this.gameState.lastTickTime = now;
        
        if (this.gameState.currentTime >= this.gameState.totalTime) {
            this.endGame();
            return;
        }
        
        this._updateOrders(deltaSeconds);
        this._updateEquipment(deltaSeconds);
        this._updateStaff();
        this._generateOrders();
        this._checkEquipmentBreakdown();
        
        this._autoSave();
        EventBus.emit(EVENTS.UI_UPDATE);
    }
    
    _updateOrders(deltaSeconds) {
        const currentTime = this.gameState.currentTime;
        
        this.orders.queue.forEach(order => {
            if (order.status !== 'queued') return;
            
            const elapsed = currentTime - order.createdAt;
            const patienceDecay = (CONFIG.PATIENCE.DECAY_RATE * deltaSeconds) / 
                (order.isUrgent ? 0.7 : order.isIced ? 1.3 : 1);
            
            order.patience = Math.max(0, order.patience - patienceDecay);
            
            if (elapsed > order.deadline) {
                if (!order.isOverdue) {
                    order.isOverdue = true;
                    this._handleOrderOverdue(order);
                }
            }
        });
    }
    
    _updateEquipment(deltaSeconds) {
        const currentTime = this.gameState.currentTime;
        const allEquipment = [
            ...this.equipment.coffeeMachines,
            ...this.equipment.grinders,
            ...this.equipment.freezers
        ];
        
        allEquipment.forEach(equipment => {
            if (equipment.status === 'broken') {
                return;
            }
            
            if (equipment.status === 'busy' && currentTime >= equipment.stepEndTime) {
                this._freeEquipment(equipment);
            }
            
            if (equipment.status === 'idle' && equipment.temperature > 0) {
                const config = CONFIG.EQUIPMENT[equipment.type.toUpperCase()];
                if (config) {
                    equipment.temperature = Math.max(0, equipment.temperature - config.COOL_RATE * deltaSeconds);
                }
            }
            
            if (equipment.status === 'overheating' && currentTime >= equipment.stepEndTime) {
                const config = CONFIG.EQUIPMENT[equipment.type.toUpperCase()];
                if (config && config.REPAIR_TIME > 0) {
                    equipment.status = 'broken';
                    equipment.stepEndTime = currentTime + config.REPAIR_TIME;
                    EventBus.emit(EVENTS.EQUIPMENT_BROKEN, { equipment });
                } else {
                    equipment.status = 'idle';
                    equipment.temperature = CONFIG.EQUIPMENT[equipment.type.toUpperCase()].OVERHEAT_THRESHOLD - 10;
                }
            }
            
            if (equipment.status === 'broken' && currentTime >= equipment.stepEndTime) {
                equipment.status = 'idle';
                equipment.temperature = 0;
                EventBus.emit(EVENTS.EQUIPMENT_REPAIRED, { equipment });
            }
        });
    }
    
    _updateStaff() {
        const currentTime = this.gameState.currentTime;
        
        this.staff.forEach(staff => {
            if (staff.status === 'busy' && currentTime >= staff.taskEndTime) {
                this._advanceOrderStep(staff);
            }
        });
    }
    
    _generateOrders() {
        const config = this.gameState.levelConfig;
        const totalOrders = this.orders.queue.length + this.orders.inProgress.length;
        
        if (totalOrders >= config.maxOrders) return;
        
        if (Utils.probability(config.orderFrequency * this.gameState.speed)) {
            this._createOrder();
        }
    }
    
    _createOrder() {
        const config = this.gameState.levelConfig;
        
        const drinkId = Utils.randomChoice(config.drinkPool);
        const drink = DRINKS[drinkId];
        
        if (!drink) return null;
        
        const isUrgent = Utils.probability(config.urgentRatio);
        const isIced = drink.isIced || Utils.probability(config.icedRatio);
        const isTakeaway = Utils.probability(config.takeawayRatio);
        
        let patience = CONFIG.PATIENCE.BASE_PATIENCE;
        if (isUrgent) patience = CONFIG.PATIENCE.URGENT_PATIENCE;
        if (isIced) patience = Math.max(patience, CONFIG.PATIENCE.ICED_PATIENCE);
        
        let deadline = drink.baseTime;
        if (isUrgent) deadline *= 0.7;
        if (isIced) deadline *= 1.2;
        if (isTakeaway) deadline += 15;
        
        const order = {
            id: `order_${this.orders.nextOrderId++}`,
            drinkId: drinkId,
            drinkName: drink.name,
            drink: Utils.deepClone(drink),
            isUrgent: isUrgent,
            isIced: isIced,
            isTakeaway: isTakeaway,
            status: 'queued',
            isOverdue: false,
            patience: patience,
            maxPatience: patience,
            createdAt: this.gameState.currentTime,
            deadline: this.gameState.currentTime + deadline,
            startedAt: null,
            completedAt: null,
            assignedStaffId: null,
            currentStepIndex: 0,
            usedEquipment: [],
            reservedEquipment: []
        };
        
        this.orders.queue.push(order);
        EventBus.emit(EVENTS.ORDER_CREATED, { order });
        
        return order;
    }
    
    assignOrderToStaff(orderId, staffId) {
        const order = this._findOrderById(orderId);
        const staff = this._findStaffById(staffId);
        
        if (!order || !staff) {
            return { success: false, reason: 'Order or staff not found' };
        }
        
        if (order.status !== 'queued') {
            return { success: false, reason: 'Order is not in queue' };
        }
        
        if (staff.status !== 'idle') {
            return { success: false, reason: 'Staff is not available' };
        }
        
        if (!this._canStartOrder(order)) {
            return { success: false, reason: 'Not enough ingredients or equipment' };
        }
        
        const historyEntry = this._createHistoryEntry('assign', {
            orderId,
            staffId,
            orderState: Utils.deepClone(order),
            staffState: Utils.deepClone(staff),
            stockState: Utils.deepClone(this.stock)
        });
        
        this._reserveEquipmentForOrder(order);
        this._consumeIngredients(order);
        
        order.status = 'in_progress';
        order.startedAt = this.gameState.currentTime;
        order.assignedStaffId = staffId;
        order.currentStepIndex = 0;
        
        staff.status = 'busy';
        staff.currentOrderId = orderId;
        staff.currentStepIndex = 0;
        
        const queueIndex = this.orders.queue.findIndex(o => o.id === orderId);
        if (queueIndex > -1) {
            this.orders.queue.splice(queueIndex, 1);
        }
        this.orders.inProgress.push(order);
        
        this._startNextStep(order, staff);
        
        this.history.push(historyEntry);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        EventBus.emit(EVENTS.ORDER_STARTED, { order, staff });
        EventBus.emit(EVENTS.STAFF_ASSIGNED, { staff, order });
        
        return { success: true };
    }
    
    _findOrderById(orderId) {
        return this.orders.queue.find(o => o.id === orderId) ||
               this.orders.inProgress.find(o => o.id === orderId) ||
               this.orders.completed.find(o => o.id === orderId) ||
               this.orders.overdue.find(o => o.id === orderId);
    }
    
    _findStaffById(staffId) {
        return this.staff.find(s => s.id === staffId);
    }
    
    _findEquipmentById(equipmentId) {
        const allEquipment = [
            ...this.equipment.coffeeMachines,
            ...this.equipment.grinders,
            ...this.equipment.freezers
        ];
        return allEquipment.find(e => e.id === equipmentId);
    }
    
    _canStartOrder(order) {
        for (const [ingredient, amount] of Object.entries(order.drink.ingredients)) {
            if ((this.stock[ingredient] || 0) < amount) {
                return false;
            }
        }
        
        return true;
    }
    
    _reserveEquipmentForOrder(order) {
        order.reservedEquipment = [];
        
        const currentTime = this.gameState.currentTime;
        
        for (const step of order.drink.steps) {
            if (!step.equipment) continue;
            
            let equipmentList;
            switch (step.equipment) {
                case 'coffee_machine':
                    equipmentList = this.equipment.coffeeMachines;
                    break;
                case 'grinder':
                    equipmentList = this.equipment.grinders;
                    break;
                case 'freezer':
                    equipmentList = this.equipment.freezers;
                    break;
                default:
                    continue;
            }
            
            const available = equipmentList.find(e => 
                e.status === 'idle' && 
                !order.reservedEquipment.includes(e.id)
            );
            
            if (available) {
                order.reservedEquipment.push(available.id);
            }
        }
    }
    
    _consumeIngredients(order) {
        for (const [ingredient, amount] of Object.entries(order.drink.ingredients)) {
            if (this.stock[ingredient] !== undefined) {
                this.stock[ingredient] -= amount;
                
                if (this.stock[ingredient] < 5) {
                    EventBus.emit(EVENTS.STOCK_LOW, { ingredient, amount: this.stock[ingredient] });
                }
                if (this.stock[ingredient] <= 0) {
                    EventBus.emit(EVENTS.STOCK_EMPTY, { ingredient });
                }
            }
        }
        
        EventBus.emit(EVENTS.STOCK_CHANGED, { stock: this.stock });
    }
    
    _startNextStep(order, staff) {
        if (order.currentStepIndex >= order.drink.steps.length) {
            this._completeOrder(order, staff);
            return;
        }
        
        const step = order.drink.steps[order.currentStepIndex];
        const currentTime = this.gameState.currentTime;
        
        let equipment = null;
        if (step.equipment) {
            equipment = this._getEquipmentForStep(step, order);
            
            if (!equipment) {
                return;
            }
            
            equipment.status = 'busy';
            equipment.currentOrderId = order.id;
            equipment.currentStep = step.type;
            equipment.stepEndTime = currentTime + step.duration;
            
            if (equipment.type !== 'freezer') {
                const config = CONFIG.EQUIPMENT[equipment.type.toUpperCase()];
                if (config) {
                    equipment.temperature += config.HEAT_PER_USE;
                    
                    if (equipment.temperature > config.OVERHEAT_THRESHOLD) {
                        this._handleEquipmentOverheat(equipment);
                    }
                }
            }
            
            order.usedEquipment.push(equipment.id);
            this.stats.equipmentUsage[equipment.type]++;
            
            EventBus.emit(EVENTS.EQUIPMENT_USED, { equipment, order, step });
        }
        
        staff.taskEndTime = currentTime + step.duration;
        staff.currentStepIndex = order.currentStepIndex;
    }
    
    _getEquipmentForStep(step, order) {
        let equipmentList;
        switch (step.equipment) {
            case 'coffee_machine':
                equipmentList = this.equipment.coffeeMachines;
                break;
            case 'grinder':
                equipmentList = this.equipment.grinders;
                break;
            case 'freezer':
                equipmentList = this.equipment.freezers;
                break;
            default:
                return null;
        }
        
        let equipment = equipmentList.find(e => 
            e.status === 'idle' || 
            (e.currentOrderId === order.id)
        );
        
        if (!equipment && order.reservedEquipment.length > 0) {
            equipment = this._findEquipmentById(order.reservedEquipment[0]);
            if (equipment && equipment.status !== 'idle') {
                equipment = null;
            }
        }
        
        return equipment;
    }
    
    _freeEquipment(equipment) {
        const oldStatus = equipment.status;
        equipment.status = 'idle';
        equipment.currentOrderId = null;
        equipment.currentStep = null;
        
        EventBus.emit(EVENTS.EQUIPMENT_IDLE, { equipment, oldStatus });
    }
    
    _advanceOrderStep(staff) {
        const order = this._findOrderById(staff.currentOrderId);
        if (!order) {
            this._freeStaff(staff);
            return;
        }
        
        order.currentStepIndex++;
        staff.currentStepIndex++;
        
        if (order.currentStepIndex >= order.drink.steps.length) {
            this._completeOrder(order, staff);
        } else {
            this._startNextStep(order, staff);
        }
    }
    
    _completeOrder(order, staff) {
        order.status = 'completed';
        order.completedAt = this.gameState.currentTime;
        
        const progressIndex = this.orders.inProgress.findIndex(o => o.id === order.id);
        if (progressIndex > -1) {
            this.orders.inProgress.splice(progressIndex, 1);
        }
        
        if (order.isOverdue) {
            this.orders.overdue.push(order);
        } else {
            this.orders.completed.push(order);
        }
        
        this._freeStaff(staff);
        
        order.usedEquipment.forEach(equipId => {
            const equipment = this._findEquipmentById(equipId);
            if (equipment && equipment.status === 'busy' && equipment.currentOrderId === order.id) {
                this._freeEquipment(equipment);
            }
        });
        
        const scoreResult = this._calculateOrderScore(order);
        
        this.scoring.completedCount++;
        if (!order.isOverdue) {
            this.scoring.combo++;
            this.scoring.maxCombo = Math.max(this.scoring.maxCombo, this.scoring.combo);
        }
        
        const waitTime = order.completedAt - order.createdAt;
        this.stats.waitTimes.push(waitTime);
        
        if (!this.stats.completedDrinks[order.drinkId]) {
            this.stats.completedDrinks[order.drinkId] = 0;
        }
        this.stats.completedDrinks[order.drinkId]++;
        
        EventBus.emit(EVENTS.ORDER_COMPLETED, { 
            order, 
            score: scoreResult.score,
            bonus: scoreResult.bonus
        });
    }
    
    _freeStaff(staff) {
        staff.status = 'idle';
        staff.currentOrderId = null;
        staff.currentStepIndex = -1;
        staff.taskEndTime = 0;
        
        EventBus.emit(EVENTS.STAFF_FREE, { staff });
    }
    
    _calculateOrderScore(order) {
        let score = 0;
        let bonus = 0;
        
        if (order.isOverdue) {
            score += CONFIG.SCORING.OVERDUE_PENALTY;
            this.scoring.overdueCount++;
            this.scoring.combo = 0;
        } else {
            score += CONFIG.SCORING.COMPLETE_ON_TIME;
            
            const timeLeft = order.deadline - this.gameState.currentTime;
            if (timeLeft > order.deadline * 0.3) {
                bonus += CONFIG.SCORING.COMPLETE_EARLY;
            }
            
            if (order.isUrgent) {
                bonus += CONFIG.SCORING.URGENT_TIP;
                this.scoring.tipsTotal += CONFIG.SCORING.URGENT_TIP;
            }
            
            if (this.scoring.combo > 0) {
                bonus += this.scoring.combo * CONFIG.SCORING.COMBO_BONUS;
            }
        }
        
        const total = score + bonus;
        this.scoring.totalScore += total;
        
        EventBus.emit(EVENTS.SCORE_CHANGED, { 
            score: this.scoring.totalScore,
            change: total,
            order
        });
        
        if (this.scoring.combo >= 3) {
            EventBus.emit(EVENTS.COMBO_ACHIEVED, { combo: this.scoring.combo });
        }
        
        return { score, bonus, total };
    }
    
    _handleOrderOverdue(order) {
        this.scoring.combo = 0;
        
        if (order.status === 'queued') {
            this.scoring.totalScore += CONFIG.SCORING.MISSED_PENALTY;
            this.scoring.missedCount++;
            
            const queueIndex = this.orders.queue.findIndex(o => o.id === order.id);
            if (queueIndex > -1) {
                this.orders.queue.splice(queueIndex, 1);
            }
            this.orders.missed.push(order);
            
            EventBus.emit(EVENTS.ORDER_MISSED, { order });
        }
        
        EventBus.emit(EVENTS.ORDER_OVERDUE, { order });
    }
    
    _handleEquipmentOverheat(equipment) {
        equipment.status = 'overheating';
        equipment.stepEndTime = this.gameState.currentTime + 10;
        
        this.scoring.overheatCount++;
        this.scoring.totalScore += CONFIG.SCORING.OVERHEAT_PENALTY;
        
        EventBus.emit(EVENTS.EQUIPMENT_OVERHEAT, { equipment });
    }
    
    _checkEquipmentBreakdown() {
        const config = this.gameState.levelConfig;
        const allEquipment = [
            ...this.equipment.coffeeMachines,
            ...this.equipment.grinders
        ];
        
        allEquipment.forEach(equipment => {
            if (equipment.status === 'idle' && equipment.temperature > 50) {
                if (Utils.probability(config.breakdownChance * this.gameState.speed)) {
                    const equipConfig = CONFIG.EQUIPMENT[equipment.type.toUpperCase()];
                    equipment.status = 'broken';
                    equipment.stepEndTime = this.gameState.currentTime + equipConfig.REPAIR_TIME;
                    EventBus.emit(EVENTS.EQUIPMENT_BROKEN, { equipment });
                }
            }
        });
    }
    
    undo() {
        if (this.history.length === 0) {
            return { success: false, reason: 'No history to undo' };
        }
        
        const lastAction = this.history.pop();
        
        if (lastAction.type === 'assign') {
            const order = this._findOrderById(lastAction.data.orderId);
            const staff = this._findStaffById(lastAction.data.staffId);
            
            if (order && order.status === 'in_progress') {
                this._revertOrderAssignment(order, staff, lastAction.data);
            }
        }
        
        EventBus.emit(EVENTS.ACTION_UNDONE);
        return { success: true };
    }
    
    _revertOrderAssignment(order, staff, savedState) {
        if (staff) {
            this._freeStaff(staff);
        }
        
        order.usedEquipment.forEach(equipId => {
            const equipment = this._findEquipmentById(equipId);
            if (equipment) {
                this._freeEquipment(equipment);
            }
        });
        
        this.stock = Utils.deepClone(savedState.stockState);
        
        Object.assign(order, savedState.orderState);
        
        const progressIndex = this.orders.inProgress.findIndex(o => o.id === order.id);
        if (progressIndex > -1) {
            this.orders.inProgress.splice(progressIndex, 1);
        }
        this.orders.queue.push(order);
    }
    
    _createHistoryEntry(type, data) {
        return {
            type,
            data,
            timestamp: this.gameState.currentTime,
            realTime: Utils.now()
        };
    }
    
    _autoSave() {
        if (Math.floor(this.gameState.currentTime) % 30 === 0) {
            this.saveState();
        }
    }
    
    saveState() {
        const state = {
            gameState: Utils.deepClone(this.gameState),
            orders: Utils.deepClone(this.orders),
            equipment: Utils.deepClone(this.equipment),
            staff: Utils.deepClone(this.staff),
            stock: Utils.deepClone(this.stock),
            scoring: Utils.deepClone(this.scoring),
            stats: Utils.deepClone(this.stats),
            history: Utils.deepClone(this.history),
            uiSelections: Utils.deepClone(this.uiSelections)
        };
        
        Storage.saveGame(state);
        return state;
    }
    
    loadState(state) {
        try {
            this.gameState = state.gameState;
            this.orders = state.orders;
            this.equipment = state.equipment;
            this.staff = state.staff;
            this.stock = state.stock;
            this.scoring = state.scoring;
            this.stats = state.stats;
            this.history = state.history;
            this.uiSelections = state.uiSelections || { selectedOrderId: null, selectedStaffId: null };
            
            this.gameState.running = false;
            this.gameState.paused = true;
            this.gameState.lastTickTime = Utils.now();
            
            return true;
        } catch (e) {
            console.error('Failed to load state:', e);
            return false;
        }
    }
    
    endGame() {
        this.gameState.running = false;
        
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }
        
        this.orders.queue.forEach(order => {
            if (order.status === 'queued') {
                order.status = 'missed';
                this.orders.missed.push(order);
                this.scoring.missedCount++;
            }
        });
        this.orders.queue = [];
        
        Storage.addHighScore(
            this.scoring.totalScore,
            this.gameState.level.id,
            this.gameState.level.name
        );
        
        Storage.clearSavedGame();
        
        EventBus.emit(EVENTS.GAME_OVER, {
            report: this.generateReport()
        });
    }
    
    generateReport() {
        const totalOrders = this.scoring.completedCount + this.scoring.missedCount;
        const completionRate = totalOrders > 0 
            ? (this.scoring.completedCount / totalOrders * 100).toFixed(1) 
            : 0;
        
        const avgWaitTime = this.stats.waitTimes.length > 0
            ? Utils.average(this.stats.waitTimes).toFixed(1)
            : 0;
        
        const maxPossibleScore = (this.scoring.completedCount + this.scoring.missedCount) * 
            (CONFIG.SCORING.COMPLETE_ON_TIME + CONFIG.SCORING.COMPLETE_EARLY + CONFIG.SCORING.URGENT_TIP);
        
        const grade = Utils.calculateGrade(this.scoring.totalScore, Math.max(maxPossibleScore, 1000));
        
        return {
            level: {
                id: this.gameState.level.id,
                name: this.gameState.level.name,
                difficulty: this.gameState.level.difficulty
            },
            timestamp: Utils.getCurrentDateString(),
            gameDuration: this.gameState.currentTime,
            scoring: {
                totalScore: this.scoring.totalScore,
                grade: grade
            },
            orders: {
                total: totalOrders,
                completed: this.scoring.completedCount,
                overdue: this.scoring.overdueCount,
                missed: this.scoring.missedCount,
                completionRate: parseFloat(completionRate)
            },
            performance: {
                averageWaitTime: parseFloat(avgWaitTime),
                maxCombo: this.scoring.maxCombo,
                totalTips: this.scoring.tipsTotal,
                overheatCount: this.scoring.overheatCount
            },
            stock: {
                initial: this.gameState.levelConfig.initialStock,
                final: this.stock,
                wasted: this.scoring.wasteTotal
            },
            equipment: {
                usage: this.stats.equipmentUsage,
                breakdowns: this.scoring.overheatCount
            },
            drinks: this.stats.completedDrinks
        };
    }
    
    generateMarkdownReport(report) {
        const r = report || this.generateReport();
        
        return `# 咖啡店营业日报

## 📋 基本信息
- **关卡**: ${r.level.name}
- **难度**: ${r.level.difficulty === 'easy' ? '简单' : r.level.difficulty === 'medium' ? '中等' : '困难'}
- **日期**: ${r.timestamp}
- **营业时长**: ${Utils.formatTime(r.gameDuration)}

## 🏆 最终评分
- **总分**: **${r.scoring.totalScore}** 分
- **评级**: **${r.scoring.grade.letter}**

## 📊 订单统计
| 指标 | 数值 |
|------|------|
| 总订单数 | ${r.orders.total} |
| 已完成 | ${r.orders.completed} |
| 超时完成 | ${r.orders.overdue} |
| 漏单 | ${r.orders.missed} |
| 完成率 | ${r.orders.completionRate}% |

## ⏱️ 运营效率
- **平均等待时间**: ${r.performance.averageWaitTime} 秒
- **最高连单**: ${r.performance.maxCombo} 单
- **获得小费**: ${r.performance.totalTips} 分
- **设备过热**: ${r.performance.overheatCount} 次

## 📦 库存使用
### 初始库存
${Object.entries(r.stock.initial).map(([key, val]) => 
  `- ${INGREDIENT_NAMES[key] || key}: ${val}`
).join('\n')}

### 剩余库存
${Object.entries(r.stock.final).map(([key, val]) => 
  `- ${INGREDIENT_NAMES[key] || key}: ${val}`
).join('\n')}

## ☕ 饮品销量
${Object.entries(r.drinks).length > 0 
  ? Object.entries(r.drinks).map(([id, count]) => 
    `- ${DRINKS[id]?.name || id}: ${count} 杯`
  ).join('\n')
  : '无销量记录'}

---

*报告生成时间: ${new Date().toLocaleString()}*
`;
    }
    
    getState() {
        return {
            gameState: this.gameState,
            orders: this.orders,
            equipment: this.equipment,
            staff: this.staff,
            stock: this.stock,
            scoring: this.scoring,
            stats: this.stats,
            uiSelections: this.uiSelections
        };
    }
    
    selectOrder(orderId) {
        this.uiSelections.selectedOrderId = orderId;
    }
    
    selectStaff(staffId) {
        this.uiSelections.selectedStaffId = staffId;
    }
    
    getSelectedOrder() {
        if (!this.uiSelections.selectedOrderId) return null;
        return this._findOrderById(this.uiSelections.selectedOrderId);
    }
    
    getSelectedStaff() {
        if (!this.uiSelections.selectedStaffId) return null;
        return this._findStaffById(this.uiSelections.selectedStaffId);
    }
    
    tryQuickAssign() {
        const order = this.getSelectedOrder();
        const staff = this.getSelectedStaff();
        
        if (order && staff) {
            return this.assignOrderToStaff(order.id, staff.id);
        }
        
        return { success: false, reason: 'No order or staff selected' };
    }
}
