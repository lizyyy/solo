import request from 'supertest';
import app from './index';
import { db } from './database';
import {
  normalInvoice,
  conflictInvoice,
  amountMismatchInvoice,
  invalidInvoice,
  importTestData
} from './data/sampleData';
import { ERROR_RULES } from './constants/errorRules';

beforeAll(() => {
  db.init();
});

beforeEach(() => {
  db.clearAll();
});

afterAll(() => {
  db.close();
});

describe('社区维修基金票据 API 测试', () => {
  describe('1. 正常记录创建测试', () => {
    it('应该成功创建一条正常的票据记录', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send(normalInvoice);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoiceNo).toBe(normalInvoice.invoiceNo);
      expect(response.body.data.communityName).toBe(normalInvoice.communityName);
      expect(response.body.data.ownerName).toBe(normalInvoice.ownerName);
      expect(response.body.data.paymentAmount).toBe(normalInvoice.paymentAmount);
      expect(response.body.data.invoiceAmount).toBe(normalInvoice.invoiceAmount);
      expect(response.body.data.status).toBe(normalInvoice.status);
    });
  });

  describe('2. 重复票据编号冲突测试', () => {
    it('应该禁止静默覆盖，返回明确的冲突错误', async () => {
      await request(app)
        .post('/api/invoices')
        .send(normalInvoice);

      const response = await request(app)
        .post('/api/invoices')
        .send(conflictInvoice);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].rule).toBe(ERROR_RULES.DUPLICATE_INVOICE_NO);
      expect(response.body.errors[0].message).toContain('票据编号已存在');
    });
  });

  describe('3. 付款金额与票据金额不一致测试', () => {
    it('应该检测到付款金额与票据金额不一致', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send(amountMismatchInvoice);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      
      const amountError = response.body.errors.find(
        (e: any) => e.rule === ERROR_RULES.PAYMENT_INVOICE_AMOUNT_MISMATCH
      );
      expect(amountError).toBeDefined();
      expect(amountError.message).toContain('付款金额与票据金额不一致');
    });
  });

  describe('4. 导入坏行测试', () => {
    it('应该正确识别导入中的坏数据行，并返回详细错误', async () => {
      const response = await request(app)
        .post('/api/invoices/import')
        .send({ data: importTestData.withBadRows });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.success).toBe(2);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
      
      const badRowError = response.body.data.errors.find((e: any) => e.row === 2);
      expect(badRowError).toBeDefined();
      expect(badRowError.errors.length).toBeGreaterThan(0);
    });
  });

  describe('5. 必填字段验证测试', () => {
    it('应该检测所有缺失的必填字段', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send(invalidInvoice);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
      
      const requiredErrors = response.body.errors.filter(
        (e: any) => e.rule === ERROR_RULES.REQUIRED_FIELD_MISSING
      );
      expect(requiredErrors.length).toBeGreaterThan(0);
    });
  });

  describe('6. 票据汇总一致性测试', () => {
    it('应该检测汇总金额不一致', async () => {
      await request(app)
        .post('/api/invoices')
        .send(normalInvoice);

      const response = await request(app)
        .post('/api/invoices/validate-summary')
        .send({ expectedSummary: 10000 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      const summaryError = response.body.errors.find(
        (e: any) => e.rule === ERROR_RULES.INVOICE_SUMMARY_INCONSISTENCY
      );
      expect(summaryError).toBeDefined();
      expect(summaryError.message).toContain('票据汇总金额与明细金额不一致');
    });

    it('应该通过汇总金额一致的验证', async () => {
      await request(app)
        .post('/api/invoices')
        .send(normalInvoice);

      const response = await request(app)
        .post('/api/invoices/validate-summary')
        .send({ expectedSummary: 5000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('汇总金额一致');
    });
  });

  describe('7. CRUD 操作测试', () => {
    let createdId: number;

    it('应该创建票据记录', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send(normalInvoice);

      expect(response.status).toBe(201);
      createdId = response.body.data.id;
    });

    it('应该查询单条票据记录', async () => {
      const createResponse = await request(app)
        .post('/api/invoices')
        .send(normalInvoice);
      createdId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/invoices/${createdId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdId);
    });

    it('应该查询所有票据记录', async () => {
      await request(app).post('/api/invoices').send(normalInvoice);
      
      const response = await request(app).get('/api/invoices');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('应该更新票据记录', async () => {
      const createResponse = await request(app)
        .post('/api/invoices')
        .send(normalInvoice);
      createdId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/invoices/${createdId}`)
        .send({ remark: '已更新的备注信息' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remark).toBe('已更新的备注信息');
    });

    it('应该删除票据记录', async () => {
      const createResponse = await request(app)
        .post('/api/invoices')
        .send(normalInvoice);
      createdId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/invoices/${createdId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('8. CSV 导出测试', () => {
    it('应该成功导出 CSV 文件', async () => {
      await request(app)
        .post('/api/invoices')
        .send(normalInvoice);

      const response = await request(app)
        .get('/api/invoices/export/csv');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('text/csv');
      expect(response.text).toContain(normalInvoice.invoiceNo);
      expect(response.text).toContain(normalInvoice.communityName);
      expect(response.text).toContain(normalInvoice.ownerName);
    });
  });

  describe('9. 导入导出互相校验测试', () => {
    it('导出的 CSV 数据应该和 API 返回的数据一致', async () => {
      await request(app)
        .post('/api/invoices')
        .send(normalInvoice);

      const apiResponse = await request(app).get('/api/invoices');
      const csvResponse = await request(app).get('/api/invoices/export/csv');

      expect(apiResponse.body.data[0].invoiceNo).toBe(normalInvoice.invoiceNo);
      expect(csvResponse.text).toContain(normalInvoice.invoiceNo);
      expect(csvResponse.text).toContain(normalInvoice.communityName);
      expect(csvResponse.text).toContain(normalInvoice.ownerName);
      expect(csvResponse.text).toContain(normalInvoice.paymentAmount.toString());
      expect(csvResponse.text).toContain(normalInvoice.invoiceAmount.toString());
    });
  });

  describe('10. 无效状态值测试', () => {
    it('应该检测无效的状态值', async () => {
      const invalidStatusInvoice = {
        ...normalInvoice,
        invoiceNo: 'WXJJ-TEST-INVALID',
        status: 'invalid_status'
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invalidStatusInvoice);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const statusError = response.body.errors.find(
        (e: any) => e.rule === ERROR_RULES.INVALID_STATUS
      );
      expect(statusError).toBeDefined();
    });
  });

  describe('11. 无效日期格式测试', () => {
    it('应该检测无效的日期格式', async () => {
      const invalidDateInvoice = {
        ...normalInvoice,
        invoiceNo: 'WXJJ-TEST-DATE',
        invoiceDate: '2024/13/45'
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invalidDateInvoice);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      
      const dateError = response.body.errors.find(
        (e: any) => e.rule === ERROR_RULES.INVALID_DATE
      );
      expect(dateError).toBeDefined();
    });
  });

  describe('12. 健康检查测试', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.message).toContain('社区维修基金票据 API');
    });
  });
});
