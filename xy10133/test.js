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

runTest('正确选择后应锁定回合，500ms窗口内无法点击其他药品', function() {
    const game = new PharmacyGame();
    game.start();
    const state = game.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    const wrongMedicine = state.cabinetMedicines.find(m => !m.isCorrect);
    
    game.selectMedicine(correctMedicine.id);
    
    const result = game.selectMedicine(wrongMedicine.id);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.message, '回合已锁定，正在切换中');
    
    game.destroy();
});

runTest('生命为1时选择错误后应立即游戏结束，历史记录不应有额外的 new_round', function() {
    const game = new PharmacyGame({ lives: 1 });
    game.start();
    const state = game.getState();
    const wrongMedicine = state.cabinetMedicines.find(m => !m.isCorrect);
    
    game.selectMedicine(wrongMedicine.id);
    
    assert.strictEqual(game.getGameState(), GameState.GAME_OVER);
    
    const history = game.getGameHistory();
    const lastEntry = history[history.length - 1];
    assert.strictEqual(lastEntry.type, 'gameover');
    
    const newRoundCount = history.filter(e => e.type === 'new_round').length;
    const gameOverCount = history.filter(e => e.type === 'gameover').length;
    
    assert.strictEqual(newRoundCount, 1, '游戏结束后不应有额外的 new_round');
    assert.strictEqual(gameOverCount, 1, '只能有一个 gameover 记录');
    
    game.destroy();
});

runTest('游戏结束后异步回调不应继续推进游戏', function(done) {
    const game = new PharmacyGame({ lives: 1 });
    game.start();
    
    const state = game.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    
    game.selectMedicine(correctMedicine.id);
    
    setTimeout(() => {
        const state2 = game.getState();
        const wrongMedicine = state2.cabinetMedicines.find(m => !m.isCorrect);
        game.selectMedicine(wrongMedicine.id);
        
        const history = game.getGameHistory();
        const lastEntry = history[history.length - 1];
        
        assert.strictEqual(lastEntry.type, 'gameover');
        
        const entriesAfterGameOver = history.filter((e, i) => {
            const gameOverIndex = history.findIndex(h => h.type === 'gameover');
            return i > gameOverIndex;
        });
        
        assert.strictEqual(entriesAfterGameOver.length, 0, 'gameover 之后不应有任何记录');
        
        game.destroy();
        done();
    }, 600);
});

runTest('重新开始应取消所有待执行的回合切换回调', function() {
    const game = new PharmacyGame();
    game.start();
    
    const state = game.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    
    game.selectMedicine(correctMedicine.id);
    
    game.restart();
    
    const newState = game.getState();
    assert.strictEqual(newState.score, 0);
    assert.strictEqual(newState.lives, 3);
    assert.strictEqual(game.getGameState(), GameState.PLAYING);
    
    game.destroy();
});

runTest('destroy() 应取消待执行的回合切换回调', function(done) {
    let cabinetChangeCount = 0;
    
    const game = new PharmacyGame({
        onCabinetChange: function() {
            cabinetChangeCount++;
        }
    });
    
    game.start();
    
    const countAfterStart = cabinetChangeCount;
    
    const state = game.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    
    game.selectMedicine(correctMedicine.id);
    
    game.destroy();
    
    setTimeout(() => {
        const countAfterWait = cabinetChangeCount;
        
        assert.strictEqual(countAfterStart, 1, 'start 应触发 1 次回调');
        assert.strictEqual(countAfterWait, 1, 'destroy 后等待 650ms 不应触发额外回调');
        
        game.destroy();
        done();
    }, 650);
});

runTest('销毁旧实例后启动新实例，旧实例的异步回调不应触发新实例的状态变化', function(done) {
    let oldGameCallbackCount = 0;
    let newGameCallbackCount = 0;
    
    const oldGame = new PharmacyGame({
        onCabinetChange: function() {
            oldGameCallbackCount++;
        }
    });
    
    oldGame.start();
    
    const state = oldGame.getState();
    const correctMedicine = state.cabinetMedicines.find(m => m.isCorrect);
    
    oldGame.selectMedicine(correctMedicine.id);
    
    const initialOldHistoryLength = oldGame.getGameHistory().length;
    
    oldGame.destroy();
    
    const newGame = new PharmacyGame({
        onCabinetChange: function() {
            newGameCallbackCount++;
        }
    });
    
    newGame.start();
    
    const initialNewHistoryLength = newGame.getGameHistory().length;
    
    setTimeout(() => {
        const finalOldHistoryLength = oldGame.getGameHistory().length;
        const finalNewHistoryLength = newGame.getGameHistory().length;
        
        assert.strictEqual(
            finalOldHistoryLength, 
            initialOldHistoryLength, 
            '旧实例 destroy 后历史记录不应增长'
        );
        
        assert.strictEqual(
            finalNewHistoryLength, 
            initialNewHistoryLength, 
            '新实例历史记录不应被旧实例影响'
        );
        
        oldGame.destroy();
        newGame.destroy();
        done();
    }, 700);
});

console.log('\n========================================');
console.log(`  测试结果: ${testResults.passed} 个通过, ${testResults.failed} 个失败`);
console.log('========================================\n');

process.exit(testResults.failed > 0 ? 1 : 0);
