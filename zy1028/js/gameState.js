export const GameStates = {
    MENU: 'menu',
    LEVEL_SELECT: 'level_select',
    LEVEL_MANAGE: 'level_manage',
    PLAYING: 'playing',
    PAUSED: 'paused',
    RESULT: 'result'
};

export const CustomerState = {
    WAITING: 'waiting',
    ANGRY: 'angry',
    LEFT: 'left',
    SERVED: 'served'
};

export const WokState = {
    EMPTY: 'empty',
    COOKING: 'cooking',
    DONE: 'done'
};

export const PackingState = {
    EMPTY: 'empty',
    WAITING: 'waiting'
};

export class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.gameState = GameStates.MENU;
        
        this.currentLevel = null;
        
        this.gameTime = 0;
        this.maxGameTime = 0;
        
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.badReviews = 0;
        
        this.customers = [];
        this.nextCustomerId = 1;
        
        this.ingredients = {
            noodles: 0,
            toppings: 0
        };
        this.maxIngredients = {
            noodles: 0,
            toppings: 0
        };
        this.wastedIngredients = {
            noodles: 0,
            toppings: 0
        };
        
        this.woks = [];
        this.packingStations = [];
        
        this.completedOrders = [];
        this.lostCustomers = [];
        this.badReasons = [];
        
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this));
    }

    setState(newState) {
        this.gameState = newState;
        this.notify();
    }

    initFromLevel(level) {
        this.currentLevel = level;
        this.gameTime = 0;
        this.maxGameTime = level.duration;
        
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.badReviews = 0;
        
        this.customers = [];
        this.nextCustomerId = 1;
        
        this.ingredients = {
            noodles: level.initialIngredients.noodles,
            toppings: level.initialIngredients.toppings
        };
        this.maxIngredients = {
            noodles: level.maxIngredients.noodles,
            toppings: level.maxIngredients.toppings
        };
        this.wastedIngredients = {
            noodles: 0,
            toppings: 0
        };
        
        this.woks = Array(level.wokCount).fill(null).map((_, index) => ({
            id: index,
            state: WokState.EMPTY,
            order: null,
            progress: 0,
            maxProgress: 0
        }));
        
        this.packingStations = Array(level.packingCount).fill(null).map((_, index) => ({
            id: index,
            state: PackingState.EMPTY,
            order: null
        }));
        
        this.completedOrders = [];
        this.lostCustomers = [];
        this.badReasons = [];
        
        this.notify();
    }

    addCustomer(customer) {
        customer.id = this.nextCustomerId++;
        customer.state = CustomerState.WAITING;
        customer.waitTime = 0;
        customer.maxWaitTime = customer.patience;
        this.customers.push(customer);
        this.notify();
        return customer;
    }

    updateCustomerWaitTime(deltaTime) {
        const leavingCustomers = [];
        
        this.customers.forEach(customer => {
            if (customer.state === CustomerState.WAITING || customer.state === CustomerState.ANGRY) {
                customer.waitTime += deltaTime;
                
                if (customer.waitTime >= customer.maxWaitTime) {
                    customer.state = CustomerState.LEFT;
                    leavingCustomers.push(customer);
                    this.badReviews++;
                    this.lostCustomers.push({
                        id: customer.id,
                        name: customer.name,
                        dish: customer.dish,
                        reason: '超时等待'
                    });
                    this.badReasons.push({
                        type: 'timeout',
                        customer: customer.name,
                        dish: customer.dish,
                        time: this.gameTime
                    });
                } else if (customer.waitTime >= customer.maxWaitTime * 0.7 && customer.state === CustomerState.WAITING) {
                    customer.state = CustomerState.ANGRY;
                }
            }
        });
        
        this.customers = this.customers.filter(c => c.state !== CustomerState.LEFT);
        
        if (leavingCustomers.length > 0) {
            this.notify();
        }
        
        return leavingCustomers;
    }

    useIngredients(noodles = 0, toppings = 0) {
        if (this.ingredients.noodles < noodles || this.ingredients.toppings < toppings) {
            return false;
        }
        
        this.ingredients.noodles -= noodles;
        this.ingredients.toppings -= toppings;
        this.notify();
        return true;
    }

    restockIngredients(type) {
        const restockAmount = this.currentLevel.restockAmount || 5;
        
        if (type === 'noodles') {
            const space = this.maxIngredients.noodles - this.ingredients.noodles;
            if (space <= 0) {
                return false;
            }
            const amount = Math.min(restockAmount, space);
            this.ingredients.noodles += amount;
        } else if (type === 'toppings') {
            const space = this.maxIngredients.toppings - this.ingredients.toppings;
            if (space <= 0) {
                return false;
            }
            const amount = Math.min(restockAmount, space);
            this.ingredients.toppings += amount;
        }
        
        this.notify();
        return true;
    }

    getEmptyWok() {
        return this.woks.find(wok => wok.state === WokState.EMPTY);
    }

    startCooking(order, customerId) {
        const emptyWok = this.getEmptyWok();
        if (!emptyWok) {
            return { success: false, reason: '没有空闲炒锅' };
        }
        
        const dish = this.currentLevel.dishes.find(d => d.name === order);
        if (!dish) {
            return { success: false, reason: '菜品不存在' };
        }
        
        if (this.ingredients.noodles < dish.ingredients.noodles) {
            return { success: false, reason: '米粉不足' };
        }
        if (this.ingredients.toppings < dish.ingredients.toppings) {
            return { success: false, reason: '配菜不足' };
        }
        
        this.useIngredients(dish.ingredients.noodles, dish.ingredients.toppings);
        
        emptyWok.state = WokState.COOKING;
        emptyWok.order = {
            name: order,
            customerId: customerId,
            dish: dish
        };
        emptyWok.progress = 0;
        emptyWok.maxProgress = dish.cookTime;
        
        this.notify();
        return { success: true, wok: emptyWok };
    }

    updateCookingProgress(deltaTime) {
        const completedWoks = [];
        
        this.woks.forEach(wok => {
            if (wok.state === WokState.COOKING) {
                wok.progress += deltaTime;
                
                if (wok.progress >= wok.maxProgress) {
                    wok.state = WokState.DONE;
                    wok.progress = wok.maxProgress;
                    completedWoks.push(wok);
                }
            }
        });
        
        if (completedWoks.length > 0) {
            this.notify();
        }
        
        return completedWoks;
    }

    getEmptyPackingStation() {
        return this.packingStations.find(station => station.state === PackingState.EMPTY);
    }

    moveToPacking(wokId) {
        const wok = this.woks.find(w => w.id === wokId);
        if (!wok || wok.state !== WokState.DONE) {
            return { success: false, reason: '炒锅状态不正确' };
        }
        
        const emptyStation = this.getEmptyPackingStation();
        if (!emptyStation) {
            return { success: false, reason: '没有空闲打包台' };
        }
        
        emptyStation.state = PackingState.WAITING;
        emptyStation.order = { ...wok.order };
        
        wok.state = WokState.EMPTY;
        wok.order = null;
        wok.progress = 0;
        wok.maxProgress = 0;
        
        this.notify();
        return { success: true, station: emptyStation };
    }

    serveOrder(stationId, customerId) {
        const station = this.packingStations.find(s => s.id === stationId);
        if (!station || station.state !== PackingState.WAITING) {
            return { success: false, reason: '打包台状态不正确' };
        }
        
        if (station.order.customerId !== customerId) {
            return { success: false, reason: '订单不匹配，会做错哦！' };
        }
        
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer || (customer.state !== CustomerState.WAITING && customer.state !== CustomerState.ANGRY)) {
            return { success: false, reason: '顾客已离开或不存在' };
        }
        
        const dish = station.order.dish;
        const isOnTime = customer.waitTime < customer.maxWaitTime * 0.7;
        const isAngry = customer.state === CustomerState.ANGRY;
        
        let baseScore = dish.score;
        let comboBonus = 0;
        let tipBonus = 0;
        
        if (isOnTime) {
            this.combo++;
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo;
            }
            comboBonus = Math.floor(baseScore * (this.combo - 1) * 0.1);
        } else {
            this.combo = 0;
        }
        
        if (!isAngry && isOnTime) {
            const patienceRatio = 1 - (customer.waitTime / customer.maxWaitTime);
            tipBonus = Math.floor(dish.tip * patienceRatio);
        }
        
        const totalScore = baseScore + comboBonus + tipBonus;
        this.score += totalScore;
        
        customer.state = CustomerState.SERVED;
        this.customers = this.customers.filter(c => c.id !== customerId);
        
        this.completedOrders.push({
            id: customer.id,
            name: customer.name,
            dish: dish.name,
            score: totalScore,
            baseScore: baseScore,
            comboBonus: comboBonus,
            tipBonus: tipBonus,
            wasOnTime: isOnTime,
            wasAngry: isAngry,
            waitTime: customer.waitTime
        });
        
        station.state = PackingState.EMPTY;
        station.order = null;
        
        this.notify();
        return { 
            success: true, 
            score: totalScore,
            baseScore: baseScore,
            comboBonus: comboBonus,
            tipBonus: tipBonus,
            combo: this.combo,
            isOnTime: isOnTime
        };
    }

    updateGameTime(deltaTime) {
        this.gameTime += deltaTime;
        if (this.gameTime > this.maxGameTime) {
            this.gameTime = this.maxGameTime;
        }
        this.notify();
        return this.gameTime >= this.maxGameTime;
    }

    discardWok(wokId) {
        const wok = this.woks.find(w => w.id === wokId);
        if (!wok || wok.state === WokState.EMPTY) {
            return { success: false, reason: '炒锅已为空' };
        }
        
        if (wok.order) {
            this.wastedIngredients.noodles += wok.order.dish.ingredients.noodles;
            this.wastedIngredients.toppings += wok.order.dish.ingredients.toppings;
        }
        
        wok.state = WokState.EMPTY;
        wok.order = null;
        wok.progress = 0;
        wok.maxProgress = 0;
        
        this.notify();
        return { success: true };
    }

    discardPacking(stationId) {
        const station = this.packingStations.find(s => s.id === stationId);
        if (!station || station.state === PackingState.EMPTY) {
            return { success: false, reason: '打包台已为空' };
        }
        
        if (station.order) {
            this.wastedIngredients.noodles += station.order.dish.ingredients.noodles;
            this.wastedIngredients.toppings += station.order.dish.ingredients.toppings;
        }
        
        station.state = PackingState.EMPTY;
        station.order = null;
        
        this.notify();
        return { success: true };
    }

    getGameSummary() {
        return {
            score: this.score,
            maxCombo: this.maxCombo,
            badReviews: this.badReviews,
            completedOrders: this.completedOrders.length,
            lostCustomers: this.lostCustomers.length,
            wastedNoodles: this.wastedIngredients.noodles,
            wastedToppings: this.wastedIngredients.toppings,
            badReasons: this.badReasons
        };
    }
}

export const gameState = new GameState();
