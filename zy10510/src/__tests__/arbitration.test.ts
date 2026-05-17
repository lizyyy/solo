import request from 'supertest';
import app from '../app';
import { arbitrationStore } from '../store/arbitrationStore';
import { ArbitrationStatus } from '../types';

describe('字段口径仲裁 API 测试', () => {
  beforeEach(() => {
    arbitrationStore.clear();
  });

  describe('POST /api/arbitration - 创建仲裁记录', () => {
    it('应该成功创建仲裁记录', async () => {
      const response = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: '订单金额',
          sourceReports: [
            {
              reportName: '销售日报',
              calculation: 'sum(订单表.金额)',
              description: '按天汇总'
            },
            {
              reportName: '财务月报',
              calculation: 'sum(财务表.实收金额)',
              description: '按月汇总'
            }
          ],
          disputeDescription: '两个报表统计口径不一致，销售日报包含未回款订单，财务月报只统计已回款',
          createdBy: '张三',
          rawInput: {
            screenshotUrl: 'https://example.com/screenshot.png',
            meetingNotes: '产品评审会议记录...'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fieldName).toBe('订单金额');
      expect(response.body.data.status).toBe(ArbitrationStatus.PENDING);
      expect(response.body.data.sourceReports.length).toBe(2);
      expect(response.body.data.history.length).toBe(1);
      expect(response.body.data.rawInput).toBeDefined();
    });

    it('参数验证失败应该返回400', async () => {
      const response = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: '',
          sourceReports: [],
          disputeDescription: '',
          createdBy: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/arbitration/:id - 查询单条记录', () => {
    it('应该成功返回记录', async () => {
      const createResponse = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: '用户数',
          sourceReports: [
            { reportName: '运营日报', calculation: 'count(distinct 用户ID)' }
          ],
          disputeDescription: '统计口径争议',
          createdBy: '李四'
        });

      const recordId = createResponse.body.data.id;
      const response = await request(app).get(`/api/arbitration/${recordId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(recordId);
    });

    it('不存在的记录应该返回404', async () => {
      const response = await request(app).get('/api/arbitration/non-existent-id');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/arbitration - 查询列表', () => {
    beforeEach(async () => {
      for (let i = 0; i < 15; i++) {
        await request(app)
          .post('/api/arbitration')
          .send({
            fieldName: `字段${i}`,
            sourceReports: [{ reportName: '报表A', calculation: '公式A' }],
            disputeDescription: '争议描述',
            createdBy: i % 2 === 0 ? '张三' : '李四'
          });
      }
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get('/api/arbitration')
        .query({ page: 1, pageSize: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(10);
      expect(response.body.pagination.total).toBe(15);
    });

    it('应该支持按创建人筛选', async () => {
      const response = await request(app)
        .get('/api/arbitration')
        .query({ createdBy: '张三' });

      expect(response.status).toBe(200);
      expect(response.body.pagination.total).toBe(8);
    });
  });

  describe('PATCH /api/arbitration/:id/status - 状态推进', () => {
    it('应该成功更新状态', async () => {
      const createResponse = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: 'GMV',
          sourceReports: [{ reportName: '销售报表', calculation: 'sum(金额)' }],
          disputeDescription: 'GMV定义不明确',
          createdBy: '产品经理'
        });

      const recordId = createResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/arbitration/${recordId}/status`)
        .send({
          status: ArbitrationStatus.IN_REVIEW,
          updatedBy: '仲裁人1',
          remark: '开始审核'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(ArbitrationStatus.IN_REVIEW);
      expect(response.body.data.history.length).toBe(2);
    });

    it('重复提交相同状态不应该重复添加历史记录', async () => {
      const createResponse = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: '复购率',
          sourceReports: [{ reportName: '用户报表', calculation: '复购用户/总用户' }],
          disputeDescription: '复购周期定义不同',
          createdBy: '数据分析师'
        });

      const recordId = createResponse.body.data.id;
      const initialHistoryLength = createResponse.body.data.history.length;

      await request(app)
        .patch(`/api/arbitration/${recordId}/status`)
        .send({
          status: ArbitrationStatus.IN_REVIEW,
          updatedBy: '仲裁人1'
        });

      const response = await request(app)
        .patch(`/api/arbitration/${recordId}/status`)
        .send({
          status: ArbitrationStatus.IN_REVIEW,
          updatedBy: '仲裁人1'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.history.length).toBe(initialHistoryLength + 1);
    });

    it('应该支持完整的状态流转和仲裁信息', async () => {
      const createResponse = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: '活跃用户',
          sourceReports: [
            { reportName: 'A系统', calculation: '登录一次就算活跃' },
            { reportName: 'B系统', calculation: '连续登录7天才算活跃' }
          ],
          disputeDescription: '活跃用户定义不一致',
          createdBy: '运营'
        });

      const recordId = createResponse.body.data.id;

      await request(app)
        .patch(`/api/arbitration/${recordId}/status`)
        .send({
          status: ArbitrationStatus.IN_REVIEW,
          updatedBy: '仲裁委员A'
        });

      const arbitratedResponse = await request(app)
        .patch(`/api/arbitration/${recordId}/status`)
        .send({
          status: ArbitrationStatus.ARBITRATED,
          updatedBy: '仲裁委员会主席',
          arbitrationOpinion: '统一采用"登录一次就算活跃"的定义',
          handlingBasis: '行业标准及历史数据对比'
        });

      expect(arbitratedResponse.body.data.arbitrationOpinion).toBeDefined();
      expect(arbitratedResponse.body.data.arbitratedBy).toBe('仲裁委员会主席');

      const effectiveResponse = await request(app)
        .patch(`/api/arbitration/${recordId}/status`)
        .send({
          status: ArbitrationStatus.EFFECTIVE,
          updatedBy: '仲裁委员会主席',
          effectiveVersion: 'v2.1.0'
        });

      expect(effectiveResponse.body.data.effectiveVersion).toBe('v2.1.0');
      expect(effectiveResponse.body.data.history.length).toBe(4);
    });
  });

  describe('PATCH /api/arbitration/:id/correction - 人工修正', () => {
    it('应该成功修正字段', async () => {
      const createResponse = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: 'ARPU',
          sourceReports: [{ reportName: '收入报表', calculation: '总收入/用户数' }],
          disputeDescription: '用户数范围定义不同',
          createdBy: '财务'
        });

      const recordId = createResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/arbitration/${recordId}/correction`)
        .send({
          field: 'disputeDescription',
          newValue: '用户数范围定义不同：是否包含测试账号',
          reason: '补充争议细节',
          correctedBy: '数据管理员'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.disputeDescription).toContain('是否包含测试账号');
      expect(response.body.data.corrections.length).toBe(1);
      expect(response.body.data.corrections[0].oldValue).toContain('用户数范围定义不同');
    });

    it('不允许的字段应该返回400', async () => {
      const createResponse = await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: 'LTV',
          sourceReports: [{ reportName: '用户价值报表', calculation: '累计收入' }],
          disputeDescription: '计算周期不同',
          createdBy: '分析师'
        });

      const recordId = createResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/arbitration/${recordId}/correction`)
        .send({
          field: 'createdAt',
          newValue: '2024-01-01',
          reason: '修改创建时间',
          correctedBy: '管理员'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_FIELD');
    });
  });

  describe('GET /api/arbitration/export - 导出功能', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/arbitration')
        .send({
          fieldName: '留存率',
          sourceReports: [
            { reportName: '次日留存', calculation: '次日登录/新增用户' },
            { reportName: '7日留存', calculation: '7日登录/新增用户' }
          ],
          disputeDescription: '留存统计口径差异',
          createdBy: '运营'
        });
    });

    it('应该导出CSV文件', async () => {
      const response = await request(app).get('/api/arbitration/export');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('留存率');
      expect(response.text).toContain('pending');
    });
  });

  describe('GET /api/arbitration/stats - 统计信息', () => {
    it('应该返回正确的统计', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/arbitration')
          .send({
            fieldName: `字段${i}`,
            sourceReports: [{ reportName: '报表', calculation: '公式' }],
            disputeDescription: '争议',
            createdBy: '测试用户'
          });
      }

      const response = await request(app).get('/api/arbitration/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.byStatus.pending).toBe(3);
    });
  });
});
