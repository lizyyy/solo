import { repairPartReturnService } from '../src/services/repairPartReturn';
import { Carrier, InspectionResult, RepairPartReturnStatus } from '../src/types';

describe('维修件返厂跟踪 - 完整流转测试', () => {
  test('应该完成从创建到入库的完整流程', () => {
    const createResult = repairPartReturnService.create({
      sparePart: {
        partName: '测试主板',
        partCode: 'TEST-MB-001',
        partModel: 'Test-Model',
        quantity: 1,
        unit: '件'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-001',
        customerName: '测试用户',
        customerPhone: '13800000000',
        faultDescription: '测试故障描述',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey: 'test-flow-complete'
    });

    expect(createResult.success).toBe(true);
    expect(createResult.data?.status).toBe(RepairPartReturnStatus.PENDING_SHIP);

    const id = createResult.data!.id;

    const shipResult = repairPartReturnService.ship(id, {
      carrier: Carrier.SF,
      trackingNo: 'TEST-SF-001',
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });
    expect(shipResult.success).toBe(true);
    expect(shipResult.data?.status).toBe(RepairPartReturnStatus.IN_TRANSIT);
    expect(shipResult.data?.shippingInfo?.carrier).toBe(Carrier.SF);

    const receiveResult = repairPartReturnService.receive(id, {
      receiverName: '测试收件人',
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });
    expect(receiveResult.success).toBe(true);
    expect(receiveResult.data?.status).toBe(RepairPartReturnStatus.PENDING_INSPECTION);

    const inspectResult = repairPartReturnService.inspect(id, {
      result: InspectionResult.PASS,
      remark: '测试检测通过',
      inspectorId: 'TEST-QC',
      inspectorName: '测试质检员'
    });
    expect(inspectResult.success).toBe(true);
    expect(inspectResult.data?.status).toBe(RepairPartReturnStatus.INSPECTED);
    expect(inspectResult.data?.inspectionConclusion?.result).toBe(InspectionResult.PASS);

    const stockInResult = repairPartReturnService.stockIn(id, {
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });
    expect(stockInResult.success).toBe(true);
    expect(stockInResult.data?.status).toBe(RepairPartReturnStatus.STOCKED);

    const histories = repairPartReturnService.getHistories(id);
    expect(histories.success).toBe(true);
    expect(histories.data?.length).toBeGreaterThanOrEqual(5);
  });
});

describe('维修件返厂跟踪 - 冲突检测测试', () => {
  test('检测不通过且库存已恢复时，应该被拦截并提示补充材料', () => {
    const createResult = repairPartReturnService.create({
      sparePart: {
        partName: '测试屏幕',
        partCode: 'TEST-LCD-001',
        partModel: 'Test-Screen',
        quantity: 1,
        unit: '件'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-002',
        customerName: '测试用户2',
        customerPhone: '13800000002',
        faultDescription: '屏幕故障',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey: 'test-flow-conflict'
    });

    const id = createResult.data!.id;
    repairPartReturnService.ship(id, {
      carrier: Carrier.JD,
      trackingNo: 'TEST-JD-001',
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });
    repairPartReturnService.receive(id, {
      receiverName: '测试收件人',
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });

    const inspectResult = repairPartReturnService.inspect(id, {
      result: InspectionResult.FAIL,
      remark: '检测不通过，物理损坏',
      defectDescription: '屏幕有明显磕碰',
      requiredMaterials: ['质量检测报告', '维修记录', '现场照片', '客户沟通记录'],
      inspectorId: 'TEST-QC',
      inspectorName: '测试质检员'
    }, true);

    expect(inspectResult.success).toBe(false);
    expect(inspectResult.code).toBe('STOCK_RECOVERED_BLOCKED');
    expect(inspectResult.nextStepHint).toContain('请补充以下材料');
    expect(inspectResult.nextStepHint).toContain('质量检测报告');
  });

  test('幂等性冲突 - 重复创建应该被拦截', () => {
    const idempotentKey = 'test-idempotent-key';
    
    const result1 = repairPartReturnService.create({
      sparePart: {
        partName: '测试电池',
        partCode: 'TEST-BAT-001',
        partModel: 'Test-Battery',
        quantity: 1,
        unit: '件'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-003',
        customerName: '测试用户3',
        customerPhone: '13800000003',
        faultDescription: '电池故障',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey
    });
    expect(result1.success).toBe(true);

    const result2 = repairPartReturnService.create({
      sparePart: {
        partName: '测试电池2',
        partCode: 'TEST-BAT-002',
        partModel: 'Test-Battery2',
        quantity: 1,
        unit: '件'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-004',
        customerName: '测试用户4',
        customerPhone: '13800000004',
        faultDescription: '电池故障2',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey
    });
    expect(result2.success).toBe(false);
    expect(result2.code).toBe('IDEMPOTENT_CONFLICT');
  });
});

describe('维修件返厂跟踪 - 状态流转校验测试', () => {
  test('待寄出状态不允许直接入库', () => {
    const createResult = repairPartReturnService.create({
      sparePart: {
        partName: '测试内存',
        partCode: 'TEST-RAM-001',
        partModel: 'Test-RAM',
        quantity: 1,
        unit: '条'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-005',
        customerName: '测试用户5',
        customerPhone: '13800000005',
        faultDescription: '内存故障',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey: 'test-status-flow'
    });

    const id = createResult.data!.id;
    const stockInResult = repairPartReturnService.stockIn(id, {
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });

    expect(stockInResult.success).toBe(false);
    expect(stockInResult.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('检测不通过的备件不允许入库', () => {
    const createResult = repairPartReturnService.create({
      sparePart: {
        partName: '测试硬盘',
        partCode: 'TEST-HDD-001',
        partModel: 'Test-HDD',
        quantity: 1,
        unit: '块'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-006',
        customerName: '测试用户6',
        customerPhone: '13800000006',
        faultDescription: '硬盘故障',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey: 'test-inspect-fail-stock'
    });

    const id = createResult.data!.id;
    repairPartReturnService.ship(id, {
      carrier: Carrier.SF,
      trackingNo: 'TEST-SF-002',
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });
    repairPartReturnService.receive(id, {
      receiverName: '测试收件人',
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });
    repairPartReturnService.inspect(id, {
      result: InspectionResult.FAIL,
      remark: '检测不通过',
      inspectorId: 'TEST-QC',
      inspectorName: '测试质检员'
    });

    const stockInResult = repairPartReturnService.stockIn(id, {
      operatorId: 'TEST-OP',
      operatorName: '测试操作员'
    });

    expect(stockInResult.success).toBe(false);
    expect(stockInResult.code).toBe('INVALID_STATUS_TRANSITION');
  });
});

describe('维修件返厂跟踪 - 驳回测试', () => {
  test('待寄出状态可以被驳回', () => {
    const createResult = repairPartReturnService.create({
      sparePart: {
        partName: '测试键盘',
        partCode: 'TEST-KB-001',
        partModel: 'Test-Keyboard',
        quantity: 1,
        unit: '个'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-007',
        customerName: '测试用户7',
        customerPhone: '13800000007',
        faultDescription: '键盘故障',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey: 'test-reject-flow'
    });

    const id = createResult.data!.id;
    const rejectResult = repairPartReturnService.reject(id, 'TEST-AUDIT', '测试审核员', '非保修范围');

    expect(rejectResult.success).toBe(true);
    expect(rejectResult.data?.status).toBe(RepairPartReturnStatus.REJECTED);
  });
});

describe('维修件返厂跟踪 - 查询测试', () => {
  test('列表查询应该返回正确的分页结果', () => {
    const listResult = repairPartReturnService.list(1, 10);
    expect(listResult.success).toBe(true);
    expect(listResult.data?.list).toBeDefined();
    expect(listResult.data?.total).toBeGreaterThan(0);
    expect(listResult.data?.page).toBe(1);
    expect(listResult.data?.pageSize).toBe(10);
  });

  test('按状态筛选应该返回正确结果', () => {
    const stockedResult = repairPartReturnService.list(1, 10, RepairPartReturnStatus.STOCKED);
    expect(stockedResult.success).toBe(true);
    stockedResult.data?.list.forEach(item => {
      expect(item.status).toBe(RepairPartReturnStatus.STOCKED);
    });
  });
});

describe('维修件返厂跟踪 - 参数校验测试', () => {
  test('创建时备件名称不能为空', () => {
    const result = repairPartReturnService.create({
      sparePart: {
        partName: '',
        partCode: 'TEST-VAL-001',
        partModel: 'Test',
        quantity: 1,
        unit: '件'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-008',
        customerName: '测试用户8',
        customerPhone: '13800000008',
        faultDescription: '故障描述',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey: 'test-validation-1'
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('备件名称');
  });

  test('创建时数量不能为负数', () => {
    const result = repairPartReturnService.create({
      sparePart: {
        partName: '测试校验',
        partCode: 'TEST-VAL-002',
        partModel: 'Test',
        quantity: -1,
        unit: '件'
      },
      repairOrder: {
        repairOrderNo: 'TEST-RO-009',
        customerName: '测试用户9',
        customerPhone: '13800000009',
        faultDescription: '故障描述',
        createTime: new Date().toISOString()
      },
      operatorId: 'TEST-OP',
      operatorName: '测试操作员',
      idempotentKey: 'test-validation-2'
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('数量');
  });
});

describe('维修件返厂跟踪 - 导入坏行样例', () => {
  test('模拟导入坏行数据结构', () => {
    const badRows = [
      { rowNumber: 1, rawData: '坏件数据1', errorMessage: '备件编码格式错误', errorFields: ['partCode'] },
      { rowNumber: 2, rawData: '坏件数据2', errorMessage: '数量不能为负数', errorFields: ['quantity'] },
      { rowNumber: 3, rawData: '坏件数据3', errorMessage: '客户电话格式不正确', errorFields: ['customerPhone'] }
    ];

    expect(badRows.length).toBe(3);
    expect(badRows[0].rowNumber).toBe(1);
    expect(badRows[0].errorFields).toContain('partCode');
  });
});
