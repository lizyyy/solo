const request = require('supertest');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, '../../database', 'test-shift-board.db');

process.env.PORT = 3001;

let app;
let sequelize;
let Issue;

beforeAll(async () => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const { Sequelize } = require('sequelize');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: testDbPath,
    logging: false,
  });

  const { Model, DataTypes } = require('sequelize');
  class TestIssue extends Model {}
  
  TestIssue.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      shift: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [['白班', '晚班']],
        },
      },
      assignee: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      customer: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ticketNo: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'ticket_no',
      },
      riskLevel: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [['低', '中', '高', '紧急']],
        },
        field: 'risk_level',
      },
      deadline: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      tags: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const raw = this.getDataValue('tags');
          return raw ? JSON.parse(raw) : [];
        },
        set(val) {
          this.setDataValue('tags', val ? JSON.stringify(val) : '[]');
        },
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '待处理',
        validate: {
          isIn: [['待处理', '处理中', '待复盘', '已关闭']],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Issue',
      tableName: 'issues',
      timestamps: true,
    }
  );

  Issue = TestIssue;

  const express = require('express');
  const cors = require('cors');
  
  app = express();
  app.use(cors());
  app.use(express.json());

  const moment = require('moment');
  const { Op } = require('sequelize');
  const multer = require('multer');
  const Papa = require('papaparse');
  const upload = multer({ storage: multer.memoryStorage() });

  const isOverdueSoon = (deadline) => {
    const now = moment();
    const deadlineMoment = moment(deadline);
    const diffHours = deadlineMoment.diff(now, 'hours', true);
    return diffHours > 0 && diffHours <= 2;
  };

  const enhanceIssue = (issue) => {
    const issueData = issue.toJSON ? issue.toJSON() : { ...issue };
    return {
      ...issueData,
      isOverdueSoon: isOverdueSoon(issueData.deadline) && issueData.status !== '已关闭',
      isHighRisk: issueData.riskLevel === '高' || issueData.riskLevel === '紧急',
    };
  };

  app.get('/api/issues/summary', async (req, res) => {
    const now = moment();
    const overdueSoonThreshold = now.clone().add(2, 'hours');

    const [
      totalIssues,
      overdueSoonCount,
      highRiskUnresolved,
      pendingReview,
      closed,
    ] = await Promise.all([
      Issue.count(),
      Issue.count({
        where: {
          deadline: { [Op.between]: [now.toDate(), overdueSoonThreshold.toDate()] },
          status: { [Op.ne]: '已关闭' },
        },
      }),
      Issue.count({
        where: {
          riskLevel: { [Op.in]: ['高', '紧急'] },
          status: { [Op.in]: ['待处理', '处理中'] },
        },
      }),
      Issue.count({ where: { status: '待复盘' } }),
      Issue.count({ where: { status: '已关闭' } }),
    ]);

    res.json({
      total: totalIssues,
      overdueSoon: overdueSoonCount,
      highRiskUnresolved,
      pendingReview,
      closed,
      open: totalIssues - closed,
    });
  });

  app.get('/api/issues/grouped', async (req, res) => {
    const where = {};
    if (req.query.shift) where.shift = req.query.shift;
    if (req.query.assignee) where.assignee = req.query.assignee;
    if (req.query.riskLevel) where.riskLevel = req.query.riskLevel;

    const allIssues = await Issue.findAll({ where, order: [['createdAt', 'DESC']] });
    const enhancedIssues = allIssues.map(enhanceIssue);

    const groups = {
      overdueSoon: [],
      highRiskUnresolved: [],
      pendingReview: [],
      closed: [],
    };

    enhancedIssues.forEach((issue) => {
      if (issue.status === '已关闭') {
        groups.closed.push(issue);
      } else if (issue.status === '待复盘') {
        groups.pendingReview.push(issue);
      } else if (issue.isOverdueSoon) {
        groups.overdueSoon.push(issue);
      } else {
        groups.highRiskUnresolved.push(issue);
      }
    });

    res.json(groups);
  });

  app.post('/api/issues', async (req, res) => {
    const {
      shift,
      assignee,
      customer,
      ticketNo,
      riskLevel,
      deadline,
      tags,
      status,
      description,
    } = req.body;

    const issue = await Issue.create({
      shift,
      assignee,
      customer: customer || '',
      ticketNo: ticketNo || '',
      riskLevel,
      deadline: moment(deadline).toDate(),
      tags: tags || [],
      status: status || '待处理',
      description,
    });

    res.status(201).json(enhanceIssue(issue));
  });

  app.get('/api/issues/:id', async (req, res) => {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json(enhanceIssue(issue));
  });

  app.put('/api/issues/:id', async (req, res) => {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });

    const { shift, assignee, customer, ticketNo, riskLevel, deadline, tags, status, description } = req.body;
    
    await issue.update({
      shift: shift || issue.shift,
      assignee: assignee || issue.assignee,
      customer: customer !== undefined ? customer : issue.customer,
      ticketNo: ticketNo !== undefined ? ticketNo : issue.ticketNo,
      riskLevel: riskLevel || issue.riskLevel,
      deadline: deadline ? moment(deadline).toDate() : issue.deadline,
      tags: tags !== undefined ? tags : issue.tags,
      status: status || issue.status,
      description: description !== undefined ? description : issue.description,
    });

    await issue.reload();
    res.json(enhanceIssue(issue));
  });

  app.patch('/api/issues/:id/status', async (req, res) => {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    
    await issue.update({ status });
    await issue.reload();
    res.json(enhanceIssue(issue));
  });

  app.patch('/api/issues/batch/status', async (req, res) => {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Valid ids array is required' });
    }
    if (!status) return res.status(400).json({ error: 'Status is required' });

    await Issue.update({ status }, { where: { id: { [Op.in]: ids } } });
    const updatedIssues = await Issue.findAll({ where: { id: { [Op.in]: ids } } });
    res.json(updatedIssues.map(enhanceIssue));
  });

  app.delete('/api/issues/:id', async (req, res) => {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    await issue.destroy();
    res.status(204).send();
  });

  app.get('/api/issues/export/csv', async (req, res) => {
    const issues = await Issue.findAll({ order: [['createdAt', 'DESC']] });
    
    const csvData = issues.map((issue) => ({
      ID: issue.id,
      班次: issue.shift,
      负责人: issue.assignee,
      客户: issue.customer || '',
      工单号: issue.ticketNo || '',
      风险等级: issue.riskLevel,
      截止时间: moment(issue.deadline).format('YYYY-MM-DD HH:mm:ss'),
      标签: (issue.tags || []).join(','),
      状态: issue.status,
      描述: issue.description,
    }));

    const csv = Papa.unparse(csvData);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=test.csv');
    res.send('\uFEFF' + csv);
  });

  app.post('/api/issues/import/csv', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const csvContent = req.file.buffer.toString('utf8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    
    const issues = parsed.data.map((row) => ({
      shift: row['班次'] || row['shift'] || '白班',
      assignee: row['负责人'] || row['assignee'],
      customer: row['客户'] || row['customer'] || '',
      ticketNo: row['工单号'] || row['ticketNo'] || '',
      riskLevel: row['风险等级'] || row['riskLevel'] || '中',
      deadline: moment(row['截止时间'] || row['deadline']).toDate(),
      tags: (row['标签'] || row['tags'] || '').split(',').map(t => t.trim()).filter(t => t),
      status: row['状态'] || row['status'] || '待处理',
      description: row['描述'] || row['description'],
    }));

    const createdIssues = await Issue.bulkCreate(issues, { validate: true, returning: true });
    res.status(201).json({
      message: `Successfully imported ${createdIssues.length} issues`,
      issues: createdIssues.map(enhanceIssue),
    });
  });

  await sequelize.sync({ force: true });
});

