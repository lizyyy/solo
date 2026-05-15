const express = require('express');
const router = express.Router();
const Joi = require('joi');
const taskService = require('../services/taskService');
const { Parser } = require('json2csv');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

const upload = multer({ storage: multer.memoryStorage() });

const createTaskSchema = Joi.object({
  task_type: Joi.string().required().valid('EXPORT', 'TRANSCODE', 'PUSH'),
  business_no: Joi.string().required(),
  total_count: Joi.number().integer().min(0).default(0)
});

const updateStatusSchema = Joi.object({
  status: Joi.string().required().valid('RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED'),
  message: Joi.string().allow('').default('')
});

const progressSchema = Joi.object({
  progress: Joi.number().integer().min(0).max(100).required(),
  success_count: Joi.number().integer().min(0).default(0),
  fail_count: Joi.number().integer().min(0).default(0),
  details: Joi.string().allow('').default('')
});

const failureSchema = Joi.object({
  error_code: Joi.string().allow(''),
  error_message: Joi.string().required(),
  stack_trace: Joi.string().allow('')
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const result = await taskService.createTask(value.task_type, value.business_no, value.total_count);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { task_type, current_status, business_no, page = 1, pageSize = 20 } = req.query;
    const filters = { task_type, current_status, business_no };
    const result = await taskService.listTasks(filters, parseInt(page), parseInt(pageSize));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const task = await taskService.getTaskDetail(req.params.id);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const task = await taskService.updateTaskStatus(req.params.id, value.status, value.message);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/progress', async (req, res) => {
  try {
    const { error, value } = progressSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    await taskService.addProgressSnapshot(
      req.params.id,
      value.progress,
      value.success_count,
      value.fail_count,
      value.details
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/failure', async (req, res) => {
  try {
    const { error, value } = failureSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const failureId = await taskService.recordFailure(
      req.params.id,
      value.error_code,
      value.error_message,
      value.stack_trace
    );
    res.json({ id: failureId, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const task = await taskService.retryTask(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { task_type, current_status } = req.query;
    const tasks = await taskService.getAllTasksForExport({ task_type, current_status });
    
    const fields = ['id', 'task_type', 'business_no', 'current_status', 'progress', 
                    'total_count', 'success_count', 'fail_count', 'event_count', 
                    'failure_count', 'created_at', 'updated_at'];
    const parser = new Parser({ fields });
    const csvData = parser.parse(tasks);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tasks_${Date.now()}.csv"`);
    res.send('\uFEFF' + csvData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });

    const tasks = [];
    const bufferStream = Readable.from(req.file.buffer);

    await new Promise((resolve, reject) => {
      bufferStream
        .pipe(csv())
        .on('data', (row) => tasks.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const results = await taskService.bulkCreateTasks(tasks);
    res.json({ results, total: tasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
