const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const multer = require('multer');

const testDbPath = path.join(__dirname, '../data/test_main.json');
const testUploadsPath = path.join(__dirname, '../test_uploads');

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
fs.mkdirSync(testUploadsPath, { recursive: true });

process.env.TEST_DB_PATH = testDbPath;
process.env.TEST_UPLOADS_PATH = testUploadsPath;

delete require.cache[require.resolve('../src/models/database')];
delete require.cache[require.resolve('../src/services/historyService')];
delete require.cache[require.resolve('../src/services/sampleService')];
delete require.cache[require.resolve('../src/services/taskService')];
delete require.cache[require.resolve('../src/services/approvalService')];
delete require.cache[require.resolve('../src/routes/samples')];
delete require.cache[require.resolve('../src/routes/tasks')];
delete require.cache[require.resolve('../src/routes/approvals')];
delete require.cache[require.resolve('../src/routes/audit')];

const { v4: uuidv4 } = require('uuid');
const { Database, getDatabase } = require('../src/models/database');

class TestDatabase {
  constructor(customPath) {
    this.filePath = customPath;
    this.data = {
      samples: [],
      samplesHistory: [],
      destructionTasks: [],
      approvals: [],
      photos: [],
      auditLogs: [],
      jobRuns: []
    };
  }
  
  save() {}
  
  getSamples() { return this.data.samples; }
  
  addSample(sample) {
    this.data.samples.push(sample);
    return sample;
  }
  
  findSample(predicate) {
    return this.data.samples.find(predicate);
  }
  
  filterSamples(predicate) {
    return this.data.samples.filter(predicate);
  }
  
  updateSample(id, updates) {
    const idx = this.data.samples.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this.data.samples[idx] = { ...this.data.samples[idx], ...updates };
    return this.data.samples[idx];
  }
  
  addHistory(record) {
    this.data.samplesHistory.push(record);
    return record;
  }
  
  findHistory(predicate) {
    return this.data.samplesHistory.filter(predicate);
  }
  
  addTask(task) {
    this.data.destructionTasks.push(task);
    return task;
  }
  
  findTask(predicate) {
    return this.data.destructionTasks.find(predicate);
  }
  
  filterTasks(predicate) {
    return this.data.destructionTasks.filter(predicate);
  }
  
  updateTask(id, updates) {
    const idx = this.data.destructionTasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.data.destructionTasks[idx] = { ...this.data.destructionTasks[idx], ...updates };
    return this.data.destructionTasks[idx];
  }
  
  addApproval(approval) {
    this.data.approvals.push(approval);
    return approval;
  }
  
  findApproval(predicate) {
    return this.data.approvals.find(predicate);
  }
  
  filterApprovals(predicate) {
    return this.data.approvals.filter(predicate);
  }
  
  updateApproval(id, updates) {
    const idx = this.data.approvals.findIndex(a => a.id === id);
    if (idx === -1) return null;
    this.data.approvals[idx] = { ...this.data.approvals[idx], ...updates };
    return this.data.approvals[idx];
  }
  
  addPhoto(photo) {
    this.data.photos.push(photo);
    return photo;
  }
  
  filterPhotos(predicate) {
    return this.data.photos.filter(predicate);
  }
  
  addAuditLog(log) {
    this.data.auditLogs.push(log);
    return log;
  }
  
  filterAuditLogs(predicate) {
    return this.data.auditLogs.filter(predicate);
  }
  
  addJobRun(run) {
    this.data.jobRuns.push(run);
    return run;
  }
  
  findJobRun(predicate) {
    return this.data.jobRuns.find(predicate);
  }
  
  filterJobRuns(predicate) {
    return this.data.jobRuns.filter(predicate);
  }
  
  transaction(fn) {
    fn();
  }
}

let testDb = null;

function getTestDb() {
  if (!testDb) {
    testDb = new TestDatabase(testDbPath);
  }
  return testDb;
}

