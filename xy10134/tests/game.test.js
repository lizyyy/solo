import { GameEngine, GameConfiguration } from '../src/gameEngine.js';
import { GameState, FailureReason, Buffer, Workstation } from '../src/game.js';

const assert = {
    equal: (actual, expected, message) => {
        if (actual !== expected) {
            throw new Error(`Assertion failed: ${message}\nExpected: ${expected}, Actual: ${actual}`);
        }
        console.log(`✓ ${message}`);
    },
    notEqual: (actual, expected, message) => {
        if (actual === expected) {
            throw new Error(`Assertion failed: ${message}\nExpected not: ${expected}, Actual: ${actual}`);
        }
        console.log(`✓ ${message}`);
    },
    true: (value, message) => {
        if (!value) {
            throw new Error(`Assertion failed: ${message}\nExpected true, Actual: ${value}`);
        }
        console.log(`✓ ${message}`);
    },
    false: (value, message) => {
        if (value) {
            throw new Error(`Assertion failed: ${message}\nExpected false, Actual: ${value}`);
        }
        console.log(`✓ ${message}`);
    }
};

console.log('========================================');
console.log('开始运行游戏测试');
console.log('========================================\n');

try {
    console.log('--- Buffer 类测试 ---\n');
    
    const buffer = new Buffer(8, 4);
    assert.equal(buffer.capacity, 8, '缓冲区容量应为 8');
    assert.equal(buffer.items, 4, '初始物品数应为 4');
    assert.false(buffer.isEmpty(), '缓冲区不应为空');
    assert.false(buffer.isFull(), '缓冲区不应为满');
    assert.equal(buffer.getFillRatio(), 0.5, '填充率应为 0.5');
    
    assert.true(buffer.addItem(), '添加物品应成功');
    assert.equal(buffer.items, 5, '物品数应为 5');
    
    assert.true(buffer.removeItem(), '移除物品应成功');
    assert.equal(buffer.items, 4, '物品数应为 4');
    
    for (let i = 0; i < 5; i++) {
        buffer.addItem();
    }
    assert.true(buffer.isFull(), '缓冲区应为满');
    assert.false(buffer.addItem(), '满缓冲区添加应失败');
    
    for (let i = 0; i < 8; i++) {
        buffer.removeItem();
    }
    assert.true(buffer.isEmpty(), '缓冲区应为空');
    assert.false(buffer.removeItem(), '空缓冲区移除应失败');
    
    console.log('\n--- Workstation 类测试 ---\n');
    
    const ws = new Workstation('ws1', '测试工位', 5, 2, 8);
    assert.equal(ws.cycleTime, 5, '初始节拍应为 5');
    assert.equal(ws.minCycleTime, 2, '最小节拍应为 2');
    assert.equal(ws.maxCycleTime, 8, '最大节拍应为 8');
    assert.false(ws.isWorking, '初始状态不应工作');
    
    ws.decreaseCycleTime();
    assert.equal(ws.cycleTime, 4, '减少节拍后应为 4');
    
    ws.increaseCycleTime();
    assert.equal(ws.cycleTime, 5, '增加节拍后应为 5');
    
    for (let i = 0; i < 10; i++) {
        ws.decreaseCycleTime();
    }
    assert.equal(ws.cycleTime, 2, '不能低于最小节拍');
    assert.false(ws.canDecreaseCycleTime(), '不能继续减少节拍');
    
    for (let i = 0; i < 10; i++) {
        ws.increaseCycleTime();
    }
    assert.equal(ws.cycleTime, 8, '不能高于最大节拍');
    assert.false(ws.canIncreaseCycleTime(), '不能继续增加节拍');
    
    ws.setCycleTime(4);
    ws.startWorking();
    assert.true(ws.isWorking, '开始工作后状态应为工作中');
    assert.equal(ws.progress, 0, '进度初始应为 0');
    
    assert.false(ws.tick(1), '1秒后不应完成');
    assert.equal(ws.progress, 1, '进度应为 1');
    
    assert.true(ws.tick(3.5), '再 3.5 秒后应完成');
    
    console.log('\n--- GameEngine 基础状态测试 ---\n');
    
    let engine = new GameEngine();
    let state = engine.getState();
    
    assert.equal(state.gameState, GameState.IDLE, '初始状态应为 IDLE');
    assert.equal(state.score, 1000, '初始分数应为 1000');
    assert.equal(state.productsCompleted, 0, '初始完成产品应为 0');
    assert.equal(state.buffers.length, 3, '应有 3 个缓冲区');
    assert.equal(state.workstations.length, 4, '应有 4 个工位');
    
    engine.start();
    state = engine.getState();
    assert.equal(state.gameState, GameState.RUNNING, '开始后状态应为 RUNNING');
    
    console.log('\n--- 节拍调整测试 ---\n');
    
    engine = new GameEngine();
    engine.start();
    
    let ws1State = engine.getState().workstations[0];
    assert.equal(ws1State.cycleTime, 4, '工位 A 初始节拍应为 4');
    
    assert.true(engine.adjustWorkstationCycleTime('ws1', -1), '减少节拍应成功');
    ws1State = engine.getState().workstations[0];
    assert.equal(ws1State.cycleTime, 3, '减少后节拍应为 3');
    
    assert.true(engine.adjustWorkstationCycleTime('ws1', 1), '增加节拍应成功');
    ws1State = engine.getState().workstations[0];
    assert.equal(ws1State.cycleTime, 4, '增加后节拍应为 4');
    
    engine.pause();
    assert.false(engine.adjustWorkstationCycleTime('ws1', -1), '暂停时不能调整节拍');
    
    engine.resume();
    assert.false(engine.adjustWorkstationCycleTime('invalid_ws', -1), '无效工位 ID 调整应失败');
    
    console.log('\n--- 暂停/继续测试 ---\n');
    
    engine = new GameEngine();
    engine.start();
    
    let stateBefore = engine.getState();
    let scoreBefore = stateBefore.score;
    let timeBefore = stateBefore.timeLeft;
    
    engine.pause();
    state = engine.getState();
    assert.equal(state.gameState, GameState.PAUSED, '暂停后状态应为 PAUSED');
    
    engine.tick(5);
    state = engine.getState();
    assert.equal(state.timeLeft, timeBefore, '暂停时时间不应流逝');
    assert.equal(state.score, scoreBefore, '暂停时分数不应变化');
    
    engine.resume();
    state = engine.getState();
    assert.equal(state.gameState, GameState.RUNNING, '继续后状态应为 RUNNING');
    
    console.log('\n--- 重复点击测试（幂等性）---\n');
    
    engine = new GameEngine();
    engine.start();
    let initialState = engine.getState();
    
    engine.start();
    engine.start();
    engine.start();
    state = engine.getState();
    assert.equal(state.gameState, GameState.RUNNING, '重复点击开始应保持运行');
    
    engine.pause();
    engine.pause();
    engine.pause();
    state = engine.getState();
    assert.equal(state.gameState, GameState.PAUSED, '重复点击暂停应保持暂停');
    
    engine.resume();
    engine.resume();
    engine.resume();
    state = engine.getState();
    assert.equal(state.gameState, GameState.RUNNING, '重复点击继续应保持运行');
    
    console.log('\n--- 重新开始测试 ---\n');
    
    engine = new GameEngine();
    engine.start();
    engine.tick(10);
    let stateAfter = engine.getState();
    assert.notEqual(stateAfter.timeLeft, 120, '游戏进行后时间应减少');
    
    engine.restart();
    state = engine.getState();
    assert.equal(state.gameState, GameState.RUNNING, '重开后状态应为 RUNNING');
    assert.equal(state.score, 1000, '重开后分数应重置');
    assert.equal(state.timeLeft, 120, '重开后时间应重置');
    assert.equal(state.productsCompleted, 0, '重开后产品数应重置');
    
    console.log('\n--- 时间耗尽测试 ---\n');
    
    const fastConfig = new GameConfiguration();
    fastConfig.totalTime = 5;
    engine = new GameEngine(fastConfig);
    engine.start();
    
    engine.tick(6);
    state = engine.getState();
    assert.equal(state.gameState, GameState.FAILED, '时间耗尽应失败');
    assert.equal(state.failureReason, FailureReason.TIME_EXHAUSTED, '失败原因应为时间耗尽');
    
    console.log('\n--- 扣分和分数过低失败测试 ---\n');
    
    const penaltyConfig = new GameConfiguration();
    penaltyConfig.startingScore = 50;
    penaltyConfig.minScore = 0;
    penaltyConfig.fullBufferPenalty = 100;
    penaltyConfig.penaltyInterval = 0.5;
    engine = new GameEngine(penaltyConfig);
    engine.start();
    
    engine.tick(2);
    state = engine.getState();
    assert.notEqual(state.gameState, GameState.FAILED, '扣分前不应失败');
    
    let historyCount = engine.getHistoryCount();
    assert.true(historyCount > 0, '应有历史记录');
    
    console.log('\n--- 失败回放测试 ---\n');
    
    assert.true(engine.startReplay(), '启动回放射应成功');
    
    let replayState = engine.getReplayState(0);
    assert.true(replayState !== null, '回放状态不应为 null');
    assert.true(replayState.isReplayMode, '回放模式标志应为 true');
    
    let lastReplayState = engine.getReplayState(historyCount - 1);
    assert.true(lastReplayState !== null, '最后一帧回放状态不应为 null');
    
    assert.true(engine.getReplayState(-1) === null, '负数索引回放应返回 null');
    assert.true(engine.getReplayState(historyCount) === null, '越界索引回放应返回 null');
    
    engine.stopReplay();
    assert.false(engine.getState().isReplayMode, '停止回放后模式标志应为 false');
    
    console.log('\n--- 缓冲区空满测试 ---\n');
    
    engine = new GameEngine();
    engine.start();
    
    const b1Buffer = engine.getState().buffers.find(b => b.id === 'b1');
    assert.equal(b1Buffer.items, 4, '缓冲区 b1 初始应为 4 个物品');
    
    console.log('\n========================================');
    console.log('所有测试通过！🎉');
    console.log('========================================');
    
} catch (error) {
    console.log('\n========================================');
    console.log('❌ 测试失败！');
    console.log(error.message);
    console.log('========================================');
    process.exit(1);
}
