const request = require('supertest');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const testDbPath = path.join(dataDir, 'test_leads.db');

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DB_PATH = testDbPath;

const { app } = require('../src/app');
const { initDatabase } = require('../src/database/database');

beforeAll(async () => {
  await initDatabase();
});

afterAll((done) => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  done();
});

describe('健康检查', () => {
  it('GET /health 应该返回健康状态', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });
});

describe('元数据 API', () => {
  it('GET /api/leads/metadata 应该返回元数据', async () => {
    const response = await request(app).get('/api/leads/metadata');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('statuses');
    expect(response.body.data).toHaveProperty('courses');
    expect(response.body.data).toHaveProperty('responsibles');
  });
});

describe('线索 CRUD API', () => {
  let testLeadId;

  const validLead = {
    name: '测试学员',
    phone: '13800138000',
    course: 'Python编程体验课',
    appointment_time: '2026-06-01 14:00',
    status: 'new',
    responsible: '张顾问',
    notes: '测试备注'
  };

  describe('POST /api/leads - 创建线索', () => {
    it('应该成功创建有效的线索', async () => {
      const response = await request(app)
        .post('/api/leads')
        .send(validLead);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lead.name).toBe(validLead.name);
      expect(response.body.data.lead.phone).toBe(validLead.phone);
      
      testLeadId = response.body.data.lead.id;
    });

    it('应该拒绝无效的手机号', async () => {
      const response = await request(app)
        .post('/api/leads')
        .send({
          ...validLead,
          phone: '12345'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该拒绝缺少必填字段的请求', async () => {
      const response = await request(app)
        .post('/api/leads')
        .send({
          name: '测试'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该拒绝无效的预约时间格式', async () => {
      const response = await request(app)
        .post('/api/leads')
        .send({
          ...validLead,
          appointment_time: '无效时间'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leads - 获取线索列表', () => {
    it('应该返回线索列表', async () => {
      const response = await request(app).get('/api/leads');
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('leads');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.leads)).toBe(true);
    });

    it('应该支持按状态筛选', async () => {
      const response = await request(app)
        .get('/api/leads')
        .query({ status: 'new' });
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('应该支持按负责人筛选', async () => {
      const response = await request(app)
        .get('/api/leads')
        .query({ responsible: '张顾问' });
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('应该支持分页', async () => {
      const response = await request(app)
        .get('/api/leads')
        .query({ page: 1, limit: 10 });
      expect(response.statusCode).toBe(200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });
  });

  describe('GET /api/leads/:id - 获取单个线索', () => {
    it('应该返回指定ID的线索', async () => {
      const response = await request(app).get(`/api/leads/${testLeadId}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lead.id).toBe(testLeadId);
      expect(response.body.data).toHaveProperty('history');
    });

    it('应该对不存在的ID返回404', async () => {
      const response = await request(app).get('/api/leads/999999');
      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/leads/:id - 更新线索', () => {
    it('应该成功更新线索', async () => {
      const response = await request(app)
        .put(`/api/leads/${testLeadId}`)
        .send({
          notes: '更新后的备注',
          responsible: '李顾问'
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lead.notes).toBe('更新后的备注');
      expect(response.body.data.lead.responsible).toBe('李顾问');
      expect(response.body.data).toHaveProperty('changes');
    });

    it('应该记录修改历史', async () => {
      const historyResponse = await request(app).get(`/api/leads/${testLeadId}`);
      expect(historyResponse.body.data.history.length).toBeGreaterThan(0);
    });

    it('应该拒绝无效的状态流转', async () => {
      const response = await request(app)
        .put(`/api/leads/${testLeadId}`)
        .send({
          status: 'converted'
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('应该允许有效的状态流转', async () => {
      const response = await request(app)
        .put(`/api/leads/${testLeadId}`)
        .send({
          status: 'contacting'
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lead.status).toBe('contacting');
    });

    it('应该拒绝更新不存在的线索', async () => {
      const response = await request(app)
        .put('/api/leads/999999')
        .send({
          notes: '测试'
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('应该拒绝空的更新请求', async () => {
      const response = await request(app)
        .put(`/api/leads/${testLeadId}`)
        .send({});

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leads/:id/export - 导出Markdown报告', () => {
    it('应该导出Markdown格式的报告', async () => {
      const response = await request(app).get(`/api/leads/${testLeadId}/export`);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('markdown');
      expect(response.text).toContain('线索核对报告');
      expect(response.text).toContain('基本信息');
      expect(response.text).toContain('修改历史');
    });

    it('应该对不存在的ID返回404', async () => {
      const response = await request(app).get('/api/leads/999999/export');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/leads/:id - 删除线索', () => {
    it('应该成功删除线索', async () => {
      const response = await request(app).delete(`/api/leads/${testLeadId}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('删除后应该无法找到该线索', async () => {
      const response = await request(app).get(`/api/leads/${testLeadId}`);
      expect(response.statusCode).toBe(404);
    });

    it('应该拒绝删除不存在的线索', async () => {
      const response = await request(app).delete('/api/leads/999999');
      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('错误处理', () => {
  it('应该对不存在的路由返回404', async () => {
    const response = await request(app).get('/api/nonexistent');
    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

describe('数据一致性测试', () => {
  it('更新后列表和详情应该显示相同的数据', async () => {
    const createResponse = await request(app)
      .post('/api/leads')
      .send({
        name: '一致性测试',
        phone: '13900139000',
        course: 'Web前端开发入门',
        appointment_time: '2026-06-15 10:00',
        status: 'new',
        responsible: '王顾问',
        notes: '初始备注'
      });

    const leadId = createResponse.body.data.lead.id;

    await request(app)
      .put(`/api/leads/${leadId}`)
      .send({
        notes: '更新后的备注',
        status: 'contacting'
      });

    const listResponse = await request(app).get('/api/leads');
    const listLead = listResponse.body.data.leads.find(l => l.id === leadId);

    const detailResponse = await request(app).get(`/api/leads/${leadId}`);
    const detailLead = detailResponse.body.data.lead;

    expect(listLead.notes).toBe('更新后的备注');
    expect(listLead.status).toBe('contacting');
    expect(detailLead.notes).toBe('更新后的备注');
    expect(detailLead.status).toBe('contacting');

    expect(listLead.notes).toBe(detailLead.notes);
    expect(listLead.status).toBe(detailLead.status);
  });
});