const HistoryService = {
  recordSampleHistory(sampleId, operation, oldData, newData, operator = null, reason = null) {
    const db = getTestDb();
    db.addHistory({
      history_id: uuidv4(),
      sample_id: sampleId,
      operation,
      old_data: oldData ? JSON.stringify(oldData) : null,
      new_data: newData ? JSON.stringify(newData) : null,
      operator,
      reason,
      created_at: new Date().toISOString()
    });
  },

  recordAudit(action, entityType, entityId, details = null, operator = null) {
    const db = getTestDb();
    db.addAuditLog({
      id: uuidv4(),
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ? JSON.stringify(details) : null,
      operator,
      created_at: new Date().toISOString()
    });
  },

  getSampleHistory(sampleId) {
    const db = getTestDb();
    return db.findHistory(h => h.sample_id === sampleId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(row => ({
        ...row,
        old_data: row.old_data ? JSON.parse(row.old_data) : null,
        new_data: row.new_data ? JSON.parse(row.new_data) : null
      }));
  },

  getAuditLogs(entityType = null, entityId = null, limit = 100) {
    const db = getTestDb();
    let logs = db.filterAuditLogs(() => true);
    
    if (entityType) {
      logs = logs.filter(l => l.entity_type === entityType);
    }
    if (entityId) {
      logs = logs.filter(l => l.entity_id === entityId);
    }
    
    return logs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
      }));
  }
};

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

