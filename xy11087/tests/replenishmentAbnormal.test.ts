import { importAbnormalRecords } from '../src/services/importService';
import { addRemarkAndContinue, updateAbnormalStatus, getAllRecords, clearAllRecords } from '../src/services/statusService';
import { dataStore } from '../src/store';
import { ReplenishmentAbnormalStatus, ReplenishmentAbnormalType } from '../src/types';

const createValidRecord = (overrides: any = {}) => ({
  abnormalNo: `RA${Date.now()}${Math.floor(Math.random() * 1000)}`,
  machineId: 'M001',
  machineName: 'A区1号售货机',
  pointId: 'P001',
  pointName: '科技园A座大堂',
  pointAddress: '深圳市南山区科技园A座1楼大堂',
  channelNo: 'A01',
  channelName: 'A层第1货道',
  productSku: 'SKU001',
  productName: '可口可乐330ml',
  actualProductSku: 'SKU002',
  actualProductName: '百事可乐330ml',
  abnormalType: ReplenishmentAbnormalType.CHANNEL_MISPLACEMENT,
  abnormalTypeDesc: '货道错放导致销售品名不一致',
  abnormalStatus: ReplenishmentAbnormalStatus.PENDING,
  expectedQty: 20,
  actualQty: 20,
  diffQty: 0,
  replenishmentTime: '2024-01-15T14:30:00',
  operatorId: 'OP001',
  operatorName: '张三',
  handlerId: 'HD001',
  handlerName: '李四',
  remark: '',
  ...overrides
});

