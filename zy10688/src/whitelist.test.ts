import request from 'supertest';
import express from 'express';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import whitelistRoutes from './routes/whitelist';
import { initDB, closeDB } from './db';
import { WhitelistStatus, OperationType } from './types';

const app = express();
app.use(express.json());
app.use('/api/whitelist', whitelistRoutes);

const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

describe('内容审核平台白名单账号失效API测试', () => {
  const testDBPath = join(dataDir, 'whitelist_test1.db');
  
  beforeAll(async () => {
    if (existsSync(testDBPath)) {
      unlinkSync(testDBPath);
    }
    process.env.DB_PATH = testDBPath;
    await initDB();
  });

  afterAll(async () => {
    await closeDB();
    if (existsSync(testDBPath)) {
      unlinkSync(testDBPath);
    }
  });

  describe('场景1: 白名单失效后缓存仍跳过审核', () => {
    let recordId: string;
    const testAccount = 'test.cache@example.com';

    it('创建生效中的白名单记录', async () => {
      const res = await request(app)
        .post('/api/whitelist')
        .send({
          account: testAccount,
          reason: '缓存测试账号',
          validFrom: '2024-01-01T00:00:00.000Z',
          validTo: '2024-12-31T23:59:59.000Z',
          auditor: 'auditor@example.com',
          createdBy: 'tester',
          remark: '测试缓存机制'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(WhitelistStatus.ACTIVE);
      recordId = res.body.data.id;
    });

    it('验证账号在白名单中可跳过审核', async () => {
      const res = await request(app)
        .get('/api/whitelist/check-audit/' + testAccount);
      
      expect(res.status).toBe(200);
      expect(res.body.data.shouldBypass).toBe(true);
      expect(res.body.data.reason).toBe('账号在白名单中');
    });

    it('提交失效审核', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/submit-expire')
        .send({
          operator: 'operator@example.com',
          remark: '测试失效'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.PENDING_EXPIRE);
    });

    it('审核通过失效', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/approve-expire')
        .send({
          operator: 'auditor@example.com',
          remark: '同意失效'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.EXPIRED);
    });

    it('验证已失效账号缓存仍跳过审核', async () => {
      const res = await request(app)
        .get('/api/whitelist/check-audit/' + testAccount);
      
      expect(res.status).toBe(200);
      expect(res.body.data.shouldBypass).toBe(true);
      expect(res.body.data.reason).toBe('账号已失效，缓存仍跳过审核');
      expect(res.body.data.cachedAt).toBeDefined();
    });
  });

  describe('场景2: 重复请求处理', () => {
    let recordId: string;
    const testAccount = 'test.duplicate@example.com';

    it('创建生效中的白名单记录', async () => {
      const res = await request(app)
        .post('/api/whitelist')
        .send({
          account: testAccount,
          reason: '重复请求测试账号',
          validFrom: '2024-01-01T00:00:00.000Z',
          validTo: '2024-12-31T23:59:59.000Z',
          auditor: 'auditor@example.com',
          createdBy: 'tester'
        });
      
      expect(res.status).toBe(201);
      recordId = res.body.data.id;
    });

    it('重复导入已有生效中账号应返回错误', async () => {
      const res = await request(app)
        .post('/api/whitelist/import')
        .send({
          records: [{
            account: testAccount,
            reason: '重复导入测试',
            validFrom: '2024-01-01T00:00:00.000Z',
            validTo: '2024-12-31T23:59:59.000Z',
            auditor: 'auditor@example.com'
          }],
          createdBy: 'tester'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(0);
      expect(res.body.data.failed).toBe(1);
      expect(res.body.data.errors[0].reason).toBe('账号已有生效中记录');
    });

    it('第一次提交失效成功', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/submit-expire')
        .send({
          operator: 'operator@example.com'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.PENDING_EXPIRE);
    });

    it('第二次重复提交失效应返回错误', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/submit-expire')
        .send({
          operator: 'operator@example.com'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('只有生效中的记录可以提交失效');
    });
  });

  describe('场景3: 撤回后再提交', () => {
    let recordId: string;
    const testAccount = 'test.withdraw@example.com';

    it('创建生效中的白名单记录', async () => {
      const res = await request(app)
        .post('/api/whitelist')
        .send({
          account: testAccount,
          reason: '撤回测试账号',
          validFrom: '2024-01-01T00:00:00.000Z',
          validTo: '2024-12-31T23:59:59.000Z',
          auditor: 'auditor@example.com',
          createdBy: 'tester'
        });
      
      expect(res.status).toBe(201);
      recordId = res.body.data.id;
    });

    it('提交失效申请', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/submit-expire')
        .send({
          operator: 'operator@example.com',
          remark: '首次提交失效'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.PENDING_EXPIRE);
    });

    it('撤回失效申请，状态回到生效中', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/withdraw')
        .send({
          operator: 'operator@example.com',
          remark: '撤回失效申请'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.ACTIVE);
    });

    it('撤回后可以再次提交失效', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/submit-expire')
        .send({
          operator: 'operator@example.com',
          remark: '再次提交失效'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.PENDING_EXPIRE);
    });

    it('验证操作历史记录完整', async () => {
      const res = await request(app)
        .get('/api/whitelist/' + recordId + '/history');
      
      expect(res.status).toBe(200);
      const history = res.body.data;
      
      const createOps = history.filter((h: any) => h.operationType === OperationType.CREATE);
      const submitOps = history.filter((h: any) => h.operationType === OperationType.SUBMIT_EXPIRE);
      const withdrawOps = history.filter((h: any) => h.operationType === OperationType.WITHDRAW);
      
      expect(createOps.length).toBe(1);
      expect(submitOps.length).toBe(2);
      expect(withdrawOps.length).toBe(1);
      
      expect(submitOps[0].oldStatus).toBe(WhitelistStatus.ACTIVE);
      expect(submitOps[0].newStatus).toBe(WhitelistStatus.PENDING_EXPIRE);
      expect(withdrawOps[0].oldStatus).toBe(WhitelistStatus.PENDING_EXPIRE);
      expect(withdrawOps[0].newStatus).toBe(WhitelistStatus.ACTIVE);
      expect(submitOps[1].oldStatus).toBe(WhitelistStatus.ACTIVE);
      expect(submitOps[1].newStatus).toBe(WhitelistStatus.PENDING_EXPIRE);
    });
  });
});

describe('验收测试: 完整流转、冲突记录和导入坏行', () => {
  const testDBPath = join(dataDir, 'whitelist_test2.db');

  beforeAll(async () => {
    if (existsSync(testDBPath)) {
      unlinkSync(testDBPath);
    }
    process.env.DB_PATH = testDBPath;
    await initDB();
  });

  afterAll(async () => {
    await closeDB();
    if (existsSync(testDBPath)) {
      unlinkSync(testDBPath);
    }
  });

  describe('完整白名单生命周期流转', () => {
    let recordId: string;
    const testAccount = 'full.cycle@example.com';

    it('1. 创建白名单记录 - ACTIVE', async () => {
      const res = await request(app)
        .post('/api/whitelist')
        .send({
          account: testAccount,
          reason: '完整生命周期测试账号',
          validFrom: '2024-01-01T00:00:00.000Z',
          validTo: '2024-12-31T23:59:59.000Z',
          auditor: 'auditor@example.com',
          createdBy: 'operator1',
          remark: '初始化创建'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(WhitelistStatus.ACTIVE);
      recordId = res.body.data.id;
    });

    it('2. 列表中可以查询到该记录', async () => {
      const res = await request(app)
        .get('/api/whitelist')
        .query({ account: testAccount });
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].account).toBe(testAccount);
    });

    it('3. 提交失效申请 - ACTIVE -> PENDING_EXPIRE', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/submit-expire')
        .send({
          operator: 'operator1',
          remark: '申请失效，测试流程'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.PENDING_EXPIRE);
    });

    it('4. 审核通过失效 - PENDING_EXPIRE -> EXPIRED', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/approve-expire')
        .send({
          operator: 'auditor1',
          remark: '审核通过，同意失效'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.EXPIRED);
    });

    it('5. 申请恢复 - EXPIRED -> RESTORE_REQUESTED', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/request-restore')
        .send({
          operator: 'operator1',
          remark: '业务需要，申请恢复'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.RESTORE_REQUESTED);
    });

    it('6. 审核通过恢复 - RESTORE_REQUESTED -> ACTIVE', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/approve-restore')
        .send({
          operator: 'auditor1',
          remark: '审核通过，同意恢复'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WhitelistStatus.ACTIVE);
    });

    it('7. 添加人工备注继续处理', async () => {
      const res = await request(app)
        .post('/api/whitelist/' + recordId + '/remark')
        .send({
          operator: 'operator1',
          remark: '2024-05-20 业务复核通过，继续保留白名单资格'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.remark).toContain('业务复核通过');
    });

    it('8. 详情页数据完整', async () => {
      const res = await request(app)
        .get('/api/whitelist/' + recordId);
      
      expect(res.status).toBe(200);
      const record = res.body.data;
      expect(record.id).toBe(recordId);
      expect(record.account).toBe(testAccount);
      expect(record.reason).toBeDefined();
      expect(record.validFrom).toBeDefined();
      expect(record.validTo).toBeDefined();
      expect(record.auditor).toBeDefined();
      expect(record.status).toBe(WhitelistStatus.ACTIVE);
      expect(record.remark).toBeDefined();
    });

    it('9. 历史记录完整可追溯', async () => {
      const res = await request(app)
        .get('/api/whitelist/' + recordId + '/history');
      
      expect(res.status).toBe(200);
      const history = res.body.data;
      
      const operationTypes = history.map((h: any) => h.operationType);
      expect(operationTypes).toContain(OperationType.CREATE);
      expect(operationTypes).toContain(OperationType.SUBMIT_EXPIRE);
      expect(operationTypes).toContain(OperationType.APPROVE_EXPIRE);
      expect(operationTypes).toContain(OperationType.RESTORE_REQUEST);
      expect(operationTypes).toContain(OperationType.APPROVE_RESTORE);
      expect(operationTypes).toContain(OperationType.REMARK);
      
      history.forEach((h: any) => {
        expect(h.operator).toBeDefined();
        expect(h.operatedAt).toBeDefined();
      });
    });

    it('10. 导出功能正常', async () => {
      const res = await request(app)
        .get('/api/whitelist/export');
      
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
      expect(res.text).toContain(testAccount);
      expect(res.text).toContain('完整生命周期测试账号');
    });
  });

  describe('冲突记录处理', () => {
    it('批量导入包含冲突账号时，正确处理成功和失败记录', async () => {
      const firstAccount = 'conflict.test1@example.com';
      
      await request(app)
        .post('/api/whitelist')
        .send({
          account: firstAccount,
          reason: '已存在的账号',
          validFrom: '2024-01-01T00:00:00.000Z',
          validTo: '2024-12-31T23:59:59.000Z',
          auditor: 'auditor@example.com',
          createdBy: 'tester'
        });

      const res = await request(app)
        .post('/api/whitelist/import')
        .send({
          records: [
            {
              account: firstAccount,
              reason: '冲突的账号',
              validFrom: '2024-01-01T00:00:00.000Z',
              validTo: '2024-12-31T23:59:59.000Z',
              auditor: 'auditor@example.com'
            },
            {
              account: 'conflict.test2@example.com',
              reason: '正常导入的账号',
              validFrom: '2024-01-01T00:00:00.000Z',
              validTo: '2024-12-31T23:59:59.000Z',
              auditor: 'auditor@example.com'
            }
          ],
          createdBy: 'importer'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(1);
      expect(res.body.data.failed).toBe(1);
      expect(res.body.data.errors.length).toBe(1);
      expect(res.body.data.errors[0].account).toBe(firstAccount);
      expect(res.body.data.errors[0].reason).toBe('账号已有生效中记录');
    });
  });

  describe('导入坏行处理', () => {
    it('批量导入包含各种坏数据时，正确记录错误详情', async () => {
      const res = await request(app)
        .post('/api/whitelist/import')
        .send({
          records: [
            {
              account: '',
              reason: '缺少账号',
              validFrom: '2024-01-01T00:00:00.000Z',
              validTo: '2024-12-31T23:59:59.000Z',
              auditor: 'auditor@example.com'
            },
            {
              account: 'bad.date@example.com',
              reason: '日期格式错误',
              validFrom: 'invalid-date',
              validTo: '2024-12-31T23:59:59.000Z',
              auditor: 'auditor@example.com'
            },
            {
              account: 'invalid.range@example.com',
              reason: '有效期开始晚于结束',
              validFrom: '2024-12-31T23:59:59.000Z',
              validTo: '2024-01-01T00:00:00.000Z',
              auditor: 'auditor@example.com'
            },
            {
              account: 'missing.reason@example.com',
              reason: '',
              validFrom: '2024-01-01T00:00:00.000Z',
              validTo: '2024-12-31T23:59:59.000Z',
              auditor: 'auditor@example.com'
            },
            {
              account: 'good.record@example.com',
              reason: '正常导入的记录',
              validFrom: '2024-01-01T00:00:00.000Z',
              validTo: '2024-12-31T23:59:59.000Z',
              auditor: 'auditor@example.com'
            }
          ],
          createdBy: 'importer'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(1);
      expect(res.body.data.failed).toBe(4);
      expect(res.body.data.errors.length).toBe(4);
      
      const errorReasons = res.body.data.errors.map((e: any) => e.reason);
      expect(errorReasons).toContain('必填字段缺失');
      expect(errorReasons).toContain('日期格式无效');
      expect(errorReasons).toContain('有效期结束时间必须晚于开始时间');
    });
  });
});
