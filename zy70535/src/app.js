const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const store = require('./store');
const parserService = require('./parserService');
const {
  FILE_STATUS,
  TASK_STATUS,
  APPROVAL_STATUS,
  UploadFile,
  SandboxTask,
  ParseRule,
  PublishRequest
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

const generateIdempotencyKey = (...args) => {
  return crypto.createHash('md5').update(args.join('|')).digest('hex');
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.post('/api/rules', (req, res) => {
  try {
    const { name, description, columns, validators, createdBy } = req.body;

    if (!name || !columns) {
      return res.status(400).json({ error: '规则名称和列定义是必填项' });
    }

    const rule = new ParseRule({
      name,
      description,
      columns,
      validators,
      createdBy: createdBy || 'system'
    });

    store.saveRule(rule);
    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rules', (req, res) => {
  const rules = store.getAllRules();
  res.json(rules);
});

app.get('/api/rules/:id', (req, res) => {
  const rule = store.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在' });
  }
  res.json(rule);
});

app.post('/api/files/upload', upload.single('file'), (req, res) => {
  try {
    const { uploadedBy } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const file = new UploadFile({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: uploadedBy || 'anonymous'
    });

    store.saveFile(file);
    res.status(201).json(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files', (req, res) => {
  const files = store.getAllFiles();
  res.json(files);
});

app.get('/api/files/:id', (req, res) => {
  const file = store.getFile(req.params.id);
  if (!file) {
    return res.status(404).json({ error: '文件不存在' });
  }
  res.json(file);
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { fileId, ruleId, triggeredBy } = req.body;

    if (!fileId || !ruleId) {
      return res.status(400).json({ error: 'fileId 和 ruleId 是必填项' });
    }

    const idempotencyKey = generateIdempotencyKey('task', fileId, ruleId);
    const existingTask = store.checkIdempotency(idempotencyKey);
    if (existingTask) {
      return res.status(200).json({
        task: existingTask,
        message: '任务已存在（幂等性保证），未重复创建'
      });
    }

    const file = store.getFile(fileId);
    if (!file) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const rule = store.getRule(ruleId);
    if (!rule) {
      return res.status(404).json({ error: '规则不存在' });
    }

    if (!file.isSandbox) {
      return res.status(400).json({ error: '只能在沙箱环境中处理文件' });
    }

    const existingTasks = store.getTasksByFileId(fileId);
    const runningTask = existingTasks.find(t => t.status === TASK_STATUS.RUNNING);
    if (runningTask) {
      return res.status(400).json({ error: '该文件已有正在运行的解析任务' });
    }

    const task = new SandboxTask({
      fileId,
      ruleId,
      triggeredBy: triggeredBy || 'anonymous'
    });

    store.saveTask(task);
    store.setIdempotency(idempotencyKey, task);

    const filePath = path.join(uploadsDir, file.filename);
    parserService.parseFileAsync(task.id, filePath, rule);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks', (req, res) => {
  const tasks = Array.from(store.tasks.values());
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = store.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  res.json(task);
});

app.get('/api/tasks/:id/progress', (req, res) => {
  const task = store.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  res.json({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    totalRows: task.totalRows,
    successRows: task.successRows,
    failedRows: task.failedRows,
    startedAt: task.startedAt,
    completedAt: task.completedAt
  });
});

app.get('/api/failed-rows', (req, res) => {
  const { taskId, fileId } = req.query;
  let failedRows;

  if (taskId) {
    failedRows = store.getFailedRowsByTaskId(taskId);
  } else if (fileId) {
    failedRows = store.getFailedRowsByFileId(fileId);
  } else {
    failedRows = Array.from(store.failedRows.values());
  }

  res.json(failedRows);
});

app.get('/api/failed-rows/:id', (req, res) => {
  const failedRow = store.getFailedRow(req.params.id);
  if (!failedRow) {
    return res.status(404).json({ error: '失败行记录不存在' });
  }
  res.json(failedRow);
});

app.patch('/api/failed-rows/:id/fix', (req, res) => {
  try {
    const { fixedData, fixedBy } = req.body;

    if (!fixedData) {
      return res.status(400).json({ error: '修正后的数据是必填项' });
    }

    const failedRow = store.getFailedRow(req.params.id);
    if (!failedRow) {
      return res.status(404).json({ error: '失败行记录不存在' });
    }

    if (failedRow.isManuallyFixed) {
      return res.status(400).json({ error: '该行数据已被修正' });
    }

    failedRow.manuallyFix(fixedData, fixedBy || 'anonymous');
    store.saveFailedRow(failedRow);

    res.json(failedRow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/summaries', (req, res) => {
  const { fileId, taskId } = req.query;
  let summaries;

  if (fileId) {
    summaries = store.getSummariesByFileId(fileId);
  } else if (taskId) {
    summaries = store.getSummariesByTaskId(taskId);
  } else {
    summaries = Array.from(store.summaries.values());
  }

  res.json(summaries);
});

app.get('/api/summaries/:id', (req, res) => {
  const summary = store.getSummary(req.params.id);
  if (!summary) {
    return res.status(404).json({ error: '摘要不存在' });
  }
  res.json(summary);
});

app.get('/api/summaries/:id/export', (req, res) => {
  const summary = store.getSummary(req.params.id);
  if (!summary) {
    return res.status(404).json({ error: '摘要不存在' });
  }

  const failedRows = store.getFailedRowsByTaskId(summary.taskId);

  const exportData = {
    summary: {
      totalRows: summary.totalRows,
      successRows: summary.successRows,
      failedRows: summary.failedRows,
      successRate: summary.totalRows > 0 ? ((summary.successRows / summary.totalRows) * 100).toFixed(2) + '%' : '0%',
      generatedAt: summary.generatedAt
    },
    errorBreakdown: summary.errorBreakdown,
    columnBreakdown: summary.columnBreakdown,
    failedRowsDetail: failedRows.map(fr => ({
      rowNumber: fr.rowNumber,
      originalData: fr.originalData,
      errors: fr.validationErrors,
      processingBasis: fr.processingBasis,
      conclusion: fr.conclusion,
      isManuallyFixed: fr.isManuallyFixed
    }))
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="parse-summary-${summary.id}.json"`);
  res.json(exportData);
});

app.post('/api/publish-requests', (req, res) => {
  try {
    const { fileId, taskId, requestedBy, reason } = req.body;

    if (!fileId || !taskId) {
      return res.status(400).json({ error: 'fileId 和 taskId 是必填项' });
    }

    const idempotencyKey = generateIdempotencyKey('publish', fileId, taskId);
    const existingRequest = store.checkIdempotency(idempotencyKey);
    if (existingRequest) {
      return res.status(200).json({
        request: existingRequest,
        message: '发布申请已存在（幂等性保证），未重复创建'
      });
    }

    const file = store.getFile(fileId);
    if (!file) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const task = store.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (task.status !== TASK_STATUS.COMPLETED) {
      return res.status(400).json({ error: '只有已完成的解析任务才能申请发布' });
    }

    const publishRequest = new PublishRequest({
      fileId,
      taskId,
      requestedBy: requestedBy || 'anonymous',
      reason
    });

    store.savePublishRequest(publishRequest);
    store.setIdempotency(idempotencyKey, publishRequest);

    file.updateStatus(FILE_STATUS.PENDING_APPROVAL);
    store.saveFile(file);

    res.status(201).json(publishRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/publish-requests', (req, res) => {
  const { fileId } = req.query;
  let requests;

  if (fileId) {
    requests = store.getPublishRequestsByFileId(fileId);
  } else {
    requests = Array.from(store.publishRequests.values());
  }

  res.json(requests);
});

app.get('/api/publish-requests/:id', (req, res) => {
  const request = store.getPublishRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ error: '发布申请不存在' });
  }
  res.json(request);
});

app.post('/api/publish-requests/:id/approve', (req, res) => {
  try {
    const { reviewedBy, comment } = req.body;

    const publishRequest = store.getPublishRequest(req.params.id);
    if (!publishRequest) {
      return res.status(404).json({ error: '发布申请不存在' });
    }

    if (publishRequest.status !== APPROVAL_STATUS.PENDING) {
      return res.status(400).json({ error: '该申请已被处理' });
    }

    publishRequest.approve(reviewedBy || 'anonymous', comment);
    store.savePublishRequest(publishRequest);

    const file = store.getFile(publishRequest.fileId);
    if (file) {
      file.updateStatus(FILE_STATUS.APPROVED);
      file.isSandbox = false;
      store.saveFile(file);
    }

    res.json(publishRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/publish-requests/:id/reject', (req, res) => {
  try {
    const { reviewedBy, comment } = req.body;

    const publishRequest = store.getPublishRequest(req.params.id);
    if (!publishRequest) {
      return res.status(404).json({ error: '发布申请不存在' });
    }

    if (publishRequest.status !== APPROVAL_STATUS.PENDING) {
      return res.status(400).json({ error: '该申请已被处理' });
    }

    publishRequest.reject(reviewedBy || 'anonymous', comment);
    store.savePublishRequest(publishRequest);

    const file = store.getFile(publishRequest.fileId);
    if (file) {
      file.updateStatus(FILE_STATUS.REJECTED);
      store.saveFile(file);
    }

    res.json(publishRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

const server = app.listen(PORT, () => {
  console.log(`文件处理沙箱API服务已启动，监听端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = { app, server };
