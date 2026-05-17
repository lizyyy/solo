import { diffService } from '../services/diffService';
import { ArrivalStatus } from '../types';
import { dataStore } from '../store/dataStore';

describe('采购协同系统到货差异确认 - 业务规则测试', () => {
  beforeEach(() => {
    (dataStore as any).diffRecords.clear();
    (dataStore as any).historyRecords.clear();
  });

  describe('1. 完整流转测试', () => {
    it('完整流程: 待到货 -> 差异待确认 -> 已确认 -> 已入库', () => {
      const record = diffService.createRecord({
        orderNo: 'PO-TEST-FLOW-001',
        arrivalQuantity: 0,
        inspectionQuantity: 0,
        diffDescription: '等待到货',
        supplierId: 'SUP-001',
        supplierName: '测试供应商',
        materialId: 'MAT-001',
        materialName: '测试物料',
        unit: '个',
        orderQuantity: 1000
      }, '测试员A');

      expect(record.status).toBe(ArrivalStatus.PENDING_ARRIVAL);
      expect(record.diffQuantity).toBe(0);

      const step1 = diffService.updateRecord(record.id, {
        arrivalQuantity: 1000,
        inspectionQuantity: 950,
        diffDescription: '到货短缺50个，物流损坏'
      }, '测试员A');
      expect(step1.status).toBe(ArrivalStatus.DIFF_PENDING_CONFIRM);
      expect(step1.diffQuantity).toBe(50);

      const step2 = diffService.updateRecord(record.id, {
        status: ArrivalStatus.CONFIRMED,
        remarks: '差异已确认，供应商同意补发'
      }, '测试员B');
      expect(step2.status).toBe(ArrivalStatus.CONFIRMED);

      const step3 = diffService.updateRecord(record.id, {
        status: ArrivalStatus.STOCKED
      }, '仓库管理员');
      expect(step3.status).toBe(ArrivalStatus.STOCKED);

      const history = diffService.getHistory(record.id);
      expect(history.length).toBeGreaterThanOrEqual(4);
      expect(history[history.length - 1].action).toBe('创建差异记录');
    });

    it('列表、详情、历史互相对齐', () => {
      const created = diffService.createRecord({
        orderNo: 'PO-TEST-ALIGN-001',
        arrivalQuantity: 100,
        inspectionQuantity: 90,
        diffDescription: '少10个',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 100
      });

      const list = diffService.getAllRecords();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(created.id);

      const detail = diffService.getRecord(created.id)!;
      expect(detail.orderNo).toBe(list[0].orderNo);
      expect(detail.arrivalQuantity).toBe(list[0].arrivalQuantity);

      const history = diffService.getHistory(created.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].recordId).toBe(created.id);

      const exported = diffService.exportRecords();
      expect(exported.length).toBe(1);
      expect(exported[0]['采购单号']).toBe(created.orderNo);
    });
  });

  describe('2. 冲突记录测试', () => {
    it('同采购单未关闭记录存在时创建新记录触发冲突', () => {
      diffService.createRecord({
        orderNo: 'PO-TEST-CONFLICT-001',
        arrivalQuantity: 100,
        inspectionQuantity: 90,
        diffDescription: '差异待确认',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 100
      });

      expect(() => {
        diffService.createRecord({
          orderNo: 'PO-TEST-CONFLICT-001',
          arrivalQuantity: 10,
          inspectionQuantity: 10,
          diffDescription: '补发',
          supplierId: 'SUP-001',
          supplierName: '供应商A',
          materialId: 'MAT-001',
          materialName: '物料X',
          unit: '个',
          orderQuantity: 10,
          isResupplied: true
        });
      }).toThrow(/\[RULE_CONFLICT\]/);
    });

    it('原记录关闭后可创建补发记录', () => {
      const original = diffService.createRecord({
        orderNo: 'PO-TEST-RESUPPLY-001',
        arrivalQuantity: 100,
        inspectionQuantity: 90,
        diffDescription: '差异待确认',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 100
      });

      diffService.updateRecord(original.id, {
        status: ArrivalStatus.CONFIRMED
      });

      diffService.updateRecord(original.id, {
        status: ArrivalStatus.STOCKED
      });

      const resupply = diffService.createRecord({
        orderNo: 'PO-TEST-RESUPPLY-001',
        arrivalQuantity: 10,
        inspectionQuantity: 10,
        diffDescription: '供应商补发',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 10,
        isResupplied: true,
        originalRecordId: original.id
      });

      expect(resupply.isResupplied).toBe(true);
      expect(resupply.originalRecordId).toBe(original.id);
    });

    it('已入库记录不可修改', () => {
      const record = diffService.createRecord({
        orderNo: 'PO-TEST-LOCKED-001',
        arrivalQuantity: 100,
        inspectionQuantity: 100,
        diffDescription: '无差异',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 100
      });

      diffService.updateRecord(record.id, {
        status: ArrivalStatus.STOCKED
      });

      expect(() => {
        diffService.updateRecord(record.id, {
          remarks: '尝试修改'
        });
      }).toThrow(/\[RULE_STATUS\]/);
    });

    it('状态流转校验', () => {
      const record = diffService.createRecord({
        orderNo: 'PO-TEST-TRANSITION-001',
        arrivalQuantity: 0,
        inspectionQuantity: 0,
        diffDescription: '待到货',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 100
      });

      expect(() => {
        diffService.updateRecord(record.id, {
          status: ArrivalStatus.STOCKED
        });
      }).toThrow(/\[RULE_TRANSITION\]/);
    });
  });

  describe('3. 导入坏行测试', () => {
    it('导入数据校验失败时标记错误', () => {
      const testRows = [
        {
          orderNo: 'PO-IMPORT-GOOD-001',
          arrivalQuantity: 100,
          inspectionQuantity: 95,
          diffDescription: '正常数据',
          supplierId: 'SUP-001',
          supplierName: '供应商A',
          materialId: 'MAT-001',
          materialName: '物料X',
          unit: '个',
          orderQuantity: 100
        },
        {
          orderNo: '',
          arrivalQuantity: 100,
          inspectionQuantity: 95,
          diffDescription: '采购单号为空',
          supplierId: 'SUP-001',
          supplierName: '供应商A',
          materialId: 'MAT-001',
          materialName: '物料X'
        },
        {
          orderNo: 'PO-IMPORT-BAD-NEG',
          arrivalQuantity: -10,
          inspectionQuantity: 95,
          diffDescription: '到货数量负数',
          supplierId: 'SUP-001',
          supplierName: '供应商A',
          materialId: 'MAT-001',
          materialName: '物料X'
        },
        {
          orderNo: 'PO-IMPORT-BAD-NAN',
          arrivalQuantity: '不是数字',
          inspectionQuantity: 95,
          diffDescription: '到货数量非数字',
          supplierId: 'SUP-001',
          supplierName: '供应商A',
          materialId: 'MAT-001',
          materialName: '物料X'
        },
        {
          orderNo: 'PO-IMPORT-BAD-EMPTY',
          arrivalQuantity: '',
          inspectionQuantity: 95,
          diffDescription: '到货数量为空',
          supplierId: 'SUP-001',
          supplierName: '供应商A',
          materialId: 'MAT-001',
          materialName: '物料X'
        }
      ];

      const result = diffService.batchImport(testRows, '导入员');

      expect(result.success).toBe(1);
      expect(result.failed).toBe(4);
      expect(result.errors.length).toBe(4);

      const row2Error = result.errors.find(e => e.row === 2)!;
      expect(row2Error.errors.some(e => e.includes('[RULE_ORDER_NO]'))).toBe(true);

      const row3Error = result.errors.find(e => e.row === 3)!;
      expect(row3Error.errors.some(e => e.includes('[RULE_ARRIVAL]'))).toBe(true);

      const row4Error = result.errors.find(e => e.row === 4)!;
      expect(row4Error.errors.some(e => e.includes('[RULE_ARRIVAL]'))).toBe(true);

      const row5Error = result.errors.find(e => e.row === 5)!;
      expect(row5Error.errors.some(e => e.includes('[RULE_ARRIVAL]'))).toBe(true);
    });

    it('导入冲突行失败', () => {
      diffService.createRecord({
        orderNo: 'PO-IMPORT-CONFLICT-001',
        arrivalQuantity: 100,
        inspectionQuantity: 90,
        diffDescription: '已存在',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 100
      });

      const testRows = [
        {
          orderNo: 'PO-IMPORT-CONFLICT-001',
          arrivalQuantity: 100,
          inspectionQuantity: 90,
          diffDescription: '冲突',
          supplierId: 'SUP-001',
          supplierName: '供应商A',
          materialId: 'MAT-001',
          materialName: '物料X',
          unit: '个',
          orderQuantity: 100
        }
      ];

      const result = diffService.batchImport(testRows, '导入员');
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].errors[0]).toContain('[RULE_CONFLICT]');
    });
  });

  describe('4. 单条人工备注处理', () => {
    it('可添加备注继续处理', () => {
      const record = diffService.createRecord({
        orderNo: 'PO-TEST-REMARK-001',
        arrivalQuantity: 100,
        inspectionQuantity: 90,
        diffDescription: '差异待确认',
        supplierId: 'SUP-001',
        supplierName: '供应商A',
        materialId: 'MAT-001',
        materialName: '物料X',
        unit: '个',
        orderQuantity: 100
      });

      const updated = diffService.updateRecord(record.id, {
        remarks: '已联系供应商，确认下周二补发'
      }, '采购员');

      expect(updated.remarks).toBe('已联系供应商，确认下周二补发');

      const history = diffService.getHistory(record.id);
      const updateHistory = history.find(h => h.action === '更新差异记录');
      expect(updateHistory).toBeDefined();
      expect(updateHistory!.changedFields).toContain('remarks');
    });
  });
});
