const { sequelize, Batch, ReplayHistory } = require('../src/models');
const BatchService = require('../src/services/BatchService');
const ExportService = require('../src/services/ExportService');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('完整流转测试', () => {
  let batchId;

  test('1. 创建批次 - 同步中状态', async () => {
    const batch = await BatchService.create({
      batchNo: 'BATCH20240101001',
      dataSource: 'MySQL-用户库',
      targetTable: 't_user_sync',
      totalCount: 100,
      createdBy: 'admin'
    });

    expect(batch.status).toBe('syncing');
    expect(batch.dataSource).toBe('MySQL-用户库');
    batchId = batch.id;
  });

  test('2. 标记批次失败 - 含部分成功', async () => {
    const batch = await BatchService.markFailed(batchId, {
      successCount: 60,
      failCount: 40,
      failReason: '字段格式错误: 手机号格式不合法',
      failDetail: {
        errorType: 'validation_error',
        fieldErrors: ['phone', 'email']
      }
    });

    expect(batch.status).toBe('failed');
    expect(batch.hasPartialSuccess).toBe(true);
    expect(batch.successCount).toBe(60);
    expect(batch.failCount).toBe(40);
  });

  test('3. 查询批次列表 - 验证列表可见', async () => {
    const result = await BatchService.list({ page: 1, pageSize: 10 });
    expect(result.total).toBeGreaterThan(0);
    expect(result.list[0].statusText).toBe('失败');
  });

  test('4. 发起重放 - 状态变为重放中', async () => {
    const result = await BatchService.replay(batchId, 'operator_001', '修复数据格式后重放');
    
    expect(result.batch.status).toBe('replaying');
    expect(result.batch.replayCount).toBe(1);
    expect(result.replayHistory.operator).toBe('operator_001');
  });

  test('5. 重放完成 - 全部成功', async () => {
    const result = await BatchService.completeReplay(batchId, {
      successCount: 40,
      failCount: 0,
      conflictCount: 0,
      skipCount: 0,
      failRecords: [],
      conflictRecords: [],
      evidence: {
        requestId: 'REQ' + Date.now(),
        processTime: 1250,
        operator: 'operator_001'
      }
    });

    expect(result.batch.status).toBe('completed');
    expect(result.batch.successCount).toBe(100);
    expect(result.batch.failCount).toBe(0);
    expect(result.replayHistory.status).toBe('success');
  });

  test('6. 查询批次详情 - 验证历史记录', async () => {
    const detail = await BatchService.getDetail(batchId);
    expect(detail.replayHistories.length).toBe(1);
    expect(detail.replayHistories[0].replayNo).toBe(1);
    expect(detail.statusText).toBe('已完成');
  });

  test('7. 已完成批次不能重放', async () => {
    await expect(BatchService.replay(batchId, 'operator_001')).rejects.toThrow('已完成，无需重放');
  });
});

describe('冲突记录测试', () => {
  let batchId;

  test('1. 创建含部分成功的批次', async () => {
    const batch = await BatchService.create({
      batchNo: 'BATCH20240101002',
      dataSource: 'PostgreSQL-订单库',
      targetTable: 't_order_sync',
      totalCount: 50,
      createdBy: 'admin'
    });
    batchId = batch.id;

    await BatchService.markFailed(batchId, {
      successCount: 30,
      failCount: 20,
      failReason: '主键冲突: 订单号已存在',
      failDetail: { conflictKeys: ['ORD001', 'ORD002'] }
    });
  });

  test('2. 检测冲突记录', async () => {
    const result = await BatchService.checkConflict(batchId, ['ORD001', 'ORD002', 'ORD003']);
    expect(typeof result.hasConflict).toBe('boolean');
    expect(Array.isArray(result.conflictKeys)).toBe(true);
  });

  test('3. 重放含冲突的批次', async () => {
    await BatchService.replay(batchId, 'operator_002', '处理冲突后重放');

    const result = await BatchService.completeReplay(batchId, {
      successCount: 15,
      failCount: 5,
      conflictCount: 5,
      skipCount: 5,
      failRecords: [
        { recordKey: 'ORD021', reason: '金额格式错误', type: 'format_error' },
        { recordKey: 'ORD022', reason: '日期超出范围', type: 'validation_error' }
      ],
      conflictRecords: [
        { recordKey: 'ORD001', reason: '记录已存在，跳过' },
        { recordKey: 'ORD002', reason: '记录已存在，跳过' }
      ],
      evidence: {
        requestId: 'REQ' + Date.now(),
        skipStrategy: 'ignore_duplicate',
        processTime: 890
      }
    });

    expect(result.replayHistory.conflictCount).toBe(5);
    expect(result.replayHistory.skipCount).toBe(5);
    expect(result.replayHistory.conflictRecords.length).toBe(2);
    expect(result.batch.hasPartialSuccess).toBe(true);
  });

  test('4. 查询详情验证冲突记录留存', async () => {
    const detail = await BatchService.getDetail(batchId);
    const lastHistory = detail.replayHistories[0];
    expect(lastHistory.conflictRecords).toBeDefined();
    expect(lastHistory.conflictRecords.length).toBeGreaterThan(0);
  });
});

