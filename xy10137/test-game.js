const { GameState, GameConfig, ColdChainGame } = require('./game');

console.log('开始运行游戏测试...\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('✓ ' + message);
    passed++;
  } else {
    console.log('✗ ' + message);
    failed++;
  }
}

function runTests() {
  testGameInitialization();
  testGameStart();
  testGamePauseResume();
  testVehicleAssignment();
  testGameUpdate();
  testGameOverConditions();
  testEdgeCases();
  testReplayData();
  testScoreSystem();
  testStateTransitions();

  console.log('\n========================');
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('========================');

  process.exit(failed > 0 ? 1 : 0);
}

function testGameInitialization() {
  console.log('--- 测试游戏初始化 ---');
  
  const game = new ColdChainGame();
  game.init();
  const state = game.getState();

  assert(state.state === GameState.IDLE, '初始状态应该是 IDLE');
  assert(state.crates.length === GameConfig.INITIAL_CRATES, `应该有 ${GameConfig.INITIAL_CRATES} 个冷链箱`);
  assert(state.vehicles.length === GameConfig.INITIAL_VEHICLES, `应该有 ${GameConfig.INITIAL_VEHICLES} 辆车`);
  assert(state.score === 0, '初始分数应该为 0');
  assert(state.elapsedTime === 0, '初始时间应该为 0');
  assert(state.scoreDetails.length === 0, '初始计分明细应该为空');

  for (const crate of state.crates) {
    assert(crate.temperature === GameConfig.BASE_TEMPERATURE, `冷链箱 ${crate.name} 初始温度应该是 ${GameConfig.BASE_TEMPERATURE}°C`);
    assert(crate.deliveryTime === 0, `冷链箱 ${crate.name} 初始配送时间应该为 0`);
    assert(crate.vehicleId === null, `冷链箱 ${crate.name} 初始没有分配车辆`);
    assert(crate.delivered === false, `冷链箱 ${crate.name} 初始状态应该是未配送`);
  }

  for (const vehicle of state.vehicles) {
    assert(vehicle.assignedCrateId === null, `车辆 ${vehicle.name} 初始没有分配冷链箱`);
  }

  console.log('');
}

function testGameStart() {
  console.log('--- 测试游戏开始 ---');
  
  const game = new ColdChainGame();
  game.init();
  
  assert(game.start() === true, '从 IDLE 状态开始游戏应该返回 true');
  assert(game.state === GameState.PLAYING, '开始后状态应该是 PLAYING');
  
  assert(game.start() === false, '已经在 PLAYING 状态时再次开始应该返回 false');
  
  console.log('');
}

function testGamePauseResume() {
  console.log('--- 测试暂停和继续 ---');
  
  const game = new ColdChainGame();
  game.init();
  
  assert(game.pause() === false, '在 IDLE 状态时暂停应该返回 false');
  assert(game.resume() === false, '在 IDLE 状态时继续应该返回 false');
  
  game.start();
  
  assert(game.pause() === true, '在 PLAYING 状态时暂停应该返回 true');
  assert(game.state === GameState.PAUSED, '暂停后状态应该是 PAUSED');
  assert(game.pause() === false, '已经在 PAUSED 状态时再次暂停应该返回 false');
  
  assert(game.resume() === true, '在 PAUSED 状态时继续应该返回 true');
  assert(game.state === GameState.PLAYING, '继续后状态应该是 PLAYING');
  assert(game.resume() === false, '已经在 PLAYING 状态时再次继续应该返回 false');
  
  console.log('');
}

function testVehicleAssignment() {
  console.log('--- 测试车辆分配 ---');
  
  const game = new ColdChainGame();
  game.init();
  
  assert(game.assignVehicleToCrate(0, 0) === false, '在 IDLE 状态时分配车辆应该返回 false');
  
  game.start();
  
  const vehicle = game.vehicles[0];
  const crate = game.crates[0];
  
  assert(game.assignVehicleToCrate(vehicle.id, crate.id) === true, '在 PLAYING 状态时分配车辆应该返回 true');
  assert(vehicle.assignedCrateId === crate.id, '车辆应该分配到指定冷链箱');
  assert(crate.vehicleId === vehicle.id, '冷链箱应该分配到指定车辆');
  
  assert(game.assignVehicleToCrate(999, 0) === false, '分配不存在的车辆应该返回 false');
  assert(game.assignVehicleToCrate(0, 999) === false, '分配不存在的冷链箱应该返回 false');
  
  const vehicle2 = game.vehicles[1];
  const crate2 = game.crates[1];
  game.assignVehicleToCrate(vehicle2.id, crate2.id);
  
  game.assignVehicleToCrate(vehicle.id, crate2.id);
  assert(vehicle2.assignedCrateId === null, '冷链箱被重新分配时，旧车辆应该被释放');
  assert(vehicle.assignedCrateId === crate2.id, '新车辆应该分配到冷链箱');
  assert(crate2.vehicleId === vehicle.id, '冷链箱应该关联到新车辆');
  
  console.log('');
}

