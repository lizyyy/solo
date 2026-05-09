const { GameStatus, ErrorType, PORTS, GAME_CONFIG } = require('../src/game/constants');
const GameState = require('../src/game/GameState');
const GameEngine = require('../src/game/GameEngine');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const condition = actual === expected;
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    errors.push(`${message} (expected: ${expected}, actual: ${actual})`);
    console.log(`  ✗ ${message} (expected: ${expected}, actual: ${actual})`);
  }
}

console.log('\n═══════════════════════════════════════');
console.log('  港口吊机装箱节奏游戏 - 测试套件');
console.log('═══════════════════════════════════════\n');

console.log('一、GameState 基础状态测试');
console.log('─────────────────────────────────');

const state = new GameState();

console.log('\n1. 初始状态验证');
assertEqual(state.status, GameStatus.IDLE, '初始状态应为 IDLE');
assertEqual(state.score, 0, '初始分数为 0');
assertEqual(state.timeLeft, GAME_CONFIG.initialTime, `初始时间为 ${GAME_CONFIG.initialTime} 秒`);
assertEqual(state.penalties, 0, '初始处罚次数为 0');

console.log('\n2. 游戏启动测试');
state.start();
assertEqual(state.status, GameStatus.PLAYING, '启动后状态为 PLAYING');
assert(state.containers.length > 0, '有集装箱队列');
assert(state.currentContainer !== null, '有当前集装箱');

console.log('\n3. 集装箱生成验证');
const container = state.currentContainer;
assert(container.id > 0, '集装箱有 ID');
assert(container.weight >= GAME_CONFIG.minWeight, '重量不小于最小值');
assert(container.weight <= GAME_CONFIG.maxWeight, '重量不大于最大值');
assert(PORTS.some(p => p.id === container.targetPort), '目的港有效');

console.log('\n4. 吊机状态管理');
const crane0 = state.cranes[0];
assert(!crane0.busy, '吊机初始空闲');
assertEqual(crane0.cooldown, 0, '吊机初始无冷却');
assert(state.canUseCrane(0), '可以使用吊机0');

console.log('\n5. 吊机冷却测试');
state.assignContainerToCrane(0, { weight: 30 });
assert(!state.canUseCrane(0), '吊机被占用后不可用');
assert(state.cranes[0].cooldown > 0, '吊机有冷却时间');
state.updateCraneCooldowns();
state.updateCraneCooldowns();
state.updateCraneCooldowns();
assertEqual(state.cranes[0].cooldown, 0, '冷却时间结束后归零');
state.releaseCrane(0);
assert(state.canUseCrane(0), '冷却结束后吊机可用');

console.log('\n二、GameEngine 游戏流程测试');
console.log('─────────────────────────────────');

const engine = new GameEngine();

console.log('\n1. 开始游戏');
engine.start();
const snapshot1 = engine.getGameSnapshot();
assertEqual(snapshot1.status, GameStatus.PLAYING, '引擎启动状态正确');
assertEqual(snapshot1.penalties, 0, '处罚次数为 0');
assertEqual(snapshot1.score, 0, '初始分数为 0');

console.log('\n2. 边界情况 - 重复点击操作');
console.log('   2.1 未开始游戏时操作');
const engine2 = new GameEngine();
engine2.selectCrane(0);
assertEqual(engine2.state.status, GameStatus.IDLE, '未开始时不改变状态');

engine2.pickContainer();
assert(engine2.holdingContainer === null, '未开始时不能抓取');

engine2.placeContainer('SH');
assertEqual(engine2.state.penalties, 0, '未开始时不扣分');

console.log('   2.2 未选择吊机时抓取');
engine.selectCrane(0);
engine.pickContainer();
const afterPick = engine.getGameSnapshot();
const pickedContainer = afterPick.holdingContainer;
assert(pickedContainer !== null, '正常抓取集装箱');

console.log('   2.3 重复抓取（有正在运送的集装箱）');
const scoreBeforeDouble = engine.state.score;
engine.pickContainer();
assert(engine.holdingContainer === pickedContainer, '已有集装箱时不重复抓取');
assertEqual(engine.state.score, scoreBeforeDouble, '重复操作不扣分');

console.log('   2.4 未抓取时放置');
const engine3 = new GameEngine();
engine3.start();
const scoreBeforePlace = engine3.state.score;
engine3.placeContainer('SH');
assertEqual(engine3.state.score, scoreBeforePlace, '未抓取时放置不扣分');

