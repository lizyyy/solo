const { v4: uuidv4 } = require('uuid');
const {
  createActivity,
  getActivityById,
  advanceActivityStatus,
  cancelActivity,
  updateActivity,
  getActivitySummary,
  ACTIVITY_STATUS
} = require('../src/services/activityService');

const {
  createBatch,
  getBatchesByActivity,
  createSampleArchive,
  getSampleById,
  getSamplesByActivity,
  getSamplesForDestroyReminder,
  advanceSampleStatus,
  destroySample,
  retainSampleForInvestigation,
  updateSampleArchive,
  withdrawSampleArchive,
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

const { initTables } = require('../src/config/database');

const { format, addDays } = require('date-fns');

describe('状态流转规则验证', () => {
  beforeAll(async () => {
    process.env.DB_PATH = ':memory:';
    await initTables();
  });

  test('活动状态流转 DRAFT -> PLANNED 应该成功', async () => {
    const result = await createActivity({
      storeId: 'STORE-001',
      storeName: '测试门店',
      activityName: '测试活动',
      activityDate: '2026-05-10',
      productName: '测试产品'
    }, null, 'tester');

    expect(result.success).toBe(true);
    expect(result.data.status).toBe(ACTIVITY_STATUS.DRAFT);

    const advanceResult = await advanceActivityStatus(
      result.data.id,
      ACTIVITY_STATUS.PLANNED,
      null,
      'tester'
    );

    expect(advanceResult.success).toBe(true);
    expect(advanceResult.data.status).toBe(ACTIVITY_STATUS.PLANNED);
  });

  test('活动状态流转 DRAFT -> COMPLETED 应该失败（不允许跳级）', async () => {
    const result = await createActivity({
      storeId: 'STORE-002',
      storeName: '测试门店2',
      activityName: '测试活动2',
      activityDate: '2026-05-10',
      productName: '测试产品2'
    }, null, 'tester');

    const advanceResult = await advanceActivityStatus(
      result.data.id,
      ACTIVITY_STATUS.COMPLETED,
      null,
      'tester'
    );

    expect(advanceResult.success).toBe(false);
    expect(advanceResult.code).toBe('INVALID_TRANSITION');
  });

  test('已完成的活动无法修改', async () => {
    const createResult = await createActivity({
      storeId: 'STORE-003',
      storeName: '测试门店3',
      activityName: '测试活动3',
      activityDate: '2026-05-10',
      productName: '测试产品3'
    }, null, 'tester');

    await advanceActivityStatus(createResult.data.id, ACTIVITY_STATUS.PLANNED);
    await advanceActivityStatus(createResult.data.id, ACTIVITY_STATUS.IN_PROGRESS);
    await advanceActivityStatus(createResult.data.id, ACTIVITY_STATUS.COMPLETED);

    const updateResult = await updateActivity(createResult.data.id, {
      activityName: '修改后的名称'
    });

    expect(updateResult.success).toBe(false);
    expect(updateResult.code).toBe('READONLY_STATUS');
  });
});

describe('留样销毁时间和提醒功能', () => {
  let activityId;
  let batchId;

  beforeAll(async () => {
    const activityResult = await createActivity({
      storeId: 'STORE-REMIND',
      storeName: '提醒测试门店',
      activityName: '销毁提醒测试活动',
      activityDate: '2026-05-01',
      productName: '测试饼干'
    }, null, 'tester');
    activityId = activityResult.data.id;

    const batchResult = await createBatch(activityId, {
      batchNumber: 'BATCH-REMIND-001',
      productionDate: '2026-04-20',
      expirationDate: '2026-07-20',
      quantity: 200
    }, null, 'tester');
    batchId = batchResult.data.id;
  });

  test('创建留样时应自动计算销毁截止日期（默认7天）', async () => {
    const archiveDate = '2026-05-01';
    const result = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 2,
      storageLocation: '冷藏柜1号',
      archiveDate
    }, null, 'tester');

    expect(result.success).toBe(true);
    expect(result.data.destroy_deadline).toBe('2026-05-08');
  });

  test('可自定义保质期天数计算销毁时间', async () => {
    const archiveDate = '2026-05-01';
    const shelfLifeDays = 14;
    const result = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 3,
      storageLocation: '冷藏柜2号',
      archiveDate,
      shelfLifeDays
    }, null, 'tester');

    expect(result.success).toBe(true);
    expect(result.data.destroy_deadline).toBe('2026-05-15');
  });

  test('销毁提醒应列出到期或即将到期的留样', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const reminders = await getSamplesForDestroyReminder(today);
    
    expect(Array.isArray(reminders)).toBe(true);
  });

  test('已销毁的留样应记录销毁时间', async () => {
    const archiveResult = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 1,
      storageLocation: '待销毁柜',
      archiveDate: '2026-04-01',
      shelfLifeDays: 1
    }, null, 'tester');

    const destroyResult = await destroySample(archiveResult.data.id, null, 'tester');
    expect(destroyResult.success).toBe(true);
    expect(destroyResult.data.status).toBe(SAMPLE_STATUS.DESTROYED);
    expect(destroyResult.data.destroyed_at).toBeDefined();
    expect(destroyResult.data.destroyed_at).not.toBeNull();
  });

  test('已销毁的留样无法再修改或销毁', async () => {
    const archiveResult = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 1,
      storageLocation: '测试柜',
      archiveDate: '2026-04-10',
      shelfLifeDays: 1
    }, null, 'tester');

    await destroySample(archiveResult.data.id, null, 'tester');

    const updateResult = await updateSampleArchive(archiveResult.data.id, {
      storageLocation: '新位置'
    });

    expect(updateResult.success).toBe(false);
    expect(updateResult.code).toBe('READONLY_STATUS');
  });
});