describe('无人售货点售货机补货异常API测试', () => {
  beforeEach(() => {
    clearAllRecords();
  });

  describe('初始化数据测试', () => {
    it('应包含一条被暂停又恢复的记录，证明状态不是单向的', () => {
      const record = createValidRecord({
        abnormalNo: 'RA20240001',
        abnormalType: ReplenishmentAbnormalType.STOCK_SHORTAGE,
        abnormalTypeDesc: '补货时发现缺货'
      });

      const importResult = importAbnormalRecords([record]);
      expect(importResult.success).toBe(1);
      expect(importResult.failed).toBe(0);

      let result = updateAbnormalStatus('RA20240001', ReplenishmentAbnormalStatus.PROCESSING, 'OP002', '王五');
      expect(result.success).toBe(true);

      result = updateAbnormalStatus('RA20240001', ReplenishmentAbnormalStatus.SUSPENDED, 'OP002', '王五', '等待供应商补货');
      expect(result.success).toBe(true);

      result = updateAbnormalStatus('RA20240001', ReplenishmentAbnormalStatus.PROCESSING, 'OP002', '王五', '供应商已补货，恢复处理');
      expect(result.success).toBe(true);

      const updatedRecord = dataStore.get('RA20240001');
      expect(updatedRecord).toBeDefined();
      expect(updatedRecord!.statusHistory.length).toBeGreaterThanOrEqual(4);

      const statuses = updatedRecord!.statusHistory.map(h => h.status);
      expect(statuses).toContain(ReplenishmentAbnormalStatus.SUSPENDED);
      expect(statuses.filter(s => s === ReplenishmentAbnormalStatus.PROCESSING).length).toBe(2);
    });
  });

  describe('导入接口测试', () => {
    it('正常数据应导入成功', () => {
      const record = createValidRecord();
      const result = importAbnormalRecords([record]);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(1);
      expect(result.successItems[0].abnormalNo).toBe(record.abnormalNo);
    });

    it('重复提交应失败并提示', () => {
      const record = createValidRecord({ abnormalNo: 'RA2024TEST001' });
      let result = importAbnormalRecords([record]);
      expect(result.success).toBe(1);

      result = importAbnormalRecords([record]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.failedItems[0].reason).toContain('已存在');
      expect(result.failedItems[0].suggestion).toBeDefined();
      expect(result.failedItems[0].rowData.abnormalNo).toBe('RA2024TEST001');
    });

    it('缺少必填字段应失败并给出具体原因和建议', () => {
      const record = createValidRecord({
        abnormalNo: undefined,
        pointAddress: undefined,
        expectedQty: -5
      });
      const result = importAbnormalRecords([record]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.failedItems[0].reason).toContain('异常单号不能为空');
      expect(result.failedItems[0].reason).toContain('点位地址不能为空');
      expect(result.failedItems[0].suggestion).toBeDefined();
      expect(result.failedItems[0].rowData).toBeDefined();
    });

    it('货道错放类型允许直接导入为remarked状态', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024REMARK001',
        abnormalType: ReplenishmentAbnormalType.CHANNEL_MISPLACEMENT,
        abnormalStatus: ReplenishmentAbnormalStatus.REMARKED,
        remark: '已确认货道错放，现场调整完成'
      });
      const result = importAbnormalRecords([record]);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('补货差异不一致类型允许直接导入为remarked状态', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024REMARK002',
        abnormalType: ReplenishmentAbnormalType.REPLENISHMENT_DIFF_INCONSISTENCY,
        abnormalStatus: ReplenishmentAbnormalStatus.REMARKED,
        remark: '差异已核实，为系统统计误差'
      });
      const result = importAbnormalRecords([record]);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('其他异常类型不允许直接导入为remarked状态', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024REMARK003',
        abnormalType: ReplenishmentAbnormalType.MACHINE_FAULT,
        abnormalStatus: ReplenishmentAbnormalStatus.REMARKED
      });
      const result = importAbnormalRecords([record]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.failedItems[0].reason).toContain('不允许直接设置为已备注状态');
    });

    it('不能直接导入为closed状态', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024CLOSED001',
        abnormalStatus: ReplenishmentAbnormalStatus.CLOSED
      });
      const result = importAbnormalRecords([record]);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.failedItems[0].reason).toContain('不能直接创建已关闭状态');
    });

    it('批量导入时部分成功部分失败，失败记录包含原始数据', () => {
      const records = [
        createValidRecord({ abnormalNo: 'RA2024BATCH001' }),
        createValidRecord({ abnormalNo: 'RA2024BATCH002', machineId: undefined }),
        createValidRecord({ abnormalNo: 'RA2024BATCH003' }),
        createValidRecord({ abnormalNo: 'RA2024BATCH004', expectedQty: '不是数字' })
      ];

      const result = importAbnormalRecords(records);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(4);

      expect(result.failedItems[0].rowData.abnormalNo).toBe('RA2024BATCH002');
      expect(result.failedItems[0].reason).toBeDefined();
      expect(result.failedItems[0].suggestion).toBeDefined();

      expect(result.failedItems[1].rowData.abnormalNo).toBe('RA2024BATCH004');
    });

    it('样例数据应包含真实业务字段，不是只有编号和状态', () => {
      const record = createValidRecord();
      const result = importAbnormalRecords([record]);
      const imported = result.successItems[0];

      expect(imported.machineName).toBeDefined();
      expect(imported.pointName).toBeDefined();
      expect(imported.pointAddress).toBeDefined();
      expect(imported.channelName).toBeDefined();
      expect(imported.productName).toBeDefined();
      expect(imported.expectedQty).toBeDefined();
      expect(imported.actualQty).toBeDefined();
      expect(imported.diffQty).toBeDefined();
      expect(imported.replenishmentTime).toBeDefined();
      expect(imported.operatorName).toBeDefined();
    });
  });

  describe('状态流转测试', () => {
    it('pending -> processing 应成功', () => {
      const record = createValidRecord({ abnormalNo: 'RA2024STATUS001' });
      importAbnormalRecords([record]);

      const result = updateAbnormalStatus('RA2024STATUS001', ReplenishmentAbnormalStatus.PROCESSING, 'OP002', '王五');
      expect(result.success).toBe(true);
    });

    it('pending -> resolved 状态越级应失败', () => {
      const record = createValidRecord({ abnormalNo: 'RA2024STATUS002' });
      importAbnormalRecords([record]);

      const result = updateAbnormalStatus('RA2024STATUS002', ReplenishmentAbnormalStatus.RESOLVED, 'OP002', '王五');
      expect(result.success).toBe(false);
      expect(result.error).toContain('状态流转不合法');
    });

    it('suspended -> processing 应成功，证明可以从暂停恢复', () => {
      const record = createValidRecord({ abnormalNo: 'RA2024STATUS003' });
      importAbnormalRecords([record]);

      updateAbnormalStatus('RA2024STATUS003', ReplenishmentAbnormalStatus.PROCESSING, 'OP002', '王五');
      updateAbnormalStatus('RA2024STATUS003', ReplenishmentAbnormalStatus.SUSPENDED, 'OP002', '王五');

      const result = updateAbnormalStatus('RA2024STATUS003', ReplenishmentAbnormalStatus.PROCESSING, 'OP002', '王五', '恢复处理');
      expect(result.success).toBe(true);
    });

    it('closed 之后不能再流转', () => {
      const record = createValidRecord({ abnormalNo: 'RA2024STATUS004' });
      importAbnormalRecords([record]);

      updateAbnormalStatus('RA2024STATUS004', ReplenishmentAbnormalStatus.PROCESSING, 'OP002', '王五');
      updateAbnormalStatus('RA2024STATUS004', ReplenishmentAbnormalStatus.REMARKED, 'OP002', '王五');
      updateAbnormalStatus('RA2024STATUS004', ReplenishmentAbnormalStatus.RESOLVED, 'OP002', '王五');
      updateAbnormalStatus('RA2024STATUS004', ReplenishmentAbnormalStatus.CLOSED, 'OP002', '王五');

      const result = updateAbnormalStatus('RA2024STATUS004', ReplenishmentAbnormalStatus.PROCESSING, 'OP002', '王五');
      expect(result.success).toBe(false);
    });
  });

  describe('人工备注推进测试', () => {
    it('货道错放类型异常可以通过备注推进到remarked状态', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024REMARKTEST001',
        abnormalType: ReplenishmentAbnormalType.CHANNEL_MISPLACEMENT
      });
      importAbnormalRecords([record]);

      const result = addRemarkAndContinue({
        abnormalNo: 'RA2024REMARKTEST001',
        remark: '现场已核实，货道商品放错，已调整完成',
        operatorId: 'OP003',
        operatorName: '赵六'
      });

      expect(result.success).toBe(true);
      expect(result.data!.abnormalStatus).toBe(ReplenishmentAbnormalStatus.REMARKED);
      expect(result.data!.remark).toBe('现场已核实，货道商品放错，已调整完成');
    });

    it('补货差异不一致类型异常可以通过备注推进到remarked状态', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024REMARKTEST002',
        abnormalType: ReplenishmentAbnormalType.REPLENISHMENT_DIFF_INCONSISTENCY,
        expectedQty: 30,
        actualQty: 25,
        diffQty: 5
      });
      importAbnormalRecords([record]);

      const result = addRemarkAndContinue({
        abnormalNo: 'RA2024REMARKTEST002',
        remark: '差异已核实，为仓库出库时少发5件，已记录',
        operatorId: 'OP003',
        operatorName: '赵六'
      });

      expect(result.success).toBe(true);
      expect(result.data!.abnormalStatus).toBe(ReplenishmentAbnormalStatus.REMARKED);
    });

    it('机器故障类型异常不能通过备注推进', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024REMARKTEST003',
        abnormalType: ReplenishmentAbnormalType.MACHINE_FAULT
      });
      importAbnormalRecords([record]);

      const result = addRemarkAndContinue({
        abnormalNo: 'RA2024REMARKTEST003',
        remark: '已联系维修人员',
        operatorId: 'OP003',
        operatorName: '赵六'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('不允许通过备注推进');
    });

    it('remarked状态的记录不能再次通过备注推进', () => {
      const record = createValidRecord({
        abnormalNo: 'RA2024REMARKTEST004',
        abnormalType: ReplenishmentAbnormalType.CHANNEL_MISPLACEMENT,
        abnormalStatus: ReplenishmentAbnormalStatus.REMARKED
      });
      importAbnormalRecords([record]);

      const result = addRemarkAndContinue({
        abnormalNo: 'RA2024REMARKTEST004',
        remark: '再次备注',
        operatorId: 'OP003',
        operatorName: '赵六'
      });

      expect(result.success).toBe(false);
    });
  });
});
