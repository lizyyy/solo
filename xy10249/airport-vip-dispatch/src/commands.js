const fs = require('fs');
const path = require('path');
const storage = require('./utils/storage');
const dispatchEngine = require('./services/dispatch-engine');
const Flight = require('./models/flight');
const Vehicle = require('./models/vehicle');
const Driver = require('./models/driver');
const { VEHICLE_TYPE_NAMES, REPORTS_DIR, DISPATCH_STATUS } = require('./config');

async function initCommand(args) {
  console.log('🚀 初始化机场贵宾车调派系统...');
  
  storage.initialize();
  storage.clearAll();

  const now = new Date();
  const later1 = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const later2 = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const later3 = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const sampleFlights = [
    {
      id: 'FLIGHT-001',
      flightNumber: 'CA1234',
      scheduledDeparture: later1.toISOString(),
      status: 'scheduled',
      gate: 'T3-A01',
      destination: '北京',
      airline: '国航',
      passengerName: '张三',
      passengerLevel: 'platinum',
      vehiclePreference: 'limousine',
      delayMinutes: 0,
      vipRequests: ['需要轮椅']
    },
    {
      id: 'FLIGHT-002',
      flightNumber: 'MU5678',
      scheduledDeparture: later2.toISOString(),
      status: 'delayed',
      gate: 'T1-B02',
      destination: '上海',
      airline: '东航',
      passengerName: '李四',
      passengerLevel: 'gold',
      vehiclePreference: 'suv',
      delayMinutes: 45,
      vipRequests: []
    },
    {
      id: 'FLIGHT-003',
      flightNumber: 'CZ9012',
      scheduledDeparture: later3.toISOString(),
      status: 'scheduled',
      gate: 'T2-A02',
      destination: '广州',
      airline: '南航',
      passengerName: '王五',
      passengerLevel: 'silver',
      vehiclePreference: 'sedan',
      delayMinutes: 0,
      vipRequests: ['额外行李空间']
    }
  ];

  const sampleVehicles = [
    {
      id: 'VEH-001',
      plateNumber: '京A·88888',
      type: 'limousine',
      capacity: 4,
      status: 'available',
      baseLocation: 'BASE-T3',
      features: ['商务座', 'WiFi', '充电口']
    },
    {
      id: 'VEH-002',
      plateNumber: '京B·66666',
      type: 'suv',
      capacity: 6,
      status: 'available',
      baseLocation: 'BASE-T1',
      features: ['大空间', '四驱', '儿童座椅']
    },
    {
      id: 'VEH-003',
      plateNumber: '京C·22222',
      type: 'sedan',
      capacity: 4,
      status: 'available',
      baseLocation: 'BASE-MAIN',
      features: ['豪华内饰', '真皮座椅']
    },
    {
      id: 'VEH-004',
      plateNumber: '京D·55555',
      type: 'van',
      capacity: 8,
      status: 'available',
      baseLocation: 'BASE-MAIN',
      features: ['商务车', '多人乘坐', '会议设备']
    }
  ];

  const sampleDrivers = [
    {
      id: 'DRV-001',
      name: '王师傅',
      phone: '13800138001',
      status: 'available',
      vehicleId: 'VEH-001',
      rating: 4.9,
      experienceYears: 10
    },
    {
      id: 'DRV-002',
      name: '李师傅',
      phone: '13800138002',
      status: 'available',
      vehicleId: 'VEH-002',
      rating: 4.7,
      experienceYears: 5
    },
    {
      id: 'DRV-003',
      name: '张师傅',
      phone: '13800138003',
      status: 'on_duty',
      vehicleId: 'VEH-003',
      rating: 4.8,
      experienceYears: 7
    },
    {
      id: 'DRV-004',
      name: '赵师傅',
      phone: '13800138004',
      status: 'available',
      vehicleId: 'VEH-004',
      rating: 4.6,
      experienceYears: 3
    }
  ];

  sampleFlights.forEach(f => storage.saveFlight(new Flight(f)));
  sampleVehicles.forEach(v => storage.saveVehicle(new Vehicle(v)));
  sampleDrivers.forEach(d => storage.saveDriver(new Driver(d)));

  console.log('✅ 样例数据已初始化');
  console.log('');
  console.log('📊 初始化数据统计:');
  console.log('  - 航班: 3 条');
  console.log('  - 车辆: 4 辆');
  console.log('  - 司机: 4 位');
  console.log('');
  console.log('💡 提示: 运行 "node src/index.js run" 开始调派流程，或 "node src/index.js --help" 查看所有命令');

  return { success: true };
}

