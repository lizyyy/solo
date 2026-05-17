const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/index');
const { clearVisitors, addVisitor, VISITOR_STATUSES } = require('../src/models/visitor');
const { clearBatches } = require('../src/models/revocationBatch');

const testDataDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

describe('园区访客系统 - 批量撤销API', () => {
  beforeEach(() => {
    clearVisitors();
    clearBatches();
  });

  describe('验收场景1: 完整流转', () => {
    test('完整的批量撤销流程 - 列表 -> 创建批次 -> 处理 -> 详情 -> 导出', async () => {
      const visitor1 = addVisitor({
        visitorName: '张三',
        visitorPhone: '13800138001',
        hostName: '李经理',
        hostDepartment: '技术部',
        visitStartTime: '2024-01-15 09:00',
        visitEndTime: '2024-01-15 18:00'
      });

      const visitor2 = addVisitor({
        visitorName: '李四',
        visitorPhone: '13800138002',
        hostName: '王主管',
        hostDepartment: '市场部',
        visitStartTime: '2024-01-15 10:00',
        visitEndTime: '2024-01-15 17:00'
      });

      const listResponse = await request(app).get('/api/visitors');
      expect(listResponse.body.success).toBe(true);
      expect(listResponse.body.data.length).toBe(2);

      const createResponse = await request(app)
        .post('/api/revocations')
        .send({
          batchName: '测试批次-001',
          operatorName: '张管理员',
          revocationReason: '临时取消会议',
          visitorIds: [visitor1.id, visitor2.id]
        });

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.status).toBe('已完成');
      expect(createResponse.body.data.totalCount).toBe(2);
      expect(createResponse.body.data.successCount).toBe(2);
      expect(createResponse.body.data.failedCount).toBe(0);

      const batchId = createResponse.body.data.id;

      const detailResponse = await request(app).get(`/api/revocations/${batchId}`);
      expect(detailResponse.body.success).toBe(true);
      expect(detailResponse.body.data.items.length).toBe(2);
      expect(detailResponse.body.data.visitors.length).toBe(2);

      detailResponse.body.data.items.forEach(item => {
        expect(item.originalStatus).toBe(VISITOR_STATUSES.PENDING);
        expect(item.resultStatus).toBe(VISITOR_STATUSES.REVOKED);
        expect(item.success).toBe(true);
      });

      detailResponse.body.data.visitors.forEach(visitor => {
        expect(visitor.status).toBe(VISITOR_STATUSES.REVOKED);
        expect(visitor.revocationReason).toBe('临时取消会议');
      });

      const exportResponse = await request(app).get(`/api/revocations/${batchId}/export`);
      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toContain('text/csv');
      expect(exportResponse.text).toContain('张三');
      expect(exportResponse.text).toContain('李四');
      expect(exportResponse.text).toContain('成功');
    });
  });

  describe('验收场景2: 冲突记录', () => {
    test('包含无法撤销的访客时 - 不中断批次，记录行级错误', async () => {
      const pendingVisitor = addVisitor({
        visitorName: '王五',
        visitorPhone: '13800138003',
        hostName: '赵总监',
        hostDepartment: '人事部',
        status: VISITOR_STATUSES.PENDING
      });

      const enteredVisitor = addVisitor({
        visitorName: '赵六',
        visitorPhone: '13800138004',
        hostName: '孙副总',
        hostDepartment: '总裁办',
        status: VISITOR_STATUSES.ENTERED
      });

      const alreadyRevokedVisitor = addVisitor({
        visitorName: '钱七',
        visitorPhone: '13800138005',
        hostName: '周经理',
        hostDepartment: '财务部',
        status: VISITOR_STATUSES.REVOKED
      });

      const createResponse = await request(app)
        .post('/api/revocations')
        .send({
          batchName: '测试批次-002',
          operatorName: '李管理员',
          revocationReason: '疫情防控',
          visitorIds: [pendingVisitor.id, enteredVisitor.id, alreadyRevokedVisitor.id]
        });

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.status).toBe('部分失败');
      expect(createResponse.body.data.totalCount).toBe(3);
      expect(createResponse.body.data.successCount).toBe(1);
      expect(createResponse.body.data.failedCount).toBe(2);

      const items = createResponse.body.data.items;
      
      const successItem = items.find(i => i.visitorName === '王五');
      expect(successItem.success).toBe(true);
      expect(successItem.resultStatus).toBe(VISITOR_STATUSES.REVOKED);

      const enteredItem = items.find(i => i.visitorName === '赵六');
      expect(enteredItem.success).toBe(false);
      expect(enteredItem.errorMessage).toBe('访客已入园，无法撤销');
      expect(enteredItem.resultStatus).toBe(VISITOR_STATUSES.ENTERED);

      const revokedItem = items.find(i => i.visitorName === '钱七');
      expect(revokedItem.success).toBe(false);
      expect(revokedItem.errorMessage).toBe('访客已撤销，无需重复操作');
      expect(revokedItem.resultStatus).toBe(VISITOR_STATUSES.REVOKED);

      const visitorListResponse = await request(app).get('/api/visitors');
      const visitors = visitorListResponse.body.data;
      
      expect(visitors.find(v => v.visitorName === '王五').status).toBe(VISITOR_STATUSES.REVOKED);
      expect(visitors.find(v => v.visitorName === '赵六').status).toBe(VISITOR_STATUSES.ENTERED);
      expect(visitors.find(v => v.visitorName === '钱七').status).toBe(VISITOR_STATUSES.REVOKED);
    });
  });

  describe('验收场景3: 导入坏行', () => {
    test('CSV导入包含坏行时 - 不中断，处理有效行，记录坏行', async () => {
      const csvContent = `访客姓名,访客手机号,被访人姓名,被访人部门
孙八,13800138006,吴经理,销售部
周九,13800138007,郑主管,研发部
,13800138008,冯总监,产品部
吴十,,陈经理,运营部
郑十一,13800138009,,客服部
王十二,13800138010,林总监,法务部`;

      const csvPath = path.join(testDataDir, 'test-import.csv');
      fs.writeFileSync(csvPath, csvContent, 'utf8');

      const importResponse = await request(app)
        .post('/api/revocations/import')
        .attach('file', csvPath)
        .field('operatorName', '王管理员');

      expect(importResponse.body.success).toBe(true);
      
      const importSummary = importResponse.body.data.importSummary;
      expect(importSummary.total).toBe(6);
      expect(importSummary.imported).toBe(3);
      expect(importSummary.failed).toBe(3);

      expect(importSummary.failedRows.length).toBe(3);
      const failedRows = importSummary.failedRows;
      
      expect(failedRows.some(r => r.row === 4)).toBe(true);
      expect(failedRows.some(r => r.row === 5)).toBe(true);
      expect(failedRows.some(r => r.row === 6)).toBe(true);

      const batch = importResponse.body.data.batch;
      expect(batch.totalCount).toBe(3);
      expect(batch.successCount).toBe(3);

      const visitorListResponse = await request(app).get('/api/visitors');
      const visitors = visitorListResponse.body.data;
      
      const validVisitors = visitors.filter(v => 
        ['孙八', '周九', '王十二'].includes(v.visitorName)
      );
      expect(validVisitors.length).toBe(3);
      validVisitors.forEach(v => {
        expect(v.status).toBe(VISITOR_STATUSES.REVOKED);
      });

      fs.unlinkSync(csvPath);
    });
  });

  describe('数据一致性验证', () => {
    test('列表、详情、历史、导出数据互相对应', async () => {
      const visitor = addVisitor({
        visitorName: '测试用户',
        visitorPhone: '13900139001',
        hostName: '测试被访人',
        hostDepartment: '测试部门'
      });

      const createResponse = await request(app)
        .post('/api/revocations')
        .send({
          batchName: '数据一致性测试',
          operatorName: '测试管理员',
          revocationReason: '测试原因',
          visitorIds: [visitor.id]
        });

      const batchId = createResponse.body.data.id;

      const batchListResponse = await request(app).get('/api/revocations');
      const batchInList = batchListResponse.body.data.find(b => b.id === batchId);
      expect(batchInList).toBeDefined();
      expect(batchInList.batchName).toBe('数据一致性测试');
      expect(batchInList.successCount).toBe(1);

      const batchDetailResponse = await request(app).get(`/api/revocations/${batchId}`);
      const item = batchDetailResponse.body.data.items[0];
      expect(item.visitorName).toBe('测试用户');
      expect(item.hostName).toBe('测试被访人');
      expect(item.success).toBe(true);

      const visitorListResponse = await request(app).get(`/api/visitors?batchId=${batchId}`);
      expect(visitorListResponse.body.data.length).toBe(1);
      expect(visitorListResponse.body.data[0].visitorName).toBe('测试用户');
      expect(visitorListResponse.body.data[0].status).toBe(VISITOR_STATUSES.REVOKED);

      const exportResponse = await request(app).get(`/api/revocations/${batchId}/export`);
      expect(exportResponse.text).toContain('测试用户');
      expect(exportResponse.text).toContain('测试被访人');
      expect(exportResponse.text).toContain('成功');
    });
  });

  describe('状态校验', () => {
    test('各状态的撤销权限校验', async () => {
      const testCases = [
        { status: VISITOR_STATUSES.PENDING, canRevoke: true, desc: '待来访' },
        { status: VISITOR_STATUSES.REVOKING, canRevoke: true, desc: '撤销中' },
        { status: VISITOR_STATUSES.REVOKED, canRevoke: false, desc: '已撤销' },
        { status: VISITOR_STATUSES.ENTERED, canRevoke: false, desc: '已入园' }
      ];

      for (const testCase of testCases) {
        const visitor = addVisitor({
          visitorName: `测试-${testCase.desc}`,
          visitorPhone: '13800000000',
          hostName: '测试',
          status: testCase.status
        });

        const createResponse = await request(app)
          .post('/api/revocations')
          .send({
            batchName: `状态测试-${testCase.desc}`,
            operatorName: '测试员',
            revocationReason: '测试',
            visitorIds: [visitor.id]
          });

        const item = createResponse.body.data.items[0];
        if (testCase.canRevoke) {
          expect(item.success).toBe(true);
        } else {
          expect(item.success).toBe(false);
        }
      }
    });
  });
});
