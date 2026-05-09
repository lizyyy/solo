const { v4: uuidv4 } = require('uuid');
const { initTables } = require('../src/config/database');
const {
  createActivity,
  getActivityById,
  advanceActivityStatus,
  getActivitySummary,
  ACTIVITY_STATUS
} = require('../src/services/activityService');

const {
  createBatch,
  createSampleArchive,
  getSampleById,
  getSamplesForDestroyReminder,
  destroySample,
  SAMPLE_STATUS
} = require('../src/services/batchService');

const {
  createComplaint,
  getComplaintById,
  advanceComplaintStatus,
  createTraceReport,
  completeReport,
  getFullTraceInfo,
  COMPLAINT_STATUS,
  REPORT_STATUS
} = require('../src/services/complaintService');

const { format } = require('date-fns');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logStep = (step, description) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`【步骤 ${step}】${description}`);
  console.log(`${'='.repeat(60)}`);
};

const logResult = (label, data, fields = null) => {
  console.log(`\n✓ ${label}:`);
  if (fields) {
    fields.forEach(f => {
      console.log(`   ${f}: ${data[f] !== undefined ? data[f] : data[f.replace(/_/g, '')] || '-'}`);
    });
  } else {
    console.log(`   ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
  }
};

const demoMainFlow = async () => {
  console.log('\n' + '★'.repeat(60));
  console.log('★  门店试吃样品留样 API - 主业务流程演示');
  console.log('★  场景：五一新品试吃活动 → 留样登记 → 销毁管理 → 投诉追溯');
  console.log('★'.repeat(60));

  await initTables();
  await sleep(200);

  let activityId, batchId, sampleId, complaintId, reportId;
  const operator = 'demo-operator';

  logStep('1', '创建活动档案（试吃活动筹备）');
  const activityResult = await createActivity({
    storeId: 'STORE-MAY-2026',
    storeName: '阳光食品五一店',
    activityName: '2026五一劳动节新品试吃活动',
    activityDate: '2026-05-01',
    productName: '抹茶奶油夹心曲奇饼干',
    description: '五一劳动节期间门店促销活动，推广全新抹茶口味曲奇'
  }, uuidv4(), operator);
  activityId = activityResult.data.id;
  logResult('活动已创建', activityResult.data, ['id', 'activity_name', 'store_name', 'status', 'activity_date']);
  console.log(`   当前状态: ${activityResult.data.status} (草稿，等待确认)`);

  logStep('2', '推进活动状态：确认活动计划');
  const planResult = await advanceActivityStatus(
    activityId,
    ACTIVITY_STATUS.PLANNED,
    uuidv4(),
    operator
  );
  logResult('活动已确认', planResult.data, ['id', 'status']);
  console.log(`   当前状态: ${planResult.data.status} (已计划)`);

  logStep('3', '登记样品批次信息');
  const batchResult = await createBatch(activityId, {
    batchNumber: 'BATCH-MC-2026-0425-001',
    productionDate: '2026-04-25',
    expirationDate: '2026-07-25',
    quantity: 500
  }, uuidv4(), operator);
  batchId = batchResult.data.id;
  logResult('批次已登记', batchResult.data, ['id', 'batch_number', 'production_date', 'expiration_date', 'quantity']);

  logStep('4', '推进活动状态：活动进行中');
  const progressResult = await advanceActivityStatus(
    activityId,
    ACTIVITY_STATUS.IN_PROGRESS,
    uuidv4(),
    operator
  );
  logResult('活动开始', progressResult.data, ['status']);
  console.log(`   当前状态: ${progressResult.data.status} (进行中)`);

  logStep('5', '试吃活动结束 - 进行样品留样登记');
  console.log('   留样时间：2026-05-01（活动结束当天）');
  console.log('   留样数量：2份（用于追溯）');
  console.log('   存储位置：门店冷藏柜 A-03 号');
  console.log('   保质期：7天（默认，自动计算销毁时间）');

  const archiveResult = await createSampleArchive({
    activityId,
    batchId,
    sampleQuantity: 2,
    storageLocation: '门店冷藏柜 A-03 号',
    archiveDate: '2026-05-01'
  }, uuidv4(), operator);
  sampleId = archiveResult.data.id;
  logResult('留样已登记', archiveResult.data, ['id', 'sample_quantity', 'storage_location', 'archive_date', 'destroy_deadline', 'status']);
  console.log(`   ⚠  销毁截止日期: ${archiveResult.data.destroy_deadline}（2026-05-08）`);
  console.log(`   当前留样状态: ${archiveResult.data.status}`);

  logStep('6', '推进活动状态：活动完成');
  const completeResult = await advanceActivityStatus(
    activityId,
    ACTIVITY_STATUS.COMPLETED,
    uuidv4(),
    operator
  );
  logResult('活动已完成', completeResult.data, ['status']);

  logStep('7', '日常巡检：销毁提醒查询（2026-05-08）');
  const today = '2026-05-08';
  console.log(`   查询日期: ${today}`);
  const reminders = await getSamplesForDestroyReminder(today);
  console.log(`   到期留样数量: ${reminders.length}`);
  
  if (reminders.length > 0) {
    console.log(`\n   🔔 需要处理的留样:`);
    reminders.forEach((r, i) => {
      console.log(`   ${i + 1}. ID: ${r.id}`);
      console.log(`      门店: ${r.store_name}`);
      console.log(`      活动: ${r.activity_name}`);
      console.log(`      批次: ${r.batch_number}`);
      console.log(`      销毁截止: ${r.destroy_deadline}`);
      console.log(`      当前状态: ${r.status}`);
    });
  }

  logStep('8', '发生消费者投诉 - 关联留样');
  console.log('   投诉时间：2026-05-05');
  console.log('   投诉类型：食品安全');
  console.log('   投诉内容：李女士反馈5月3日食用试吃饼干后出现腹痛腹泻');
  console.log('   关联留样：自动触发留样留存调查');

  const complaintResult = await createComplaint({
    activityId,
    sampleArchiveId: sampleId,
    complaintType: '食品安全',
    complaintDate: '2026-05-05',
    complaintContent: '2026年5月3日购买并食用五一试吃活动的抹茶饼干后，于5月4日出现腹痛、腹泻症状，就医诊断为急性肠胃炎。怀疑食品存在质量问题。',
    complainant: '李女士',
    contactInfo: '138****5678'
  }, uuidv4(), operator);
  complaintId = complaintResult.data.id;
  logResult('投诉已记录', complaintResult.data, ['id', 'complaint_type', 'complainant', 'complaint_date', 'status']);

  logStep('9', '验证：关联投诉后留样状态自动变更');
  const updatedSample = await getSampleById(sampleId);
  console.log(`   留样 ID: ${updatedSample.id}`);
  console.log(`   原状态: ${SAMPLE_STATUS.ARCHIVED}`);
  console.log(`   现状态: ${updatedSample.status}`);
  console.log(`   ✓ 状态已变更为: ${SAMPLE_STATUS.RETAINED_FOR_INVESTIGATION} (留存调查)`);

  logStep('10', '推进投诉状态：开始调查');
  const investigateResult = await advanceComplaintStatus(
    complaintId,
    COMPLAINT_STATUS.UNDER_INVESTIGATION,
    uuidv4(),
    operator
  );
  logResult('投诉调查中', investigateResult.data, ['status']);

  logStep('11', '创建追溯报告');
  console.log('   报告内容：');
  console.log('   - 调取活动档案：五一抹茶曲奇试吃活动');
  console.log('   - 调取批次信息：BATCH-MC-2026-0425-001');
  console.log('   - 留样状态：已留存调查，未销毁');
  console.log('   - 送检安排：留样送第三方检验');

  const reportResult = await createTraceReport(
    complaintId,
    {
      reportContent: '追溯调查开始：\n1. 活动信息：2026五一劳动节新品试吃活动（抹茶奶油夹心曲奇）\n2. 批次信息：BATCH-MC-2026-0425-001，生产日期2026-04-25，保质期至2026-07-25\n3. 留样信息：2份，存储于门店冷藏柜A-03，原销毁日期2026-05-08，现已留存调查\n4. 关联投诉：李女士，食品安全投诉\n5. 下一步：留样送第三方食品检验机构检测',
      reportDate: '2026-05-05',
      activityId
    },
    uuidv4(),
    operator
  );
  reportId = reportResult.data.id;
  logResult('追溯报告已创建', reportResult.data, ['id', 'report_date', 'status']);

  logStep('12', '检验完成 - 完成追溯报告');
  console.log('   检验结论：');
  console.log('   - 留样检验合格，各项指标符合国家标准');
  console.log('   - 留样存储条件检查符合要求');
  console.log('   - 批次同期其他留样无异常');
  console.log('   - 建议：投诉方就医确认，排除其他因素');

  const completeReportResult = await completeReport(
    reportId,
    '第三方食品检验机构检测报告显示：\n1. 留样微生物指标（菌落总数、大肠杆菌、霉菌、酵母）均符合GB 7101-2021食品安全国家标准\n2. 食品添加剂检测均在允许范围内\n3. 留样存储条件（温度0-4℃冷藏）符合要求\n4. 同期批次其他留样无异常记录\n\n结论：留样批次无质量问题。建议协助投诉方进行全面医疗检查，确认不适原因。',
    uuidv4(),
    operator
  );
  logResult('追溯报告已完成', completeReportResult.data, ['status']);
  console.log(`   报告状态: ${REPORT_STATUS.COMPLETED}`);
  console.log(`   结论已记录 ✓`);

  logStep('13', '完成投诉处理');
  const resolveResult = await advanceComplaintStatus(
    complaintId,
    COMPLAINT_STATUS.RESOLVED,
    uuidv4(),
    operator,
    '已向投诉方李女士提交检验报告，说明留样批次质量合格。协助联系医院进行进一步检查，确认不适原因。投诉方接受解释，案件暂告一段落。'
  );
  logResult('投诉已解决', resolveResult.data, ['status', 'resolution']);

  logStep('14', '关闭投诉');
  const closeResult = await advanceComplaintStatus(
    complaintId,
    COMPLAINT_STATUS.CLOSED,
    uuidv4(),
    operator
  );
  logResult('投诉已关闭', closeResult.data, ['status']);

  logStep('15', '完整追溯信息查询');
  const fullTrace = await getFullTraceInfo(complaintId);
  console.log('\n   📋 完整追溯链路：');
  console.log(`   ┌─────────────────────────────────────────`);
  console.log(`   │ 投诉信息:`);
  console.log(`   │   ID: ${fullTrace.data.complaint.id}`);
  console.log(`   │   类型: ${fullTrace.data.complaint.complaint_type}`);
  console.log(`   │   投诉人: ${fullTrace.data.complaint.complainant}`);
  console.log(`   │   状态: ${fullTrace.data.complaint.status}`);
  console.log(`   ├─────────────────────────────────────────`);
  console.log(`   │ 关联活动:`);
  console.log(`   │   名称: ${fullTrace.data.activity.activity_name}`);
  console.log(`   │   门店: ${fullTrace.data.activity.store_name}`);
  console.log(`   │   产品: ${fullTrace.data.activity.product_name}`);
  console.log(`   ├─────────────────────────────────────────`);
  console.log(`   │ 关联留样:`);
  console.log(`   │   ID: ${fullTrace.data.relatedSample.id}`);
  console.log(`   │   批次号: ${fullTrace.data.relatedSample.batch_number}`);
  console.log(`   │   存储位置: ${fullTrace.data.relatedSample.storage_location}`);
  console.log(`   │   状态: ${fullTrace.data.relatedSample.status}`);
  console.log(`   ├─────────────────────────────────────────`);
  console.log(`   │ 追溯报告: ${fullTrace.data.reportCount} 份`);
  console.log(`   │   状态: ${fullTrace.data.reports[0].status}`);
  console.log(`   └─────────────────────────────────────────`);

  logStep('16', '活动汇总查询');
  const summary = await getActivitySummary(activityId);
  console.log('\n   📊 活动统计汇总：');
  console.log(`   活动名称: ${summary.data.activity.activity_name}`);
  console.log(`   批次数量: ${summary.data.batchCount}`);
  console.log(`   留样数量: ${summary.data.sampleCount}`);
  console.log(`   投诉数量: ${summary.data.complaintCount}`);

  logStep('17', '调查结束 - 处理留存的留样');
  console.log('   投诉已解决，留存的留样可以正常销毁');
  const finalDestroy = await destroySample(sampleId, uuidv4(), operator);
  logResult('留样已销毁', finalDestroy.data, ['status', 'destroyed_at']);

  console.log('\n' + '★'.repeat(60));
  console.log('★  主业务流程演示完成！');
  console.log('★'.repeat(60));
  console.log('\n📝 演示要点回顾：');
  console.log('  1. ✓ 活动档案状态流转：DRAFT → PLANNED → IN_PROGRESS → COMPLETED');
  console.log('  2. ✓ 批次信息登记，关联活动');
  console.log('  3. ✓ 留样登记自动计算销毁时间（7天）');
  console.log('  4. ✓ 销毁提醒查询功能');
  console.log('  5. ✓ 投诉关联留样后，留样自动变更为留存调查状态');
  console.log('  6. ✓ 追溯报告记录调查过程');
  console.log('  7. ✓ 报告结论影响投诉状态推进（调查→解决→关闭）');
  console.log('  8. ✓ 完整追溯链路可追溯：投诉→活动→留样→批次→报告');
  console.log('\n');
};

demoMainFlow().catch(err => {
  console.error('演示执行出错:', err);
  process.exit(1);
});