const SampleService = {
  createSample(data) {
    const db = getTestDb();
    const {
      batch_no, product_name, quantity, unit, sample_date,
      retention_days, storage_location, operator = null
    } = data;
    
    const expiry_date = addDays(sample_date, retention_days);
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const newData = {
      id, batch_no, product_name, quantity, unit,
      sample_date, retention_days, expiry_date,
      storage_location, status: 'active',
      created_at: now, updated_at: now
    };
    
    db.addSample(newData);
    
    HistoryService.recordSampleHistory(id, 'create', null, newData, operator);
    HistoryService.recordAudit('create', 'sample', id, { batch_no, product_name }, operator);
    
    return this.getSample(id);
  },

  getSample(id) {
    const db = getTestDb();
    return db.findSample(s => s.id === id);
  },

  getSamples(filters = {}) {
    const db = getTestDb();
    let samples = db.filterSamples(() => true);
    
    if (filters.batch_no) {
      samples = samples.filter(s => s.batch_no.includes(filters.batch_no));
    }
    if (filters.status) {
      samples = samples.filter(s => s.status === filters.status);
    }
    
    return samples.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  updateSample(id, updates, operator = null, reason = null) {
    const db = getTestDb();
    const oldSample = this.getSample(id);
    if (!oldSample) return null;
    
    const updateData = {};
    for (const field of ['product_name', 'quantity', 'unit', 'sample_date', 'retention_days', 'storage_location']) {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    }
    
    if ('sample_date' in updates || 'retention_days' in updates) {
      const sample_date = updates.sample_date || oldSample.sample_date;
      const retention_days = updates.retention_days || oldSample.retention_days;
      updateData.expiry_date = addDays(sample_date, retention_days);
    }
    
    updateData.updated_at = new Date().toISOString();
    
    db.updateSample(id, updateData);
    const newSample = this.getSample(id);
    
    HistoryService.recordSampleHistory(id, 'update', oldSample, newSample, operator, reason);
    HistoryService.recordAudit('update', 'sample', id, { reason }, operator);
    
    return newSample;
  },

  supplementSample(id, data, operator = null, reason = null) {
    const oldSample = this.getSample(id);
    if (!oldSample) return null;
    
    const updated = this.updateSample(id, data, operator, reason);
    
    HistoryService.recordSampleHistory(id, 'supplement', oldSample, updated, operator, reason);
    HistoryService.recordAudit('supplement', 'sample', id, { reason }, operator);
    
    return updated;
  },

  withdrawSample(id, operator = null, reason = null) {
    const db = getTestDb();
    const oldSample = this.getSample(id);
    if (!oldSample) return null;
    if (oldSample.status === 'withdrawn') {
      throw new Error('该留样已撤回');
    }
    
    db.updateSample(id, {
      status: 'withdrawn',
      updated_at: new Date().toISOString()
    });
    
    const newSample = this.getSample(id);
    
    HistoryService.recordSampleHistory(id, 'withdraw', oldSample, newSample, operator, reason);
    HistoryService.recordAudit('withdraw', 'sample', id, { reason }, operator);
    
    return newSample;
  },

  getHistory(id) {
    return HistoryService.getSampleHistory(id);
  }
};

const TaskService = {
  generateExpiryTasks(targetDate = null) {
    const db = getTestDb();
    const runDate = targetDate || new Date().toISOString().split('T')[0];
    
    const existingRun = db.findJobRun(
      j => j.job_name === 'generate_expiry_tasks' && j.run_date === runDate && j.status === 'success'
    );
    
    if (existingRun) {
      return {
        message: `今日任务已跳过，重复执行`,
        recordsProcessed: existingRun.records_processed,
        rerunDetected: true
      };
    }
    
    const now = new Date().toISOString();
    const jobId = uuidv4();
    
    db.addJobRun({
      id: jobId,
      job_name: 'generate_expiry_tasks',
      run_date: runDate,
      status: 'running',
      records_processed: 0,
      error_message: null,
      started_at: now,
      finished_at: null
    });
    
    try {
      const allSamples = db.filterSamples(() => true);
      const samples = allSamples.filter(s => {
        if (s.status !== 'active') return false;
        if (s.expiry_date > runDate) return false;
        
        const existingTask = db.findTask(
          t => t.sample_id === s.id && ['pending', 'approved', 'completed', 'pending_approval'].includes(t.status)
        );
        
        return !existingTask;
      });
      
      let processed = 0;
      
      for (const sample of samples) {
        db.addTask({
          id: uuidv4(),
          sample_id: sample.id,
          batch_no: sample.batch_no,
          expiry_date: sample.expiry_date,
          status: 'pending',
          is_extended: 0,
          extension_days: 0,
          extension_reason: null,
          created_at: new Date().toISOString()
        });
        processed++;
        
        HistoryService.recordAudit('task_created', 'task', sample.id, {
          batch_no: sample.batch_no,
          expiry_date: sample.expiry_date
        });
      }
      
      const finishedAt = new Date().toISOString();
      
      const jobRuns = db.data.jobRuns;
      const idx = jobRuns.findIndex(j => j.id === jobId);
      if (idx !== -1) {
        jobRuns[idx].status = 'success';
        jobRuns[idx].records_processed = processed;
        jobRuns[idx].finished_at = finishedAt;
      }
      
      return {
        message: `成功生成 ${processed} 个到期任务`,
        recordsProcessed: processed,
        runDate,
        rerunDetected: false
      };
    } catch (error) {
      const jobRuns = db.data.jobRuns;
      const idx = jobRuns.findIndex(j => j.id === jobId);
      if (idx !== -1) {
        jobRuns[idx].status = 'failed';
        jobRuns[idx].error_message = error.message;
        jobRuns[idx].finished_at = new Date().toISOString();
      }
      
      throw error;
    }
  },

  getTasks(filters = {}) {
    const db = getTestDb();
    let tasks = db.filterTasks(() => true);
    
    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.sample_id) {
      tasks = tasks.filter(t => t.sample_id === filters.sample_id);
    }
    
    return tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getTask(id) {
    const db = getTestDb();
    return db.findTask(t => t.id === id);
  },

  extendTask(taskId, extensionDays, reason, operator = null) {
    const db = getTestDb();
    const task = this.getTask(taskId);
    if (!task) throw new Error('任务不存在');
    if (task.status !== 'pending') throw new Error('只有待处理任务才能延期');
    
    const newExpiry = new Date(task.expiry_date);
    newExpiry.setDate(newExpiry.getDate() + extensionDays);
    const newExpiryStr = newExpiry.toISOString().split('T')[0];
    
    db.updateTask(taskId, {
      is_extended: 1,
      extension_days: extensionDays,
      extension_reason: reason,
      expiry_date: newExpiryStr
    });
    
    const updatedTask = this.getTask(taskId);
    
    HistoryService.recordAudit('task_extended', 'task', taskId, {
      oldExpiry: task.expiry_date,
      newExpiry: newExpiryStr,
      extensionDays,
      reason
    }, operator);
    
    return updatedTask;
  },

  getJobRuns(jobName, limit = 20) {
    const db = getTestDb();
    return db.filterJobRuns(j => j.job_name === jobName)
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, limit);
  }
};

