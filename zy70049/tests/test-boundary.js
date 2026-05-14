const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const multer = require('multer');

const testDbPath = path.join(__dirname, '../data/test_boundary.json');
const testUploadsPath = path.join(__dirname, '../test_uploads_boundary');

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
fs.mkdirSync(testUploadsPath, { recursive: true });

const { v4: uuidv4 } = require('uuid');

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
    
    db.updateSample(id, { status: 'withdrawn', updated_at: new Date().toISOString() });
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

function request(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3457,
      path: url,
      method: method,
      headers: {
        'Content-Type': 'application/json'
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
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: null });
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

function assertThrows(fn, expectedError, message) {
  try {
    fn();
    throw new Error(`Expected error: ${expectedError}`);
  } catch (err) {
    assert(err.message.includes(expectedError), message);
  }
}

async function runTests() {
  console.log('\n=== 开始边界条件测试（真实 HTTP API 调用）===\n');
  
  const app = createTestApp();
  const server = app.listen(3457);
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('--- 边界1：撤回后的留样不生成到期任务 ---');
    const withdrawnRes = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-001',
      product_name: '边界测试药品1',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -365),
      retention_days: 180,
      storage_location: '测试柜',
      operator: '测试员'
    });
    const withdrawnSample = withdrawnRes.data;
    
    await request('POST', `/api/samples/${withdrawnSample.id}/withdraw`, {
      operator: '测试员',
      reason: '测试撤回'
    });
    
    const beforeTasks = await request('GET', '/api/tasks');
    assert(beforeTasks.data.length === 0, '撤回前暂无任务');
    
    await request('POST', '/api/tasks/generate', { targetDate: today });
    const afterWithdrawn = await request('GET', '/api/tasks');
    assert(afterWithdrawn.data.length === 0, '已撤回的留样不生成到期任务');
    
    console.log('\n--- 边界2：审批驳回后可重新提交 ---');
    const day2 = addDays(today, 2);
    const s2Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-002',
      product_name: '边界测试药品2',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -365),
      retention_days: 180,
      storage_location: '测试柜',
      operator: '测试员'
    });
    
    await request('POST', '/api/tasks/generate', { targetDate: day2 });
    const tasks2 = await request('GET', '/api/tasks');
    const task2 = tasks2.data.find(t => t.sample_id === s2Res.data.id);
    
    const a1 = await request('POST', '/api/approvals/submit', {
      task_id: task2.id,
      submitter: '提交人'
    });
    assert(a1.data.status === 'pending', '首次提交审批成功');
    
    await request('POST', `/api/approvals/${a1.data.id}/reject`, {
      reviewer: '审批人',
      comment: '资料不全，请补充'
    });
    
    const a2 = await request('POST', '/api/approvals/submit', {
      task_id: task2.id,
      submitter: '提交人'
    });
    assert(a2.data.status === 'pending', '驳回后可重新提交审批');
    
    console.log('\n--- 边界3：未批准的任务无法完成销毁 ---');
    const s3Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-003',
      product_name: '边界测试药品3',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -365),
      retention_days: 180,
      storage_location: '测试柜',
      operator: '测试员'
    });
    
    await request('POST', '/api/tasks/generate', { targetDate: addDays(today, 3) });
    const tasks3 = await request('GET', '/api/tasks');
    const task3 = tasks3.data.find(t => t.sample_id === s3Res.data.id);
    
    const tempPhoto = path.join(testUploadsPath, 'temp.jpg');
    fs.writeFileSync(tempPhoto, 'test');
    const boundary = '----Boundary' + Date.now();
    const photoBuf = fs.readFileSync(tempPhoto);
    
    const multipartBody = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="photos"; filename="test.jpg"`,
      `Content-Type: image/jpeg`,
      ``,
      photoBuf.toString('binary'),
      `--${boundary}--`
    ].join('\r\n');
    
    const noApproveComplete = await new Promise((resolve) => {
      const options = {
        hostname: 'localhost', port: 3457,
        path: `/api/approvals/${task3.id}/complete`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(multipartBody, 'binary')
        }
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      });
      req.write(multipartBody, 'binary');
      req.end();
    });
    
    assert(noApproveComplete.status === 400, '未批准任务无法完成销毁');
    assert(noApproveComplete.data.error.includes('只有已批准的任务'), '错误信息正确');
    
    console.log('\n--- 边界4：任务过期后重新生成（延期后）---');
    const s4Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-004',
      product_name: '边界测试药品4',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -365),
      retention_days: 90,
      storage_location: '测试柜',
      operator: '测试员'
    });
    
    const day4a = addDays(today, 5);
    const g1 = await request('POST', '/api/tasks/generate', { targetDate: day4a });
    assert(g1.data.recordsProcessed === 1, '第一次生成任务');
    
    const tasks4 = await request('GET', '/api/tasks');
    const task4 = tasks4.data.find(t => t.sample_id === s4Res.data.id);
    const oldExpiry = task4.expiry_date;
    
    await request('POST', `/api/tasks/${task4.id}/extend`, {
      extension_days: 30,
      reason: '测试延期',
      operator: '测试员'
    });
    
    const day4b = addDays(oldExpiry, 30);
    const g2 = await request('POST', '/api/tasks/generate', { targetDate: day4b });
    assert(g2.data.rerunDetected === false, '新的日期是全新执行，不是重复');
    
    console.log('\n--- 边界5：数据稳定性 - 多次重复执行同一天任务 ---');
    const s5Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-005',
      product_name: '边界测试药品5',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -500),
      retention_days: 90,
      storage_location: '测试柜',
      operator: '测试员'
    });
    
    const day5 = addDays(today, 6);
    const countBefore = (await request('GET', '/api/tasks')).data.length;
    
    await request('POST', '/api/tasks/generate', { targetDate: day5 });
    const countAfter1 = (await request('GET', '/api/tasks')).data.length;
    assert(countAfter1 === countBefore + 1, '首次执行新增一个任务');
    
    await request('POST', '/api/tasks/generate', { targetDate: day5 });
    const countAfter2 = (await request('GET', '/api/tasks')).data.length;
    assert(countAfter2 === countAfter1, '重复执行同一天任务，任务数量不变');
    
    await request('POST', '/api/tasks/generate', { targetDate: day5 });
    const countAfter3 = (await request('GET', '/api/tasks')).data.length;
    assert(countAfter3 === countAfter1, '第三次重复执行，结果仍然稳定');
    
    console.log('\n--- 边界6：状态机验证 ---');
    const s6Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-006',
      product_name: '边界测试药品6',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -400),
      retention_days: 90,
      storage_location: '测试柜',
      operator: '测试员'
    });
    
    const day6 = addDays(today, 7);
    await request('POST', '/api/tasks/generate', { targetDate: day6 });
    const tasks6 = await request('GET', '/api/tasks');
    const task6 = tasks6.data.find(t => t.sample_id === s6Res.data.id);
    
    assert(task6.status === 'pending', '新任务状态为pending');
    
    const a6 = await request('POST', '/api/approvals/submit', {
      task_id: task6.id,
      submitter: '提交人'
    });
    const taskAfterSubmit = await request('GET', `/api/tasks/${task6.id}`);
    assert(taskAfterSubmit.data.status === 'pending_approval', '提交后状态为pending_approval');
    
    await request('POST', `/api/approvals/${a6.data.id}/approve`, {
      reviewer: '审批人',
      comment: '同意'
    });
    const taskAfterApprove = await request('GET', `/api/tasks/${task6.id}`);
    assert(taskAfterApprove.data.status === 'approved', '批准后状态为approved');
    
    console.log('\n--- 边界7：撤销历史可追溯 ---');
    const s7Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-007',
      product_name: '边界测试药品7',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -30),
      retention_days: 30,
      storage_location: '柜A',
      operator: '测试员1'
    });
    
    await request('POST', `/api/samples/${s7Res.data.id}/supplement`, {
      quantity: 15,
      operator: '测试员2',
      reason: '调整数量'
    });
    
    await request('POST', `/api/samples/${s7Res.data.id}/supplement`, {
      storage_location: '柜B',
      operator: '测试员2',
      reason: '补录位置'
    });
    
    await request('POST', `/api/samples/${s7Res.data.id}/withdraw`, {
      operator: '测试员3',
      reason: '质量问题'
    });
    
    const history7 = await request('GET', `/api/samples/${s7Res.data.id}/history`);
    
    assert(history7.data.length >= 4, '历史记录条数正确（创建+更新+补录+撤回）');
    
    const operations = new Set(history7.data.map(h => h.operation));
    assert(operations.has('create'), '历史包含创建操作');
    assert(operations.has('supplement'), '历史包含补录操作');
    assert(operations.has('withdraw'), '历史包含撤回操作');
    
    const withdrawRecord = history7.data.find(h => h.operation === 'withdraw');
    assert(withdrawRecord.new_data.status === 'withdrawn', '撤回后状态是withdrawn');
    
    console.log('\n--- 边界8：任务执行失败后的处理 ---');
    const db = getTestDb();
    db.addJobRun({
      id: uuidv4(),
      job_name: 'generate_expiry_tasks',
      run_date: addDays(today, -5),
      status: 'failed',
      error_message: '数据库连接超时',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString()
    });
    
    const auditLogs = await request('GET', '/api/audit/logs');
    assert(auditLogs.data.length > 0, '审计日志存在');
    
    const resultAfterFail = await request('POST', '/api/tasks/generate', {
      targetDate: addDays(today, -5)
    });
    assert(resultAfterFail.data.rerunDetected === false, '失败的任务可以重新执行，不会被幂等性拦截');
    
    console.log('\n--- 边界9：重复提交审批的防御 ---');
    const s9Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-009',
      product_name: '边界测试药品9',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -365),
      retention_days: 180,
      storage_location: '测试柜',
      operator: '测试员'
    });
    
    await request('POST', '/api/tasks/generate', { targetDate: addDays(today, 10) });
    const tasks9 = await request('GET', '/api/tasks');
    const task9 = tasks9.data.find(t => t.sample_id === s9Res.data.id);
    
    await request('POST', '/api/approvals/submit', {
      task_id: task9.id,
      submitter: '提交人A'
    });
    
    const dupSubmit = await request('POST', '/api/approvals/submit', {
      task_id: task9.id,
      submitter: '提交人B'
    });
    assert(dupSubmit.status === 400, '同一任务不能重复提交审批');
    assert(dupSubmit.data.error.includes('该任务已提交审批'), '错误信息正确');
    
    console.log('\n--- 边界10：空照片数组的防御（Service层）---');
    const s10Res = await request('POST', '/api/samples', {
      batch_no: 'BATCH-BOUNDARY-010',
      product_name: '边界测试药品10',
      quantity: 10,
      unit: '盒',
      sample_date: addDays(today, -365),
      retention_days: 180,
      storage_location: '测试柜',
      operator: '测试员'
    });
    
    await request('POST', '/api/tasks/generate', { targetDate: addDays(today, 11) });
    const tasks10 = await request('GET', '/api/tasks');
    const task10 = tasks10.data.find(t => t.sample_id === s10Res.data.id);
    
    const a10 = await request('POST', '/api/approvals/submit', {
      task_id: task10.id,
      submitter: '测试员'
    });
    await request('POST', `/api/approvals/${a10.data.id}/approve`, {
      reviewer: '审批人',
      comment: '同意'
    });
    
    const emptyPhotoComplete = await request('POST', `/api/approvals/${task10.id}/complete`, {
      uploader: '测试员'
    });
    
    assert(emptyPhotoComplete.status === 400, '空照片时拒绝完成销毁');
    assert(emptyPhotoComplete.data.error.includes('至少一张销毁照片'), '错误信息明确要求照片');
    
    const sampleBefore = await request('GET', `/api/samples/${s10Res.data.id}`);
    assert(sampleBefore.data.status === 'active', '无照片时留样状态仍为active，未被错误销毁');
    
    console.log('\n=== 边界条件测试通过 ===\n');
    
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