function testGameUpdate() {
  console.log('--- 测试游戏更新 ---');
  
  const game = new ColdChainGame();
  game.init();
  
  const initialTime = Date.now();
  assert(game.update(initialTime) === false, '在 IDLE 状态时更新应该返回 false');
  
  game.start();
  const startState = game.getState();
  
  const laterTime = initialTime + 5000;
  game.update(laterTime);
  const afterUpdate = game.getState();
  
  assert(afterUpdate.elapsedTime > startState.elapsedTime, '更新后时间应该增加');
  
  for (const crate of afterUpdate.crates) {
    if (crate.vehicleId === null) {
      assert(crate.temperature > GameConfig.BASE_TEMPERATURE, `没有分配车辆的冷链箱 ${crate.name} 温度应该上升`);
      assert(crate.deliveryTime > 0, `没有分配车辆的冷链箱 ${crate.name} 等待时间应该增加`);
    }
  }
  
  const vehicle = game.vehicles[0];
  const crate = game.crates[0];
  game.assignVehicleToCrate(vehicle.id, crate.id);
  
  const time1 = Date.now() + 10000;
  game.update(time1);
  
  const assignedCrate = game.crates.find(c => c.id === crate.id);
  assert(assignedCrate.deliveryProgress > 0, '分配车辆后配送进度应该增加');
  
  console.log('');
}

function testGameOverConditions() {
  console.log('--- 测试游戏结束条件 ---');
  
  testWinCondition();
  testLoseCondition();
  
  console.log('');
}

function testWinCondition() {
  const game = new ColdChainGame();
  game.init();
  game.start();
  
  for (const crate of game.crates) {
    crate.delivered = true;
    crate.deliveryProgress = 100;
  }
  
  game._checkGameOver();
  assert(game.isWon() === true, '所有冷链箱送达后应该胜利');
  assert(game.isGameOver() === true, '胜利状态应该是游戏结束');
}

function testLoseCondition() {
  const game = new ColdChainGame();
  game.init();
  game.start();
  
  const crate = game.crates[0];
  crate.temperature = GameConfig.MAX_TEMPERATURE + 1;
  crate.deliveryTime = crate.maxDeliveryTime + 1;
  
  game._checkGameOver();
  assert(game.isLost() === true, '冷链箱温度和时间同时超标应该失败');
  assert(game.isGameOver() === true, '失败状态应该是游戏结束');
  
  const game2 = new ColdChainGame();
  game2.init();
  game2.start();
  
  const crate2 = game2.crates[0];
  crate2.temperature = GameConfig.MAX_TEMPERATURE - 1;
  crate2.deliveryTime = crate2.maxDeliveryTime + 1;
  
  game2._checkGameOver();
  assert(game2.isLost() === false, '只有时间超标不应该失败');
  
  const game3 = new ColdChainGame();
  game3.init();
  game3.start();
  
  const crate3 = game3.crates[0];
  crate3.temperature = GameConfig.MAX_TEMPERATURE + 1;
  crate3.deliveryTime = crate3.maxDeliveryTime - 1;
  
  game3._checkGameOver();
  assert(game3.isLost() === false, '只有温度超标不应该失败');
}

function testEdgeCases() {
  console.log('--- 测试边界情况 ---');
  
  testDoubleClicks();
  testResourceConflicts();
  testGameOverInteractions();
  
  console.log('');
}

function testDoubleClicks() {
  const game = new ColdChainGame();
  game.init();
  
  game.start();
  game.start();
  game.start();
  assert(game.state === GameState.PLAYING, '多次点击开始不应该改变状态');
  
  game.pause();
  game.pause();
  game.pause();
  assert(game.state === GameState.PAUSED, '多次点击暂停不应该改变状态');
  
  game.resume();
  game.resume();
  game.resume();
  assert(game.state === GameState.PLAYING, '多次点击继续不应该改变状态');
}