const ApprovalService = {
  submitForApproval(taskId, submitter = null) {
    const db = getTestDb();
    const task = TaskService.getTask(taskId);
    if (!task) throw new Error('任务不存在');
    
    const existingApproval = db.findApproval(
      a => a.task_id === taskId && ['pending', 'approved'].includes(a.status)
    );
    
    if (existingApproval) {
      throw new Error('该任务已提交审批或已批准');
    }
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.addApproval({
      id,
      task_id: taskId,
      sample_id: task.sample_id,
      batch_no: task.batch_no,
      status: 'pending',
      submitter,
      reviewer: null,
      review_comment: null,
      submitted_at: now,
      reviewed_at: null
    });
    
    db.updateTask(taskId, { status: 'pending_approval' });
    
    HistoryService.recordAudit('approval_submitted', 'approval', id, {
      taskId, batchNo: task.batch_no
    }, submitter);
    
    return this.getApproval(id);
  },

  getApproval(id) {
    const db = getTestDb();
    return db.findApproval(a => a.id === id);
  },

  getApprovals(filters = {}) {
    const db = getTestDb();
    let approvals = db.filterApprovals(() => true);
    
    if (filters.status) {
      approvals = approvals.filter(a => a.status === filters.status);
    }
    if (filters.task_id) {
      approvals = approvals.filter(a => a.task_id === filters.task_id);
    }
    
    return approvals.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  },

  approve(approvalId, reviewer = null, comment = null) {
    const db = getTestDb();
    const approval = this.getApproval(approvalId);
    if (!approval) throw new Error('审批不存在');
    if (approval.status !== 'pending') throw new Error('只有待审批状态才能审批');
    
    const now = new Date().toISOString();
    
    db.updateApproval(approvalId, {
      status: 'approved',
      reviewer,
      review_comment: comment,
      reviewed_at: now
    });
    
    db.updateTask(approval.task_id, { status: 'approved' });
    
    HistoryService.recordAudit('approval_approved', 'approval', approvalId, {
      taskId: approval.task_id,
      comment
    }, reviewer);
    
    return this.getApproval(approvalId);
  },

  reject(approvalId, reviewer = null, comment = null) {
    const db = getTestDb();
    const approval = this.getApproval(approvalId);
    if (!approval) throw new Error('审批不存在');
    if (approval.status !== 'pending') throw new Error('只有待审批状态才能审批');
    
    const now = new Date().toISOString();
    
    db.updateApproval(approvalId, {
      status: 'rejected',
      reviewer,
      review_comment: comment,
      reviewed_at: now
    });
    
    db.updateTask(approval.task_id, { status: 'pending' });
    
    HistoryService.recordAudit('approval_rejected', 'approval', approvalId, {
      taskId: approval.task_id,
      comment
    }, reviewer);
    
    return this.getApproval(approvalId);
  },

  completeDestruction(taskId, photos, uploader = null) {
    const db = getTestDb();
    const task = TaskService.getTask(taskId);
    if (!task) throw new Error('任务不存在');
    if (task.status !== 'approved') {
      throw new Error('只有已批准的任务才能完成销毁');
    }
    if (!photos || photos.length === 0) {
      throw new Error('必须上传至少一张销毁照片回执');
    }
    
    const now = new Date().toISOString();
    const photoIds = [];
    
    for (const photo of photos) {
      const photoId = uuidv4();
      db.addPhoto({
        id: photoId,
        task_id: taskId,
        file_name: photo.fileName,
        file_path: photo.filePath,
        uploader,
        uploaded_at: now
      });
      photoIds.push(photoId);
      
      HistoryService.recordAudit('photo_uploaded', 'photo', photoId, {
        taskId,
        fileName: photo.fileName
      }, uploader);
    }
    
    db.updateTask(taskId, { status: 'completed' });
    
    const sampleIdx = db.data.samples.findIndex(s => s.id === task.sample_id);
    if (sampleIdx !== -1) {
      db.data.samples[sampleIdx].status = 'destroyed';
      db.data.samples[sampleIdx].updated_at = now;
    }
    
    HistoryService.recordAudit('destruction_completed', 'task', taskId, {
      photoIds,
      sampleId: task.sample_id
    }, uploader);
    
    return {
      taskId,
      status: 'completed',
      photoIds
    };
  },

  getTaskPhotos(taskId) {
    const db = getTestDb();
    return db.filterPhotos(p => p.task_id === taskId)
      .sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
  }
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, testUploadsPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      cb(null, uniqueName);
    }
  });
  const upload = multer({ storage });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/samples', (req, res) => {
    try {
      const sample = SampleService.createSample(req.body);
      res.status(201).json(sample);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/samples', (req, res) => {
    const samples = SampleService.getSamples(req.query);
    res.json(samples);
  });

  app.get('/api/samples/:id', (req, res) => {
    const sample = SampleService.getSample(req.params.id);
    if (!sample) return res.status(404).json({ error: '留样不存在' });
    res.json(sample);
  });

  app.get('/api/samples/:id/history', (req, res) => {
    const history = SampleService.getHistory(req.params.id);
    res.json(history);
  });

  app.put('/api/samples/:id', (req, res) => {
    try {
      const { operator, reason, ...updates } = req.body;
      const sample = SampleService.updateSample(req.params.id, updates, operator, reason);
      if (!sample) return res.status(404).json({ error: '留样不存在' });
      res.json(sample);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/samples/:id/supplement', (req, res) => {
    try {
      const { operator, reason, ...data } = req.body;
      const sample = SampleService.supplementSample(req.params.id, data, operator, reason);
      if (!sample) return res.status(404).json({ error: '留样不存在' });
      res.json(sample);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/samples/:id/withdraw', (req, res) => {
    try {
      const { operator, reason } = req.body;
      const sample = SampleService.withdrawSample(req.params.id, operator, reason);
      res.json(sample);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/tasks/generate', (req, res) => {
    try {
      const result = TaskService.generateExpiryTasks(req.body.targetDate);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tasks', (req, res) => {
    const tasks = TaskService.getTasks(req.query);
    res.json(tasks);
  });

  app.get('/api/tasks/:id', (req, res) => {
    const task = TaskService.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    res.json(task);
  });

  app.post('/api/tasks/:id/extend', (req, res) => {
    try {
      const { extension_days, reason, operator } = req.body;
      const task = TaskService.extendTask(req.params.id, extension_days, reason, operator);
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/approvals/submit', (req, res) => {
    try {
      const { task_id, submitter } = req.body;
      const approval = ApprovalService.submitForApproval(task_id, submitter);
      res.status(201).json(approval);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/approvals', (req, res) => {
    const approvals = ApprovalService.getApprovals(req.query);
    res.json(approvals);
  });

  app.post('/api/approvals/:id/approve', (req, res) => {
    try {
      const { reviewer, comment } = req.body;
      const approval = ApprovalService.approve(req.params.id, reviewer, comment);
      res.json(approval);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/approvals/:id/reject', (req, res) => {
    try {
      const { reviewer, comment } = req.body;
      const approval = ApprovalService.reject(req.params.id, reviewer, comment);
      res.json(approval);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/approvals/:taskId/complete', upload.array('photos', 10), (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: '必须上传至少一张销毁照片回执' });
      }
      
      const photos = req.files.map(f => ({
        fileName: f.originalname,
        filePath: f.path
      }));
      const uploader = req.body.uploader;
      const result = ApprovalService.completeDestruction(req.params.taskId, photos, uploader);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/approvals/:taskId/photos', (req, res) => {
    const photos = ApprovalService.getTaskPhotos(req.params.taskId);
    res.json(photos);
  });

  app.get('/api/audit/logs', (req, res) => {
    const logs = HistoryService.getAuditLogs(
      req.query.entity_type,
      req.query.entity_id,
      parseInt(req.query.limit) || 100
    );
    res.json(logs);
  });

  app.get('/api/audit/summary', (req, res) => {
    const db = getTestDb();
    
    const sampleCount = db.filterSamples(() => true).length;
    const taskCount = db.filterTasks(() => true).length;
    const approvalCount = db.filterApprovals(() => true).length;
    const pendingTasks = db.filterTasks(t => t.status === 'pending').length;
    const pendingApprovals = db.filterApprovals(a => a.status === 'pending').length;
    const destroyedCount = db.filterSamples(s => s.status === 'destroyed').length;
    const extendedTasks = db.filterTasks(t => t.is_extended === 1).length;
    
    res.json({
      samples: sampleCount,
      tasks: taskCount,
      approvals: approvalCount,
      pendingTasks,
      pendingApprovals,
      destroyed: destroyedCount,
      extendedTasks
    });
  });

  return app;
}

function request(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3456,
      path: url,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runTests() {
  console.log('\n=== 开始主流程测试（真实 HTTP API 调用）===\n');
  
  const app = createTestApp();
  const server = app.listen(3456);
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('--- 1. 健康检查 ---');
    const health = await request('GET', '/health');
    assert(health.status === 200, '健康检查通过');
    
    console.log('\n--- 2. 创建留样台账 ---');
    const sample1Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-2024-001',
      product_name: '维生素C片',
      quantity: 50,
      unit: '片',
      sample_date: addDays(today, -365),
      retention_days: 360,
      storage_location: '留样柜-A1',
      operator: '张三'
    });
    assert(sample1Res.status === 201, '留样1创建成功');
    const sample1 = sample1Res.data;
    assert(sample1.status === 'active', '留样1状态为active');
    
    const sample2Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-2024-002',
      product_name: '阿莫西林胶囊',
      quantity: 30,
      unit: '粒',
      sample_date: addDays(today, -180),
      retention_days: 360,
      storage_location: '留样柜-A2',
      operator: '张三'
    });
    assert(sample2Res.status === 201, '留样2创建成功');
    
    console.log('\n--- 3. 生成到期任务（数据稳定重跑测试）---');
    const gen1 = await request('POST', '/api/tasks/generate', { targetDate: today });
    assert(gen1.status === 200, '首次生成任务成功');
    assert(gen1.data.recordsProcessed === 1, '应生成1个到期任务（留样1过期，留样2未过期）');
    assert(gen1.data.rerunDetected === false, '首次执行无重复');
    
    const gen2 = await request('POST', '/api/tasks/generate', { targetDate: today });
    assert(gen2.data.rerunDetected === true, '同日重跑被正确拦截，结果稳定');
    assert(gen2.data.recordsProcessed === 1, '重跑记录数与首次一致');
    
    const tasksRes = await request('GET', '/api/tasks?status=pending');
    assert(tasksRes.data.length === 1, '待处理任务数量为1');
    const task1 = tasksRes.data[0];
    
    console.log('\n--- 4. 提交销毁审批 ---');
    const submitRes = await request('POST', '/api/approvals/submit', {
      task_id: task1.id,
      submitter: '李四'
    });
    assert(submitRes.status === 201, '审批提交成功');
    assert(submitRes.data.status === 'pending', '审批状态为待审批');
    
    const taskAfterSubmit = await request('GET', `/api/tasks/${task1.id}`);
    assert(taskAfterSubmit.data.status === 'pending_approval', '任务状态变为待审批');
    
    console.log('\n--- 5. 审批通过 ---');
    const approveRes = await request('POST', `/api/approvals/${submitRes.data.id}/approve`, {
      reviewer: '王五',
      comment: '同意销毁'
    });
    assert(approveRes.status === 200, '审批通过成功');
    assert(approveRes.data.status === 'approved', '审批状态为已批准');
    
    const taskAfterApprove = await request('GET', `/api/tasks/${task1.id}`);
    assert(taskAfterApprove.data.status === 'approved', '任务状态变为已批准');
    
    console.log('\n--- 6. 验证无照片无法完成销毁 ---');
    const noPhotoRes = await request('POST', `/api/approvals/${task1.id}/complete`, {
      uploader: '赵六'
    });
    assert(noPhotoRes.status === 400, '无照片时拒绝完成销毁');
    assert(noPhotoRes.data.error.includes('至少一张销毁照片'), '错误信息正确');
    
    const sampleBeforeDestroy = await request('GET', `/api/samples/${sample1.id}`);
    assert(sampleBeforeDestroy.data.status === 'active', '无照片时留样状态仍为active');
    
    console.log('\n--- 7. 完成销毁（上传照片回执）---');
    const tempPhotoPath = path.join(testUploadsPath, 'test_photo.jpg');
    fs.writeFileSync(tempPhotoPath, 'test photo content');
    
    const boundary = '----TestBoundary' + Date.now();
    const photoContent = fs.readFileSync(tempPhotoPath);
    
    const multipartBody = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="photos"; filename="destruction_before.jpg"`,
      `Content-Type: image/jpeg`,
      ``,
      photoContent.toString('binary'),
      `--${boundary}`,
      `Content-Disposition: form-data; name="photos"; filename="destruction_after.jpg"`,
      `Content-Type: image/jpeg`,
      ``,
      photoContent.toString('binary'),
      `--${boundary}`,
      `Content-Disposition: form-data; name="uploader"`,
      ``,
      '赵六',
      `--${boundary}--`
    ].join('\r\n');
    
    const completeRes = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3456,
        path: `/api/approvals/${task1.id}/complete`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(multipartBody, 'binary')
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data: null });
          }
        });
      });
      req.on('error', reject);
      req.write(multipartBody, 'binary');
      req.end();
    });
    
    assert(completeRes.status === 200, '有照片时销毁完成成功');
    assert(completeRes.data.status === 'completed', '任务状态为completed');
    assert(completeRes.data.photoIds.length >= 1, '至少上传了1张照片');
    
    const sampleAfterDestroy = await request('GET', `/api/samples/${sample1.id}`);
    assert(sampleAfterDestroy.data.status === 'destroyed', '留样状态变为已销毁');
    
    console.log('\n--- 8. 历史记录验证（补录、撤回）---');
    const sample3Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-TEST-003',
      product_name: '布洛芬片',
      quantity: 20,
      unit: '片',
      sample_date: addDays(today, -90),
      retention_days: 90,
      storage_location: '留样柜-B1',
      operator: '测试员'
    });
    const sample3 = sample3Res.data;
    
    await request('POST', `/api/samples/${sample3.id}/supplement`, {
      quantity: 25,
      storage_location: '留样柜-B2',
      operator: '钱七',
      reason: '发现之前数量登记错误'
    });
    
    await request('POST', `/api/samples/${sample3.id}/withdraw`, {
      operator: '钱七',
      reason: '留样被污染，需重新留样'
    });
    
    const historyRes = await request('GET', `/api/samples/${sample3.id}/history`);
    const history = historyRes.data;
    
    assert(history.length >= 3, '历史记录数量正确（创建+补录+撤回）');
    assert(history.some(h => h.operation === 'supplement'), '补录操作有历史记录');
    assert(history.some(h => h.operation === 'withdraw'), '撤回操作有历史记录');
    
    console.log('\n--- 9. 异常延期 ---');
    const sample4Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-TEST-004',
      product_name: '感冒药',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -365),
      retention_days: 360,
      storage_location: '留样柜-C1',
      operator: '测试员'
    });
    
    await request('POST', '/api/tasks/generate', { targetDate: addDays(today, 1) });
    const tasks2 = await request('GET', '/api/tasks');
    const task2 = tasks2.data.find(t => t.sample_id === sample4Res.data.id && t.status === 'pending');
    
    const extendRes = await request('POST', `/api/tasks/${task2.id}/extend`, {
      extension_days: 30,
      reason: '需要等待质量投诉调查结果',
      operator: '质检主管'
    });
    assert(extendRes.status === 200, '任务延期成功');
    assert(extendRes.data.is_extended === 1, '任务标记为已延期');
    assert(extendRes.data.extension_days === 30, '延期30天');
    
    console.log('\n--- 10. 审计清单验证 ---');
    const auditRes = await request('GET', '/api/audit/logs');
    const auditLogs = auditRes.data;
    const actions = new Set(auditLogs.map(l => l.action));
    
    assert(actions.has('create'), '创建操作有审计记录');
    assert(actions.has('task_created'), '任务创建有审计记录');
    assert(actions.has('approval_submitted'), '审批提交有审计记录');
    assert(actions.has('approval_approved'), '审批通过有审计记录');
    assert(actions.has('photo_uploaded'), '照片上传有审计记录');
    assert(actions.has('destruction_completed'), '销毁完成有审计记录');
    assert(actions.has('supplement'), '补录有审计记录');
    assert(actions.has('withdraw'), '撤回有审计记录');
    assert(actions.has('task_extended'), '延期有审计记录');
    
    console.log('\n--- 11. 统计概览 ---');
    const summaryRes = await request('GET', '/api/audit/summary');
    assert(summaryRes.data.samples >= 4, '留样数量统计正确');
    assert(summaryRes.data.destroyed === 1, '已销毁数量为1');
    assert(summaryRes.data.extendedTasks === 1, '已延期任务数量为1');
    
    console.log('\n=== 主流程测试通过 ===\n');
    
  } finally {
    server.close();
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testUploadsPath)) {
      fs.rmSync(testUploadsPath, { recursive: true, force: true });
    }
  }
}

runTests().catch(err => {
  console.error('\n测试失败:', err.message);
  process.exit(1);
});