describe('投诉关联和追溯报告', () => {
  let activityId;
  let batchId;
  let sampleId;

  beforeAll(async () => {
    const activityResult = await createActivity({
      storeId: 'STORE-TRACE',
      storeName: '追溯测试门店',
      activityName: '追溯测试活动',
      activityDate: '2026-05-05',
      productName: '抹茶饼干'
    }, null, 'tester');
    activityId = activityResult.data.id;

    const batchResult = await createBatch(activityId, {
      batchNumber: 'BATCH-TRACE-001',
      productionDate: '2026-04-25',
      expirationDate: '2026-07-25',
      quantity: 300
    }, null, 'tester');
    batchId = batchResult.data.id;

    const archiveResult = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 3,
      storageLocation: '门店冷藏柜B-02',
      archiveDate: '2026-05-05'
    }, null, 'tester');
    sampleId = archiveResult.data.id;
  });

  test('创建投诉应关联活动和留样', async () => {
    const result = await createComplaint({
      activityId,
      sampleArchiveId: sampleId,
      complaintType: '食品安全',
      complaintDate: '2026-05-06',
      complaintContent: '食用后出现不适',
      complainant: '测试消费者'
    }, null, 'tester');

    expect(result.success).toBe(true);
    expect(result.data.activity_id).toBe(activityId);
    expect(result.data.sample_archive_id).toBe(sampleId);
  });

  test('关联留样后，留样状态应自动变为留存调查', async () => {
    const archiveResult2 = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 2,
      storageLocation: '门店冷藏柜B-03',
      archiveDate: '2026-05-05'
    }, null, 'tester');

    const complaintResult = await createComplaint({
      activityId,
      sampleArchiveId: archiveResult2.data.id,
      complaintType: '食品质量',
      complaintDate: '2026-05-07',
      complaintContent: '饼干口味异常',
      complainant: '测试消费者2'
    }, null, 'tester');

    const updatedSample = await getSampleById(archiveResult2.data.id);
    
    expect(updatedSample.status).toBe(SAMPLE_STATUS.RETAINED_FOR_INVESTIGATION);
  });

  test('追溯报告应关联投诉并记录内容', async () => {
    const complaintResult = await createComplaint({
      activityId,
      sampleArchiveId: sampleId,
      complaintType: '食品安全',
      complaintDate: '2026-05-08',
      complaintContent: '测试投诉用于报告',
      complainant: '测试消费者3'
    }, null, 'tester');

    const reportResult = await createTraceReport(
      complaintResult.data.id,
      {
        reportContent: '留样检验中，批次信息：BATCH-TRACE-001',
        reportDate: '2026-05-08',
        activityId
      },
      null,
      'tester'
    );

    expect(reportResult.success).toBe(true);
    expect(reportResult.data.complaint_id).toBe(complaintResult.data.id);
    expect(reportResult.data.status).toBe(REPORT_STATUS.PENDING);
  });

  test('完整追溯信息应包含活动、留样、批次和报告', async () => {
    const complaintResult = await createComplaint({
      activityId,
      sampleArchiveId: sampleId,
      complaintType: '食品安全',
      complaintDate: '2026-05-09',
      complaintContent: '完整追溯测试',
      complainant: '测试消费者4'
    }, null, 'tester');

    await createTraceReport(
      complaintResult.data.id,
      {
        reportContent: '追溯报告内容',
        reportDate: '2026-05-09',
        activityId
      },
      null,
      'tester'
    );

    const traceInfo = await getFullTraceInfo(complaintResult.data.id);

    expect(traceInfo.success).toBe(true);
    expect(traceInfo.data.complaint).toBeDefined();
    expect(traceInfo.data.reportCount).toBeGreaterThan(0);
    expect(traceInfo.data.activity).toBeDefined();
    expect(traceInfo.data.relatedSample).toBeDefined();
  });

  test('报告完成后影响投诉状态推进', async () => {
    const complaintResult = await createComplaint({
      activityId,
      sampleArchiveId: sampleId,
      complaintType: '食品质量',
      complaintDate: '2026-05-10',
      complaintContent: '完整流程测试',
      complainant: '测试消费者5'
    }, null, 'tester');

    await advanceComplaintStatus(
      complaintResult.data.id,
      COMPLAINT_STATUS.UNDER_INVESTIGATION,
      null,
      'tester'
    );

    const reportResult = await createTraceReport(
      complaintResult.data.id,
      {
        reportContent: '已完成留样检验，排除批次问题',
        reportDate: '2026-05-10',
        activityId
      },
      null,
      'tester'
    );

    const completeResult = await completeReport(
      reportResult.data.id,
      '检验合格，留样存储符合规范，批次无质量问题。建议投诉方就医确认。',
      null,
      'tester'
    );

    expect(completeResult.success).toBe(true);
    expect(completeResult.data.status).toBe(REPORT_STATUS.COMPLETED);
    expect(completeResult.data.conclusion).toBeDefined();

    const resolveResult = await advanceComplaintStatus(
      complaintResult.data.id,
      COMPLAINT_STATUS.RESOLVED,
      null,
      'tester',
      '已向投诉方解释检验结果并提供医疗检查协助。'
    );

    expect(resolveResult.success).toBe(true);
    expect(resolveResult.data.status).toBe(COMPLAINT_STATUS.RESOLVED);
  });
});

