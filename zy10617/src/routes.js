const express = require('express');
const { createObjectCsvWriter } = require('csv-writer');
const { projectService, annotatorService, taskPackageService, reworkRecordService } = require('./services');
const { STATUS } = require('./constants');

const router = express.Router();

router.use(express.json());

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.get('/projects', async (req, res) => {
  res.json(await projectService.list());
});

router.post('/projects', async (req, res) => {
  try {
    const project = await projectService.create(req.body);
    res.status(201).json(project);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/annotators', async (req, res) => {
  res.json(await annotatorService.list());
});

router.post('/annotators', async (req, res) => {
  try {
    const annotator = await annotatorService.create(req.body);
    res.status(201).json(annotator);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/task-packages', async (req, res) => {
  res.json(await taskPackageService.list(req.query));
});

router.post('/task-packages', async (req, res) => {
  try {
    const pkg = await taskPackageService.create(req.body);
    res.status(201).json(pkg);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/rework-records', async (req, res) => {
  res.json(await reworkRecordService.list(req.query));
});

router.get('/rework-records/:id', async (req, res) => {
  const record = await reworkRecordService.get(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '返工记录不存在' });
  }
  res.json(record);
});

router.get('/rework-records/:id/history', async (req, res) => {
  const history = await reworkRecordService.getHistory(req.params.id);
  res.json(history);
});

router.post('/rework-records', async (req, res) => {
  try {
    const { task_package_id, project_id, annotator_id, reason } = req.body;
    
    if (!task_package_id || !project_id || !annotator_id || !reason) {
      return res.status(400).json({ 
        error: '缺少必填字段',
        required: ['task_package_id', 'project_id', 'annotator_id', 'reason']
      });
    }

    const record = await reworkRecordService.create(req.body);
    res.status(201).json(record);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/rework-records/:id/status', async (req, res) => {
  try {
    const { status, operator, remark } = req.body;
    
    if (!status || !Object.values(STATUS).includes(status)) {
      return res.status(400).json({ 
        error: '无效的状态值',
        valid_statuses: Object.values(STATUS)
      });
    }

    const record = await reworkRecordService.updateStatus(req.params.id, status, operator, remark);
    res.json(record);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/rework-records/export/csv', async (req, res) => {
  try {
    const data = await reworkRecordService.export(req.query);
    const filename = `rework-records-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const csvWriter = createObjectCsvWriter({
      path: 'memory',
      header: [
        { id: 'id', title: 'ID' },
        { id: 'project_name', title: '项目名称' },
        { id: 'task_package_name', title: '任务包名称' },
        { id: 'annotator_name', title: '标注员' },
        { id: 'reason', title: '返工原因' },
        { id: 'status', title: '状态' },
        { id: 'has_conflict', title: '是否有冲突' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' }
      ]
    });

    await csvWriter.writeRecords(data);
    const fs = require('fs');
    const csvContent = fs.readFileSync('memory', 'utf8');
    res.send('\uFEFF' + csvContent);
    fs.unlinkSync('memory');
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/constants', (req, res) => {
  const { STATUS, STATUS_LABELS, REWORK_REASONS, REWORK_REASON_LABELS } = require('./constants');
  res.json({
    statuses: Object.entries(STATUS).map(([key, value]) => ({
      key,
      value,
      label: STATUS_LABELS[value]
    })),
    reasons: Object.entries(REWORK_REASONS).map(([key, value]) => ({
      key,
      value,
      label: REWORK_REASON_LABELS[value]
    }))
  });
});

module.exports = router;