function testResourceConflicts() {
  const game = new ColdChainGame();
  game.init();
  game.start();
  
  const vehicle = game.vehicles[0];
  const crate1 = game.crates[0];
  const crate2 = game.crates[1];
  
  game.assignVehicleToCrate(vehicle.id, crate1.id);
  assert(vehicle.assignedCrateId === crate1.id, '第一次分配应该成功');
  
  game.assignVehicleToCrate(vehicle.id, crate2.id);
  assert(vehicle.assignedCrateId === crate2.id, '同一车辆可以重新分配');
  assert(crate1.vehicleId === null, '旧冷链箱应该被释放');
  assert(crate2.vehicleId === vehicle.id, '新冷链箱应该被分配');
  
  const vehicle2 = game.vehicles[1];
  game.assignVehicleToCrate(vehicle2.id, crate2.id);
  assert(vehicle.assignedCrateId === null, '冷链箱被重新分配时，旧车辆应该被释放');
  assert(vehicle2.assignedCrateId === crate2.id, '新车辆应该分配到冷链箱');
}

function testGameOverInteractions() {
  const game = new ColdChainGame();
  game.init();
  game.start();
  
  for (const crate of game.crates) {
    crate.delivered = true;
    crate.deliveryProgress = 100;
  }
  game._checkGameOver();
  
  assert(game.assignVehicleToCrate(0, 0) === false, '游戏结束后不能分配车辆');
  assert(game.pause() === false, '游戏结束后不能暂停');
  assert(game.resume() === false, '游戏结束后不能继续');
  assert(game.start() === false, '游戏结束后不能开始');
  
  assert(game.restart() === true, '游戏结束后可以重新开始');
  assert(game.state === GameState.PLAYING, '重新开始后状态应该是 PLAYING');
}

function testReplayData() {
  console.log('--- 测试回放数据 ---');
  
  const game = new ColdChainGame();
  game.init();
  
  const initialHistory = game.getReplayData();
  assert(initialHistory.length >= 1, '初始化后应该有回放数据');
  
  game.start();
  game.update(Date.now() + 1000);
  
  const historyAfterStart = game.getReplayData();
  assert(historyAfterStart.length > initialHistory.length, '游戏运行后应该有更多回放数据');
  
  for (const frame of historyAfterStart) {
    assert(typeof frame.elapsedTime === 'number', '回放帧应该有 elapsedTime');
    assert(typeof frame.state === 'string', '回放帧应该有 state');
    assert(typeof frame.score === 'number', '回放帧应该有 score');
    assert(Array.isArray(frame.crates), '回放帧应该有 crates 数组');
    assert(Array.isArray(frame.vehicles), '回放帧应该有 vehicles 数组');
  }
  
  console.log('');
}

function testScoreSystem() {
  console.log('--- 测试计分系统 ---');
  
  const game = new ColdChainGame();
  game.init();
  game.start();
  
  const crate = game.crates[0];
  crate.temperature = 3;
  crate.deliveryTime = 10;
  
  game._deliverCrate(crate);
  
  const state = game.getState();
  assert(state.score >= GameConfig.SCORE_PER_DELIVERY, '配送成功应该获得基础分数');
  assert(state.scoreDetails.length === 1, '应该有一条计分明细');
  
  const detail = state.scoreDetails[0];
  assert(detail.crate === crate.name, '计分明细应该有正确的冷链箱名称');
  assert(detail.score >= GameConfig.SCORE_PER_DELIVERY, '计分明细应该有正确的分数');
  assert(Array.isArray(detail.details), '计分明细应该有详情数组');
  assert(detail.details.length > 0, '计分明细详情应该不为空');
  
  console.log('');
}

function testStateTransitions() {
  console.log('--- 测试状态转换 ---');
  
  const game = new ColdChainGame();
  
  assert(game.state === undefined || game.state === GameState.IDLE, '新游戏初始状态应该是 IDLE');
  
  game.init();
  assert(game.state === GameState.IDLE, 'init() 后状态应该是 IDLE');
  
  game.start();
  assert(game.state === GameState.PLAYING, 'start() 后状态应该是 PLAYING');
  
  game.pause();
  assert(game.state === GameState.PAUSED, 'pause() 后状态应该是 PAUSED');
  
  game.resume();
  assert(game.state === GameState.PLAYING, 'resume() 后状态应该是 PLAYING');
  
  for (const crate of game.crates) {
    crate.delivered = true;
    crate.deliveryProgress = 100;
  }
  game._checkGameOver();
  assert(game.state === GameState.WON, '胜利后状态应该是 WON');
  
  game.restart();
  assert(game.state === GameState.PLAYING, 'restart() 后状态应该是 PLAYING');
  
  const crate = game.crates[0];
  crate.temperature = GameConfig.MAX_TEMPERATURE + 1;
  crate.deliveryTime = crate.maxDeliveryTime + 1;
  game._checkGameOver();
  assert(game.state === GameState.LOST, '失败后状态应该是 LOST');
  
  console.log('');
}

runTests();
