const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../models/database');
const HistoryService = require('./historyService');

class TaskService {
  static generateExpiryTasks(targetDate = null) {
    const db = getDatabase();
    const runDate = targetDate || new Date().toISOString().split('T')[0];
    
    const existingRun = db.findJobRun(
      j => j.job_name === 'generate_expiry_tasks' && j.run_date === runDate && j.status === 'success'
    );
    
    if (existingRun) {
      return {
        message: `今日任务已在 ${existingRun.finished_at} 完成，跳过重复执行`,
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
      
      db.transaction(() => {
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
      });
      
      const finishedAt = new Date().toISOString();
      
      const jobRuns = db.data.jobRuns;
      const idx = jobRuns.findIndex(j => j.id === jobId);
      if (idx !== -1) {
        jobRuns[idx].status = 'success';
        jobRuns[idx].records_processed = processed;
        jobRuns[idx].finished_at = finishedAt;
        db.save();
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
        db.save();
      }
      
      throw error;
    }
  }

  static getTasks(filters = {}) {
    const db = getDatabase();
    let tasks = db.filterTasks(() => true);
    
    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.sample_id) {
      tasks = tasks.filter(t => t.sample_id === filters.sample_id);
    }
    if (filters.batch_no) {
      tasks = tasks.filter(t => t.batch_no.includes(filters.batch_no));
    }
    
    return tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  static getTask(id) {
    const db = getDatabase();
    return db.findTask(t => t.id === id);
  }

  static extendTask(taskId, extensionDays, reason, operator = null) {
    const db = getDatabase();
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
  }

  static getJobRuns(jobName, limit = 20) {
    const db = getDatabase();
    return db.filterJobRuns(j => j.job_name === jobName)
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      .slice(0, limit);
  }
}

module.exports = TaskService;
