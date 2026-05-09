const GameEngine = require('../src/js/game-engine.js');
const constants = require('../src/js/constants.js');

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || '断言失败');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `期望 ${expected}，实际 ${actual}`);
    }
  }

  async run() {
    console.log('\n========== 开始运行测试 ==========\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✅ 通过: ${name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ 失败: ${name}`);
        console.log(`   错误: ${error.message}`);
      }
    }

    console.log(`\n========== 测试结果 ==========`);
    console.log(`通过: ${this.passed}`);
    console.log(`失败: ${this.failed}`);
    console.log(`总计: ${this.tests.length}`);
    console.log('==============================\n');

    return this.failed === 0;
  }
}

const runner = new TestRunner();

runner.test('游戏初始化状态正确', () => {
  const engine = new GameEngine();
  engine.init();
  const state = engine.getState();
  
  runner.assertEqual(state.gameState, constants.GAME_STATE.IDLE, '初始状态应为IDLE');
  runner.assertEqual(state.score, 0, '初始分数应为0');
  runner.assertEqual(state.timeRemaining, constants.GAME_TIME, '时间应正确初始化');
  runner.assertEqual(state.robots.length, 3, '应有3个机器人');
  runner.assert(state.cargos.length > 0, '应有货物');
});

runner.test('开始游戏后状态变为PLAYING', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  const state = engine.getState();
  
  runner.assertEqual(state.gameState, constants.GAME_STATE.PLAYING, '状态应为PLAYING');
  engine.stopTimer();
});

runner.test('暂停和恢复游戏', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  
  engine.pause();
  runner.assertEqual(engine.getState().gameState, constants.GAME_STATE.PAUSED, '暂停后状态应为PAUSED');
  
  engine.resume();
  runner.assertEqual(engine.getState().gameState, constants.GAME_STATE.PLAYING, '恢复后状态应为PLAYING');
  engine.stopTimer();
});

runner.test('重新开始游戏重置状态', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  engine.selectRobot(1);
  engine.moveRobot('DOWN');
  
  engine.restart();
  const state = engine.getState();
  
  runner.assertEqual(state.gameState, constants.GAME_STATE.PLAYING, '重开后应为PLAYING');
  runner.assertEqual(state.score, 0, '分数应重置为0');
  runner.assert(state.selectedRobot === null, '选择应重置');
  engine.stopTimer();
});

runner.test('选择机器人', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  
  const result = engine.selectRobot(1);
  runner.assert(result, '选择机器人应返回true');
  runner.assertEqual(engine.getState().selectedRobot, 1, '应选择机器人1');
  
  engine.stopTimer();
});

runner.test('游戏未运行时无法选择机器人', () => {
  const engine = new GameEngine();
  engine.init();
  
  const result = engine.selectRobot(1);
  runner.assertEqual(result, false, '游戏未运行时无法选择');
});

runner.test('未选择机器人时无法移动', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  
  const result = engine.moveRobot('UP');
  runner.assertEqual(result.success, false, '未选择机器人时移动应失败');
  runner.assertEqual(result.reason, '请先选择机器人', '错误原因应正确');
  engine.stopTimer();
});

runner.test('机器人可以正常移动', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  engine.selectRobot(1);
  
  const initialX = engine.getState().robots[0].x;
  const initialY = engine.getState().robots[0].y;
  
  const result = engine.moveRobot('RIGHT');
  runner.assert(result.success, '移动应成功');
  
  const newState = engine.getState();
  runner.assertEqual(newState.robots[0].x, initialX + 1, 'X坐标应增加');
  runner.assertEqual(newState.robots[0].y, initialY, 'Y坐标应不变');
  engine.stopTimer();
});

runner.test('无法移动到墙壁', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  engine.selectRobot(1);
  
  const result = engine.moveRobot('UP');
  runner.assertEqual(result.success, false, '向上移动到墙壁应失败');
  engine.stopTimer();
});

runner.test('成功拾取货物加分', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  
  engine.cargos[0].x = 1;
  engine.cargos[0].y = 2;
  engine.selectRobot(1);
  engine.moveRobot('DOWN');
  
  const initialScore = engine.getState().score;
  const result = engine.pickupCargo();
  
  runner.assert(result.success, '拾取应成功');
  runner.assert(engine.getState().score > initialScore, '分数应增加');
  runner.assert(engine.cargos[0].picked, '货物应标记为已拾取');
  engine.stopTimer();
});

