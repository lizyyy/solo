const CoffeeGameTests = {
    tests: [],
    passed: 0,
    failed: 0,
    
    assert: function(condition, message) {
        if (condition) {
            this.passed++;
            console.log(`✅ PASS: ${message}`);
        } else {
            this.failed++;
            console.error(`❌ FAIL: ${message}`);
        }
        return condition;
    },
    
    assertEqual: function(actual, expected, message) {
        const result = actual === expected;
        if (result) {
            this.passed++;
            console.log(`✅ PASS: ${message} (${actual})`);
        } else {
            this.failed++;
            console.error(`❌ FAIL: ${message} - Expected: ${expected}, Got: ${actual}`);
        }
        return result;
    },
    
    run: function() {
        console.log('🧪 开始运行咖啡店游戏测试...\n');
        
        this.testUtils();
        this.testGameEngine();
        this.testOrders();
        this.testEquipment();
        this.testStaff();
        this.testScoring();
        this.testStorage();
        
        console.log('\n📊 测试结果:');
        console.log(`   ✅ 通过: ${this.passed}`);
        console.log(`   ❌ 失败: ${this.failed}`);
        console.log(`   📋 总计: ${this.passed + this.failed}`);
        
        return this.failed === 0;
    },
    
    testUtils: function() {
        console.log('\n📦 测试工具函数...');
        
        this.assert(Utils.formatTime(65) === '01:05', '格式化时间 65秒');
        this.assert(Utils.formatTime(0) === '00:00', '格式化时间 0秒');
        this.assert(Utils.formatTime(120) === '02:00', '格式化时间 120秒');
        
        this.assertEqual(Utils.clamp(5, 0, 10), 5, 'clamp 在范围内');
        this.assertEqual(Utils.clamp(-1, 0, 10), 0, 'clamp 低于最小值');
        this.assertEqual(Utils.clamp(15, 0, 10), 10, 'clamp 高于最大值');
        
        this.assertEqual(Utils.getPatienceColorClass(80), 'high', '高耐心颜色');
        this.assertEqual(Utils.getPatienceColorClass(50), 'medium', '中耐心颜色');
        this.assertEqual(Utils.getPatienceColorClass(20), 'low', '低耐心颜色');
        
        const grade = Utils.calculateGrade(850, 1000);
        this.assertEqual(grade.letter, 'S', '85% 得S级');
        
        const gradeA = Utils.calculateGrade(700, 1000);
        this.assertEqual(gradeA.letter, 'A', '70% 得A级');
        
        console.log('   工具函数测试完成');
    },
    
    testGameEngine: function() {
        console.log('\n🎮 测试游戏引擎...');
        
        const game = new GameEngine();
        
        this.assert(game.gameState.currentTime === 0, '初始时间为0');
        this.assert(game.gameState.running === false, '初始未运行');
        this.assert(game.gameState.paused === false, '初始未暂停');
        
        game.initLevel(0);
        
        this.assert(game.gameState.level.id === 0, '关卡ID正确');
        this.assert(game.equipment.coffeeMachines.length > 0, '咖啡机已初始化');
        this.assert(game.equipment.grinders.length > 0, '磨豆机已初始化');
        this.assert(game.staff.length > 0, '店员已初始化');
        this.assert(Object.keys(game.stock).length > 0, '库存已初始化');
        
        this.assert(game.stock.coffee_beans > 0, '咖啡豆库存大于0');
        this.assert(game.stock.water > 0, '水库存大于0');
        
        game.setSpeed(2);
        this.assertEqual(game.gameState.speed, 2, '设置2倍速');
        
        game.setSpeed(3);
        this.assertEqual(game.gameState.speed, 3, '设置3倍速');
        
        console.log('   游戏引擎测试完成');
    },
    
    testOrders: function() {
        console.log('\n📋 测试订单系统...');
        
        const game = new GameEngine();
        game.initLevel(0);
        
        this.assertEqual(game.orders.queue.length, 0, '初始队列为空');
        this.assertEqual(game.orders.nextOrderId, 1, '下一个订单ID为1');
        
        game.gameState.currentTime = 0;
        const order = game._createOrder();
        
        this.assert(order !== null, '订单创建成功');
        this.assert(order.id.startsWith('order_'), '订单ID格式正确');
        this.assert(order.drinkName !== undefined, '有饮品名称');
        this.assert(order.status === 'queued', '初始状态为排队中');
        this.assert(order.patience > 0, '有耐心值');
        this.assert(order.deadline > 0, '有截止时间');
        
        this.assert(order.drink.steps.length > 0, '有制作步骤');
        this.assert(Object.keys(order.drink.ingredients).length > 0, '有原料需求');
        
        const drink = order.drink;
        for (const [ingredient, amount] of Object.entries(drink.ingredients)) {
            this.assert(amount > 0, `原料 ${ingredient} 数量大于0`);
        }
        
        console.log('   订单系统测试完成');
    },
    
    testEquipment: function() {
        console.log('\n🔧 测试设备系统...');
        
        const game = new GameEngine();
        game.initLevel(0);
        
        const cm = game.equipment.coffeeMachines[0];
        
        this.assert(cm !== undefined, '咖啡机存在');
        this.assertEqual(cm.status, 'idle', '初始状态为空闲');
        this.assertEqual(cm.temperature, 0, '初始温度为0');
        this.assert(cm.currentOrderId === null, '无当前订单');
        
        cm.temperature = 50;
        this.assert(cm.temperature === 50, '温度设置正确');
        
        const config = CONFIG.EQUIPMENT.COFFEE_MACHINE;
        this.assert(config.HEAT_PER_USE > 0, '配置有每次使用的加热值');
        this.assert(config.COOL_RATE > 0, '配置有冷却速率');
        this.assert(config.OVERHEAT_THRESHOLD > 0, '配置有过热阈值');
        
        const grinder = game.equipment.grinders[0];
        this.assert(grinder !== undefined, '磨豆机存在');
        
        const freezer = game.equipment.freezers[0];
        this.assert(freezer !== undefined, '冰柜存在');
        
        console.log('   设备系统测试完成');
    },
    
    testStaff: function() {
        console.log('\n👨‍🍳 测试店员系统...');
        
        const game = new GameEngine();
        game.initLevel(0);
        
        const staff = game.staff[0];
        
        this.assert(staff !== undefined, '店员存在');
        this.assert(staff.name !== undefined, '店员有名字');
        this.assertEqual(staff.status, 'idle', '初始状态为空闲');
        this.assert(staff.currentOrderId === null, '无当前订单');
        this.assertEqual(staff.currentStepIndex, -1, '步骤索引为-1');
        
        this.assert(STAFF_NAMES.includes(staff.name), '店员名字在预设列表中');
        
        this.assert(game.staff.length >= 2, '至少有2个店员');
        
        console.log('   店员系统测试完成');
    },
    
    testScoring: function() {
        console.log('\n💰 测试评分系统...');
        
        const game = new GameEngine();
        game.initLevel(0);
        
        this.assertEqual(game.scoring.totalScore, 0, '初始分数为0');
        this.assertEqual(game.scoring.combo, 0, '初始连击为0');
        this.assertEqual(game.scoring.maxCombo, 0, '初始最高连击为0');
        this.assertEqual(game.scoring.completedCount, 0, '初始完成数为0');
        this.assertEqual(game.scoring.overdueCount, 0, '初始超时数为0');
        this.assertEqual(game.scoring.missedCount, 0, '初始漏单数为0');
        
        const scoringConfig = CONFIG.SCORING;
        this.assert(scoringConfig.COMPLETE_ON_TIME > 0, '按时完成有加分');
        this.assert(scoringConfig.OVERDUE_PENALTY < 0, '超时完成有扣分');
        this.assert(scoringConfig.MISSED_PENALTY < 0, '漏单有扣分');
        this.assert(scoringConfig.URGENT_TIP > 0, '加急单有小费');
        
        console.log('   评分系统测试完成');
    },
    
    testStorage: function() {
        console.log('\n💾 测试存储系统...');
        
        const originalScores = Storage.getHighScores();
        
        Storage.set('test_key', { value: 'test_value' });
        const loaded = Storage.get('test_key');
        this.assertEqual(loaded.value, 'test_value', '存储和读取正确');
        
        Storage.remove('test_key');
        const afterRemove = Storage.get('test_key', null);
        this.assertEqual(afterRemove, null, '删除后读取为null');
        
        Storage.addHighScore(1000, 0, '新手练习');
        const scores = Storage.getHighScores();
        this.assert(scores.length > 0, '高分记录已添加');
        
        const bestScore = Storage.getBestScore();
        this.assert(bestScore >= 1000, '最高分正确');
        
        const state = {
            gameState: { currentTime: 100, totalTime: 480 },
            test: 'data'
        };
        
        Storage.saveGame(state);
        const loadedState = Storage.loadGame();
        
        this.assert(loadedState !== null, '游戏状态已保存');
        
        Storage.clearSavedGame();
        const afterClear = Storage.loadGame();
        this.assertEqual(afterClear, null, '清除后无保存状态');
        
        console.log('   存储系统测试完成');
    },
    
    testDrinkConfigs: function() {
        console.log('\n🍵 测试饮品配置...');
        
        const drinkCount = Object.keys(DRINKS).length;
        this.assert(drinkCount >= 10, '至少有10种饮品');
        
        const drinkIds = ['ESPRESSO', 'AMERICANO', 'LATTE', 'CAPPUCCINO', 'MOCHA'];
        drinkIds.forEach(id => {
            this.assert(DRINKS[id] !== undefined, `饮品 ${id} 存在`);
        });
        
        Object.entries(DRINKS).forEach(([id, drink]) => {
            this.assert(drink.name !== undefined, `饮品 ${id} 有名称`);
            this.assert(drink.steps.length > 0, `饮品 ${id} 有制作步骤`);
            this.assert(Object.keys(drink.ingredients).length > 0, `饮品 ${id} 有原料`);
            this.assert(drink.baseTime > 0, `饮品 ${id} 有基础时间`);
            
            drink.steps.forEach((step, index) => {
                this.assert(STEP_NAMES[step.type] !== undefined || step.type, 
                    `饮品 ${id} 步骤 ${index} 类型存在`);
                this.assert(step.duration > 0, 
                    `饮品 ${id} 步骤 ${index} 时长大于0`);
            });
        });
        
        this.assert(Object.keys(STEP_NAMES).length > 0, '有步骤名称映射');
        
        console.log('   饮品配置测试完成');
    },
    
    testLevelConfigs: function() {
        console.log('\n🏆 测试关卡配置...');
        
        this.assertEqual(LEVELS.length, 3, '有3个关卡');
        
        const difficulties = ['easy', 'medium', 'hard'];
        LEVELS.forEach((level, index) => {
            this.assertEqual(level.id, index, `关卡 ${index} ID正确`);
            this.assert(level.name !== undefined, `关卡 ${index} 有名称`);
            this.assert(difficulties.includes(level.difficulty), 
                `关卡 ${index} 难度正确`);
            this.assert(level.config !== undefined, `关卡 ${index} 有配置`);
            
            const config = level.config;
            this.assert(config.coffeeMachines > 0, `关卡 ${index} 有咖啡机`);
            this.assert(config.grinders > 0, `关卡 ${index} 有磨豆机`);
            this.assert(config.freezers > 0, `关卡 ${index} 有冰柜`);
            this.assert(config.staff > 0, `关卡 ${index} 有店员`);
            this.assert(config.orderFrequency > 0, `关卡 ${index} 有订单频率`);
            this.assert(config.drinkPool.length > 0, `关卡 ${index} 有饮品池`);
            
            config.drinkPool.forEach(drinkId => {
                this.assert(DRINKS[drinkId] !== undefined, 
                    `关卡 ${index} 饮品池中的 ${drinkId} 存在`);
            });
        });
        
        const easyLevel = LEVELS[0].config;
        const hardLevel = LEVELS[2].config;
        
        this.assert(hardLevel.orderFrequency >= easyLevel.orderFrequency, 
            '困难关卡订单频率更高');
        this.assert(hardLevel.urgentRatio >= easyLevel.urgentRatio, 
            '困难关卡加急单比例更高');
        this.assert(hardLevel.breakdownChance >= easyLevel.breakdownChance, 
            '困难关卡故障概率更高');
        
        console.log('   关卡配置测试完成');
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoffeeGameTests;
}

if (typeof window !== 'undefined') {
    window.CoffeeGameTests = CoffeeGameTests;
}

if (typeof require !== 'undefined' && require.main === module) {
    console.log('🧪 在 Node.js 环境中运行测试...\n');
    
    const vm = require('vm');
    const fs = require('fs');
    const path = require('path');
    
    const configPath = path.join(__dirname, 'config.js');
    const utilsPath = path.join(__dirname, 'utils.js');
    const enginePath = path.join(__dirname, 'game-engine.js');
    
    let configContent = '';
    let utilsContent = '';
    let engineContent = '';
    
    try {
        configContent = fs.readFileSync(configPath, 'utf8');
        utilsContent = fs.readFileSync(utilsPath, 'utf8');
        engineContent = fs.readFileSync(enginePath, 'utf8');
    } catch (e) {
        console.error('❌ 无法读取文件，请确保在正确的目录中运行');
        console.error('   错误:', e.message);
        process.exit(1);
    }
    
    const context = {
        console: console,
        module: module,
        require: require,
        process: process,
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval,
        localStorage: {
            data: {},
            setItem: function(key, value) { this.data[key] = value; },
            getItem: function(key) { return this.data[key] || null; },
            removeItem: function(key) { delete this.data[key]; },
            clear: function() { this.data = {}; }
        }
    };
    
    try {
        vm.runInNewContext(configContent, context, { filename: 'config.js' });
        vm.runInNewContext(utilsContent, context, { filename: 'utils.js' });
        vm.runInNewContext(engineContent, context, { filename: 'game-engine.js' });
        
        const CONFIG = context.CONFIG;
        const DRINKS = context.DRINKS;
        const STEP_NAMES = context.STEP_NAMES;
        const LEVELS = context.LEVELS;
        const INGREDIENT_NAMES = context.INGREDIENT_NAMES;
        const STAFF_NAMES = context.STAFF_NAMES;
        const Utils = context.Utils;
        const Storage = context.Storage;
        const EventBus = context.EventBus;
        const EVENTS = context.EVENTS;
        const GameEngine = context.GameEngine;
        
        globalThis.CONFIG = CONFIG;
        globalThis.DRINKS = DRINKS;
        globalThis.STEP_NAMES = STEP_NAMES;
        globalThis.LEVELS = LEVELS;
        globalThis.INGREDIENT_NAMES = INGREDIENT_NAMES;
        globalThis.STAFF_NAMES = STAFF_NAMES;
        globalThis.Utils = Utils;
        globalThis.Storage = Storage;
        globalThis.EventBus = EventBus;
        globalThis.EVENTS = EVENTS;
        globalThis.GameEngine = GameEngine;
        
        CoffeeGameTests.testUtils();
        CoffeeGameTests.testGameEngine();
        CoffeeGameTests.testOrders();
        CoffeeGameTests.testEquipment();
        CoffeeGameTests.testStaff();
        CoffeeGameTests.testScoring();
        CoffeeGameTests.testStorage();
        CoffeeGameTests.testDrinkConfigs();
        CoffeeGameTests.testLevelConfigs();
        
        console.log('\n📊 测试结果:');
        console.log(`   ✅ 通过: ${CoffeeGameTests.passed}`);
        console.log(`   ❌ 失败: ${CoffeeGameTests.failed}`);
        console.log(`   📋 总计: ${CoffeeGameTests.passed + CoffeeGameTests.failed}`);
        
        if (CoffeeGameTests.failed > 0) {
            process.exit(1);
        } else {
            console.log('\n🎉 所有测试通过！');
            process.exit(0);
        }
        
    } catch (e) {
        console.error('❌ 测试执行错误:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}
