const CONFIG = {
    GAME_DURATION: 480,
    TIME_STEP: 1,
    
    SCORING: {
        COMPLETE_ON_TIME: 100,
        COMPLETE_EARLY: 50,
        URGENT_TIP: 50,
        COMBO_BONUS: 25,
        OVERDUE_PENALTY: -50,
        MISSED_PENALTY: -100,
        OVERHEAT_PENALTY: -20,
        WASTE_PER_UNIT: -5
    },
    
    PATIENCE: {
        DECAY_RATE: 0.5,
        BASE_PATIENCE: 100,
        URGENT_PATIENCE: 80,
        ICED_PATIENCE: 120,
        LOW_THRESHOLD: 30,
        MEDIUM_THRESHOLD: 60
    },
    
    EQUIPMENT: {
        COFFEE_MACHINE: {
            HEAT_PER_USE: 20,
            COOL_RATE: 5,
            OVERHEAT_THRESHOLD: 80,
            MAX_TEMP: 100,
            REPAIR_TIME: 60
        },
        GRINDER: {
            HEAT_PER_USE: 15,
            COOL_RATE: 4,
            OVERHEAT_THRESHOLD: 75,
            MAX_TEMP: 100,
            REPAIR_TIME: 45
        },
        FREEZER: {
            HEAT_PER_USE: 0,
            COOL_RATE: 0,
            OVERHEAT_THRESHOLD: 100,
            MAX_TEMP: 100,
            REPAIR_TIME: 0
        }
    }
};

const DRINKS = {
    ESPRESSO: {
        id: 'ESPRESSO',
        name: '意式浓缩',
        isIced: false,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1
        },
        baseTime: 120
    },
    
    AMERICANO: {
        id: 'AMERICANO',
        name: '美式咖啡',
        isIced: false,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'ADD_WATER', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 2
        },
        baseTime: 150
    },
    
    LATTE: {
        id: 'LATTE',
        name: '拿铁',
        isIced: false,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'STEAM_MILK', duration: 8, equipment: 'coffee_machine' },
            { type: 'POUR', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1,
            milk: 2
        },
        baseTime: 180
    },
    
    CAPPUCCINO: {
        id: 'CAPPUCCINO',
        name: '卡布奇诺',
        isIced: false,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'STEAM_MILK', duration: 10, equipment: 'coffee_machine' },
            { type: 'FOAM', duration: 5, equipment: null },
            { type: 'POUR', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1,
            milk: 3
        },
        baseTime: 200
    },
    
    MOCHA: {
        id: 'MOCHA',
        name: '摩卡',
        isIced: false,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'ADD_CHOCOLATE', duration: 3, equipment: null },
            { type: 'STEAM_MILK', duration: 8, equipment: 'coffee_machine' },
            { type: 'POUR', duration: 3, equipment: null },
            { type: 'ADD_WHIPPED_CREAM', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1,
            milk: 2,
            chocolate: 1,
            whipped_cream: 1
        },
        baseTime: 240
    },
    
    ICED_LATTE: {
        id: 'ICED_LATTE',
        name: '冰拿铁',
        isIced: true,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'GET_ICE', duration: 5, equipment: 'freezer' },
            { type: 'POUR_MILK', duration: 3, equipment: null },
            { type: 'POUR', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1,
            milk: 2,
            ice: 2
        },
        baseTime: 200
    },
    
    ICED_AMERICANO: {
        id: 'ICED_AMERICANO',
        name: '冰美式',
        isIced: true,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'GET_ICE', duration: 5, equipment: 'freezer' },
            { type: 'ADD_WATER', duration: 3, equipment: null },
            { type: 'POUR', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 2,
            ice: 2
        },
        baseTime: 180
    },
    
    FLAT_WHITE: {
        id: 'FLAT_WHITE',
        name: '白咖啡',
        isIced: false,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 12, equipment: 'coffee_machine' },
            { type: 'STEAM_MILK', duration: 6, equipment: 'coffee_machine' },
            { type: 'POUR', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1,
            milk: 2
        },
        baseTime: 160
    },
    
    MACCHIATO: {
        id: 'MACCHIATO',
        name: '玛奇朵',
        isIced: false,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'ADD_MILK_FOAM', duration: 4, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1,
            milk: 1
        },
        baseTime: 140
    },
    
    AFFOGATO: {
        id: 'AFFOGATO',
        name: '阿芙佳朵',
        isIced: true,
        steps: [
            { type: 'GRIND', duration: 5, equipment: 'grinder' },
            { type: 'BREW', duration: 10, equipment: 'coffee_machine' },
            { type: 'GET_ICE_CREAM', duration: 5, equipment: 'freezer' },
            { type: 'POUR', duration: 3, equipment: null }
        ],
        ingredients: {
            coffee_beans: 1,
            water: 1,
            ice_cream: 1
        },
        baseTime: 220
    }
};

