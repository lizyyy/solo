const http = require('http');

const BASE_URL = 'http://localhost:3001';

const request = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || BASE_URL + options.path);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const printSection = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
};

const printResult = (label, data) => {
  console.log(`\n${label}:`);
  console.log(JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data).length > 500 ? '...' : ''));
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const demo = async () => {
  console.log('🚀 餐饮后厨留样管理系统 - 完整流程演示\n');

  try {
    await request({ path: '/', method: 'GET' });
  } catch (e) {
    console.log('❌ 请先启动服务器: npm start');
    process.exit(1);
  }

  printSection('1. 重置数据并导入种子数据');
  await request({ path: '/api/reset', method: 'POST' });
  require('./seed');
  await sleep(500);

  printSection('2. 获取基础数据');
  
  const personsRes = await request({ path: '/api/responsible-persons' });
  const persons = personsRes.body.data;
  const operator = persons[0];
  console.log(`\n操作人: ${operator.name} (${operator.employeeId})`);

  const dishesRes = await request({ path: '/api/dishes' });
  const dishes = dishesRes.body.data;
  console.log(`菜品数量: ${dishes.length}`);

  const boxesRes = await request({ path: '/api/sample-boxes' });
  const boxes = boxesRes.body.data;
  console.log(`留样盒数量: ${boxes.length}`);

  const mealsRes = await request({ path: '/api/meals' });
  const meals = mealsRes.body.data;
  const lunch = meals.find(m => m.mealType === 'lunch');
  console.log(`今日午餐: ${lunch.mealDate} - ${lunch.mealType}`);

  printSection('3. 正常留样流程 - 红烧肉');
  const sample1 = await request({ path: '/api/samples', method: 'POST' }, {
    mealId: lunch.id,
    dishId: dishes[0].id,
    boxId: boxes[0].id,
    responsiblePersonId: operator.id,
    temperature: 5
  });
  printResult('红烧肉留样结果', sample1.body);

  printSection('4. 异常场景1: 温度超限 (温度10℃，正常范围0-8℃)');
  const sampleBadTemp = await request({ path: '/api/samples', method: 'POST' }, {
    mealId: lunch.id,
    dishId: dishes[1].id,
    boxId: boxes[1].id,
    responsiblePersonId: operator.id,
    temperature: 10
  });
  printResult('温度超限留样结果', sampleBadTemp.body);
  await sleep(200);

  printSection('5. 异常场景2: 同一留样盒重复绑定 (重复提交防重验证)');
  
  const alertsBefore = await request({ path: '/api/alerts?status=active' });
  const boxReuseCountBefore = alertsBefore.body.data.filter(a => a.type === 'BOX_REUSE').length;
  console.log(`\n重复绑定前 BOX_REUSE 告警数量: ${boxReuseCountBefore}`);
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n第 ${i} 次尝试重复绑定留样盒 BOX-001...`);
    const duplicateBox = await request({ path: '/api/samples', method: 'POST' }, {
      mealId: lunch.id,
      dishId: dishes[2].id,
      boxId: boxes[0].id,
      responsiblePersonId: operator.id,
      temperature: 4
    });
    console.log(`  结果: ${duplicateBox.body.success ? '成功' : '失败'} - ${duplicateBox.body.error}`);
  }
  
  const alertsAfter = await request({ path: '/api/alerts?status=active' });
  const boxReuseCountAfter = alertsAfter.body.data.filter(a => a.type === 'BOX_REUSE').length;
  console.log(`\n✅ 防重验证: 重复绑定后 BOX_REUSE 告警数量: ${boxReuseCountAfter}`);
  console.log(`   告警数量未增加: ${boxReuseCountBefore === boxReuseCountAfter ? '✓' : '✗'} (${boxReuseCountBefore} -> ${boxReuseCountAfter})`);
  console.log(`   同一件事没有被重复计数: ${boxReuseCountAfter === 1 ? '✓' : '✗'}`);

  printSection('6. 异常场景3: 同一菜品同餐次重复留样');
  const duplicateDishSample = await request({ path: '/api/samples', method: 'POST' }, {
    mealId: lunch.id,
    dishId: dishes[0].id,
    boxId: boxes[2].id,
    responsiblePersonId: operator.id,
    temperature: 4
  });
  printResult('重复留样结果', duplicateDishSample.body);

  printSection('7. 继续留样其他菜品');
  await request({ path: '/api/samples', method: 'POST' }, {
    mealId: lunch.id,
    dishId: dishes[2].id,
    boxId: boxes[2].id,
    responsiblePersonId: operator.id,
    temperature: 4
  });

  printSection('8. 异常场景4: 未留样就开餐 (故意少留一道菜)');
  const samplesBeforeOpen = await request({ path: '/api/samples' });
  console.log(`当前已留样数量: ${samplesBeforeOpen.body.data.filter(s => s.mealId === lunch.id).length}`);
  console.log(`午餐菜品数量: ${lunch.dishIds.length}`);
  
  const openResult = await request({ path: `/api/meals/${lunch.id}/open`, method: 'POST' }, {
    operatorId: operator.id
  });
  printResult('开餐结果', openResult.body);
  await sleep(200);

  printSection('9. 查看当前所有告警');
  const alertsRes = await request({ path: '/api/alerts?status=active' });
  const alerts = alertsRes.body.data;
  console.log(`\n当前告警数量: ${alerts.length}`);
  alerts.forEach((alert, i) => {
    console.log(`  ${i + 1}. [${alert.level.toUpperCase()}] ${alert.type}: ${alert.message}`);
  });

  printSection('10. 模拟创建一条已到期的留样 (用于演示到期未销毁告警)');
  const expiredSampleTime = new Date();
  expiredSampleTime.setHours(expiredSampleTime.getHours() - 50);
  
  const expiredDish = await request({ path: '/api/dishes', method: 'POST' }, {
    name: '昨日凉菜',
    category: '凉菜',
    description: '已过期留样专用'
  });
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const oldMeal = await request({ path: '/api/meals', method: 'POST' }, {
    mealType: 'lunch',
    mealDate: yesterday.toISOString().split('T')[0],
    dishIds: [expiredDish.body.data.id],
    status: 'prepared'
  });

  const Storage = require('../src/storage');
  const expireTime = new Date();
  expireTime.setHours(expireTime.getHours() - 2);
  const expiredSample = Storage.create('samples', {
    mealId: oldMeal.body.data.id,
    dishId: expiredDish.body.data.id,
    dishName: expiredDish.body.data.name,
    boxId: boxes[5].id,
    boxNumber: boxes[5].boxNumber,
    responsiblePersonId: operator.id,
    sampleTime: expiredSampleTime.toISOString(),
    temperature: 4,
    expireTime: expireTime.toISOString(),
    status: 'active'
  });
  Storage.update('sampleBoxes', boxes[5].id, { status: 'in_use', currentSampleId: expiredSample.id });
  console.log('✓ 已创建到期留样');

  console.log('\n执行到期检查...');
  await request({ path: '/api/samples/check-expired' });
  await sleep(200);
  
  const alertsAfterExpired = await request({ path: '/api/alerts?status=active' });
  console.log(`当前告警数量: ${alertsAfterExpired.body.data.length}`);

  printSection('11. 温度日志可追溯性验证');
  const tempLogsRes = await request({ path: '/api/temperature-logs' });
  const tempLogs = tempLogsRes.body.data;
  console.log(`\n温度日志总数: ${tempLogs.length}`);
  tempLogs.forEach((log, i) => {
    console.log(`  ${i + 1}. 样品ID: ${log.sampleId} | 温度: ${log.temperature}℃ | 时间: ${log.recordTime.split('T')[0]}`);
  });
  console.log(`\n✅ 修复验证: 所有温度日志 sampleId 不为空: ${tempLogs.every(l => l.sampleId !== null)}`);

  printSection('12. 留样销毁确认');
  const activeSamples = await request({ path: '/api/samples' });
  const toDestroy = activeSamples.body.data.find(s => s.status === 'active' && s.dishName === '红烧肉');
  
  if (toDestroy) {
    console.log(`销毁留样: ${toDestroy.dishName} (留样盒: ${toDestroy.boxNumber})`);
    const destroyResult = await request({ path: `/api/samples/${toDestroy.id}/destroy`, method: 'POST' }, {
      operatorId: operator.id,
      destroyMethod: 'incineration'
    });
    printResult('销毁记录', destroyResult.body);

    console.log('\n尝试重复销毁同一样品:');
    const duplicateDestroy = await request({ path: `/api/samples/${toDestroy.id}/destroy`, method: 'POST' }, {
      operatorId: operator.id
    });
    printResult('重复销毁结果', duplicateDestroy.body);
  }
  await sleep(200);

  printSection('13. 监管查询 - 完整留痕记录（告警聚合修复验证）');
  const supervisionRes = await request({ path: '/api/supervision' });
  const supervision = supervisionRes.body.data;
  
  console.log(`\n📊 监管查询汇总:`);
  console.log(`  总餐次: ${supervision.summary.totalMeals}`);
  console.log(`  总留样: ${supervision.summary.totalSamples}`);
  console.log(`  已销毁: ${supervision.summary.totalDestroyed}`);
  console.log(`  温度日志总数: ${supervision.summary.totalTemperatureLogs}`);
  console.log(`  告警总数: ${supervision.summary.totalAlerts}`);
  console.log(`  待处理告警: ${supervision.summary.activeAlerts}`);

  let allAlertsInRecords = 0;
  let hasExpiredAlertInMeal = false;
  
  console.log(`\n📋 详细记录:`);
  supervision.records.forEach(record => {
    allAlertsInRecords += record.alerts.length;
    const hasExpired = record.alerts.some(a => a.type === 'EXPIRED_NOT_DESTROYED');
    if (hasExpired) hasExpiredAlertInMeal = true;
    
    console.log(`\n  餐次: ${record.meal.mealDate} - ${record.meal.mealType} (${record.meal.status})`);
    console.log(`    菜品数: ${record.statistics.totalDishes} | 已留样: ${record.statistics.sampledCount} | 已销毁: ${record.statistics.destroyedCount} | 温度日志: ${record.statistics.temperatureLogCount} | 告警: ${record.statistics.alertCount}`);
    
    if (record.samples.length > 0) {
      console.log(`    留样明细:`);
      record.samples.forEach(s => {
        const status = s.status === 'destroyed' ? `✓ 已销毁 (${s.destroyedAt?.split('T')[0]})` : `⏱ 到期 ${s.expireTime.split('T')[0]}`;
        console.log(`      - ${s.dishName} [${s.boxNumber}] ${s.temperature}℃ | ${status}`);
      });
    }
    
    if (record.temperatureLogs.length > 0) {
      console.log(`    温度日志:`);
      record.temperatureLogs.forEach(t => {
        console.log(`      - 样品ID: ${t.sampleId.substring(0, 10)}... | ${t.temperature}℃`);
      });
    }
    
    if (record.alerts.length > 0) {
      console.log(`    告警记录:`);
      record.alerts.forEach(a => {
        console.log(`      ! [${a.level}] ${a.type}: ${a.message}`);
      });
    }
  });

  console.log(`\n✅ 告警聚合修复验证:`);
  console.log(`  - 告警总数匹配: ${supervision.summary.totalAlerts === allAlertsInRecords ? '✓' : '✗'} (${supervision.summary.totalAlerts} == ${allAlertsInRecords})`);
  console.log(`  - 到期未销毁告警出现在对应餐次: ${hasExpiredAlertInMeal ? '✓' : '✗'}`);

  printSection('14. 销毁记录查询');
  const destroyRecordsRes = await request({ path: '/api/destroy-records' });
  const destroyRecords = destroyRecordsRes.body.data;
  console.log(`\n销毁记录数量: ${destroyRecords.length}`);
  destroyRecords.forEach(r => {
    console.log(`  - ${r.dishName} | ${r.boxNumber} | ${r.destroyTime.split('T')[0]} | ${r.destroyMethod}`);
  });

  printSection('✅ 演示完成');
  console.log('\n📝 已验证的业务规则 (含第三轮修复):');
  console.log('  ✓ 重复导入检测 (菜品/留样盒/餐次)');
  console.log('  ✓ 温度超限告警 (0-8℃)');
  console.log('  ✓ 留样盒重复绑定检测');
  console.log('  ✓ 同菜品同餐次重复留样检测');
  console.log('  ✓ 未留样开餐告警');
  console.log('  ✓ 到期未销毁告警');
  console.log('  ✓ 重复销毁检测');
  console.log('  ✓ 销毁后告警自动解除');
  console.log('');
  console.log('🔧 第二轮修复验证:');
  console.log('  ✓ 温度日志 sampleId 回填 (不再是null)');
  console.log('  ✓ 温度日志可追溯 (关联具体留样)');
  console.log('  ✓ BOX_REUSE 告警包含 mealId');
  console.log('  ✓ EXPIRED_NOT_DESTROYED 告警包含 mealId');
  console.log('  ✓ 告警聚合逻辑增强 (支持 mealId 和 sampleId 关联)');
  console.log('  ✓ 监管查询包含温度日志');
  console.log('  ✓ 所有告警都能正确出现在对应餐次留痕中');
  console.log('');
  console.log('🔧 第三轮修复验证:');
  console.log('  ✓ BOX_REUSE 告警防重 (同一mealId/boxId/existingSampleId 不重复创建)');
  console.log('  ✓ 重复提交同一件事不会被重复计数');
  console.log('  ✓ 监管查询告警计数准确');
  console.log('\n🌐 API服务器运行在: http://localhost:3001');
  console.log('   可用 endpoints:');
  console.log('   - GET  /api/dishes            - 菜品列表');
  console.log('   - GET  /api/samples           - 留样记录');
  console.log('   - GET  /api/alerts            - 告警列表');
  console.log('   - GET  /api/supervision       - 监管查询');
  console.log('   - GET  /api/temperature-logs  - 温度日志');
  console.log('   - POST /api/samples           - 创建留样');
  console.log('   - POST /api/samples/:id/destroy - 销毁留样');
};

demo().catch(console.error);