afterAll(async () => {
  if (sequelize) {
    await sequelize.close();
  }
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

const moment = require('moment');

describe('Issue API', () => {
  const testIssue = {
    shift: '白班',
    assignee: '张三',
    customer: '某科技公司',
    ticketNo: 'TK-2024001',
    riskLevel: '高',
    deadline: moment().add(1, 'hour').toISOString(),
    tags: ['紧急', '退款'],
    status: '待处理',
    description: '用户投诉充值未到账，需要紧急处理',
  };

  let createdIssueId;

  test('POST /api/issues - should create a new issue', async () => {
    const response = await request(app).post('/api/issues').send(testIssue);
    
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.shift).toBe(testIssue.shift);
    expect(response.body.assignee).toBe(testIssue.assignee);
    expect(response.body.riskLevel).toBe(testIssue.riskLevel);
    expect(response.body.status).toBe(testIssue.status);
    expect(Array.isArray(response.body.tags)).toBe(true);
    
    createdIssueId = response.body.id;
  });

  test('GET /api/issues/:id - should get an issue by id', async () => {
    const response = await request(app).get(`/api/issues/${createdIssueId}`);
    
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(createdIssueId);
    expect(response.body.assignee).toBe('张三');
  });

  test('GET /api/issues/:id - should return 404 for non-existent issue', async () => {
    const response = await request(app).get('/api/issues/99999');
    expect(response.statusCode).toBe(404);
  });

  test('GET /api/issues/summary - should get risk summary', async () => {
    const response = await request(app).get('/api/issues/summary');
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('overdueSoon');
    expect(response.body).toHaveProperty('highRiskUnresolved');
    expect(response.body).toHaveProperty('pendingReview');
    expect(response.body).toHaveProperty('closed');
    expect(response.body).toHaveProperty('open');
    expect(response.body.total).toBeGreaterThan(0);
  });

  test('GET /api/issues/grouped - should get grouped issues', async () => {
    const response = await request(app).get('/api/issues/grouped');
    
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('overdueSoon');
    expect(response.body).toHaveProperty('highRiskUnresolved');
    expect(response.body).toHaveProperty('pendingReview');
    expect(response.body).toHaveProperty('closed');
    expect(Array.isArray(response.body.highRiskUnresolved)).toBe(true);
  });

  test('PUT /api/issues/:id - should update an issue', async () => {
    const updates = {
      status: '处理中',
      description: '已联系技术支持，正在排查',
    };
    
    const response = await request(app)
      .put(`/api/issues/${createdIssueId}`)
      .send(updates);
    
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('处理中');
    expect(response.body.description).toBe('已联系技术支持，正在排查');
  });

  test('PATCH /api/issues/:id/status - should update issue status', async () => {
    const response = await request(app)
      .patch(`/api/issues/${createdIssueId}/status`)
      .send({ status: '待复盘' });
    
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('待复盘');
  });

  test('POST /api/issues - should create issue with overdueSoon flag for near deadline', async () => {
    const nearDeadlineIssue = {
      shift: '晚班',
      assignee: '李四',
      riskLevel: '紧急',
      deadline: moment().add(30, 'minutes').toISOString(),
      tags: [],
      status: '待处理',
      description: '即将超时的测试事项',
    };
    
    const response = await request(app).post('/api/issues').send(nearDeadlineIssue);
    
    expect(response.statusCode).toBe(201);
    expect(response.body.isOverdueSoon).toBe(true);
  });

  test('PATCH /api/issues/batch/status - should update multiple issues', async () => {
    const issue2 = {
      shift: '白班',
      assignee: '王五',
      riskLevel: '中',
      deadline: moment().add(5, 'hours').toISOString(),
      tags: [],
      status: '待处理',
      description: '批量测试事项1',
    };
    
    const issue3 = {
      shift: '晚班',
      assignee: '赵六',
      riskLevel: '低',
      deadline: moment().add(10, 'hours').toISOString(),
      tags: [],
      status: '待处理',
      description: '批量测试事项2',
    };

    const [r2, r3] = await Promise.all([
      request(app).post('/api/issues').send(issue2),
      request(app).post('/api/issues').send(issue3),
    ]);

    const response = await request(app)
      .patch('/api/issues/batch/status')
      .send({ ids: [r2.body.id, r3.body.id], status: '已关闭' });

    expect(response.statusCode).toBe(200);
    expect(response.body.length).toBe(2);
    expect(response.body[0].status).toBe('已关闭');
    expect(response.body[1].status).toBe('已关闭');
  });

  test('DELETE /api/issues/:id - should delete an issue', async () => {
    const tempIssue = {
      shift: '白班',
      assignee: '临时',
      riskLevel: '低',
      deadline: moment().add(1, 'day').toISOString(),
      tags: [],
      status: '待处理',
      description: '即将删除的测试',
    };
    
    const createResponse = await request(app).post('/api/issues').send(tempIssue);
    const tempId = createResponse.body.id;
    
    const deleteResponse = await request(app).delete(`/api/issues/${tempId}`);
    expect(deleteResponse.statusCode).toBe(204);
    
    const getResponse = await request(app).get(`/api/issues/${tempId}`);
    expect(getResponse.statusCode).toBe(404);
  });

  test('GET /api/issues/export/csv - should export CSV', async () => {
    const response = await request(app).get('/api/issues/export/csv');
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('班次');
    expect(response.text).toContain('负责人');
  });
});
