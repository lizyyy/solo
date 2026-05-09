import { ArrearsService, ImportRecordInput } from './services';
import { DatabaseConnection } from './database';
import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(process.cwd(), 'test-parking.db');

function cleanTestDb(): void {
  DatabaseConnection.reset();
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch (e) {
      // ignore
    }
  }
}

async function createTestService(): Promise<ArrearsService> {
  const SQL = await initSqlJs();
  DatabaseConnection.setInitializedModule(SQL);
  cleanTestDb();
  const db = DatabaseConnection.getInstance(TEST_DB_PATH);
  return new ArrearsService(db);
}

function createTestRecords(baseDate: Date = new Date()): ImportRecordInput[] {
  const dayMs = 24 * 60 * 60 * 1000;
  return [
    {
      plateNumber: '京A12345',
      parkingLotId: 'lot-001',
      parkingLotName: '中关村停车场',
      berthId: 'berth-101',
      berthNumber: 'A-101',
      entryTime: new Date(baseDate.getTime() - 5 * dayMs),
      exitTime: new Date(baseDate.getTime() - 5 * dayMs + 2.5 * 60 * 60 * 1000),
      totalAmount: 25.00,
      paidAmount: 0,
      isRecognizedPlate: true
    },
    {
      plateNumber: '京A12345',
      parkingLotId: 'lot-001',
      parkingLotName: '中关村停车场',
      berthId: 'berth-102',
      berthNumber: 'A-102',
      entryTime: new Date(baseDate.getTime() - 4 * dayMs),
      exitTime: new Date(baseDate.getTime() - 4 * dayMs + 2.75 * 60 * 60 * 1000),
      totalAmount: 35.00,
      paidAmount: 0,
      isRecognizedPlate: true
    },
    {
      plateNumber: '京A12345',
      parkingLotId: 'lot-002',
      parkingLotName: '五道口停车场',
      berthId: 'berth-205',
      berthNumber: 'B-205',
      entryTime: new Date(baseDate.getTime() - 2 * dayMs),
      exitTime: new Date(baseDate.getTime() - 2 * dayMs + 2.75 * 60 * 60 * 1000),
      totalAmount: 40.00,
      paidAmount: 0,
      isRecognizedPlate: false
    },
    {
      plateNumber: '京B67890',
      parkingLotId: 'lot-003',
      parkingLotName: '国贸停车场',
      berthId: 'berth-333',
      berthNumber: 'C-333',
      entryTime: new Date(baseDate.getTime() - 3 * dayMs),
      exitTime: new Date(baseDate.getTime() - 3 * dayMs + 48 * 60 * 60 * 1000),
      totalAmount: 600.00,
      paidAmount: 0,
      isRecognizedPlate: true
    },
    {
      plateNumber: '京C11111',
      parkingLotId: 'lot-001',
      parkingLotName: '中关村停车场',
      berthId: 'berth-110',
      berthNumber: 'A-110',
      entryTime: new Date(baseDate.getTime() - 1 * dayMs),
      exitTime: new Date(baseDate.getTime() - 1 * dayMs + 9 * 60 * 60 * 1000),
      totalAmount: 90.00,
      paidAmount: 30.00,
      isRecognizedPlate: true
    }
  ];
}

