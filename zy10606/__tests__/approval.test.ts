import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/database';
import app from '../src/index';
import { ImportRecord } from '../src/services/ApprovalService';
import { ApprovalStatus, SignStatus } from '../src/types/enums';

describe('企业审批服务跨部门加签超时 API 测试', () => {
  let testDataSource: DataSource;

  beforeAll(async () => {
    testDataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [__dirname + '/../src/entities/*.ts'],
      synchronize: true,
      logging: false
    });
    await testDataSource.initialize();
  }, 30000);

  afterAll(async () => {
    if (testDataSource) {
      await testDataSource.destroy();
    }
  });

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('批量导入功能', () => {
    it('应该成功导入有效的记录', async () => {
      const records: ImportRecord[] = [
        {
          orderNo: 'APPR-2024-001',
          title: '跨部门项目预算审批',
          applicantId: 'U001',
          applicantName: '张三',
          applicantDept: '财务部',
          content: '申请项目预算50万元',
          applyTime: '2024-01-15T09:00:00Z',
          status: 'signing',
          timeoutTime: '2024-01-18T09:00:00Z',
          signerId: 'U002',
          signerName: '李四',
          signerDept: '技术部',
          signOrder: 1,
          signStartTime: '2024-01-15T10:00:00Z',
          signStatus: 'pending'
        }
      ];

      const res = await request(app)
        .post('/api/approval/import')
        .send({
          records,
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(1);
      expect(res.body.failed).toBe(0);
    });

    it('应该处理重复导入（冲突记录）', async () => {
      const records: ImportRecord[] = [
        {
          orderNo: 'APPR-2024-001',
          title: '重复的审批单',
          applicantId: 'U001',
          applicantName: '张三',
          applicantDept: '财务部',
          applyTime: '2024-01-15T09:00:00Z',
          status: 'signing',
          signerId: 'U002',
          signerName: '李四',
          signerDept: '技术部',
          signOrder: 1,
          signStartTime: '2024-01-15T10:00:00Z',
          signStatus: 'pending'
        }
      ];

      const res = await request(app)
        .post('/api/approval/import')
        .send({
          records,
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(0);
      expect(res.body.failed).toBe(1);
      expect(res.body.errors[0].message).toContain('已存在');
    });

    it('应该处理导入坏行', async () => {
      const records: Partial<ImportRecord>[] = [
        {
          orderNo: 'APPR-2024-002',
          title: '缺少必填字段的记录',
          applicantId: 'U001',
          applicantName: '张三'
        } as any
      ];

      const res = await request(app)
        .post('/api/approval/import')
        .send({
          records,
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      expect(res.status).toBe(200);
      expect(res.body.failed).toBe(1);
    });
  });

  describe('加签人离职场景', () => {
    let orderId: string;
    let signId: string;

    beforeAll(async () => {
      const records: ImportRecord[] = [
        {
          orderNo: 'APPR-RESIGN-001',
          title: '离职员工审批单',
          applicantId: 'U003',
          applicantName: '王五',
          applicantDept: '市场部',
          applyTime: '2024-02-01T09:00:00Z',
          status: 'signing',
          signerId: 'U004',
          signerName: '离职员工',
          signerDept: '人事部',
          isResigned: true,
          signOrder: 1,
          signStartTime: '2024-02-01T10:00:00Z',
          signStatus: 'pending'
        }
      ];

      const importRes = await request(app)
        .post('/api/approval/import')
        .send({
          records,
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      const listRes = await request(app)
        .get('/api/approval/list')
        .query({ orderNo: 'APPR-RESIGN-001' });

      orderId = listRes.body.data[0].id;
      signId = listRes.body.data[0].signRecords[0].id;
    });

    it('应该能查询到离职状态的加签人', async () => {
      const res = await request(app).get(`/api/approval/${orderId}`);
      expect(res.status).toBe(200);
      const signRecord = res.body.signRecords.find((s: any) => s.signerName === '离职员工');
      expect(signRecord.isResigned).toBe(true);
    });

    it('应该能转交给其他人处理', async () => {
      const res = await request(app)
        .post(`/api/approval/${orderId}/transfer`)
        .send({
          signId,
          transferToId: 'U005',
          transferToName: '替代审批人',
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      expect(res.status).toBe(200);
      expect(res.body.newSign.signerName).toBe('替代审批人');
    });

    it('应该能添加人工备注继续处理', async () => {
      const res = await request(app)
        .post(`/api/approval/${orderId}/remark`)
        .send({
          signId,
          remark: '原审批人已离职，已转交其他同事处理',
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      expect(res.status).toBe(200);
      expect(res.body.remark).toBe('原审批人已离职，已转交其他同事处理');
    });
  });

  describe('撤回后再提交场景', () => {
    let orderId: string;

    beforeAll(async () => {
      const records: ImportRecord[] = [
        {
          orderNo: 'APPR-WITHDRAW-001',
          title: '待撤回审批单',
          applicantId: 'U006',
          applicantName: '赵六',
          applicantDept: '运营部',
          applyTime: '2024-03-01T09:00:00Z',
          status: 'signing',
          signerId: 'U007',
          signerName: '审批人C',
          signerDept: '管理层',
          signOrder: 1,
          signStartTime: '2024-03-01T10:00:00Z',
          signStatus: 'pending'
        }
      ];

      await request(app)
        .post('/api/approval/import')
        .send({
          records,
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      const listRes = await request(app)
        .get('/api/approval/list')
        .query({ orderNo: 'APPR-WITHDRAW-001' });

      orderId = listRes.body.data[0].id;
    });

    it('应该能撤回审批单', async () => {
      const res = await request(app)
        .post(`/api/approval/${orderId}/withdraw`)
        .send({
          operatorId: 'U006',
          operatorName: '赵六'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ApprovalStatus.WITHDRAWN);
    });

    it('应该能重新提交审批单', async () => {
      const res = await request(app)
        .post(`/api/approval/${orderId}/resubmit`)
        .send({
          operatorId: 'U006',
          operatorName: '赵六'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ApprovalStatus.SIGNING);
    });

    it('应该记录完整的操作历史', async () => {
      const res = await request(app).get(`/api/approval/${orderId}/history`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      const operations = res.body.map((h: any) => h.operationType);
      expect(operations).toContain('import');
      expect(operations).toContain('withdraw');
      expect(operations).toContain('resubmit');
    });
  });

  describe('列表查询功能', () => {
    it('应该能按状态筛选', async () => {
      const res = await request(app)
        .get('/api/approval/list')
        .query({ status: ApprovalStatus.SIGNING });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('应该支持分页', async () => {
      const res = await request(app)
        .get('/api/approval/list')
        .query({ page: 1, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(10);
      expect(typeof res.body.total).toBe('number');
    });
  });

  describe('导出功能', () => {
    it('应该能导出CSV格式文件', async () => {
      const res = await request(app).get('/api/approval/export/csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('审批单号');
      expect(res.text).toContain('审批标题');
      expect(res.text).toContain('审批状态');
    });

    it('导出字段应该与列表查询一致', async () => {
      const listRes = await request(app)
        .get('/api/approval/list')
        .query({ pageSize: 1 });

      const csvRes = await request(app).get('/api/approval/export/csv');

      if (listRes.body.data.length > 0) {
        const firstOrder = listRes.body.data[0];
        expect(csvRes.text).toContain(firstOrder.orderNo);
        expect(csvRes.text).toContain(firstOrder.applicantName);
      }
    });
  });

  describe('完整流程验收', () => {
    it('完整流转流程：导入 -> 备注 -> 办结', async () => {
      const records: ImportRecord[] = [
        {
          orderNo: 'APPR-FULL-001',
          title: '完整流程验收单',
          applicantId: 'U100',
          applicantName: '测试用户',
          applicantDept: '测试部',
          applyTime: '2024-04-01T09:00:00Z',
          status: 'signing',
          signerId: 'U101',
          signerName: '测试审批人',
          signerDept: '审批部',
          signOrder: 1,
          signStartTime: '2024-04-01T10:00:00Z',
          signStatus: 'pending'
        }
      ];

      const importRes = await request(app)
        .post('/api/approval/import')
        .send({
          records,
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      expect(importRes.body.success).toBe(1);

      const listRes = await request(app)
        .get('/api/approval/list')
        .query({ orderNo: 'APPR-FULL-001' });

      const orderId = listRes.body.data[0].id;
      const signId = listRes.body.data[0].signRecords[0].id;

      const remarkRes = await request(app)
        .post(`/api/approval/${orderId}/remark`)
        .send({
          signId,
          remark: '人工审核通过，流程正常推进',
          operatorId: 'ADMIN001',
          operatorName: '系统管理员'
        });

      expect(remarkRes.status).toBe(200);

      const detailRes = await request(app).get(`/api/approval/${orderId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.orderNo).toBe('APPR-FULL-001');

      const historyRes = await request(app).get(`/api/approval/${orderId}/history`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.length).toBeGreaterThan(0);

      const exportRes = await request(app).get(`/api/approval/${orderId}/export`);
      expect(exportRes.status).toBe(200);
      expect(JSON.parse(exportRes.text).basicInfo.orderNo).toBe('APPR-FULL-001');
    });
  });
});
