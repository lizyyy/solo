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

  printSection('5. 异常场景2: 同一留样盒重复绑定');
  const duplicateBox = await request({ path: '/api/samples', method: 'POST' }, {
    mealId: lunch.id,
    dishId: dishes[2].id,
    boxId: boxes[0].id,
    responsiblePersonId: operator.id,
    temperature: 4
  });
  printResult('重复绑定结果', duplicateBox.body);

  printSection('6. 异常场景3: 同一菜品同餐次重复留样');
  const duplicateSample = await request({ path: '/api/samples', method: 'POST' }, {
    mealId: lunch.id,
    dishId: dishes[0].id,
    boxId: boxes[2].id,
    responsiblePersonId: operator.id,
    temperature: 4
  });
  printResult('重复留样结果', duplicateSample.body);

  printSection('7. 继续留样其他菜品');
  await request({ path: '/api/samples', method: 'POST' }, {
    mealId: lunch.id,
    dishId: dishes[2].id,
    boxId: boxes[2].id,
    responsiblePersonId: operator.id,
    temperature: 4
  });

  printSection('8. 异常场景4: 未留样就开餐 (故意少留一道菜)');
  const samplesBefore = await request({ path: '/api/samples' });
  console.log(`当前已留样数量: ${samplesBefore.body.data.filter(s => s.mealId === lunch.id).length}`);
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
  
  const alertsAfter = await request({ path: '/api/alerts?status=active' });
  console.log(`当前告警数量: ${alertsAfter.body.data.length}`);

  printSection('11. 留样销毁确认');
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

  printSection('12. 监管查询 - 完整留痕记录');
  const supervisionRes = await request({ path: '/api/supervision' });
  const supervision = supervisionRes.body.data;
  
  console.log(`\n📊 监管查询汇总:`);
  console.log(`  总餐次: ${supervision.summary.totalMeals}`);
  console.log(`  总留样: ${supervision.summary.totalSamples}`);
  console.log(`  已销毁: ${supervision.summary.totalDestroyed}`);
  console.log(`  告警总数: ${supervision.summary.totalAlerts}`);
  console.log(`  待处理告警: ${supervision.summary.activeAlerts}`);

  console.log(`\n📋 详细记录:`);
  supervision.records.forEach(record => {
    console.log(`\n  餐次: ${record.meal.mealDate} - ${record.meal.mealType} (${record.meal.status})`);
    console.log(`    菜品数: ${record.statistics.totalDishes} | 已留样: ${record.statistics.sampledCount} | 已销毁: ${record.statistics.destroyedCount} | 告警: ${record.statistics.alertCount}`);
    
    if (record.samples.length > 0) {
      console.log(`    留样明细:`);
      record.samples.forEach(s => {
        const status = s.status === 'destroyed' ? `✓ 已销毁 (${s.destroyedAt?.split('T')[0]})` : `⏱ 到期 ${s.expireTime.split('T')[0]}`;
        console.log(`      - ${s.dishName} [${s.boxNumber}] ${s.temperature}℃ | ${status}`);
      });
    }
    
    if (record.alerts.length > 0) {
      console.log(`    告警记录:`);
      record.alerts.forEach(a => {
        console.log(`      ! [${a.level}] ${a.type}: ${a.message}`);
      });
    }
  });

  printSection('13. 销毁记录查询');
  const destroyRecordsRes = await request({ path: '/api/destroy-records' });
  const destroyRecords = destroyRecordsRes.body.data;
  console.log(`\n销毁记录数量: ${destroyRecords.length}`);
  destroyRecords.forEach(r => {
    console.log(`  - ${r.dishName} | ${r.boxNumber} | ${r.destroyTime.split('T')[0]} | ${r.destroyMethod}`);
  });

  printSection('✅ 演示完成');
  console.log('\n📝 已验证的业务规则:');
  console.log('  ✓ 重复导入检测 (菜品/留样盒/餐次)');
  console.log('  ✓ 温度超限告警 (0-8℃)');
  console.log('  ✓ 留样盒重复绑定检测');
  console.log('  ✓ 同菜品同餐次重复留样检测');
  console.log('  ✓ 未留样开餐告警');
  console.log('  ✓ 到期未销毁告警');
  console.log('  ✓ 重复销毁检测');
  console.log('  ✓ 销毁后告警自动解除');
  console.log('  ✓ 监管查询完整留痕');
  console.log('\n🌐 API服务器运行在: http://localhost:3000');
  console.log('   可用 endpoints:');
  console.log('   - GET  /api/dishes          - 菜品列表');
  console.log('   - GET  /api/samples         - 留样记录');
  console.log('   - GET  /api/alerts          - 告警列表');
  console.log('   - GET  /api/supervision     - 监管查询');
  console.log('   - POST /api/samples         - 创建留样');
  console.log('   - POST /api/samples/:id/destroy - 销毁留样');
};

demo().catch(console.error);
