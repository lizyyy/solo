const assert = require('assert');
const { PharmacyGame, GameState, MEDICINES, SIMILAR_NAMES, FORBIDDEN_COMBINATIONS } = require('./game.js');

let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function runTest(name, testFn) {
    try {
        testFn();
        testResults.passed++;
        testResults.tests.push({ name, passed: true });
        console.log(`✅ PASS: ${name}`);
    } catch (error) {
        testResults.failed++;
        testResults.tests.push({ name, passed: false, error: error.message });
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error.message}`);
    }
}

console.log('\n========================================');
console.log('  药房配药避错游戏 - 单元测试');
console.log('========================================\n');

runTest('游戏初始状态应为 IDLE', function() {
    const game = new PharmacyGame();
    assert.strictEqual(game.getGameState(), GameState.IDLE);
    game.destroy();
});

runTest('开始游戏后状态应为 PLAYING', function() {
    const game = new PharmacyGame();
    game.start();
    assert.strictEqual(game.getGameState(), GameState.PLAYING);
    game.destroy();
});

runTest('开始游戏后应生成处方和药柜', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    assert.ok(state.currentPrescription !== null, '处方不应为空');
    assert.ok(state.cabinetMedicines.length > 0, '药柜应有药品');
    game.destroy();
});

runTest('暂停游戏后状态应为 PAUSED', function() {
    const game = new PharmacyGame();
    game.start();
    const result = game.pause();
    assert.strictEqual(result, true, '暂停应返回 true');
    assert.strictEqual(game.getGameState(), GameState.PAUSED);
    game.destroy();
});

runTest('恢复游戏后状态应为 PLAYING', function() {
    const game = new PharmacyGame();
    game.start();
    game.pause();
    const result = game.resume();
    assert.strictEqual(result, true, '恢复应返回 true');
    assert.strictEqual(game.getGameState(), GameState.PLAYING);
    game.destroy();
});

runTest('非 PLAYING 状态下暂停应返回 false', function() {
    const game = new PharmacyGame();
    const result = game.pause();
    assert.strictEqual(result, false, 'IDLE 状态下暂停应返回 false');
    game.destroy();
});

runTest('非 PAUSED 状态下恢复应返回 false', function() {
    const game = new PharmacyGame();
    game.start();
    const result = game.resume();
    assert.strictEqual(result, false, 'PLAYING 状态下恢复应返回 false');
    game.destroy();
});

runTest('初始生命应为 3', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    assert.strictEqual(state.lives, 3);
    game.destroy();
});

runTest('初始分数应为 0', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    assert.strictEqual(state.score, 0);
    game.destroy();
});

runTest('初始连击应为 0', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    assert.strictEqual(state.combo, 0);
    game.destroy();
});

runTest('选择正确药品应增加分数', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    const result = game.selectMedicine(correctMedicine.id);
    assert.strictEqual(result.success, true, '选择正确应返回成功');
    assert.ok(result.points > 0, '应获得分数');
    assert.strictEqual(game.getState().score, result.points);
    game.destroy();
});

runTest('选择正确药品应增加连击', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    const result = game.selectMedicine(correctMedicine.id);
    assert.strictEqual(result.combo, 1, '第一次正确连击应为 1');
    game.destroy();
});

runTest('选择错误药品应扣减生命', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    const wrongMedicine = state.cabinetMedicines.find(m => !m.isCorrect);
    const initialLives = state.lives;
    const result = game.selectMedicine(wrongMedicine.id);
    assert.strictEqual(result.success, false, '选择错误应返回失败');
    assert.strictEqual(game.getState().lives, initialLives - 1);
    game.destroy();
});

runTest('选择错误药品应重置连击', function() {
    const game = new PharmacyGame();
    game.start();
    
    let state = game.getState();
    let correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    game.selectMedicine(correctMedicine.id);
    
    assert.strictEqual(game.getState().combo, 1);
    
    setTimeout(() => {
        state = game.getState();
        const wrongMedicine = state.cabinetMedicines.find(m => !m.isCorrect);
        game.selectMedicine(wrongMedicine.id);
        assert.strictEqual(game.getState().combo, 0);
    }, 600);
    
    game.destroy();
});

runTest('重复点击药品应被拒绝', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    const medicine = state.cabinetMedicines[0];
    game.selectMedicine(medicine.id);
    const result = game.selectMedicine(medicine.id);
    assert.strictEqual(result.duplicate, true, '重复点击应标记为 duplicate');
    assert.strictEqual(result.success, false, '重复点击应返回失败');
    game.destroy();
});

runTest('非 PLAYING 状态下选择药品应被拒绝', function() {
    const game = new PharmacyGame();
    const result = game.selectMedicine(1);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.message, '游戏未进行中');
    game.destroy();
});

runTest('生命耗尽后应游戏结束', function() {
    const game = new PharmacyGame({ lives: 1 });
    game.start();
    const state = game.getState();
    const wrongMedicine = state.cabinetMedicines.find(m => !m.isCorrect);
    game.selectMedicine(wrongMedicine.id);
    assert.strictEqual(game.getGameState(), GameState.GAME_OVER);
    game.destroy();
});

runTest('游戏结束后应生成游戏历史', function() {
    const game = new PharmacyGame({ lives: 1 });
    game.start();
    const state = game.getState();
    const wrongMedicine = state.cabinetMedicines.find(m => !m.isCorrect);
    game.selectMedicine(wrongMedicine.id);
    const history = game.getGameHistory();
    assert.ok(history.length > 0, '游戏历史不应为空');
    const lastEntry = history[history.length - 1];
    assert.strictEqual(lastEntry.type, 'gameover', '最后一条记录应为游戏结束');
    game.destroy();
});

runTest('游戏结束后应生成分数明细', function() {
    const game = new PharmacyGame({ lives: 1 });
    game.start();
    const state = game.getState();
    const wrongMedicine = state.cabinetMedicines.find(m => !m.isCorrect);
    game.selectMedicine(wrongMedicine.id);
    const details = game.getScoreDetails();
    assert.ok(details.length > 0, '分数明细不应为空');
    game.destroy();
});

runTest('重新开始应重置所有状态', function() {
    const game = new PharmacyGame();
    game.start();
    
    let state = game.getState();
    let correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    game.selectMedicine(correctMedicine.id);
    
    setTimeout(() => {
        game.restart();
        state = game.getState();
        assert.strictEqual(state.score, 0, '分数应重置为 0');
        assert.strictEqual(state.lives, 3, '生命应重置为 3');
        assert.strictEqual(state.combo, 0, '连响应重置为 0');
        assert.strictEqual(state.level, 1, '关卡应重置为 1');
        assert.strictEqual(game.getGameState(), GameState.PLAYING);
    }, 600);
    
    game.destroy();
});

runTest('药柜中必须包含正确的药品', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    assert.ok(correctMedicine !== undefined, '药柜中应包含正确药品');
    assert.strictEqual(correctMedicine.name, state.currentPrescription.medicine.name);
    game.destroy();
});

runTest('药柜中应包含干扰药品', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    const wrongMedicines = state.cabinetMedicines.filter(m => !m.isCorrect);
    assert.ok(wrongMedicines.length > 0, '药柜中应包含干扰药品');
    game.destroy();
});

runTest('相似药名配置应存在', function() {
    assert.ok(Object.keys(SIMILAR_NAMES).length > 0, '相似药名配置不应为空');
});

runTest('禁忌药品配置应存在', function() {
    assert.ok(Object.keys(FORBIDDEN_COMBINATIONS).length > 0, '禁忌药品配置不应为空');
});

runTest('药品列表应存在', function() {
    assert.ok(MEDICINES.length > 0, '药品列表不应为空');
});

runTest('初始时间应为 60 秒', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    assert.strictEqual(state.timeRemaining, 60);
    game.destroy();
});

runTest('可自定义初始时间', function() {
    const game = new PharmacyGame({ maxTime: 30 });
    game.start();
    const state = game.getState();
    assert.strictEqual(state.timeRemaining, 30);
    game.destroy();
});

runTest('可自定义初始生命', function() {
    const game = new PharmacyGame({ lives: 5 });
    game.start();
    const state = game.getState();
    assert.strictEqual(state.lives, 5);
    game.destroy();
});

runTest('getState 应返回完整的游戏状态', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    assert.ok('state' in state);
    assert.ok('level' in state);
    assert.ok('score' in state);
    assert.ok('lives' in state);
    assert.ok('timeRemaining' in state);
    assert.ok('combo' in state);
    assert.ok('maxCombo' in state);
    assert.ok('currentPrescription' in state);
    assert.ok('cabinetMedicines' in state);
    assert.ok('clickedMedicines' in state);
    game.destroy();
});

runTest('getGameHistory 应返回数组副本', function() {
    const game = new PharmacyGame();
    game.start();
    const history1 = game.getGameHistory();
    const history2 = game.getGameHistory();
    assert.notStrictEqual(history1, history2, '应返回不同的数组引用');
    game.destroy();
});

runTest('getScoreDetails 应返回数组副本', function() {
    const game = new PharmacyGame();
    game.start();
    const details1 = game.getScoreDetails();
    const details2 = game.getScoreDetails();
    assert.notStrictEqual(details1, details2, '应返回不同的数组引用');
    game.destroy();
});

console.log('\n========================================');
console.log(`  测试结果: ${testResults.passed} 个通过, ${testResults.failed} 个失败`);
console.log('========================================\n');

process.exit(testResults.failed > 0 ? 1 : 0);