console.log('\n3. 正确放置集装箱');
const correctTargetPort = pickedContainer.targetPort;
const scoreBeforeCorrect = engine.state.score;
engine.placeContainer(correctTargetPort);
const scoreAfterCorrect = engine.state.score;
assert(scoreAfterCorrect > scoreBeforeCorrect, '正确放置后得分增加');

console.log('\n4. 边界情况 - 错误放置（错误目的港）');
engine.start();
engine.selectCrane(0);
engine.pickContainer();
const wrongContainer = engine.holdingContainer;
const wrongPorts = PORTS.filter(p => p.id !== wrongContainer.targetPort);
const wrongTarget = wrongPorts[0].id;

const scoreBeforeWrong = engine.state.score;
engine.placeContainer(wrongTarget);
const scoreAfterWrong = engine.state.score;

assert(scoreAfterWrong <= scoreBeforeWrong, '错误放置扣分');
assertEqual(engine.state.penalties, 1, '处罚次数增加');

console.log('\n5. 边界情况 - 暂停/继续状态隔离');
engine.start();
const timeBeforePause = engine.state.timeLeft;
engine.pause();
const pausedSnapshot = engine.getGameSnapshot();
assertEqual(pausedSnapshot.status, GameStatus.PAUSED, '状态变为 PAUSED');

engine.selectCrane(0);
engine.pickContainer();
assert(engine.holdingContainer === null, '暂停时不能抓取');

engine.resume();
const resumedSnapshot = engine.getGameSnapshot();
assertEqual(resumedSnapshot.status, GameStatus.PLAYING, '恢复后状态为 PLAYING');

console.log('\n6. 边界情况 - 时间耗尽');
const engine4 = new GameEngine();
engine4.start();
engine4.state.timeLeft = 1;
engine4.state.tickTime();
engine4.state.tickTime();
assert(engine4.state.isEnded(), '时间耗尽后游戏结束');
assertEqual(engine4.state.lastError, ErrorType.TIME_OUT, '结束原因为时间耗尽');

console.log('\n7. 边界情况 - 处罚次数上限');
const engine5 = new GameEngine();
engine5.start();

for (let i = 0; i < GAME_CONFIG.maxPenalties; i++) {
  engine5.state.currentContainer = { id: 100 + i, weight: 20, targetPort: 'SH', color: '#fff' };
  engine5.state.containers = [engine5.state.currentContainer];
  engine5.selectedCrane = 0;
  engine5.state.cranes[0].cooldown = 0;
  engine5.state.cranes[0].busy = false;
  engine5.pickContainer();
  engine5.placeContainer('SZ');
}

assert(engine5.state.isEnded(), `达到${GAME_CONFIG.maxPenalties}次处罚后游戏结束`);

console.log('\n8. 暂停后重启游戏');
engine.start();
engine.pause();
const beforeRestartScore = engine.state.score;
engine.restart();
assertEqual(engine.state.score, 0, '重启后分数清零');
assertEqual(engine.state.status, GameStatus.PLAYING, '重启后状态为 PLAYING');

console.log('\n三、计分明细和回放测试');
console.log('─────────────────────────────────');

const engine6 = new GameEngine();
engine6.start();

console.log('\n1. 记录操作历史');
engine6.selectCrane(0);
engine6.pickContainer();
const c1 = engine6.holdingContainer;
engine6.placeContainer(c1.targetPort);

assertEqual(engine6.state.actionHistory.length, 2, '有2条操作记录（PICK + PLACE）');

console.log('\n2. 计分明细');
const breakdown = engine6.getScoreBreakdown();
assert(breakdown.totalScore >= 0, '总分有效');
assert(breakdown.deliveries.count >= 1, '至少有1次成功运送');
assert(breakdown.deliveries.totalPoints > 0, '有得分');

console.log('\n3. 回放功能');
engine6.start();
engine6.selectCrane(0);
engine6.pickContainer();
const c2 = engine6.holdingContainer;
engine6.placeContainer(c2.targetPort);

const replayActions = engine6.startReplay();
assert(replayActions !== null, '可以开始回放');
assert(replayActions.length >= 2, '有回放记录');

const action1 = engine6.getNextReplayAction();
assert(action1 !== null, '可以获取第一条记录');

while (!engine6.isReplayComplete()) {
  engine6.getNextReplayAction();
}
assert(engine6.isReplayComplete(), '回放可以结束');

console.log('\n═══════════════════════════════════════');
console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
console.log('═══════════════════════════════════════\n');

if (errors.length > 0) {
  console.log('失败详情:');
  errors.forEach(e => console.log(`  - ${e}`));
  console.log('');
  process.exit(1);
} else {
  console.log('所有测试通过！');
  process.exit(0);
}
