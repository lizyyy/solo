import request from 'supertest';
import app from '../server';
import { db } from '../store/database';
import { RedApplyStatus, ErrorType } from '../types';

describe('电子发票服务红票申请材料核验 - 验收测试', () => {
  describe('场景一: 完整流转', () => {
    beforeAll(() => {
      db.clear();
    });
    let recordId: string;

    test('1. 导入记录', async () => {
      const response = await request(app)
        .post('/api/red-apply/import')
        .send({
          operator: 'test_user',
          rows: [{
            invoiceCode: '123456',
            invoiceNumber: 'INV001',
            invoiceDate: '2024-01-01',
            invoiceAmount: 1000,
            invoiceTaxAmount: 130,
            invoiceTotalAmount: 1130,
            buyerName: '测试公司A',
            buyerTaxId: '911100001234567890',
            sellerName: '测试公司B',
            sellerTaxId: '911100000987654321',
            orderNo: 'ORD001',
            orderDate: '2024-01-01',
            orderAmount: 1130,
            refundAmount: 0,
            isPartialRefund: false,
            redReason: '发票开具有误',
            attachments: [{
              fileName: '证明材料.pdf',
              fileType: 'application/pdf',
              fileSize: 10240
            }]
          }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(1);
      expect(response.body.data.failed).toBe(0);
    });

    test('2. 查询列表', async () => {
      const response = await request(app).get('/api/red-apply/list');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.list.length).toBe(1);
      expect(response.body.data.list[0].status).toBe(RedApplyStatus.PENDING_APPLY);
      recordId = response.body.data.list[0].id;
    });

    test('3. 查询详情', async () => {
      const response = await request(app).get(`/api/red-apply/${recordId}/detail`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice.invoiceNumber).toBe('INV001');
      expect(response.body.data.order.orderNo).toBe('ORD001');
    });

    test('4. 开始核验', async () => {
      const response = await request(app)
        .post(`/api/red-apply/${recordId}/start-verify`)
        .send({ operator: 'verifier_a' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RedApplyStatus.VERIFYING);
    });

    test('5. 核验通过-完成红冲', async () => {
      const response = await request(app)
        .post(`/api/red-apply/${recordId}/approve`)
        .send({ operator: 'verifier_a' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RedApplyStatus.RED_COMPLETED);
    });

    test('6. 查看历史记录', async () => {
      const response = await request(app).get(`/api/red-apply/${recordId}/history`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
      
      const operations = response.body.data.map((h: any) => h.operationType);
      expect(operations).toContain('导入创建');
      expect(operations).toContain('开始核验');
      expect(operations).toContain('核验通过-完成红冲');
    });

    test('7. 导出数据', async () => {
      const response = await request(app)
        .post('/api/red-apply/export')
        .send({ ids: [recordId] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.csv).toContain('INV001');
      expect(response.body.data.csv).toContain('ORD001');
    });
  });

  describe('场景二: 冲突记录 - 部分退款申请全额红冲', () => {
    beforeAll(() => {
      db.clear();
    });
    let conflictRecordId: string;

    test('1. 导入有冲突的记录', async () => {
      const response = await request(app)
        .post('/api/red-apply/import')
        .send({
          operator: 'test_user',
          rows: [{
            invoiceCode: '789012',
            invoiceNumber: 'INV_CONFLICT',
            invoiceDate: '2024-01-15',
            invoiceAmount: 2000,
            invoiceTaxAmount: 260,
            invoiceTotalAmount: 2260,
            buyerName: '冲突测试公司',
            buyerTaxId: '911100001111111111',
            sellerName: '销售方公司',
            sellerTaxId: '911100002222222222',
            orderNo: 'ORD_CONFLICT',
            orderDate: '2024-01-15',
            orderAmount: 2260,
            refundAmount: 1000,
            isPartialRefund: true,
            redReason: '需要红冲'
          }]
        });

      expect(response.status).toBe(200);
      const listResponse = await request(app).get('/api/red-apply/list');
      conflictRecordId = listResponse.body.data.list[0].id;
    });

    test('2. 开始核验检测到冲突', async () => {
      const response = await request(app)
        .post(`/api/red-apply/${conflictRecordId}/start-verify`)
        .send({ operator: 'verifier_b' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe(ErrorType.CONFLICT_REFUND);
      expect(response.body.error.message).toContain('部分退款');
      expect(response.body.error.suggestion).toContain('业务人员确认');
    });

    test('3. 人工强制核验通过冲突', async () => {
      const response = await request(app)
        .post(`/api/red-apply/${conflictRecordId}/force-verify`)
        .send({
          operator: 'supervisor',
          remark: '与业务确认，特殊情况允许全额红冲'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RedApplyStatus.VERIFYING);
    });

    test('4. 历史记录包含冲突信息', async () => {
      const response = await request(app).get(`/api/red-apply/${conflictRecordId}/history`);
      const forceRecord = response.body.data.find((h: any) => h.operationType === '人工强制核验');
      expect(forceRecord).toBeDefined();
      expect(forceRecord.operator).toBe('supervisor');
    });
  });

  describe('场景三: 导入坏行处理', () => {
    beforeAll(() => {
      db.clear();
    });
    test('1. 批量导入包含坏行', async () => {
      const response = await request(app)
        .post('/api/red-apply/import')
        .send({
          operator: 'test_user',
          rows: [
            {
              invoiceCode: '111111',
              invoiceNumber: 'GOOD_INV',
              invoiceDate: '2024-01-20',
              invoiceAmount: 500,
              invoiceTaxAmount: 65,
              invoiceTotalAmount: 565,
              buyerName: '正常公司',
              buyerTaxId: '911100003333333333',
              sellerName: '销售方',
              sellerTaxId: '911100004444444444',
              orderNo: 'ORD_GOOD',
              orderDate: '2024-01-20',
              orderAmount: 565,
              refundAmount: 0,
              isPartialRefund: false,
              redReason: '正常红冲'
            },
            {
              invoiceCode: '',
              invoiceNumber: '',
              orderNo: '',
              redReason: ''
            },
            {
              invoiceCode: '222222',
              invoiceNumber: 'BAD_AMOUNT',
              invoiceDate: '2024-01-20',
              invoiceAmount: '不是数字' as any,
              invoiceTaxAmount: 0,
              invoiceTotalAmount: -100,
              orderNo: 'ORD_BAD',
              orderDate: '2024-01-20',
              orderAmount: -500,
              refundAmount: 0,
              isPartialRefund: false,
              redReason: '金额格式错误'
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(1);
      expect(response.body.data.failed).toBe(2);
      expect(response.body.data.failedDetails.length).toBe(2);

      const errors = response.body.data.failedDetails.map((d: any) => d.errorType);
      expect(errors).toContain(ErrorType.DATA_INCOMPLETE);
      expect(errors).toContain(ErrorType.INVALID_FORMAT);
    });

    test('2. 重复导入检测', async () => {
      await request(app)
        .post('/api/red-apply/import')
        .send({
          operator: 'test_user',
          rows: [{
            invoiceCode: '333333',
            invoiceNumber: 'DUP_INV',
            invoiceDate: '2024-01-20',
            invoiceAmount: 500,
            invoiceTaxAmount: 65,
            invoiceTotalAmount: 565,
            buyerName: '重复公司',
            buyerTaxId: '911100005555555555',
            sellerName: '销售方',
            sellerTaxId: '911100006666666666',
            orderNo: 'ORD_DUP',
            orderDate: '2024-01-20',
            orderAmount: 565,
            refundAmount: 0,
            isPartialRefund: false,
            redReason: '重复测试'
          }]
        });

      const dupResponse = await request(app)
        .post('/api/red-apply/import')
        .send({
          operator: 'test_user',
          rows: [{
            invoiceCode: '333333',
            invoiceNumber: 'DUP_INV',
            invoiceDate: '2024-01-20',
            invoiceAmount: 500,
            invoiceTaxAmount: 65,
            invoiceTotalAmount: 565,
            buyerName: '重复公司',
            buyerTaxId: '911100005555555555',
            sellerName: '销售方',
            sellerTaxId: '911100006666666666',
            orderNo: 'ORD_DUP',
            orderDate: '2024-01-20',
            orderAmount: 565,
            refundAmount: 0,
            isPartialRefund: false,
            redReason: '重复测试'
          }]
        });

      expect(dupResponse.body.data.success).toBe(0);
      expect(dupResponse.body.data.failed).toBe(1);
      expect(dupResponse.body.data.failedDetails[0].errorType).toBe(ErrorType.DUPLICATE_RECORD);
      expect(dupResponse.body.data.failedDetails[0].error).toContain('不允许静默覆盖');
    });
  });

  describe('场景四: 列表、详情、历史、导出互相对齐', () => {
    beforeAll(() => {
      db.clear();
    });
    test('1. 数据一致性验证', async () => {
      await request(app)
        .post('/api/red-apply/import')
        .send({
          operator: 'test_user',
          rows: [{
            invoiceCode: '999999',
            invoiceNumber: 'VERIFY_INV',
            invoiceDate: '2024-02-01',
            invoiceAmount: 3000,
            invoiceTaxAmount: 390,
            invoiceTotalAmount: 3390,
            buyerName: '一致性测试公司',
            buyerTaxId: '911100007777777777',
            sellerName: '销售方',
            sellerTaxId: '911100008888888888',
            orderNo: 'ORD_VERIFY',
            orderDate: '2024-02-01',
            orderAmount: 3390,
            refundAmount: 0,
            isPartialRefund: false,
            redReason: '一致性测试'
          }]
        });

      const listResponse = await request(app).get('/api/red-apply/list');
      const recordId = listResponse.body.data.list[0].id;
      const listItem = listResponse.body.data.list[0];

      const detailResponse = await request(app).get(`/api/red-apply/${recordId}/detail`);
      const detail = detailResponse.body.data;

      expect(listItem.invoice.invoiceNumber).toBe(detail.invoice.invoiceNumber);
      expect(listItem.order.orderNo).toBe(detail.order.orderNo);
      expect(listItem.status).toBe(detail.status);

      const exportResponse = await request(app)
        .post('/api/red-apply/export')
        .send({ ids: [recordId] });

      expect(exportResponse.body.data.csv).toContain(listItem.invoice.invoiceNumber);
      expect(exportResponse.body.data.csv).toContain(listItem.order.orderNo);
      expect(exportResponse.body.data.csv).toContain(listItem.status);

      await request(app)
        .post(`/api/red-apply/${recordId}/start-verify`)
        .send({ operator: 'verifier' });

      await request(app)
        .post(`/api/red-apply/${recordId}/approve`)
        .send({ operator: 'verifier' });

      const historyResponse = await request(app).get(`/api/red-apply/${recordId}/history`);
      const finalDetailResponse = await request(app).get(`/api/red-apply/${recordId}/detail`);

      const lastHistory = historyResponse.body.data[0];
      expect(lastHistory.operationType).toContain('完成红冲');
      expect(finalDetailResponse.body.data.status).toBe(RedApplyStatus.RED_COMPLETED);
    });
  });

  describe('场景五: 驳回流程', () => {
    beforeAll(() => {
      db.clear();
    });
    let rejectRecordId: string;

    test('1. 导入并驳回', async () => {
      const importResponse = await request(app)
        .post('/api/red-apply/import')
        .send({
          operator: 'test_user',
          rows: [{
            invoiceCode: 'REJECT01',
            invoiceNumber: 'REJECT_INV',
            invoiceDate: '2024-03-01',
            invoiceAmount: 800,
            invoiceTaxAmount: 104,
            invoiceTotalAmount: 904,
            buyerName: '驳回测试公司',
            buyerTaxId: '911100009999999999',
            sellerName: '销售方',
            sellerTaxId: '911100010000000000',
            orderNo: 'ORD_REJECT',
            orderDate: '2024-03-01',
            orderAmount: 904,
            refundAmount: 0,
            isPartialRefund: false,
            redReason: '驳回测试'
          }]
        });

      const listResponse = await request(app).get('/api/red-apply/list');
      rejectRecordId = listResponse.body.data.list[0].id;

      const rejectResponse = await request(app)
        .post(`/api/red-apply/${rejectRecordId}/reject`)
        .send({
          operator: 'verifier',
          rejectReason: '附件材料不完整，缺少业务部门审批文件'
        });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.data.status).toBe(RedApplyStatus.REJECTED);
      expect(rejectResponse.body.data.rejectReason).toBe('附件材料不完整，缺少业务部门审批文件');

      const historyResponse = await request(app).get(`/api/red-apply/${rejectRecordId}/history`);
      const rejectHistory = historyResponse.body.data.find((h: any) => h.operationType === '驳回申请');
      expect(rejectHistory).toBeDefined();
      expect(rejectHistory.remark).toContain('附件材料不完整');
    });
  });
});
