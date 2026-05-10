const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'water-management.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

Object.keys(require.cache).forEach(key => {
  if (key.includes('water-management') || key.includes('/src/')) {
    delete require.cache[key];
  }
});

const printSection = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
};

const printResult = (label, data) => {
  console.log(`\n${label}:`);
  console.log(JSON.stringify(data, null, 2));
};

const demo = async () => {
  const dbModule = require('../src/db');
  await dbModule.initDB();

  const waterTankService = require('../src/services/waterTankService');
  const stayService = require('../src/services/stayService');
  const waterUsageService = require('../src/services/waterUsageService');
  const { getAllHistory, getHistoryByEntity } = require('../src/utils/history');

  printSection('【最短演示路径 - 海岛民宿淡水配额管理】');
  console.log('\n场景描述：');
  console.log('1. 查看初始水箱状态');
  console.log('2. 办理客人入住（A101房，3人）');
  console.log('3. 记录洗衣用水（2次）');
  console.log('4. 记录泳池补水');
  console.log('5. 调整入住人数（3人→4人）');
  console.log('6. 查看用水记录历史');
  console.log('7. 办理退房');
  console.log('8. 查看最终水箱状态和完整历史');

  let stayId;
  let laundryUsageId;
  let poolUsageId;

  try {
    printSection('步骤 1: 查看初始水箱状态');
    let tankStatus = waterTankService.getTankStatus();
    printResult('水箱初始状态', tankStatus);

    printSection('步骤 2: 办理入住 - A101房 3位客人');
    console.log('\n入住规则：每人基本配额 50L，3人共占用 150L');
    const checkInResult = stayService.checkIn('A101', 3, null, '前台-小张');
    stayId = checkInResult.stay.id;
    printResult('入住结果', checkInResult);

    tankStatus = waterTankService.getTankStatus();
    printResult('入住后水箱状态', tankStatus);

    printSection('步骤 3: 记录洗衣用水 - 2次');
    console.log('\n洗衣规则：每次 30L，2次共 60L');
    const laundryResult = waterUsageService.recordLaundryUsage(stayId, 2, '清洁员-小李');
    laundryUsageId = laundryResult.usage.id;
    printResult('洗衣用水记录', laundryResult);

    tankStatus = waterTankService.getTankStatus();
    printResult('洗衣后水箱状态', tankStatus);

    printSection('步骤 4: 记录泳池补水 - 500L');
    const poolResult = waterUsageService.recordPoolRefill(500, '泳池日常补水', '泳池管理员-小王');
    poolUsageId = poolResult.usage.id;
    printResult('泳池补水记录', poolResult);

    tankStatus = waterTankService.getTankStatus();
    printResult('泳池补水后水箱状态', tankStatus);

    printSection('步骤 5: 调整入住人数 - 3人→4人');
    console.log('\n规则：增加1人需要额外增加 50L 配额');
    const updateResult = stayService.updateStay(stayId, { guest_count: 4 }, '前台-小张');
    printResult('更新入住结果', updateResult);

    tankStatus = waterTankService.getTankStatus();
    printResult('调整后水箱状态', tankStatus);

    printSection('步骤 6: 查看入住记录历史（可看到前后变化）');
    const stayHistory = getHistoryByEntity('room_stay', stayId);
    console.log('\n历史记录包含：创建入住、更新入住人数');
    console.log('每条记录显示 before_state 和 after_state');
    printResult('入住历史记录', stayHistory);

    printSection('步骤 7: 查看洗衣用水记录历史');
    const usageHistory = getHistoryByEntity('water_usage', laundryUsageId);
    printResult('洗衣用水历史', usageHistory);

    printSection('步骤 8: 办理退房');
    const checkOutResult = stayService.checkOut(stayId, null, '前台-小张');
    printResult('退房结果', checkOutResult);

    printSection('步骤 9: 查看最终水箱状态');
    tankStatus = waterTankService.getTankStatus();
    printResult('最终水箱状态', tankStatus);

    printSection('步骤 10: 查看完整操作历史');
    const allHistory = getAllHistory();
    console.log('\n完整历史记录数:', allHistory.length);
    printResult('完整历史（最后5条）', allHistory.slice(-5));

    printSection('演示总结');
    console.log('\n初始水量: 5000L');
    console.log('- 入住3人: -150L → 4850L');
    console.log('- 洗衣2次: -60L → 4790L');
    console.log('- 泳池补水: -500L → 4290L');
    console.log('- 增加1人: -50L → 4240L');
    console.log(`\n最终剩余: ${tankStatus.current_level}L`);
    console.log(`剩余百分比: ${tankStatus.percentage_remaining.toFixed(1)}%`);
    console.log('\n所有操作已记录到历史表，可通过 /api/history 查看');

  } catch (error) {
    console.error('\n❌ 演示过程中出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

demo();