async function importCommand(args) {
  if (args.length === 0) {
    throw new Error('请指定要导入的文件路径');
  }

  const filePath = args[0];
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawData);

  let importedCount = { flights: 0, vehicles: 0, drivers: 0 };
  let errors = [];

  if (data.flights) {
    for (const flightData of data.flights) {
      const flight = new Flight(flightData);
      const validation = flight.validate();
      if (validation.valid) {
        storage.saveFlight(flight);
        importedCount.flights++;
      } else {
        errors.push(`航班 ${flightData.flightNumber || flightData.id}: ${validation.errors.join('; ')}`);
      }
    }
  }

  if (data.vehicles) {
    for (const vehicleData of data.vehicles) {
      const vehicle = new Vehicle(vehicleData);
      const validation = vehicle.validate();
      if (validation.valid) {
        storage.saveVehicle(vehicle);
        importedCount.vehicles++;
      } else {
        errors.push(`车辆 ${vehicleData.plateNumber || vehicleData.id}: ${validation.errors.join('; ')}`);
      }
    }
  }

  if (data.drivers) {
    for (const driverData of data.drivers) {
      const driver = new Driver(driverData);
      const validation = driver.validate();
      if (validation.valid) {
        storage.saveDriver(driver);
        importedCount.drivers++;
      } else {
        errors.push(`司机 ${driverData.name || driverData.id}: ${validation.errors.join('; ')}`);
      }
    }
  }

  console.log('📥 导入结果:');
  console.log(`  航班: ${importedCount.flights} 条`);
  console.log(`  车辆: ${importedCount.vehicles} 辆`);
  console.log(`  司机: ${importedCount.drivers} 位`);

  if (errors.length > 0) {
    console.log('');
    console.log('⚠️  导入警告:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  return { success: true, importedCount, errors };
}

async function listCommand(args) {
  const type = args[0];
  
  if (!type || !['flights', 'vehicles', 'drivers', 'dispatches'].includes(type)) {
    console.log('用法: node src/index.js list <类型>');
    console.log('类型: flights, vehicles, drivers, dispatches');
    return { success: false };
  }

  if (type === 'flights') {
    const flights = storage.getFlights();
    console.log('📋 航班列表:');
    console.log('='.repeat(80));
    flights.forEach(f => {
      const delayText = f.delayMinutes > 0 ? ` (延误 ${f.delayMinutes}分钟)` : '';
      const gateInfo = f.getGateInfo();
      console.log(`  [${f.id}] ${f.flightNumber} → ${f.destination}`);
      console.log(`    贵宾: ${f.passengerName} (${f.passengerLevel})`);
      console.log(`    登机口: ${f.gate} (${gateInfo ? gateInfo.terminal : '未知'})`);
      console.log(`    起飞: ${f.getEffectiveDepartureTime().toLocaleString()}${delayText}`);
      if (f.vehiclePreference) {
        console.log(`    车型偏好: ${VEHICLE_TYPE_NAMES[f.vehiclePreference]}`);
      }
      console.log('');
    });
  } else if (type === 'vehicles') {
    const vehicles = storage.getVehicles();
    console.log('🚗 车辆列表:');
    console.log('='.repeat(80));
    vehicles.forEach(v => {
      const baseInfo = v.getBaseInfo();
      console.log(`  [${v.id}] ${v.plateNumber}`);
      console.log(`    车型: ${VEHICLE_TYPE_NAMES[v.type]} (容量: ${v.capacity}人)`);
      console.log(`    状态: ${v.status}`);
      console.log(`    基地: ${v.baseLocation} (${baseInfo.terminal})`);
      if (v.features.length > 0) {
        console.log(`    配置: ${v.features.join(', ')}`);
      }
      console.log('');
    });
  } else if (type === 'drivers') {
    const drivers = storage.getDrivers();
    console.log('👨‍✈️ 司机列表:');
    console.log('='.repeat(80));
    drivers.forEach(d => {
      console.log(`  [${d.id}] ${d.name}`);
      console.log(`    状态: ${d.status}, 评分: ${d.rating}, 经验: ${d.experienceYears}年`);
      if (d.vehicleId) {
        console.log(`    分配车辆: ${d.vehicleId}`);
      }
      console.log('');
    });
  } else if (type === 'dispatches') {
    const dispatches = storage.getDispatches();
    console.log('📦 调派记录:');
    console.log('='.repeat(80));
    dispatches.forEach(d => {
      const flight = storage.getFlightById(d.flightId);
      const vehicle = storage.getVehicleById(d.vehicleId);
      const driver = storage.getDriverById(d.driverId);
      
      console.log(`  [${d.id}] 状态: ${d.status}`);
      console.log(`    航班: ${flight ? flight.flightNumber : d.flightId}`);
      console.log(`    车辆: ${vehicle ? `${vehicle.plateNumber} (${VEHICLE_TYPE_NAMES[vehicle.type]})` : d.vehicleId}`);
      console.log(`    司机: ${driver ? driver.name : d.driverId}`);
      console.log(`    接驾时间: ${d.pickupTime ? d.pickupTime.toLocaleString() : '未设置'}`);
      if (d.conflicts.length > 0) {
        console.log(`    ⚠️  冲突: ${d.conflicts.length} 个`);
      }
      if (d.notifications.length > 0) {
        console.log(`    📢 通知: ${d.notifications.length} 条`);
      }
      console.log('');
    });
  }

  return { success: true };
}

async function dispatchCommand(args) {
  const flightId = args[0];
  
  if (!flightId) {
    console.log('用法: node src/index.js dispatch <航班ID>');
    console.log('例: node src/index.js dispatch FLIGHT-001');
    return { success: false };
  }

  const flight = storage.getFlightById(flightId);
  if (!flight) {
    throw new Error(`航班不存在: ${flightId}`);
  }

  console.log('🎯 开始调派...');
  console.log(`  航班: ${flight.flightNumber} (${flight.passengerName})`);
  console.log(`  登机口: ${flight.gate}`);
  if (flight.vehiclePreference) {
    console.log(`  车型偏好: ${VEHICLE_TYPE_NAMES[flight.vehiclePreference]}`);
  }
  if (flight.delayMinutes > 0) {
    console.log(`  延误: ${flight.delayMinutes} 分钟`);
  }
  console.log('');

  const matchResult = dispatchEngine.findBestMatch(flightId);

  if (!matchResult.success) {
    console.log('❌ 调派失败');
    console.log('  原因:', matchResult.error);
    if (matchResult.conflicts) {
      console.log('  冲突详情:');
      matchResult.conflicts.forEach(c => console.log(`    - ${c.type}: ${c.message}`));
    }
    return { success: false, matchResult };
  }

  console.log('✅ 找到最佳匹配:');
  console.log('');
  console.log('  【评分详情】');
  matchResult.scoreDetails.forEach(detail => {
    const sign = detail.points >= 0 ? '+' : '';
    console.log(`    ${detail.factor}: ${sign}${detail.points}`);
  });
  console.log(`    总分: ${matchResult.score}`);
  console.log('');

  const vehicle = matchResult.vehicle;
  const driver = matchResult.driver;
  const gateInfo = flight.getGateInfo();
  const vehicleBase = vehicle.getBaseInfo();

  console.log('  【车辆信息】');
  console.log(`    车牌号: ${vehicle.plateNumber}`);
  console.log(`    车型: ${VEHICLE_TYPE_NAMES[vehicle.type]}`);
  console.log(`    基地: ${vehicleBase.terminal}`);
  console.log(`    到登机口距离: ${gateInfo ? gateInfo.distance : '未知'} 单位`);
  console.log('');

  console.log('  【司机信息】');
  console.log(`    姓名: ${driver.name}`);
  console.log(`    评分: ${driver.rating}`);
  console.log(`    经验: ${driver.experienceYears} 年`);
  console.log('');

  console.log('  【调派时间】');
  console.log(`    接驾时间: ${matchResult.pickupTime.toLocaleString()}`);
  console.log(`    航班起飞: ${flight.getEffectiveDepartureTime().toLocaleString()}`);
  console.log('');

  if (matchResult.conflicts && matchResult.conflicts.length > 0) {
    console.log('  ⚠️  调派警告:');
    matchResult.conflicts.forEach(c => {
      console.log(`    - ${c.message}`);
    });
    console.log('');
  }

  const dispatch = dispatchEngine.createDispatch(matchResult);
  
  console.log('✅ 调派已创建');
  console.log(`  调派ID: ${dispatch.id}`);

  return { success: true, dispatch, matchResult };
}

async function delayCommand(args) {
  if (args.length < 2) {
    console.log('用法: node src/index.js delay <航班ID> <延误分钟数> [原因]');
    console.log('例: node src/index.js delay FLIGHT-001 45 天气原因');
    return { success: false };
  }

  const flightId = args[0];
  const delayMinutes = parseInt(args[1], 10);
  const reason = args.slice(2).join(' ') || '未说明原因';

  if (isNaN(delayMinutes) || delayMinutes < 0) {
    throw new Error('延误分钟数必须是非负整数');
  }

  console.log('⏰ 处理航班延误...');
  console.log(`  航班ID: ${flightId}`);
  console.log(`  新延误: ${delayMinutes} 分钟`);
  console.log(`  原因: ${reason}`);
  console.log('');

  const result = dispatchEngine.recalculateDueToDelay(flightId, delayMinutes, reason);

  console.log('✅ 延误已更新');
  console.log(`  航班: ${result.flight.flightNumber}`);
  console.log(`  延误变化: ${result.delayUpdate.oldDelayMinutes} → ${result.delayUpdate.newDelayMinutes} 分钟`);
  console.log(`  调整量: ${result.delayUpdate.delayChange > 0 ? '+' : ''}${result.delayUpdate.delayChange} 分钟`);
  console.log('');

  if (result.affectedDispatches.length > 0) {
    console.log('📢 已通知的调派:');
    result.affectedDispatches.forEach(d => {
      console.log(`  - ${d.dispatchId}`);
      console.log(`    接驾时间调整: ${Math.round(d.timeAdjustmentMinutes)} 分钟`);
      console.log(`    已发送通知: ${d.notificationsSent} 条`);
    });
  } else {
    console.log('ℹ️  没有活跃的调派需要更新');
  }

  return { success: true, result };
}

async function checkCommand(args) {
  console.log('🔍 检查调派冲突...');
  console.log('');

  const result = dispatchEngine.checkConflicts();

  if (result.count === 0) {
    console.log('✅ 没有检测到冲突');
    return { success: true, result };
  }

  console.log('⚠️  发现冲突:');
  console.log(`  车辆冲突: ${result.byType.vehicle} 个`);
  console.log(`  司机冲突: ${result.byType.driver} 个`);
  console.log('');

  result.conflicts.forEach((c, index) => {
    console.log(`  [${index + 1}] ${c.type} (${c.severity})`);
    console.log(`      ${c.message}`);
    console.log(`      建议: ${c.resolution}`);
    console.log(`      调派1: ${c.dispatch1}`);
    console.log(`      调派2: ${c.dispatch2}`);
    if (c.vehicleId) console.log(`      车辆: ${c.vehicleId}`);
    if (c.driverId) console.log(`      司机: ${c.driverId}`);
    console.log('');
  });

  return { success: true, result };
}

async function runCommand(args) {
  console.log('🏃 执行完整调派流程...');
  console.log('='.repeat(60));
  console.log('');

  const flights = storage.getFlights();
  
  if (flights.length === 0) {
    console.log('ℹ️  没有航班数据，请先运行 "node src/index.js init" 或导入数据');
    return { success: false };
  }

  const results = [];

  for (const flight of flights) {
    console.log(`处理航班: ${flight.flightNumber} (${flight.passengerName})`);
    console.log('-'.repeat(40));
    
    try {
      const matchResult = dispatchEngine.findBestMatch(flight.id);
      
      if (matchResult.success) {
        const dispatch = dispatchEngine.createDispatch(matchResult);
        results.push({
          flight: flight.id,
          success: true,
          dispatchId: dispatch.id,
          score: matchResult.score
        });
        console.log(`  ✅ 调派成功: ${dispatch.id} (评分: ${matchResult.score})`);
      } else {
        results.push({
          flight: flight.id,
          success: false,
          error: matchResult.error
        });
        console.log(`  ❌ 调派失败: ${matchResult.error}`);
      }
    } catch (err) {
      results.push({
        flight: flight.id,
        success: false,
        error: err.message
      });
      console.log(`  ❌ 处理出错: ${err.message}`);
    }
    
    console.log('');
  }

  const conflictResult = dispatchEngine.checkConflicts();
  
  console.log('='.repeat(60));
  console.log('📊 流程执行结果:');
  console.log(`  总航班数: ${flights.length}`);
  console.log(`  成功调派: ${results.filter(r => r.success).length}`);
  console.log(`  失败调派: ${results.filter(r => !r.success).length}`);
  console.log(`  冲突检测: ${conflictResult.count} 个冲突`);

  return { success: true, results, conflictResult };
}

async function historyCommand(args) {
  const limit = args[0] ? parseInt(args[0], 10) : 10;
  
  const dispatches = storage.getDispatches();
  const sorted = [...dispatches].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recent = sorted.slice(0, limit);

  console.log(`📜 调派历史 (最近 ${recent.length} 条):`);
  console.log('='.repeat(80));

  if (recent.length === 0) {
    console.log('  暂无调派记录');
    return { success: true };
  }

  for (let i = 0; i < recent.length; i++) {
    const d = recent[i];
    const flight = storage.getFlightById(d.flightId);
    const vehicle = storage.getVehicleById(d.vehicleId);
    const driver = storage.getDriverById(d.driverId);

    console.log(`\n  [${i + 1}] ${d.id}`);
    console.log(`      状态: ${d.status}`);
    console.log(`      航班: ${flight ? flight.flightNumber : d.flightId}`);
    console.log(`      车辆: ${vehicle ? vehicle.plateNumber : d.vehicleId}`);
    console.log(`      司机: ${driver ? driver.name : d.driverId}`);
    console.log(`      创建时间: ${d.createdAt.toLocaleString()}`);
    
    if (d.conflicts.length > 0) {
      console.log(`      冲突:`);
      d.conflicts.forEach(c => console.log(`        - ${c.type}: ${c.message}`));
    }
    
    if (d.notifications.length > 0) {
      console.log(`      通知 (${d.notifications.length} 条):`);
      d.notifications.slice(0, 3).forEach(n => {
        console.log(`        - ${n.type}: ${n.message.substring(0, 50)}...`);
      });
    }
  }

  return { success: true, dispatches: recent };
}

async function exportCommand(args) {
  const format = args[0] || 'json';
  const filename = args[1] || `report-${Date.now()}.${format}`;
  const filePath = path.join(REPORTS_DIR, filename);

  console.log('📄 生成报告...');

  const report = dispatchEngine.generateReport(format);

  if (format === 'json') {
    fs.writeFileSync(filePath, report, 'utf8');
  } else {
    fs.writeFileSync(filePath, report, 'utf8');
  }

  console.log('✅ 报告已生成');
  console.log(`  路径: ${filePath}`);
  console.log('');
  
  if (format === 'text') {
    console.log(report);
  }

  return { success: true, filePath, format };
}

async function statusCommand(args) {
  const report = JSON.parse(dispatchEngine.generateReport('json'));

  console.log('📊 系统状态');
  console.log('='.repeat(40));
  console.log(`航班: ${report.summary.totalFlights} (延误: ${report.summary.delayedFlights})`);
  console.log(`车辆: ${report.summary.totalVehicles} (可用: ${report.summary.availableVehicles})`);
  console.log(`司机: ${report.summary.totalDrivers} (可用: ${report.summary.availableDrivers})`);
  console.log(`调派: ${report.summary.totalDispatches} (待处理: ${report.summary.pendingDispatches})`);
  console.log(`冲突: ${report.summary.conflicts}`);
  console.log('');

  if (report.delayAnalysis.count > 0) {
    console.log('⏰ 延误概况:');
    console.log(`  平均延误: ${report.delayAnalysis.averageDelay} 分钟`);
    console.log(`  最大延误: ${report.delayAnalysis.maxDelay} 分钟`);
  }

  return { success: true, status: report.summary };
}

const dispatchCommands = {
  init: initCommand,
  import: importCommand,
  list: listCommand,
  dispatch: dispatchCommand,
  delay: delayCommand,
  check: checkCommand,
  run: runCommand,
  history: historyCommand,
  export: exportCommand,
  status: statusCommand
};

module.exports = { dispatchCommands };