describe('幂等性验证 - 重复请求不写乱状态', () => {
  const REQUEST_ID = 'TEST-IDEMPOTENCY-' + uuidv4();
  let activityId;

  beforeAll(async () => {
    const result = await createActivity({
      storeId: 'STORE-IDEM',
      storeName: '幂等测试门店',
      activityName: '幂等测试活动',
      activityDate: '2026-05-10',
      productName: '测试产品'
    }, REQUEST_ID, 'tester');
    activityId = result.data.id;
  });

  test('使用相同 requestId 重复创建活动应返回已创建的，不重复创建', async () => {
    const result1 = await createActivity({
      storeId: 'STORE-IDEM-2',
      storeName: '重复创建测试',
      activityName: '重复创建活动',
      activityDate: '2026-05-11',
      productName: '测试产品'
    }, 'REQ-DUP-CREATE', 'tester');

    const result2 = await createActivity({
      storeId: 'STORE-IDEM-2',
      storeName: '重复创建测试',
      activityName: '重复创建活动',
      activityDate: '2026-05-11',
      productName: '测试产品'
    }, 'REQ-DUP-CREATE', 'tester');

    expect(result2.isDuplicate).toBe(true);
    expect(result1.data.id).toBe(result2.data.id);
  });

  test('使用相同 requestId 重复推进状态不产生副作用', async () => {
    const ADVANCE_REQ_ID = 'REQ-ADVANCE-' + uuidv4();

    const result1 = await advanceActivityStatus(
      activityId,
      ACTIVITY_STATUS.PLANNED,
      ADVANCE_REQ_ID,
      'tester'
    );

    const result2 = await advanceActivityStatus(
      activityId,
      ACTIVITY_STATUS.PLANNED,
      ADVANCE_REQ_ID,
      'tester'
    );

    expect(result2.isDuplicate).toBe(true);
    expect(result2.data.status).toBe(ACTIVITY_STATUS.PLANNED);
  });

  test('不同操作但相同 requestId 不应冲突（区分 entity_type + operation_type）', async () => {
    const batchResult = await createBatch(activityId, {
      batchNumber: 'BATCH-IDEM-001',
      productionDate: '2026-04-20',
      expirationDate: '2026-07-20',
      quantity: 100
    }, 'REQ-BATCH-CREATE', 'tester');

    const archiveResult = await createSampleArchive({
      activityId,
      batchId: batchResult.data.id,
      sampleQuantity: 2,
      storageLocation: '测试柜',
      archiveDate: '2026-05-10'
    }, 'REQ-ARCHIVE-CREATE', 'tester');

    const destroyReqId = 'REQ-DESTROY-' + uuidv4();
    const destroy1 = await destroySample(archiveResult.data.id, destroyReqId, 'tester');
    const destroy2 = await destroySample(archiveResult.data.id, destroyReqId, 'tester');

    expect(destroy2.isDuplicate).toBe(true);
  });
});

