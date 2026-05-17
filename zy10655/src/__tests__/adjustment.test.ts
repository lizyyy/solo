import request from 'supertest';
import express from 'express';
import adjustmentRoutes from '../routes/adjustments';
import { errorHandler } from '../middleware/errorHandler';
import { AdjustmentStatus, OperationSource } from '../types';
import { closeDatabase } from '../database';
import fs from 'fs';

const app = express();
app.use(express.json());
app.use('/api/adjustments', adjustmentRoutes);
app.use(errorHandler);

describe('Organization Adjustment API Tests', () => {
  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync('./data-permission.db')) {
      fs.unlinkSync('./data-permission.db');
    }
  });

  describe('Test 1: 用户调岗后仍能看旧部门数据', () => {
    it('应该创建保留旧部门数据权限的调整记录', async () => {
      const res = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U001',
          userName: '张三',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D002',
          newDepartmentName: '产品部',
          dataScope: 'ALL',
          retainOldDataAccess: true,
          operatorId: 'O001',
          operatorName: '管理员',
          remark: '调岗并保留旧部门数据权限'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.retainOldDataAccess).toBe(true);
      expect(res.body.data.status).toBe(AdjustmentStatus.PENDING_RECALCULATION);
      expect(res.body.data.userId).toBe('U001');
    });

    it('应该创建不保留旧部门数据权限的调整记录', async () => {
      const res = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U002',
          userName: '李四',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D003',
          newDepartmentName: '市场部',
          dataScope: 'DEPARTMENT',
          retainOldDataAccess: false,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.retainOldDataAccess).toBe(false);
    });
  });

  describe('Test 2: 重复请求处理', () => {
    it('应该拒绝同一用户的重复未完成调整', async () => {
      const firstRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U003',
          userName: '王五',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D004',
          newDepartmentName: '人事部',
          dataScope: 'ALL',
          retainOldDataAccess: true,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      expect(firstRes.status).toBe(200);

      const secondRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U003',
          userName: '王五',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D005',
          newDepartmentName: '财务部',
          dataScope: 'ALL',
          retainOldDataAccess: false,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe('CONFLICT_ADJUSTMENT');
      expect(secondRes.body.error.suggestion).toBe('请先处理冲突记录后再提交新的调整');
    });

    it('应该允许已生效记录后创建新记录', async () => {
      const createRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U004',
          userName: '赵六',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D006',
          newDepartmentName: '运营部',
          dataScope: 'ALL',
          retainOldDataAccess: true,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const adjustmentId = createRes.body.data.id;

      await request(app)
        .patch(`/api/adjustments/${adjustmentId}/status`)
        .send({
          status: AdjustmentStatus.RECALCULATING,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      await request(app)
        .patch(`/api/adjustments/${adjustmentId}/status`)
        .send({
          status: AdjustmentStatus.EFFECTIVE,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const newRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U004',
          userName: '赵六',
          oldDepartmentId: 'D006',
          oldDepartmentName: '运营部',
          newDepartmentId: 'D007',
          newDepartmentName: '总裁办',
          dataScope: 'ALL',
          retainOldDataAccess: true,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      expect(newRes.status).toBe(200);
      expect(newRes.body.success).toBe(true);
    });
  });

  describe('Test 3: 撤回后再提交', () => {
    it('应该允许撤回未生效的调整记录', async () => {
      const createRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U005',
          userName: '钱七',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D008',
          newDepartmentName: '客服部',
          dataScope: 'ALL',
          retainOldDataAccess: false,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const adjustmentId = createRes.body.data.id;

      const withdrawRes = await request(app)
        .post(`/api/adjustments/${adjustmentId}/withdraw`)
        .send({
          operatorId: 'O001',
          operatorName: '管理员',
          remark: '撤回调整申请'
        });

      expect(withdrawRes.status).toBe(200);
      expect(withdrawRes.body.success).toBe(true);
      expect(withdrawRes.body.data.status).toBe(AdjustmentStatus.PENDING_REVIEW);
    });

    it('应该不允许撤回已生效的记录', async () => {
      const createRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U006',
          userName: '孙八',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D009',
          newDepartmentName: '法务部',
          dataScope: 'ALL',
          retainOldDataAccess: false,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const adjustmentId = createRes.body.data.id;

      await request(app)
        .patch(`/api/adjustments/${adjustmentId}/status`)
        .send({
          status: AdjustmentStatus.RECALCULATING,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      await request(app)
        .patch(`/api/adjustments/${adjustmentId}/status`)
        .send({
          status: AdjustmentStatus.EFFECTIVE,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const withdrawRes = await request(app)
        .post(`/api/adjustments/${adjustmentId}/withdraw`)
        .send({
          operatorId: 'O001',
          operatorName: '管理员'
        });

      expect(withdrawRes.status).toBe(422);
      expect(withdrawRes.body.success).toBe(false);
    });

    it('应该允许撤回后重新提交新的调整', async () => {
      const createRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U007',
          userName: '周九',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D010',
          newDepartmentName: '采购部',
          dataScope: 'ALL',
          retainOldDataAccess: false,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const adjustmentId = createRes.body.data.id;

      await request(app)
        .post(`/api/adjustments/${adjustmentId}/withdraw`)
        .send({
          operatorId: 'O001',
          operatorName: '管理员'
        });

      await request(app)
        .patch(`/api/adjustments/${adjustmentId}/status`)
        .send({
          status: AdjustmentStatus.RECALCULATING,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      await request(app)
        .patch(`/api/adjustments/${adjustmentId}/status`)
        .send({
          status: AdjustmentStatus.EFFECTIVE,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const newRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U007',
          userName: '周九',
          oldDepartmentId: 'D010',
          oldDepartmentName: '采购部',
          newDepartmentId: 'D011',
          newDepartmentName: '仓储部',
          dataScope: 'ALL',
          retainOldDataAccess: true,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      expect(newRes.status).toBe(200);
      expect(newRes.body.success).toBe(true);
    });
  });

  describe('验收场景测试', () => {
    let fullFlowAdjustmentId: string;

    describe('完整流转', () => {
      it('完整流程：创建 -> 重算中 -> 已生效', async () => {
        const createRes = await request(app)
          .post('/api/adjustments')
          .send({
            userId: 'U100',
            userName: '测试用户',
            oldDepartmentId: 'D999',
            oldDepartmentName: '旧部门',
            newDepartmentId: 'D888',
            newDepartmentName: '新部门',
            dataScope: 'DEPARTMENT',
            retainOldDataAccess: true,
            operatorId: 'ADMIN',
            operatorName: '系统管理员',
            operationSource: OperationSource.API,
            remark: '验收测试-完整流程'
          });

        expect(createRes.status).toBe(200);
        expect(createRes.body.data.status).toBe(AdjustmentStatus.PENDING_RECALCULATION);
        fullFlowAdjustmentId = createRes.body.data.id;

        const toRecalculatingRes = await request(app)
          .patch(`/api/adjustments/${fullFlowAdjustmentId}/status`)
          .send({
            status: AdjustmentStatus.RECALCULATING,
            operatorId: 'ADMIN',
            operatorName: '系统管理员',
            remark: '开始权限重算'
          });

        expect(toRecalculatingRes.status).toBe(200);
        expect(toRecalculatingRes.body.data.status).toBe(AdjustmentStatus.RECALCULATING);

        const toEffectiveRes = await request(app)
          .patch(`/api/adjustments/${fullFlowAdjustmentId}/status`)
          .send({
            status: AdjustmentStatus.EFFECTIVE,
            operatorId: 'ADMIN',
            operatorName: '系统管理员',
            remark: '权限重算完成，已生效'
          });

        expect(toEffectiveRes.status).toBe(200);
        expect(toEffectiveRes.body.data.status).toBe(AdjustmentStatus.EFFECTIVE);
        expect(toEffectiveRes.body.data.effectiveAt).toBeDefined();
      });

      it('列表、详情、历史记录应互相对应', async () => {
        const listRes = await request(app).get('/api/adjustments?userId=U100');
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.items.length).toBeGreaterThan(0);

        const detailRes = await request(app).get(`/api/adjustments/${fullFlowAdjustmentId}`);
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.id).toBe(fullFlowAdjustmentId);
        expect(detailRes.body.data.status).toBe(AdjustmentStatus.EFFECTIVE);

        const historyRes = await request(app).get(`/api/adjustments/${fullFlowAdjustmentId}/histories`);
        expect(historyRes.status).toBe(200);
        expect(historyRes.body.data.length).toBeGreaterThanOrEqual(3);
        
        const historyTypes = historyRes.body.data.map((h: any) => h.operationType);
        expect(historyTypes).toContain('CREATE');
        expect(historyTypes).toContain('STATUS_CHANGE');
      });

      it('导出功能应正常工作', async () => {
        const exportRes = await request(app).get('/api/adjustments/export');
        expect(exportRes.status).toBe(200);
        expect(exportRes.headers['content-type']).toContain('text/csv');
        expect(exportRes.text).toContain('记录ID');
        expect(exportRes.text).toContain('U100');
      });
    });

    describe('冲突记录', () => {
      it('同一用户存在多个活动状态的记录时应正确提示', async () => {
        const firstRes = await request(app)
          .post('/api/adjustments')
          .send({
            userId: 'U200',
            userName: '冲突用户',
            oldDepartmentId: 'D100',
            oldDepartmentName: '部门A',
            newDepartmentId: 'D101',
            newDepartmentName: '部门B',
            dataScope: 'ALL',
            retainOldDataAccess: false,
            operatorId: 'ADMIN',
            operatorName: '系统管理员'
          });

        expect(firstRes.status).toBe(200);

        const secondRes = await request(app)
          .post('/api/adjustments')
          .send({
            userId: 'U200',
            userName: '冲突用户',
            oldDepartmentId: 'D101',
            oldDepartmentName: '部门B',
            newDepartmentId: 'D102',
            newDepartmentName: '部门C',
            dataScope: 'ALL',
            retainOldDataAccess: false,
            operatorId: 'ADMIN',
            operatorName: '系统管理员'
          });

        expect(secondRes.status).toBe(409);
        expect(secondRes.body.error.details.conflictAdjustmentIds).toContain(firstRes.body.data.id);
        expect(secondRes.body.error.suggestion).toBe('请先处理冲突记录后再提交新的调整');
      });
    });

    describe('导入坏行', () => {
      it('导入包含坏行的数据时应正确处理部分成功部分失败', async () => {
        const importData = [
          {
            userId: 'U301',
            userName: '导入成功用户1',
            oldDepartmentId: 'D200',
            oldDepartmentName: '导入部门1',
            newDepartmentId: 'D201',
            newDepartmentName: '导入部门2',
            dataScope: 'DEPARTMENT',
            retainOldDataAccess: true
          },
          {},
          {
            userId: 'U303',
            userName: '导入成功用户2',
            oldDepartmentId: 'D202',
            oldDepartmentName: '导入部门3',
            newDepartmentId: 'D203',
            newDepartmentName: '导入部门4',
            dataScope: 'ALL',
            retainOldDataAccess: false
          }
        ];

        const importRes = await request(app)
          .post('/api/adjustments/import')
          .send({
            data: importData,
            operatorId: 'ADMIN',
            operatorName: '系统管理员'
          });

        expect(importRes.status).toBe(200);
        expect(importRes.body.data.success).toBe(2);
        expect(importRes.body.data.failed).toBe(1);
        expect(importRes.body.data.errors.length).toBe(1);
        expect(importRes.body.data.errors[0].row).toBe(2);

        const listRes = await request(app).get('/api/adjustments');
        const importedUsers = listRes.body.data.items
          .filter((item: any) => item.operationSource === OperationSource.IMPORT)
          .map((item: any) => item.userId);
        
        expect(importedUsers).toContain('U301');
        expect(importedUsers).toContain('U303');
      });
    });
  });

  describe('错误响应测试', () => {
    it('参数验证失败时应返回具体错误信息', async () => {
      const res = await request(app)
        .post('/api/adjustments')
        .send({
          userId: '',
          userName: '',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D001',
          newDepartmentName: '技术部',
          dataScope: '',
          retainOldDataAccess: true
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details.length).toBeGreaterThan(0);
      expect(res.body.error.suggestion).toBe('请检查请求参数是否正确');
    });

    it('查询不存在的记录时应返回404', async () => {
      const res = await request(app).get('/api/adjustments/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ADJUSTMENT_NOT_FOUND');
    });

    it('无效的状态转换应返回422', async () => {
      const createRes = await request(app)
        .post('/api/adjustments')
        .send({
          userId: 'U999',
          userName: '测试用户',
          oldDepartmentId: 'D001',
          oldDepartmentName: '技术部',
          newDepartmentId: 'D002',
          newDepartmentName: '产品部',
          dataScope: 'ALL',
          retainOldDataAccess: true,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      const adjustmentId = createRes.body.data.id;

      const invalidStatusRes = await request(app)
        .patch(`/api/adjustments/${adjustmentId}/status`)
        .send({
          status: AdjustmentStatus.EFFECTIVE,
          operatorId: 'O001',
          operatorName: '管理员'
        });

      expect(invalidStatusRes.status).toBe(422);
      expect(invalidStatusRes.body.success).toBe(false);
      expect(invalidStatusRes.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });
});
