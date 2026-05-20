import dataStore from '../src/models/DataStore';
import recordService from '../src/services/RecordService';
import batchService from '../src/services/BatchService';
import exportService from '../src/services/ExportService';
import { Receipt, Member, ActivityRule, MemberLevel, RecordStatus, BoundaryType } from '../src/types';

describe('RecordService - 边界场景测试', () => {
  let testBatchId: string;
  let testActivity: ActivityRule;
  let testMember: Member;

  beforeEach(() => {
    dataStore.clear();
    
    testActivity = {
      id: 'act_001',
      activityCode: 'TEST_PROMO',
      activityName: '测试活动',
      startTime: new Date('2024-05-01'),
      endTime: new Date('2024-05-31'),
      applicableStores: ['STORE001'],
      applicableLevels: [MemberLevel.GOLD, MemberLevel.PLATINUM],
      minAmount: 100,
      pointMultiplier: 2,
      maxPointsPerReceipt: 500,
      description: '测试活动描述'
    };
    dataStore.saveActivityRule(testActivity);

    testMember = {
      id: 'mem_001',
      memberId: 'M001',
      name: '测试会员',
      phone: '13800138000',
      level: MemberLevel.GOLD,
      points: 1000,
      registerTime: new Date('2023-01-01')
    };

    const batch = batchService.createBatch('测试批次', 'TEST_PROMO', 'STORE001', 'test_operator');
    testBatchId = batch.id;
  });

  test('退货冲正 - 应生成负数积分并标记边界', () => {
    const returnReceipt: Receipt = {
      id: 'r_001',
      receiptNo: 'RT20240501001',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 200,
      discountAmount: 0,
      payAmount: 200,
      items: [],
      isReturn: true,
      originalReceiptNo: 'ORIG20240501001'
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      returnReceipt,
      testMember,
      testActivity,
      'test_operator'
    );

    expect(record.calculatedPoints).toBeLessThan(0);
    expect(record.boundaryInfo).toBeDefined();
    expect(record.boundaryInfo?.type).toBe(BoundaryType.RETURN_REVERSAL);
    expect(record.boundaryInfo?.description).toContain('退货冲正');
    expect(record.isReturn).toBe(true);
  });

  test('倍率边界 - 积分超过上限时应封顶', () => {
    const largeReceipt: Receipt = {
      id: 'r_002',
      receiptNo: 'RX20240501002',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 350,
      discountAmount: 0,
      payAmount: 350,
      items: [],
      isReturn: false
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      largeReceipt,
      testMember,
      testActivity,
      'test_operator'
    );

    expect(record.calculatedPoints).toBe(500);
    expect(record.boundaryInfo).toBeDefined();
    expect(record.boundaryInfo?.type).toBe(BoundaryType.MULTIPLIER_BOUNDARY);
    expect(record.boundaryInfo?.detail).toContain('上限');
  });

  test('重复补录 - 同一张小票再次导入应标记', () => {
    const receipt: Receipt = {
      id: 'r_003',
      receiptNo: 'RX20240501003',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 150,
      discountAmount: 0,
      payAmount: 150,
      items: [],
      isReturn: false
    };

    const firstRecord = recordService.createProcessingRecord(
      testBatchId,
      receipt,
      testMember,
      testActivity,
      'test_operator'
    );

    const secondRecord = recordService.createProcessingRecord(
      testBatchId,
      receipt,
      testMember,
      testActivity,
      'test_operator'
    );

    expect(secondRecord.boundaryInfo).toBeDefined();
    expect(secondRecord.boundaryInfo?.type).toBe(BoundaryType.DUPLICATE_REIMPORT);
    expect(secondRecord.calculatedPoints).toBe(0);
  });

  test('金额边界 - 低于最低消费金额不产生积分', () => {
    const smallReceipt: Receipt = {
      id: 'r_004',
      receiptNo: 'RX20240501004',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 50,
      discountAmount: 0,
      payAmount: 50,
      items: [],
      isReturn: false
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      smallReceipt,
      testMember,
      testActivity,
      'test_operator'
    );

    expect(record.calculatedPoints).toBe(0);
    expect(record.boundaryInfo).toBeDefined();
    expect(record.boundaryInfo?.type).toBe(BoundaryType.AMOUNT_BOUNDARY);
  });

  test('时间边界 - 交易时间不在活动期内', () => {
    const offTimeReceipt: Receipt = {
      id: 'r_005',
      receiptNo: 'RX20240501005',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-04-15'),
      totalAmount: 200,
      discountAmount: 0,
      payAmount: 200,
      items: [],
      isReturn: false
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      offTimeReceipt,
      testMember,
      testActivity,
      'test_operator'
    );

    expect(record.calculatedPoints).toBe(0);
    expect(record.boundaryInfo).toBeDefined();
    expect(record.boundaryInfo?.type).toBe(BoundaryType.TIME_BOUNDARY);
  });

  test('等级边界 - 会员等级不满足要求', () => {
    const normalMember: Member = {
      ...testMember,
      id: 'mem_002',
      memberId: 'M002',
      level: MemberLevel.NORMAL
    };

    const receipt: Receipt = {
      id: 'r_006',
      receiptNo: 'RX20240501006',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M002',
      memberPhone: '13800138001',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 200,
      discountAmount: 0,
      payAmount: 200,
      items: [],
      isReturn: false
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      receipt,
      normalMember,
      testActivity,
      'test_operator'
    );

    expect(record.calculatedPoints).toBe(0);
    expect(record.boundaryInfo).toBeDefined();
    expect(record.boundaryInfo?.type).toBe(BoundaryType.LEVEL_BOUNDARY);
  });

  test('正常记录 - 无边界情况正常计算积分', () => {
    const normalReceipt: Receipt = {
      id: 'r_007',
      receiptNo: 'RX20240501007',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 200,
      discountAmount: 0,
      payAmount: 200,
      items: [],
      isReturn: false
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      normalReceipt,
      testMember,
      testActivity,
      'test_operator'
    );

    expect(record.calculatedPoints).toBe(400);
    expect(record.boundaryInfo).toBeUndefined();
    expect(record.status).toBe(RecordStatus.PENDING);
  });

  test('状态流转 - 审核通过后状态正确更新', () => {
    const receipt: Receipt = {
      id: 'r_008',
      receiptNo: 'RX20240501008',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 200,
      discountAmount: 0,
      payAmount: 200,
      items: [],
      isReturn: false
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      receipt,
      testMember,
      testActivity,
      'test_operator'
    );

    const approvedRecord = recordService.approveRecord(record.id, 'manager_001', '信息无误，审核通过');

    expect(approvedRecord.status).toBe(RecordStatus.APPROVED);
    expect(approvedRecord.auditTrail.length).toBe(2);
    expect(approvedRecord.auditTrail[1].operator).toBe('manager_001');
    expect(approvedRecord.auditTrail[1].reason).toBe('信息无误，审核通过');
  });

  test('决策说明 - 应生成可读的决策说明', () => {
    const returnReceipt: Receipt = {
      id: 'r_009',
      receiptNo: 'RT20240501009',
      storeCode: 'STORE001',
      storeName: '测试门店',
      memberId: 'M001',
      memberPhone: '13800138000',
      transactionTime: new Date('2024-05-15'),
      totalAmount: 200,
      discountAmount: 0,
      payAmount: 200,
      items: [],
      isReturn: true,
      originalReceiptNo: 'ORIG20240501009'
    };

    const record = recordService.createProcessingRecord(
      testBatchId,
      returnReceipt,
      testMember,
      testActivity,
      'test_operator'
    );

    const explanation = recordService.getDecisionExplanation(record.id);

    expect(explanation).toContain('退货冲正');
    expect(explanation).toContain('基本信息');
    expect(explanation).toContain('处理轨迹');
    expect(explanation).toContain('test_operator');
  });

  test('导出一致性 - 导出数量应与查询结果一致', () => {
    for (let i = 0; i < 10; i++) {
      const receipt: Receipt = {
        id: `r_${i}`,
        receiptNo: `RX202405010${i}`,
        storeCode: 'STORE001',
        storeName: '测试门店',
        memberId: 'M001',
        memberPhone: '13800138000',
        transactionTime: new Date('2024-05-15'),
        totalAmount: 150 + i * 10,
        discountAmount: 0,
        payAmount: 150 + i * 10,
        items: [],
        isReturn: false
      };

      recordService.createProcessingRecord(
        testBatchId,
        receipt,
        testMember,
        testActivity,
        'test_operator'
      );
    }

    const isConsistent = exportService.verifyExportConsistency({ page: 1, pageSize: 20 });
    expect(isConsistent).toBe(true);
  });
});