runner.test('重复拾取扣分', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  
  engine.cargos[0].x = 1;
  engine.cargos[0].y = 2;
  engine.selectRobot(1);
  engine.moveRobot('DOWN');
  engine.pickupCargo();
  
  engine.robots[0].carrying = false;
  const result = engine.pickupCargo();
  
  runner.assertEqual(result.success, false, '重复拾取应失败');
  runner.assertEqual(result.reason, '货物已被取走', '错误原因应正确');
  engine.stopTimer();
});

runner.test('取空位置扣分', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  engine.selectRobot(1);
  
  engine.cargos[0].x = 1;
  engine.cargos[0].y = 2;
  engine.moveRobot('DOWN');
  engine.pickupCargo();
  
  const initialScore = engine.getState().score;
  engine.robots[0].carrying = false;
  const result = engine.pickupCargo();
  
  runner.assertEqual(result.success, false, '取空应失败');
  runner.assert(engine.getState().score < initialScore, '分数应减少');
  engine.stopTimer();
});

runner.test('移动有历史记录', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  engine.selectRobot(1);
  engine.moveRobot('DOWN');
  
  const history = engine.getMoveHistory();
  runner.assert(history.length > 0, '应有移动历史');
  runner.assertEqual(history[0].type, 'move', '历史记录类型应为move');
  engine.stopTimer();
});

runner.test('游戏结束后可以回放', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  engine.selectRobot(1);
  engine.moveRobot('DOWN');
  engine.endGame();
  
  const canReplay = engine.startReplay();
  runner.assert(canReplay, '应可以开始回放');
  runner.assertEqual(engine.getState().gameState, constants.GAME_STATE.REPLAYING, '状态应为REPLAYING');
  
  const step = engine.replayNextStep();
  runner.assertEqual(step.done, false, '应有回放步骤');
});

runner.test('没有移动历史时无法回放', () => {
  const engine = new GameEngine();
  engine.init();
  engine.endGame();
  
  const canReplay = engine.startReplay();
  runner.assertEqual(canReplay, false, '没有历史时无法回放');
});

runner.test('分数记录有明细', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  engine.selectRobot(1);
  engine.moveRobot('DOWN');
  
  const state = engine.getState();
  runner.assert(state.scoreDetails.length > 0, '应有计分明细');
  runner.assert(state.scoreDetails[0].reason, '明细应有原因');
  runner.assert(typeof state.scoreDetails[0].amount === 'number', '明细应有分数');
  engine.stopTimer();
});

runner.test('快速重复操作不会破坏状态', () => {
  const engine = new GameEngine();
  engine.init();
  
  engine.start();
  engine.start();
  engine.start();
  
  runner.assertEqual(engine.getState().gameState, constants.GAME_STATE.PLAYING, '重复开始不破坏状态');
  
  engine.pause();
  engine.pause();
  
  runner.assertEqual(engine.getState().gameState, constants.GAME_STATE.PAUSED, '重复暂停不破坏状态');
  engine.stopTimer();
});

runner.test('时间耗尽游戏结束', async () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  const state = engine.getState();
  runner.assert(state.timeRemaining < constants.GAME_TIME, '时间应减少');
  engine.stopTimer();
});

runner.test('拾取所有货物游戏结束', () => {
  const engine = new GameEngine();
  engine.init();
  engine.start();
  
  engine.cargos.forEach((cargo, idx) => {
    engine.selectRobot((idx % 3) + 1);
    engine.robots[(idx % 3)].x = cargo.x;
    engine.robots[(idx % 3)].y = cargo.y;
    engine.robots[(idx % 3)].carrying = false;
    engine.pickupCargo();
  });
  
  const state = engine.getState();
  runner.assertEqual(state.gameState, constants.GAME_STATE.ENDED, '所有货物拾取后游戏结束');
  runner.assert(state.allCargosPicked, '所有货物应已拾取');
  engine.stopTimer();
});

module.exports = runner;