describe('公共停车欠费追缴服务 - 核心业务测试', () => {
  beforeEach(() => {
    cleanTestDb();
  });

  afterAll(() => {
    cleanTestDb();
  });

  describe('主流程测试', () => {
    test('应该正确导入停车记录并合并跨泊位/停车场的欠费', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      const batchId = 'test-batch-001';

      const result = service.importRecords(records, { batchId });

      expect(result.success).toBe(true);
      expect(result.newRecords).toBe(5);
      expect(result.unpaidAmount).toBe(25 + 35 + 40 + 600 + 60);

      const group1 = service.getArrearsGroup('京A12345');
      expect(group1).not.toBeNull();
      expect(group1!.totalUnpaidAmount).toBe(100);
      expect(group1!.recordCount).toBe(3);

      const group2 = service.getArrearsGroup('京B67890');
      expect(group2).not.toBeNull();
      expect(group2!.totalUnpaidAmount).toBe(600);
      expect(group2!.recordCount).toBe(1);

      const group3 = service.getArrearsGroup('京C11111');
      expect(group3).not.toBeNull();
      expect(group3!.totalUnpaidAmount).toBe(60);
      expect(group3!.recordCount).toBe(1);

      const pending = service.getPendingArrears();
      expect(pending.length).toBe(3);
    });

    test('应该对小金额欠费执行短信通知追缴', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const result = service.performCollection('京A12345');

      expect(result.plateNumber).toBe('京A12345');
      expect(result.totalUnpaid).toBe(100);
      expect(result.status).toBe('追缴中');
      expect(result.actions.length).toBe(1);
      expect(result.actions[0].type).toBe('notify');
      expect(result.actions[0].channel).toBe('短信');
      expect(result.actions[0].result).toBe('成功');
    });

    test('应该对大金额欠费直接加入黑名单', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const result = service.performCollection('京B67890');

      expect(result.plateNumber).toBe('京B67890');
      expect(result.status).toBe('已拉黑');
      expect(result.actions[0].type).toBe('blacklist');
      expect(result.actions[0].channel).toBe('征信系统');
    });

    test('应该正确处理支付回调（部分结清）', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const result = service.processPaymentCallback(
        'pay-001',
        '京A12345',
        60.00,
        'wechat',
        new Date()
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('部分结清');
      expect(result.message).toContain('¥60.00');
      expect(result.message).toContain('¥40.00');

      const group = service.getArrearsGroup('京A12345');
      expect(group!.status).toBe('partially_paid');
      expect(group!.totalUnpaidAmount).toBe(40);
    });

    test('应该正确处理支付回调（全额结清并自动移除黑名单）', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      service.performCollection('京B67890');

      const groupBefore = service.getArrearsGroup('京B67890');
      expect(groupBefore!.status).toBe('blacklisted');

      const result = service.processPaymentCallback(
        'pay-002',
        '京B67890',
        600.00,
        'alipay',
        new Date()
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('全额结清');
      expect(result.message).toContain('¥600.00');

      const groupAfter = service.getArrearsGroup('京B67890');
      expect(groupAfter!.status).toBe('paid');
      expect(groupAfter!.totalUnpaidAmount).toBe(0);
    });

    test('应该正确处理欠费撤回', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const result = service.withdrawArrears(
        '京C11111',
        '车牌识别错误，实际应为京C11112'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('已撤回');
      expect(result.message).toContain('¥60.00');

      const group = service.getArrearsGroup('京C11111');
      expect(group).toBeNull();

      const history = service.getOperationHistory('京C11111');
      expect(history.length).toBeGreaterThan(0);
    });

    test('应该生成正确的追缴报告', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      service.processPaymentCallback(
        'pay-001',
        '京A12345',
        100.00,
        'wechat',
        new Date()
      );

      service.performCollection('京B67890');

      const report = service.generateReport();

      expect(report.totalRecords).toBe(2);
      expect(report.totalAmount).toBe(690);
      expect(report.collectedAmount).toBe(30);
      expect(report.pendingAmount).toBe(660);
      expect(report.blacklistCount).toBe(1);
      expect(report.paidCount).toBe(1);
      expect(report.summary).toContain('690.00');
    });
  });

  describe('边界场景测试', () => {
    test('同一批次数据重跑应该保持结果稳定（幂等性）', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      const batchId = 'test-batch-002';

      const result1 = service.importRecords(records, { batchId });
      expect(result1.newRecords).toBe(5);
      expect(result1.skippedRecords).toBe(0);

      const result2 = service.importRecords(records, { batchId });
      expect(result2.newRecords).toBe(0);
      expect(result2.skippedRecords).toBe(5);
      expect(result2.warnings.length).toBeGreaterThan(0);

      const group = service.getArrearsGroup('京A12345');
      expect(group!.totalUnpaidAmount).toBe(100);
      expect(group!.recordCount).toBe(3);
    });

    test('重复的支付回调应该被忽略', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const result1 = service.processPaymentCallback(
        'pay-dedup-001',
        '京A12345',
        50.00,
        'wechat',
        new Date()
      );
      expect(result1.message).toContain('部分结清');

      const group1 = service.getArrearsGroup('京A12345');
      const unpaidAfterFirst = group1!.totalUnpaidAmount;

      const result2 = service.processPaymentCallback(
        'pay-dedup-001',
        '京A12345',
        50.00,
        'wechat',
        new Date()
      );
      expect(result2.message).toContain('已处理过');
      expect(result2.message).toContain('忽略');

      const group2 = service.getArrearsGroup('京A12345');
      expect(group2!.totalUnpaidAmount).toBe(unpaidAfterFirst);
    });

    test('撤回已结清的欠费应该有正确提示', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      service.processPaymentCallback(
        'pay-001',
        '京A12345',
        100.00,
        'wechat',
        new Date()
      );

      const result = service.performCollection('京A12345');
      expect(result.status).toContain('已结清');
      expect(result.status).toContain('无需追缴');
    });

    test('撤回后再次查询应该返回未找到', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const result1 = service.withdrawArrears('京C11111', '第一次撤回');
      expect(result1.success).toBe(true);
      expect(result1.message).toContain('已撤回');

      const group = service.getArrearsGroup('京C11111');
      expect(group).toBeNull();

      const result2 = service.withdrawArrears('京C11111', '第二次撤回');
      expect(result2.success).toBe(false);
      expect(result2.message).toContain('未找到');
    });

    test('查询不存在的车牌应该返回空', async () => {
      const service = await createTestService();

      const group = service.getArrearsGroup('京X99999');
      expect(group).toBeNull();

      const detail = service.formatArrearsDetail('京X99999');
      expect(detail).toContain('未找到');
      expect(detail).toContain('京X99999');
    });

    test('对已结清车牌执行追缴应该被拒绝', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      service.processPaymentCallback(
        'pay-001',
        '京A12345',
        100.00,
        'wechat',
        new Date()
      );

      const result = service.performCollection('京A12345');
      expect(result.status).toContain('已结清');
      expect(result.actions.length).toBe(0);
    });

    test('操作历史应该完整记录所有变更', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      service.performCollection('京C11111');

      service.processPaymentCallback(
        'pay-001',
        '京C11111',
        30.00,
        'alipay',
        new Date()
      );

      const history = service.getOperationHistory('京C11111');

      const operations = history.map(h => h.operation);
      expect(operations).toContain('创建');
      expect(operations).toContain('更新');
      expect(operations).toContain('首次通知');

      expect(history.some(h => h.reason?.includes('支付回调'))).toBe(true);
    });
  });

  describe('数据关系测试', () => {
    test('停车流水和欠费合并应该正确关联', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const group = service.getArrearsGroup('京A12345');
      expect(group!.mergedRecordIds.length).toBe(3);

      const detail = service.formatArrearsDetail('京A12345');
      expect(detail).toContain('A-101');
      expect(detail).toContain('A-102');
      expect(detail).toContain('B-205');
      expect(detail).toContain('中关村停车场');
      expect(detail).toContain('五道口停车场');
    });

    test('识别车牌和手动车牌应该正确标记', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      const detail = service.formatArrearsDetail('京A12345');
      const lines = detail.split('\n');
      const recognizedCount = lines.filter(l => l.includes('车牌类型')).length;
      expect(recognizedCount).toBe(2);
    });

    test('追缴历史应该按时间倒序排列', async () => {
      const service = await createTestService();
      const records = createTestRecords();
      service.importRecords(records, { batchId: 'test-001' });

      service.performCollection('京A12345', { actionType: 'notify' });
      service.performCollection('京A12345', { actionType: 'reminder' });

      const history = service.getOperationHistory('京A12345');
      const notifyIndex = history.findIndex(h => h.operation === '首次通知');
      const reminderIndex = history.findIndex(h => h.operation === '再次提醒');

      expect(reminderIndex).toBeLessThan(notifyIndex);
    });
  });
});