describe('撤回和修正功能', () => {
  let activityId;
  let batchId;

  beforeAll(async () => {
    const activityResult = await createActivity({
      storeId: 'STORE-WD',
      storeName: '撤回修正测试门店',
      activityName: '撤回修正测试活动',
      activityDate: '2026-05-10',
      productName: '测试产品'
    }, null, 'tester');
    activityId = activityResult.data.id;

    const batchResult = await createBatch(activityId, {
      batchNumber: 'BATCH-WD-001',
      productionDate: '2026-04-20',
      expirationDate: '2026-07-20',
      quantity: 200
    }, null, 'tester');
    batchId = batchResult.data.id;
  });

  test('已留样状态可以撤回（删除记录）', async () => {
    const archiveResult = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 2,
      storageLocation: '测试位置',
      archiveDate: '2026-05-10'
    }, null, 'tester');

    const withdrawResult = await withdrawSampleArchive(
      archiveResult.data.id,
      null,
      'tester',
      '录入错误需撤回'
    );

    expect(withdrawResult.success).toBe(true);

    const checkResult = await getSampleById(archiveResult.data.id);
    expect(checkResult).toBeUndefined();
  });

  test('已销毁的留样无法撤回', async () => {
    const archiveResult = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 1,
      storageLocation: '待销毁',
      archiveDate: '2026-05-01',
      shelfLifeDays: 1
    }, null, 'tester');

    await destroySample(archiveResult.data.id, null, 'tester');

    const withdrawResult = await withdrawSampleArchive(
      archiveResult.data.id,
      null,
      'tester',
      '尝试撤回已销毁留样'
    );

    expect(withdrawResult.success).toBe(false);
    expect(withdrawResult.code).toBe('READONLY_STATUS');
  });

  test('非终态可以修正（更新字段）', async () => {
    const archiveResult = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 2,
      storageLocation: '旧位置',
      archiveDate: '2026-05-10'
    }, null, 'tester');

    const updateResult = await updateSampleArchive(
      archiveResult.data.id,
      {
        storageLocation: '新位置A-01',
        sampleQuantity: 3
      },
      null,
      'tester'
    );

    expect(updateResult.success).toBe(true);
    expect(updateResult.data.storage_location).toBe('新位置A-01');
    expect(updateResult.data.sample_quantity).toBe(3);
  });

  test('活动取消功能', async () => {
    const activityResult = await createActivity({
      storeId: 'STORE-CANCEL',
      storeName: '取消测试门店',
      activityName: '待取消活动',
      activityDate: '2026-06-01',
      productName: '测试产品'
    }, null, 'tester');

    await advanceActivityStatus(
      activityResult.data.id,
      ACTIVITY_STATUS.PLANNED,
      null,
      'tester'
    );

    const cancelResult = await cancelActivity(
      activityResult.data.id,
      null,
      'tester'
    );

    expect(cancelResult.success).toBe(true);
    expect(cancelResult.data.status).toBe(ACTIVITY_STATUS.CANCELLED);
  });
});