const STEP_NAMES = {
    GRIND: '磨豆',
    BREW: '萃取',
    ADD_WATER: '加水',
    STEAM_MILK: '打奶泡',
    POUR: '拉花/倒杯',
    FOAM: '打发奶泡',
    ADD_CHOCOLATE: '加巧克力酱',
    ADD_WHIPPED_CREAM: '加鲜奶油',
    GET_ICE: '取冰块',
    POUR_MILK: '倒牛奶',
    ADD_MILK_FOAM: '加奶泡',
    GET_ICE_CREAM: '取冰淇淋'
};

const LEVELS = [
    {
        id: 0,
        name: '新手练习',
        difficulty: 'easy',
        description: '适合新手的练习关卡',
        unlocked: true,
        config: {
            coffeeMachines: 2,
            grinders: 2,
            freezers: 1,
            staff: 2,
            initialStock: {
                coffee_beans: 50,
                water: 100,
                milk: 40,
                chocolate: 20,
                whipped_cream: 15,
                ice: 60,
                ice_cream: 10
            },
            orderFrequency: 0.02,
            urgentRatio: 0.1,
            icedRatio: 0.2,
            takeawayRatio: 0.3,
            maxOrders: 8,
            breakdownChance: 0.001,
            drinkPool: ['ESPRESSO', 'AMERICANO', 'LATTE', 'ICED_AMERICANO', 'ICED_LATTE']
        }
    },
    {
        id: 1,
        name: '繁忙早班',
        difficulty: 'medium',
        description: '真实的早高峰体验',
        unlocked: true,
        config: {
            coffeeMachines: 2,
            grinders: 2,
            freezers: 1,
            staff: 2,
            initialStock: {
                coffee_beans: 60,
                water: 120,
                milk: 50,
                chocolate: 25,
                whipped_cream: 20,
                ice: 80,
                ice_cream: 15
            },
            orderFrequency: 0.035,
            urgentRatio: 0.2,
            icedRatio: 0.3,
            takeawayRatio: 0.4,
            maxOrders: 12,
            breakdownChance: 0.003,
            drinkPool: ['ESPRESSO', 'AMERICANO', 'LATTE', 'CAPPUCCINO', 'MOCHA', 'ICED_AMERICANO', 'ICED_LATTE', 'FLAT_WHITE']
        }
    },
    {
        id: 2,
        name: '极限挑战',
        difficulty: 'hard',
        description: '设备有限，订单如潮',
        unlocked: true,
        config: {
            coffeeMachines: 1,
            grinders: 1,
            freezers: 1,
            staff: 2,
            initialStock: {
                coffee_beans: 40,
                water: 80,
                milk: 35,
                chocolate: 15,
                whipped_cream: 10,
                ice: 50,
                ice_cream: 8
            },
            orderFrequency: 0.05,
            urgentRatio: 0.35,
            icedRatio: 0.4,
            takeawayRatio: 0.5,
            maxOrders: 15,
            breakdownChance: 0.008,
            drinkPool: ['ESPRESSO', 'AMERICANO', 'LATTE', 'CAPPUCCINO', 'MOCHA', 'ICED_AMERICANO', 'ICED_LATTE', 'FLAT_WHITE', 'MACCHIATO', 'AFFOGATO']
        }
    }
];

const INGREDIENT_NAMES = {
    coffee_beans: '咖啡豆',
    water: '水',
    milk: '牛奶',
    chocolate: '巧克力酱',
    whipped_cream: '鲜奶油',
    ice: '冰块',
    ice_cream: '冰淇淋'
};

const STAFF_NAMES = ['小明', '小红', '小李', '小王', '小张', '小陈'];

const TAGS = {
    urgent: { name: '加急', color: 'var(--danger-color)' },
    iced: { name: '冰饮', color: 'var(--info-color)' },
    takeaway: { name: '外带', color: 'var(--warning-color)' }
};
