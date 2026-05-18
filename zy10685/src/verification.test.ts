import { verificationService } from './service';
import { store } from './store';
import { VerificationStatus } from './types';

describe('售票核销服务团体票分批核销', () => {
  beforeEach(() => {
    store.reset();
  });

  describe('完整流转', () => {
    it('从待核销 -> 部分核销 -> 已核销 状态流转正确', async () => {
      const batches = store.getAllTicketBatches();
      const testBatch = batches.find(b => b.remark === '测试批次-完整流转');
      expect(testBatch).toBeDefined();
      expect(testBatch!.status).toBe(VerificationStatus.PENDING);
      expect(testBatch!.remainingQuantity).toBe(50);
      expect(testBatch!.verifiedQuantity).toBe(0);

      const points = store.getAllVerificationPoints();
      const point = points[0];

      const result1 = await verificationService.verify({
        batchId: testBatch!.id,
        verificationPointId: point.id,
        quantity: 20,
        operatorName: '测试核销员',
        remark: '第一次核销'
      });

      expect(result1.success).toBe(true);
      expect(result1.data!.batch.status).toBe(VerificationStatus.PARTIAL);
      expect(result1.data!.batch.remainingQuantity).toBe(30);
      expect(result1.data!.batch.verifiedQuantity).toBe(20);
      expect(result1.data!.record.quantity).toBe(20);
      expect(result1.data!.record.statusBefore).toBe(VerificationStatus.PENDING);
      expect(result1.data!.record.statusAfter).toBe(VerificationStatus.PARTIAL);

      const result2 = await verificationService.verify({
        batchId: testBatch!.id,
        verificationPointId: point.id,
        quantity: 30,
        operatorName: '测试核销员',
        remark: '第二次核销（完成）'
      });

      expect(result2.success).toBe(true);
      expect(result2.data!.batch.status).toBe(VerificationStatus.COMPLETED);
      expect(result2.data!.batch.remainingQuantity).toBe(0);
      expect(result2.data!.batch.verifiedQuantity).toBe(50);
      expect(result2.data!.record.statusBefore).toBe(VerificationStatus.PARTIAL);
      expect(result2.data!.record.statusAfter).toBe(VerificationStatus.COMPLETED);

      const history = store.getVerificationRecordsByBatchId(testBatch!.id);
      expect(history.length).toBe(2);
      expect(history[0].remark).toBe('第二次核销（完成）');
      expect(history[1].remark).toBe('第一次核销');

      const updatedBatch = store.getTicketBatch(testBatch!.id);
      expect(updatedBatch!.version).toBe(3);
    });

    it('列表、详情、历史数据一致', async () => {
      const batches = store.getAllTicketBatches();
      const batch = batches[0];
      
      const detail = store.getTicketBatch(batch.id);
      expect(detail).toBeDefined();
      expect(detail!.batchNo).toBe(batch.batchNo);
      expect(detail!.teamName).toBe(batch.teamName);
      
      const history = store.getVerificationRecordsByBatchId(batch.id);
      history.forEach(record => {
        expect(record.batchId).toBe(batch.id);
        expect(record.batchNo).toBe(batch.batchNo);
        expect(record.teamName).toBe(batch.teamName);
      });
    });
  });

  describe('冲突记录', () => {
    it('并发核销时拦截并提示所需材料和下一步', async () => {
      const batches = store.getAllTicketBatches();
      const testBatch = batches.find(b => b.remark === '测试批次-冲突记录');
      expect(testBatch).toBeDefined();

      const points = store.getAllVerificationPoints();
      const point = points[0];

      await store.acquireLock(testBatch!.id);

      const conflictResult = await verificationService.verify({
        batchId: testBatch!.id,
        verificationPointId: point.id,
        quantity: 5,
        operatorName: '冲突测试员',
        remark: ''
      });

      expect(conflictResult.success).toBe(false);
      expect((conflictResult.error as any).errorCode).toBe('CONCURRENT_CONFLICT');
      expect((conflictResult.error as any).message).toContain('正在被其他操作处理');
      
      const error = conflictResult.error as any;
      expect(error.requiredDocuments).toBeDefined();
      expect(error.requiredDocuments.length).toBeGreaterThan(0);
      expect(error.requiredDocuments).toContain('团体票核销授权书（加盖公章）');
      expect(error.requiredDocuments).toContain('核销人员工作证明');
      expect(error.requiredDocuments).toContain('现场照片（包含核销点标识）');
      expect(error.requiredDocuments).toContain('冲突情况书面说明');
      
      expect(error.nextSteps).toBeDefined();
      expect(error.nextSteps.length).toBeGreaterThan(0);
      expect(error.nextSteps.some((s: string) => s.includes('暂停'))).toBe(true);
      expect(error.nextSteps.some((s: string) => s.includes('收集'))).toBe(true);
      expect(error.nextSteps.some((s: string) => s.includes('联系'))).toBe(true);
      expect(error.nextSteps.some((s: string) => s.includes('审核'))).toBe(true);

      store.releaseLock(testBatch!.id);

      const normalResult = await verificationService.verify({
        batchId: testBatch!.id,
        verificationPointId: point.id,
        quantity: 5,
        operatorName: '正常测试员',
        remark: '锁释放后正常核销'
      });

      expect(normalResult.success).toBe(true);
      expect(normalResult.data!.batch.remainingQuantity).toBe(15);
    });
  });

  describe('导入坏行', () => {
    it('导入时校验坏行，正确统计成功和错误数量', async () => {
      const batches = store.getAllTicketBatches();
      const validBatch = batches[0];
      const points = store.getAllVerificationPoints();
      const validPoint = points[0];

      const importRows = [
        {
          '票批次号': validBatch.batchNo,
          '核销点名称': validPoint.name,
          '核销数量': 5,
          '操作人姓名': '导入测试员',
          '备注': '正常行'
        },
        {
          '票批次号': '',
          '核销点名称': validPoint.name,
          '核销数量': 5,
          '操作人姓名': '导入测试员',
          '备注': '缺少票批次号'
        },
        {
          '票批次号': validBatch.batchNo,
          '核销点名称': '不存在的核销点',
          '核销数量': 5,
          '操作人姓名': '导入测试员',
          '备注': '核销点不存在'
        },
        {
          '票批次号': validBatch.batchNo,
          '核销点名称': validPoint.name,
          '核销数量': -1,
          '操作人姓名': '导入测试员',
          '备注': '数量非法'
        },
        {
          '票批次号': validBatch.batchNo,
          '核销点名称': validPoint.name,
          '核销数量': 999999,
          '操作人姓名': '导入测试员',
          '备注': '超出剩余数量'
        }
      ];

      const result = await verificationService.processImport(importRows);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(4);
      expect(result.errors.length).toBe(4);

      expect(result.errors[0].rowNumber).toBe(2);
      expect(result.errors[0].errors).toContain('票批次号不能为空');

      expect(result.errors[1].rowNumber).toBe(3);
      expect(result.errors[1].errors).toContain('核销点名称不存在');

      expect(result.errors[2].rowNumber).toBe(4);
      expect(result.errors[2].errors).toContain('核销数量必须为大于0的数字');

      expect(result.errors[3].rowNumber).toBe(5);
      expect(result.errors[3].errors.some(e => e.includes('超出'))).toBe(true);
    });

    it('单行字段校验函数正确', () => {
      const badRow1 = {
        '票批次号': '',
        '核销点名称': '测试点',
        '核销数量': 5,
        '操作人姓名': '测试员'
      };
      const error1 = verificationService.validateImportRow(badRow1, 1);
      expect(error1).not.toBeNull();
      expect(error1!.errors).toContain('票批次号不能为空');

      const badRow2 = {
        '票批次号': 'BATCH-001',
        '核销点名称': '',
        '核销数量': 5,
        '操作人姓名': '测试员'
      };
      const error2 = verificationService.validateImportRow(badRow2, 2);
      expect(error2).not.toBeNull();
      expect(error2!.errors).toContain('核销点名称不能为空');

      const badRow3 = {
        '票批次号': 'BATCH-001',
        '核销点名称': '测试点',
        '核销数量': 0,
        '操作人姓名': '测试员'
      };
      const error3 = verificationService.validateImportRow(badRow3, 3);
      expect(error3).not.toBeNull();
      expect(error3!.errors).toContain('核销数量必须为大于0的数字');

      const badRow4 = {
        '票批次号': 'BATCH-001',
        '核销点名称': '测试点',
        '核销数量': 5,
        '操作人姓名': ''
      };
      const error4 = verificationService.validateImportRow(badRow4, 4);
      expect(error4).not.toBeNull();
      expect(error4!.errors).toContain('操作人姓名不能为空');
    });
  });

  describe('导出字段', () => {
    it('导出字段使用业务语言，与列表查询一致', () => {
      const exportFields = verificationService.getExportFields();
      const recordExportFields = verificationService.getRecordExportFields();

      const batchLabels = exportFields.map(f => f.label);
      expect(batchLabels).toContain('票批次号');
      expect(batchLabels).toContain('团队名称');
      expect(batchLabels).toContain('总数量');
      expect(batchLabels).toContain('剩余数量');
      expect(batchLabels).toContain('已核销数量');
      expect(batchLabels).toContain('状态');
      expect(batchLabels).toContain('生效日期');
      expect(batchLabels).toContain('失效日期');
      expect(batchLabels).toContain('备注');
      expect(batchLabels).toContain('创建时间');
      expect(batchLabels).toContain('更新时间');

      const recordLabels = recordExportFields.map(f => f.label);
      expect(recordLabels).toContain('票批次号');
      expect(recordLabels).toContain('团队名称');
      expect(recordLabels).toContain('核销点名称');
      expect(recordLabels).toContain('操作人');
      expect(recordLabels).toContain('核销数量');
      expect(recordLabels).toContain('核销前剩余');
      expect(recordLabels).toContain('核销后剩余');
      expect(recordLabels).toContain('核销前状态');
      expect(recordLabels).toContain('核销后状态');
      expect(recordLabels).toContain('是否导入');
      expect(recordLabels).toContain('备注');
      expect(recordLabels).toContain('核销时间');

      const batches = store.getAllTicketBatches();
      if (batches.length > 0) {
        const batch = batches[0];
        exportFields.forEach(field => {
          expect(batch[field.value]).toBeDefined();
        });
      }
    });
  });

  describe('状态计算', () => {
    it('状态计算函数正确', () => {
      expect(verificationService.calculateStatus(50, 50)).toBe(VerificationStatus.PENDING);
      expect(verificationService.calculateStatus(30, 50)).toBe(VerificationStatus.PARTIAL);
      expect(verificationService.calculateStatus(0, 50)).toBe(VerificationStatus.COMPLETED);
      expect(verificationService.calculateStatus(-5, 50)).toBe(VerificationStatus.ABNORMAL);
    });

    it('核销前置校验正确', () => {
      const batches = store.getAllTicketBatches();
      const batch = batches[0];

      expect(verificationService.canVerify(batch, 0).valid).toBe(false);
      expect(verificationService.canVerify(batch, 100).valid).toBe(false);
      expect(verificationService.canVerify(batch, 10).valid).toBe(true);
    });
  });
});