describe('查询汇总功能', () => {
  let activityId;
  let batchId;
  let sampleId;
  let complaintId;

  beforeAll(async () => {
    const activityResult = await createActivity({
      storeId: 'STORE-SUM',
      storeName: '汇总查询门店',
      activityName: '汇总查询测试活动',
      activityDate: '2026-05-15',
      productName: '汇总测试产品'
    }, null, 'tester');
    activityId = activityResult.data.id;

    const batchResult1 = await createBatch(activityId, {
      batchNumber: 'BATCH-SUM-001',
      productionDate: '2026-05-01',
      expirationDate: '2026-08-01',
      quantity: 150
    }, null, 'tester');
    batchId = batchResult1.data.id;

    await createBatch(activityId, {
      batchNumber: 'BATCH-SUM-002',
      productionDate: '2026-05-02',
      expirationDate: '2026-08-02',
      quantity: 200
    }, null, 'tester');

    const archiveResult = await createSampleArchive({
      activityId,
      batchId,
      sampleQuantity: 2,
      storageLocation: '冷藏柜S-01',
      archiveDate: '2026-05-15'
    }, null, 'tester');
    sampleId = archiveResult.data.id;

    const complaintResult = await createComplaint({
      activityId,
      sampleArchiveId: sampleId,
      complaintType: '食品质量',
      complaintDate: '2026-05-16',
      complaintContent: '汇总查询测试投诉',
      complainant: '测试用户'
    }, null, 'tester');
    complaintId = complaintResult.data.id;
  });

  test('活动汇总应包含批次数量、留样数量、投诉数量', async () => {
    const summary = await getActivitySummary(activityId);

    expect(summary.success).toBe(true);
    expect(summary.data.activity.id).toBe(activityId);
    expect(summary.data.batchCount).toBe(2);
    expect(summary.data.sampleCount).toBe(1);
    expect(summary.data.complaintCount).toBe(1);
  });

  test('追溯信息汇总应包含完整链路', async () => {
    const traceInfo = await getFullTraceInfo(complaintId);

    expect(traceInfo.success).toBe(true);
    expect(traceInfo.data.complaint.id).toBe(complaintId);
    expect(traceInfo.data.activity.id).toBe(activityId);
    expect(traceInfo.data.relatedSample.id).toBe(sampleId);
  });
});
