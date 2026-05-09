const { v4: uuidv4 } = require('uuid');
const { initTables } = require('../src/config/database');
const {
  createActivity,
  getActivityById,
  advanceActivityStatus,
  updateActivity,
  ACTIVITY_STATUS
} = require('../src/services/activityService');

const {
  createBatch,
  createSampleArchive,
  getSampleById,
  advanceSampleStatus,
  destroySample,
  retainSampleForInvestigation,
  updateSampleArchive,
  withdrawSampleArchive,
  SAMPLE_STATUS
} = require('../src/services/batchService');

const {
  createComplaint,
  advanceComplaintStatus,
  updateComplaint,
  COMPLAINT_STATUS
} = require('../src/services/complaintService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logStep = (step, title, description) => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`【异常场景 ${step}】${title}`);
  console.log(`    场景描述: ${description}`);
  console.log(`${'═'.repeat(60)}`);
};

const logError = (result) => {
  console.log(`\n❌ 操作结果:`);
  console.log(`   成功: ${result.success}`);
  console.log(`   错误码: ${result.code || '-'}`);
  console.log(`   错误信息: ${result.error || '-'}`);
};

const logSuccess = (message, data = null) => {
  console.log(`\n✅ ${message}`);
  if (data) {
    console.log(`   详细: ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
  }
};

const demoErrorCases = async () => {
  console.log('\n' + '⚠'.repeat(60));
  console.log('⚠  门店试吃样品留样 API - 异常操作演示');
  console.log('⚠  场景：演示各种错误操作，验证系统的保护性校验');
  console.log('⚠'.repeat(60));

  await initTables();
  await sleep(200);

  const operator = 'error-demo';

  logStep('1', '状态流转跳级', '直接从草稿(DRAFT)跳到完成(COMPLETED)，跳过中间状态');

  const activity1 = await createActivity({
    storeId: 'STORE-ERR-001',
    storeName: '异常测试门店1',
    activityName: '跳级状态测试活动',
    activityDate: '2026-05-10',
    productName: '测试产品'
  }, uuidv4(), operator);

  console.log(`\n活动当前状态: ${activity1.data.status} (DRAFT)`);
  console.log('尝试直接推进到 COMPLETED...');

  const badAdvance = await advanceActivityStatus(
    activity1.data.id,
    ACTIVITY_STATUS.COMPLETED,
    uuidv4(),
    operator
  );
  logError(badAdvance);

  logStep('2', '状态流转回退', '从已完成(COMPLETED)尝试回退到进行中(IN_PROGRESS)');

  const activity2 = await createActivity({
    storeId: 'STORE-ERR-002',
    storeName: '异常测试门店2',
    activityName: '回退状态测试活动',
    activityDate: '2026-05-10',
    productName: '测试产品'
  }, uuidv4(), operator);

  await advanceActivityStatus(activity2.data.id, ACTIVITY_STATUS.PLANNED, uuidv4(), operator);
  await advanceActivityStatus(activity2.data.id, ACTIVITY_STATUS.IN_PROGRESS, uuidv4(), operator);
  await advanceActivityStatus(activity2.data.id, ACTIVITY_STATUS.COMPLETED, uuidv4(), operator);

  const currentStatus = await getActivityById(activity2.data.id);
  console.log(`\n活动当前状态: ${currentStatus.status} (COMPLETED)`);
  console.log('尝试回退到 IN_PROGRESS...');

  const badRollback = await advanceActivityStatus(
    activity2.data.id,
    ACTIVITY_STATUS.IN_PROGRESS,
    uuidv4(),
    operator
  );
  logError(badRollback);

  logStep('3', '修改已完成的活动', '尝试修改状态为 COMPLETED 的活动信息');

  console.log(`\n活动状态: COMPLETED`);
  console.log('尝试修改活动名称...');

  const badUpdate = await updateActivity(
    activity2.data.id,
    { activityName: '被恶意修改的名称' },
    uuidv4(),
    operator
  );
  logError(badUpdate);

  logStep('4', '留样数量超过批次总量', '尝试留样数量大于批次总数量');

  const activity3 = await createActivity({
    storeId: 'STORE-ERR-003',
    storeName: '异常测试门店3',
    activityName: '数量超限测试活动',
    activityDate: '2026-05-10',
    productName: '测试产品'
  }, uuidv4(), operator);

  const batch1 = await createBatch(activity3.data.id, {
    batchNumber: 'BATCH-ERR-001',
    productionDate: '2026-04-20',
    expirationDate: '2026-07-20',
    quantity: 100
  }, uuidv4(), operator);

  console.log(`\n批次总量: 100`);
  console.log('尝试留样 150 份...');

  const badQuantity = await createSampleArchive({
    activityId: activity3.data.id,
    batchId: batch1.data.id,
    sampleQuantity: 150,
    storageLocation: '测试柜',
    archiveDate: '2026-05-10'
  }, uuidv4(), operator);
  logError(badQuantity);

  logStep('5', '批次与活动不匹配', '使用不属于该活动的批次进行留样');

  const activity4 = await createActivity({
    storeId: 'STORE-ERR-004',
    storeName: '异常测试门店4',
    activityName: '批次不匹配测试活动',
    activityDate: '2026-05-10',
    productName: '测试产品'
  }, uuidv4(), operator);

  console.log(`\n活动A ID: ${activity3.data.id}`);
  console.log(`活动B ID: ${activity4.data.id}`);
  console.log(`批次属于活动A，尝试在活动B中使用该批次...`);

  const badBatchMatch = await createSampleArchive({
    activityId: activity4.data.id,
    batchId: batch1.data.id,
    sampleQuantity: 10,
    storageLocation: '测试柜',
    archiveDate: '2026-05-10'
  }, uuidv4(), operator);
  logError(badBatchMatch);

  logStep('6', '重复销毁留样', '已销毁的留样再次执行销毁操作');

  const activity5 = await createActivity({
    storeId: 'STORE-ERR-005',
    storeName: '异常测试门店5',
    activityName: '重复销毁测试活动',
    activityDate: '2026-05-01',
    productName: '测试产品'
  }, uuidv4(), operator);

  const batch2 = await createBatch(activity5.data.id, {
    batchNumber: 'BATCH-ERR-002',
    productionDate: '2026-04-20',
    expirationDate: '2026-07-20',
    quantity: 100
  }, uuidv4(), operator);

  const sample1 = await createSampleArchive({
    activityId: activity5.data.id,
    batchId: batch2.data.id,
    sampleQuantity: 5,
    storageLocation: '测试柜',
    archiveDate: '2026-05-01',
    shelfLifeDays: 1
  }, uuidv4(), operator);

  await destroySample(sample1.data.id, uuidv4(), operator);

  console.log(`\n留样当前状态: DESTROYED`);
  console.log('尝试再次销毁...');

  const badDestroy = await destroySample(sample1.data.id, uuidv4(), operator);
  logError(badDestroy);

  logStep('7', '修改已销毁的留样', '尝试修改已销毁留样的存储位置');

  console.log(`\n留样状态: DESTROYED`);
  console.log('尝试修改存储位置...');

  const badUpdateSample = await updateSampleArchive(
    sample1.data.id,
    { storageLocation: '新位置' },
    uuidv4(),
    operator
  );
  logError(badUpdateSample);

  logStep('8', '撤回已销毁的留样', '尝试撤回（删除）已销毁的留样记录');

  console.log(`\n留样状态: DESTROYED`);
  console.log('尝试撤回留样...');

  const badWithdraw = await withdrawSampleArchive(
    sample1.data.id,
    uuidv4(),
    operator,
    '尝试撤回已销毁留样'
  );
  logError(badWithdraw);

  logStep('9', '撤回非已留样状态的记录', '留样已被留存调查，尝试撤回');

  const sample2 = await createSampleArchive({
    activityId: activity5.data.id,
    batchId: batch2.data.id,
    sampleQuantity: 3,
    storageLocation: '测试柜2',
    archiveDate: '2026-05-01'
  }, uuidv4(), operator);

  await retainSampleForInvestigation(sample2.data.id, uuidv4(), operator, '测试留存');

  console.log(`\n留样当前状态: RETAINED_FOR_INVESTIGATION`);
  console.log('尝试撤回留样...');

  const badWithdrawRetained = await withdrawSampleArchive(
    sample2.data.id,
    uuidv4(),
    operator,
    '尝试撤回留存中的留样'
  );
  logError(badWithdrawRetained);

  logStep('10', '修改已关闭的投诉', '尝试修改状态为 CLOSED 的投诉内容');

  const activity6 = await createActivity({
    storeId: 'STORE-ERR-006',
    storeName: '异常测试门店6',
    activityName: '投诉修改测试活动',
    activityDate: '2026-05-10',
    productName: '测试产品'
  }, uuidv4(), operator);

  const complaint1 = await createComplaint({
    activityId: activity6.data.id,
    complaintType: '食品质量',
    complaintDate: '2026-05-10',
    complaintContent: '测试投诉内容',
    complainant: '测试用户'
  }, uuidv4(), operator);

  await advanceComplaintStatus(complaint1.data.id, COMPLAINT_STATUS.UNDER_INVESTIGATION, uuidv4(), operator);
  await advanceComplaintStatus(complaint1.data.id, COMPLAINT_STATUS.RESOLVED, uuidv4(), operator, '测试解决方案');
  await advanceComplaintStatus(complaint1.data.id, COMPLAINT_STATUS.CLOSED, uuidv4(), operator);

  console.log(`\n投诉状态: CLOSED`);
  console.log('尝试修改投诉内容...');

  const badUpdateComplaint = await updateComplaint(
    complaint1.data.id,
    { complaintContent: '被恶意修改的内容' },
    uuidv4(),
    operator
  );
  logError(badUpdateComplaint);

  logStep('11', '重复请求幂等性', '使用相同requestId验证不重复创建');

  console.log(`\n第一次创建活动（requestId: REQ-IDEMPOTENT-TEST-001）...`);
  const firstCreate = await createActivity({
    storeId: 'STORE-IDEM-001',
    storeName: '幂等测试门店',
    activityName: '幂等测试活动',
    activityDate: '2026-05-10',
    productName: '测试产品'
  }, 'REQ-IDEMPOTENT-TEST-001', operator);
  
  logSuccess('第一次创建成功', { id: firstCreate.data.id, isDuplicate: firstCreate.isDuplicate });

  console.log(`\n第二次创建相同活动（使用相同requestId）...`);
  const secondCreate = await createActivity({
    storeId: 'STORE-IDEM-001',
    storeName: '幂等测试门店',
    activityName: '幂等测试活动',
    activityDate: '2026-05-10',
    productName: '测试产品'
  }, 'REQ-IDEMPOTENT-TEST-001', operator);

  console.log(`\n📊 幂等性验证结果:`);
  console.log(`   第一次ID: ${firstCreate.data.id}`);
  console.log(`   第二次ID: ${secondCreate.data.id}`);
  console.log(`   是否重复: ${secondCreate.isDuplicate}`);
  console.log(`   ID一致: ${firstCreate.data.id === secondCreate.data.id}`);
  
  if (firstCreate.data.id === secondCreate.data.id && secondCreate.isDuplicate) {
    console.log(`   ✅ 幂等性校验通过！重复请求返回已创建的记录`);
  } else {
    console.log(`   ❌ 幂等性校验失败！`);
  }

  logStep('12', '使用不存在的ID', '使用无效ID进行查询和操作');

  const fakeId = '00000000-0000-0000-0000-000000000000';
  console.log(`\n尝试查询不存在的活动 ID: ${fakeId}`);
  
  const getResult = await advanceActivityStatus(
    fakeId,
    ACTIVITY_STATUS.PLANNED,
    uuidv4(),
    operator
  );
  logError(getResult);

  console.log('\n' + '⚠'.repeat(60));
  console.log('⚠  异常操作演示完成！');
  console.log('⚠'.repeat(60));
  console.log('\n📝 演示要点回顾：');
  console.log('  1. ✓ 状态流转保护：不允许跳级、不允许回退');
  console.log('  2. ✓ 终态数据保护：已完成/已销毁/已关闭的数据不可修改');
  console.log('  3. ✓ 数据完整性校验：留样数量、批次匹配等');
  console.log('  4. ✓ 幂等性保护：重复请求不产生副作用');
  console.log('  5. ✓ 资源存在性校验：无效ID明确报错');
  console.log('\n');
};

demoErrorCases().catch(err => {
  console.error('演示执行出错:', err);
  process.exit(1);
});
