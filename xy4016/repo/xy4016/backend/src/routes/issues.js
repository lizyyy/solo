const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');
const moment = require('moment');
const { Op } = require('sequelize');
const Issue = require('../models/Issue');
const RuleEngine = require('../services/ruleEngine');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  try {
    const filters = {
      shift: req.query.shift,
      assignee: req.query.assignee,
      riskLevel: req.query.riskLevel,
      status: req.query.status,
      tag: req.query.tag,
    };
    
    const issues = await RuleEngine.getFilteredIssues(filters);
    const enhancedIssues = issues.map((issue) => RuleEngine.enhanceIssue(issue));
    res.json(enhancedIssues);
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await RuleEngine.getRiskSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.get('/grouped', async (req, res) => {
  try {
    const filters = {
      shift: req.query.shift,
      assignee: req.query.assignee,
      riskLevel: req.query.riskLevel,
      status: req.query.status,
      tag: req.query.tag,
    };
    
    const groups = await RuleEngine.getGroupedIssues(filters);
    res.json(groups);
  } catch (error) {
    console.error('Error fetching grouped issues:', error);
    res.status(500).json({ error: 'Failed to fetch grouped issues' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const enhanced = RuleEngine.enhanceIssue(issue);
    res.json(enhanced);
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
});

router.post('/', async (req, res) => {
  try {
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

    const enhanced = RuleEngine.enhanceIssue(issue);
    res.status(201).json(enhanced);
  } catch (error) {
    console.error('Error creating issue:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

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
    const enhanced = RuleEngine.enhanceIssue(issue);
    res.json(enhanced);
  } catch (error) {
    console.error('Error updating issue:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    await issue.update({ status });
    await issue.reload();
    const enhanced = RuleEngine.enhanceIssue(issue);
    res.json(enhanced);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.patch('/batch/status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Valid ids array is required' });
    }
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    await Issue.update(
      { status },
      { where: { id: { [Op.in]: ids } } }
    );

    const updatedIssues = await Issue.findAll({
      where: { id: { [Op.in]: ids } },
    });

    const enhancedIssues = updatedIssues.map((issue) => RuleEngine.enhanceIssue(issue));
    res.json(enhancedIssues);
  } catch (error) {
    console.error('Error batch updating status:', error);
    res.status(500).json({ error: 'Failed to batch update status' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const issue = await Issue.findByPk(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    await issue.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting issue:', error);
    res.status(500).json({ error: 'Failed to delete issue' });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const issues = await Issue.findAll({
      order: [['createdAt', 'DESC']],
    });

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
      创建时间: moment(issue.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      更新时间: moment(issue.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
    }));

    const csv = Papa.unparse(csvData);
    const filename = `shift-handover-${moment().format('YYYYMMDDHHmmss')}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      return res.status(400).json({
        error: 'CSV parse error',
        details: parsed.errors,
      });
    }

    const issues = [];
    const errors = [];

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      try {
        const shift = row['班次'] || row['shift'] || '白班';
        const assignee = row['负责人'] || row['assignee'];
        const customer = row['客户'] || row['customer'] || '';
        const ticketNo = row['工单号'] || row['ticketNo'] || '';
        const riskLevel = row['风险等级'] || row['riskLevel'] || '中';
        const deadlineStr = row['截止时间'] || row['deadline'];
        const tagsStr = row['标签'] || row['tags'] || '';
        const status = row['状态'] || row['status'] || '待处理';
        const description = row['描述'] || row['description'];

        if (!assignee) {
          throw new Error('负责人不能为空');
        }
        if (!description) {
          throw new Error('描述不能为空');
        }
        if (!deadlineStr) {
          throw new Error('截止时间不能为空');
        }

        const deadline = moment(deadlineStr);
        if (!deadline.isValid()) {
          throw new Error(`截止时间格式无效: ${deadlineStr}`);
        }

        const tags = tagsStr ? tagsStr.split(/[,，]/).map((t) => t.trim()).filter((t) => t) : [];

        const validShifts = ['白班', '晚班'];
        const validRiskLevels = ['低', '中', '高', '紧急'];
        const validStatuses = ['待处理', '处理中', '待复盘', '已关闭'];

        if (!validShifts.includes(shift)) {
          throw new Error(`无效的班次: ${shift}`);
        }
        if (!validRiskLevels.includes(riskLevel)) {
          throw new Error(`无效的风险等级: ${riskLevel}`);
        }
        if (!validStatuses.includes(status)) {
          throw new Error(`无效的状态: ${status}`);
        }

        issues.push({
          shift,
          assignee,
          customer,
          ticketNo,
          riskLevel,
          deadline: deadline.toDate(),
          tags,
          status,
          description,
        });
      } catch (error) {
        errors.push({ row: i + 2, message: error.message });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Some rows have validation errors',
        errors,
      });
    }

    const createdIssues = await Issue.bulkCreate(issues, {
      validate: true,
      returning: true,
    });

    const enhancedIssues = createdIssues.map((issue) => RuleEngine.enhanceIssue(issue));
    res.status(201).json({
      message: `Successfully imported ${enhancedIssues.length} issues`,
      issues: enhancedIssues,
    });
  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({ error: 'Failed to import CSV', details: error.message });
  }
});

module.exports = router;
