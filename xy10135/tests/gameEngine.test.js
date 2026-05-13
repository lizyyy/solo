const GameConfig = require('../public/js/gameConfig');
const GameEngine = require('../public/js/gameEngine');

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  run() {
    console.log('\n=== 运行测试 ===\n');
    
    for (const test of this.tests) {
      try {
        const engine = new GameEngine();
        test.fn(engine);
        console.log(`✅ PASS: ${test.name}`);
        this.passed++;
      } catch (err) {
        console.log(`❌ FAIL: ${test.name}`);
        console.log(`   错误: ${err.message}`);
        if (err.expected !== undefined) {
          console.log(`   期望: ${err.expected}`);
          console.log(`   实际: ${err.actual}`);
        }
        this.failed++;
      }
    }

    console.log(`\n=== 测试结果 ===`);
    console.log(`通过: ${this.passed}`);
    console.log(`失败: ${this.failed}`);
    console.log(`总计: ${this.tests.length}\n`);

    return this.failed === 0;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    const err = new Error(`${message} Expected ${expected} but got ${actual}`);
    err.expected = expected;
    err.actual = actual;
    throw err;
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertFalse(condition, message = '') {
  if (condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const runner = new TestRunner();

runner.test('初始化游戏状态', (engine) => {
  assertEqual(engine.state, 'idle', '初始状态应为 idle');
  assertEqual(engine.score, 0, '初始分数应为 0');
  assertEqual(engine.timeRemaining, GameConfig.GAME_DURATION, '初始时间应为配置值');
  assertEqual(engine.emergencies.length, 0, '初始应无警情');
});

runner.test('开始游戏应改变状态', (engine) => {
  engine.start();
  assertEqual(engine.state, 'playing', '开始后状态应为 playing');
  assertTrue(engine.emergencies.length > 0, '开始后应至少有一个警情');
});

runner.test('暂停游戏', (engine) => {
  engine.start();
  engine.pause();
  assertEqual(engine.state, 'paused', '暂停后状态应为 paused');
  
  engine.resume();
  assertEqual(engine.state, 'playing', '恢复后状态应为 playing');
});

runner.test('从非运行状态暂停不影响状态', (engine) => {
  engine.pause();
  assertEqual(engine.state, 'idle', '从 idle 状态暂停应保持 idle');
  
  engine.start();
  engine.finishGame('test');
  engine.pause();
  assertEqual(engine.state, 'finished', '从 finished 状态暂停应保持 finished');
});

runner.test('调度车辆 - 成功情况', (engine) => {
  engine.start();
  
  const availableVehicle = engine.vehicles.find(v => v.status === 'available');
  const emergency = engine.emergencies[0];
  
  assertTrue(availableVehicle, '应有可用车辆');
  assertTrue(emergency, '应有警情');
  
  const result = engine.dispatch(availableVehicle.id, emergency.id, 1);
  
  assertTrue(result.success, '调度应成功');
  assertEqual(availableVehicle.status, 'enroute', '车辆状态应为 enroute');
});

runner.test('调度车辆 - 车辆不存在', (engine) => {
  engine.start();
  const emergency = engine.emergencies[0];
  
  const result = engine.dispatch('invalid_vehicle', emergency.id, 1);
  
  assertFalse(result.success, '调度应失败');
  assertEqual(result.error, '车辆不存在', '错误信息应正确');
});

runner.test('调度车辆 - 警情不存在', (engine) => {
  engine.start();
  const availableVehicle = engine.vehicles.find(v => v.status === 'available');
  
  const result = engine.dispatch(availableVehicle.id, 'invalid_emergency', 1);
  
  assertFalse(result.success, '调度应失败');
  assertEqual(result.error, '警情不存在', '错误信息应正确');
});

runner.test('调度车辆 - 车辆已被调度', (engine) => {
  engine.start();
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  const emergency = engine.emergencies[0];
  
  engine.dispatch(vehicle.id, emergency.id, 1);
  
  const result = engine.dispatch(vehicle.id, emergency.id, 1);
  
  assertFalse(result.success, '重复调度应失败');
  assertEqual(result.error, '车辆已被调度', '错误信息应正确');
});

runner.test('调度车辆 - 人员数量超出限制', (engine) => {
  engine.start();
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
  const emergency = engine.emergencies[0];
  
  const result = engine.dispatch(vehicle.id, emergency.id, vehicleConfig.capacity + 10);
  
  assertFalse(result.success, '超出人员数量限制应失败');
  assertTrue(result.error.includes('人员数量'), '错误信息应包含人员数量');
});

runner.test('调度车辆 - 消防站人员不足', (engine) => {
  engine.start();
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  const station = engine.stations.find(s => s.id === vehicle.stationId);
  const emergency = engine.emergencies[0];
  
  station.personnel = 0;
  
  const result = engine.dispatch(vehicle.id, emergency.id, 1);
  
  assertFalse(result.success, '人员不足应失败');
  assertEqual(result.error, '消防站人员不足', '错误信息应正确');
});

runner.test('游戏未运行时无法调度', (engine) => {
  const result = engine.dispatch('any', 'any', 1);
  assertFalse(result.success, '游戏未运行时调度应失败');
  assertEqual(result.error, '游戏未运行', '错误信息应正确');
});

runner.test('时间耗尽结束游戏', (engine) => {
  engine.start();
  engine.timeRemaining = 0.1;
  
  const mockNow = Date.now();
  engine.lastUpdateTime = mockNow - 1000;
  
  engine.update();
  
  assertEqual(engine.state, 'finished', '时间耗尽应结束游戏');
  assertEqual(engine.finishReason, 'time_up', '结束原因应为 time_up');
});

runner.test('失败次数过多结束游戏', (engine) => {
  engine.start();
  
  const emergencyTypes = Object.keys(GameConfig.EMERGENCY_TYPES);
  for (let i = 0; i < 3; i++) {
    const typeKey = emergencyTypes[i % emergencyTypes.length];
    const config = GameConfig.EMERGENCY_TYPES[typeKey];
    
    const fakeEmergency = {
      id: `fake_${i}`,
      type: typeKey,
      x: 100,
      y: 100,
      timeRemaining: 0,
      maxTime: config.maxTime,
      dispatchedVehicles: [],
      personnelArrived: 0,
      waterProvided: 0,
      status: 'active',
      targetPersonnel: config.personnelNeeded,
      targetWater: config.waterNeeded,
      createdAt: Date.now()
    };
    
    engine.emergencies.push(fakeEmergency);
    engine.resolveEmergency(fakeEmergency, 'timeout');
  }
  
  assertTrue(engine.checkGameOver(), '失败3次应触发游戏结束');
  
  engine.update();
  assertEqual(engine.state, 'finished', '游戏应结束');
  assertEqual(engine.finishReason, 'too_many_failures', '结束原因应为 too_many_failures');
});

runner.test('计分系统 - 成功处置获得分数', (engine) => {
  engine.start();
  
  const emergency = engine.emergencies[0];
  const config = GameConfig.EMERGENCY_TYPES[emergency.type];
  const initialScore = engine.score;
  
  engine.resolveEmergency(emergency, 'success');
  
  assertTrue(engine.score > initialScore, '成功处置应获得分数');
  assertEqual(engine.completedEmergencies.length, 1, '完成警情数应增加');
});

runner.test('计分系统 - 失败扣除分数', (engine) => {
  engine.start();
  engine.score = 500;
  
  const emergency = engine.emergencies[0];
  
  engine.resolveEmergency(emergency, 'timeout');
  
  assertEqual(engine.failedEmergencies.length, 1, '失败警情数应增加');
});

runner.test('计分明细记录', (engine) => {
  engine.start();
  const initialCount = engine.scoreBreakdown.length;
  
  const emergency = engine.emergencies[0];
  engine.resolveEmergency(emergency, 'success');
  
  assertEqual(engine.scoreBreakdown.length, initialCount + 1, '应添加计分明细');
  assertTrue(engine.scoreBreakdown[0].reason.length > 0, '明细应包含原因');
  assertTrue(engine.scoreBreakdown[0].points !== 0, '明细应包含分数');
});

runner.test('重新开始重置游戏状态', (engine) => {
  engine.start();
  engine.score = 1000;
  engine.timeRemaining = 100;
  engine.failedEmergencies.push({});
  
  engine.restart();
  
  assertEqual(engine.state, 'playing', '重新开始后状态应为 playing');
  assertEqual(engine.score, 0, '分数应重置为 0');
  assertEqual(engine.timeRemaining, GameConfig.GAME_DURATION, '时间应重置');
  assertEqual(engine.failedEmergencies.length, 0, '失败记录应清空');
});

runner.test('查找最近消防栓', (engine) => {
  const hydrant = engine.findNearestHydrant(400, 300);
  assertTrue(hydrant, '应找到消防栓');
  assertTrue(typeof hydrant.x === 'number', '消防栓应有 x 坐标');
  assertTrue(typeof hydrant.y === 'number', '消防栓应有 y 坐标');
});

runner.test('计算距离', (engine) => {
  const dist = engine.getDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
  assertEqual(dist, 5, '距离计算应为 5');
});

runner.test('验证调度 - 所有条件满足', (engine) => {
  engine.start();
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  const emergency = engine.emergencies[0];
  
  const validation = engine.validateDispatch(vehicle.id, emergency.id, 1);
  
  assertTrue(validation.valid, '验证应通过');
});

runner.test('验证调度 - 人员数量无效', (engine) => {
  engine.start();
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  const emergency = engine.emergencies[0];
  const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
  
  const validation = engine.validateDispatch(vehicle.id, emergency.id, vehicleConfig.capacity + 1);
  
  assertFalse(validation.valid, '人员数量超出应验证失败');
});

runner.test('获取可用车辆', (engine) => {
  engine.start();
  const availableVehicles = engine.getAvailableVehicles();
  
  assertTrue(Array.isArray(availableVehicles), '应返回数组');
  availableVehicles.forEach(v => {
    assertEqual(v.status, 'available', '所有返回的车辆状态应为 available');
  });
});

runner.test('获取活跃警情', (engine) => {
  engine.start();
  const activeEmergencies = engine.getActiveEmergencies();
  
  assertTrue(Array.isArray(activeEmergencies), '应返回数组');
  activeEmergencies.forEach(e => {
    assertEqual(e.status, 'active', '所有返回的警情状态应为 active');
  });
});

runner.test('调度历史记录', (engine) => {
  engine.start();
  const initialHistoryLength = engine.dispatchHistory.length;
  
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  const emergency = engine.emergencies[0];
  engine.dispatch(vehicle.id, emergency.id, 1);
  
  assertEqual(engine.dispatchHistory.length, initialHistoryLength + 1, '调度历史应增加');
  assertEqual(engine.dispatchHistory[0].vehicleId, vehicle.id, '历史记录应包含车辆ID');
});

runner.test('车辆完成任务后返回消防站', (engine) => {
  engine.start();
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  const emergency = engine.emergencies[0];
  const station = engine.stations.find(s => s.id === vehicle.stationId);
  
  engine.dispatch(vehicle.id, emergency.id, 1);
  
  vehicle.status = 'arrived';
  vehicle.x = emergency.x;
  vehicle.y = emergency.y;
  
  emergency.dispatchedVehicles = [{
    id: vehicle.id,
    type: vehicle.type,
    personnel: 1,
    water: 2000,
    status: 'arrived',
    distance: 100
  }];
  
  engine.resolveEmergency(emergency, 'success');
  
  assertEqual(vehicle.status, 'returning', '车辆状态应为 returning');
  assertEqual(vehicle.targetX, station.x, '目标位置应为消防站 x');
  assertEqual(vehicle.targetY, station.y, '目标位置应为消防站 y');
});

runner.test('核心修复验证 - 车辆到达后状态同步到警情', (engine) => {
  engine.start();
  const emergency = engine.emergencies[0];
  const emergencyConfig = GameConfig.EMERGENCY_TYPES[emergency.type];
  
  const vehiclesNeeded = [];
  let totalPersonnel = 0;
  let totalWater = 0;
  
  for (const vehicle of engine.vehicles) {
    if (vehicle.status !== 'available') continue;
    
    const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
    const station = engine.stations.find(s => s.id === vehicle.stationId);
    
    if (!station || station.personnel < 1) continue;
    
    const personnelToSend = Math.min(station.personnel, vehicleConfig.capacity);
    engine.dispatch(vehicle.id, emergency.id, personnelToSend, false);
    
    vehiclesNeeded.push(vehicle);
    totalPersonnel += personnelToSend;
    totalWater += vehicleConfig.waterCapacity;
    
    vehicle.status = 'arrived';
    vehicle.x = emergency.x;
    vehicle.y = emergency.y;
    
    if (totalPersonnel >= emergencyConfig.personnelNeeded && totalWater >= emergencyConfig.waterNeeded) {
      break;
    }
  }
  
  assertEqual(emergency.dispatchedVehicles.length, vehiclesNeeded.length, '应有已调度车辆');
  
  engine.updateEmergencies(0);
  
  assertTrue(emergency.personnelArrived > 0, '到达人员应大于 0');
  assertTrue(emergency.waterProvided > 0, '到达水量应大于 0');
  
  if (totalPersonnel >= emergencyConfig.personnelNeeded && totalWater >= emergencyConfig.waterNeeded) {
    assertEqual(emergency.personnelArrived, totalPersonnel, '到达人员应等于派遣人员');
    assertEqual(emergency.waterProvided, totalWater, '到达水量应等于派遣水量');
  }
});

runner.test('核心修复验证 - 车辆到达副本状态不同步不影响真实状态', (engine) => {
  engine.start();
  const emergency = engine.emergencies[0];
  
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  assertTrue(vehicle, '应有可用车辆');
  
  const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
  
  engine.dispatch(vehicle.id, emergency.id, 1, false);
  
  assertEqual(emergency.dispatchedVehicles.length, 1, '应有 1 辆已调度车辆');
  
  vehicle.status = 'arrived';
  
  assertEqual(emergency.dispatchedVehicles[0].status, 'enroute', '副本状态仍为 enroute');
  
  engine.updateEmergencies(0);
  
  assertEqual(emergency.personnelArrived, 1, '应能检测到车辆已到达');
});

runner.test('核心修复验证 - 消防栓真正增加水量', (engine) => {
  engine.start();
  const emergency = engine.emergencies[0];
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  assertTrue(vehicle, '应有可用车辆');
  
  const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
  
  const nearestHydrant = engine.findNearestHydrant(emergency.x, emergency.y);
  assertTrue(nearestHydrant, '附近应有消防栓');
  
  const expectedWater = vehicleConfig.waterCapacity + nearestHydrant.flowRate * 3;
  
  engine.dispatch(vehicle.id, emergency.id, 1, true);
  
  assertEqual(vehicle.water, expectedWater, '车辆水量应包含消防栓加成');
  
  const dv = emergency.dispatchedVehicles[0];
  assertTrue(dv, '应有已调度车辆记录');
  assertEqual(dv.water, expectedWater, '记录中的水量也应包含消防栓加成');
});

runner.test('核心修复验证 - 不使用消防栓水量保持基础值', (engine) => {
  engine.start();
  const emergency = engine.emergencies[0];
  const vehicle = engine.vehicles.find(v => v.status === 'available');
  assertTrue(vehicle, '应有可用车辆');
  
  const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
  
  engine.dispatch(vehicle.id, emergency.id, 1, false);
  
  assertEqual(vehicle.water, vehicleConfig.waterCapacity, '不使用消防栓应保持基础水量');
});

runner.test('核心修复验证 - 满足条件后警情自动处置成功', (engine) => {
  engine.start();
  
  const emergency = engine.emergencies[0];
  const config = GameConfig.EMERGENCY_TYPES[emergency.type];
  
  let personnelSent = 0;
  let waterSent = 0;
  
  for (const vehicle of engine.vehicles) {
    if (vehicle.status !== 'available') continue;
    
    const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
    const station = engine.stations.find(s => s.id === vehicle.stationId);
    
    if (!station || station.personnel < 1) continue;
    
    const personnelToSend = Math.min(station.personnel, vehicleConfig.capacity);
    
    engine.dispatch(vehicle.id, emergency.id, personnelToSend, false);
    
    vehicle.status = 'arrived';
    vehicle.x = emergency.x;
    vehicle.y = emergency.y;
    
    personnelSent += personnelToSend;
    waterSent += vehicleConfig.waterCapacity;
    
    if (personnelSent >= config.personnelNeeded && waterSent >= config.waterNeeded) {
      break;
    }
  }
  
  assertTrue(
    personnelSent >= config.personnelNeeded && waterSent >= config.waterNeeded,
    '应能派遣足够的资源'
  );
  
  const initialCompletedCount = engine.completedEmergencies.length;
  engine.updateEmergencies(0);
  
  assertEqual(
    engine.completedEmergencies.length,
    initialCompletedCount + 1,
    '满足条件后警情应自动处置成功'
  );
  
  const completedEmergency = engine.completedEmergencies[engine.completedEmergencies.length - 1];
  assertEqual(completedEmergency.id, emergency.id, '处置成功的应是目标警情');
});

runner.test('资源循环验证 - 警情处置成功后人员归还消防站', (engine) => {
  engine.start();
  const station = engine.stations[0];
  const initialPersonnel = station.personnel;
  
  const emergency = engine.emergencies[0];
  
  const vehicle = engine.vehicles.find(v => v.status === 'available' && v.stationId === station.id);
  assertTrue(vehicle, '消防站应有可用车辆');
  
  const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
  const personnelToSend = Math.min(2, vehicleConfig.capacity, station.personnel);
  
  engine.dispatch(vehicle.id, emergency.id, personnelToSend, false);
  
  assertEqual(station.personnel, initialPersonnel - personnelToSend, '派遣后消防站人员应减少');
  
  vehicle.status = 'arrived';
  vehicle.x = emergency.x;
  vehicle.y = emergency.y;
  
  engine.resolveEmergency(emergency, 'success');
  
  assertEqual(station.personnel, initialPersonnel, '警情处置成功后人员应归还消防站');
  assertEqual(vehicle.personnel, 0, '车辆上的人员应已清空');
});

runner.test('资源循环验证 - 警情处置失败后人员也应归还', (engine) => {
  engine.start();
  const station = engine.stations[0];
  const initialPersonnel = station.personnel;
  
  const emergency = engine.emergencies[0];
  
  const vehicle = engine.vehicles.find(v => v.status === 'available' && v.stationId === station.id);
  assertTrue(vehicle, '消防站应有可用车辆');
  
  const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
  const personnelToSend = Math.min(1, vehicleConfig.capacity, station.personnel);
  
  engine.dispatch(vehicle.id, emergency.id, personnelToSend, false);
  
  assertEqual(station.personnel, initialPersonnel - personnelToSend, '派遣后消防站人员应减少');
  
  engine.resolveEmergency(emergency, 'timeout');
  
  assertEqual(station.personnel, initialPersonnel, '警情处置失败后人员也应归还消防站');
});

runner.test('资源循环验证 - 多警情连续调度人员资源正确循环', (engine) => {
  engine.start();
  const station = engine.stations[0];
  const initialPersonnel = station.personnel;
  
  let totalPersonnelDispatched = 0;
  let usedVehicleIds = [];
  
  for (const vehicle of engine.vehicles) {
    if (vehicle.status !== 'available' || vehicle.stationId !== station.id) continue;
    
    const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
    const personnelToSend = 1;
    
    if (station.personnel < personnelToSend) break;
    
    engine.dispatch(vehicle.id, engine.emergencies[0].id, personnelToSend, false);
    totalPersonnelDispatched += personnelToSend;
    usedVehicleIds.push(vehicle.id);
    
    vehicle.status = 'arrived';
    vehicle.x = engine.emergencies[0].x;
    vehicle.y = engine.emergencies[0].y;
  }
  
  assertTrue(totalPersonnelDispatched > 0, '应派遣了至少一辆车');
  assertEqual(station.personnel, initialPersonnel - totalPersonnelDispatched, '人员应已扣减');
  
  engine.resolveEmergency(engine.emergencies[0], 'success');
  
  assertEqual(station.personnel, initialPersonnel, '所有人员应已归还消防站');
  
  const vehiclesAfter = engine.vehicles.filter(v => usedVehicleIds.includes(v.id));
  for (const v of vehiclesAfter) {
    assertEqual(v.status, 'returning', '车辆状态应为 returning');
    assertEqual(v.personnel, 0, '车辆人员应已清空');
  }
});

if (require.main === module) {
  process.exit(runner.run() ? 0 : 1);
}

module.exports = { runner, TestRunner };