describe('坏行导入测试', () => {
  let batchId;

  test('1. 创建批次并标记失败含坏行记录', async () => {
    const batch = await BatchService.create({
      batchNo: 'BATCH20240101003',
      dataSource: 'CSV文件导入',
      targetTable: 't_import_data',
      totalCount: 1000,
      createdBy: 'admin'
    });
    batchId = batch.id;

    await BatchService.markFailed(batchId, {
      successCount: 950,
      failCount: 50,
      failReason: '50条数据格式错误',
      failDetail: { badRows: 50 }
    });
  });

  test('2. 重放失败 - 保留所有坏行证据', async () => {
    await BatchService.replay(batchId, 'operator_003', '重新导入坏行');

    const badRecords = Array.from({ length: 50 }, (_, i) => ({
      lineNo: i + 1,
      recordKey: `ROW${String(i + 1).padStart(4, '0')}`,
      reason: i % 2 === 0 ? '字段缺失: name不能为空' : '类型转换错误: age必须为数字',
      type: i % 2 === 0 ? 'missing_field' : 'type_error',
      rawData: `ROW${String(i + 1).padStart(4, '0')},user_${i},${i % 2 === 0 ? '' : 'invalid'},${i % 2 === 0 ? 25 : 'twenty'}`
    }));

    const result = await BatchService.completeReplay(batchId, {
      successCount: 30,
      failCount: 20,
      conflictCount: 0,
      skipCount: 0,
      failRecords: badRecords.slice(0, 20),
      evidence: {
        requestId: 'REQ' + Date.now(),
        importMethod: 'batch_insert',
        errorDistribution: {
          missing_field: 12,
          type_error: 8
        }
      }
    });

    expect(result.replayHistory.failRecords.length).toBe(20);
    expect(result.replayHistory.failRecords[0].reason).toBeDefined();
    expect(result.batch.failCount).toBe(20);
  });

  test('3. 导出请求创建成功', async () => {
    const exportResult = await ExportService.createExportRequest(
      'fail_records',
      { batchId },
      'operator_003',
      false
    );

    expect(exportResult.exportNo).toBeDefined();
    expect(exportResult.id).toBeDefined();
  });

  test('4. 验证导出字段与列表字段一致', async () => {
    const batchFields = ExportService.exportFields.batchList.map(f => f.id);
    const expectedFields = ['batchNo', 'dataSource', 'targetTable', 'statusText', 'totalCount', 'successCount', 'failCount'];
    
    expectedFields.forEach(field => {
      expect(batchFields).toContain(field);
    });
  });
});

describe('API返回业务字段验证', () => {
  test('返回值包含业务字段而非仅状态码', async () => {
    const batch = await BatchService.create({
      batchNo: 'BATCH20240101004',
      dataSource: 'API数据源',
      targetTable: 't_api_data',
      totalCount: 10,
      failCount: 3,
      failReason: '测试失败原因',
      createdBy: 'admin'
    });

    await BatchService.markFailed(batch.id, {
      successCount: 7,
      failCount: 3,
      failReason: '字段格式错误'
    });

    const detail = await BatchService.getDetail(batch.id);
    
    expect(detail.dataSource).toBeDefined();
    expect(detail.targetTable).toBeDefined();
    expect(detail.statusText).toBeDefined();
    expect(detail.failReason).toBeDefined();
    expect(detail.hasPartialSuccess).toBeDefined();
    expect(detail.replayCount).toBeDefined();
  });
});
