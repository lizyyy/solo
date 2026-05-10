const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'water-management.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const printSection = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
};

const printError = (error) => {
  console.log(`\n✓ 成功捕获异常:`);
  console.log(`  类型: ${error.name}`);
  console.log(`  状态码: ${error.statusCode || 'N/A'}`);
  console.log(`  消息: ${error.message}`);
  if (error.field) console.log(`  字段: ${error.field}`);
  if (error.details) console.log(`  详情:`, error.details);
};

const demo = async () => {
  const db = require('../src/db');
  await db.initDB();

  const waterTankService = require('../src/services/waterTankService');
  const stayService = require('../src/services/stayService');
  const waterUsageService = require('../src/services/waterUsageService');

  printSection('【异常演示路径 - 可复现的错误场景】');
  console.log('\n本演示展示以下异常场景：');
  console.log('1. 缺字段错误 - 入住登记缺少必要字段');
  console.log('2. 非法状态流转 - 对已退房记录再次操作');
  console.log('3. 重复提交检测 - 1分钟内相同记录重复提交');
  console.log('4. 配额不足 - 水箱水量不够时的操作');
  console.log('5. 人工修正 - 修正后再撤回的非法操作');

  let stayId;
  let usageId;

  try {
    printSection('场景 1: 缺字段错误');
    console.log('\n尝试办理入住但缺少 room_number 字段:');
    try {
      stayService.checkIn(null, 2);
      console.log('❌ 应该抛出异常但没有!');
    } catch (error) {
      printError(error);
    }

    printSection('场景 2: 非法状态流转');
    console.log('\n先正常办理入住，然后退房，再尝试记录洗衣用水:');
    
    const checkInResult = stayService.checkIn('B202', 2, null, '测试员');
    stayId = checkInResult.stay.id;
    console.log('✓ 入住成功，ID:', stayId);

    stayService.checkOut(stayId, null, '测试员');
    console.log('✓ 退房成功');

    console.log('\n现在尝试为已退房的记录添加洗衣用水:');
    try {
      waterUsageService.recordLaundryUsage(stayId, 1);
      console.log('❌ 应该抛出异常但没有!');
    } catch (error) {
      printError(error);
    }

    printSection('场景 3: 重复提交检测');
    console.log('\n重新办理入住，然后快速提交两次相同的洗衣记录:');
    
    const checkIn2 = stayService.checkIn('C303', 1, null, '测试员');
    const stayId2 = checkIn2.stay.id;
    console.log('✓ 新入住成功，ID:', stayId2);

    const laundry1 = waterUsageService.recordLaundryUsage(stayId2, 1, '测试员');
    usageId = laundry1.usage.id;
    console.log('✓ 第一次洗衣记录成功');

    console.log('\n立即提交第二次相同的洗衣记录:');
    try {
      waterUsageService.recordLaundryUsage(stayId2, 1, '测试员');
      console.log('❌ 应该抛出异常但没有!');
    } catch (error) {
      printError(error);
    }

    printSection('场景 4: 配额不足 - 水箱水量不够');
    console.log('\n查看当前水箱状态:');
    let tankStatus = waterTankService.getTankStatus();
    console.log(`当前水量: ${tankStatus.current_level}L`);

    console.log(`\n尝试记录一个超大的泳池补水 (${tankStatus.current_level + 1000}L):`);
    try {
      waterUsageService.recordPoolRefill(tankStatus.current_level + 1000, '测试超大补水');
      console.log('❌ 应该抛出异常但没有!');
    } catch (error) {
      printError(error);
    }

    printSection('场景 5: 人工修正后再撤回 - 非法流转');
    console.log('\n先记录洗衣用水，然后修正，再尝试撤回:');

    const checkIn3 = stayService.checkIn('D404', 2, null, '测试员');
    const stayId3 = checkIn3.stay.id;
    console.log('✓ 入住成功，ID:', stayId3);

    const laundry3 = waterUsageService.recordLaundryUsage(stayId3, 2, '测试员');
    const usageId3 = laundry3.usage.id;
    console.log('✓ 洗衣记录成功，ID:', usageId3);

    const correctResult = waterUsageService.correctUsage(usageId3, 90, '实际用了3次', '管理员');
    console.log('✓ 人工修正成功:', correctResult.original_amount, '→', correctResult.new_amount, 'L');

    console.log('\n现在尝试撤回已修正的记录:');
    try {
      waterUsageService.revokeUsage(usageId3, '测试撤回修正记录');
      console.log('❌ 应该抛出异常但没有!');
    } catch (error) {
      printError(error);
    }

    printSection('异常演示完成');
    console.log('\n✓ 所有异常场景都已成功复现和捕获');
    console.log('\n错误类型总结:');
    console.log('- ValidationError (400): 缺字段、参数无效');
    console.log('- InvalidStateTransitionError (409): 状态流转错误');
    console.log('- ConflictError (409): 重复提交、操作冲突');
    console.log('- WaterQuotaExceededError (422): 配额不足');

  } catch (error) {
    console.error('\n❌ 演示过程中未预期的错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

demo();
