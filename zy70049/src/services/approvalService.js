const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../models/database');
const TaskService = require('./taskService');
const HistoryService = require('./historyService');

class ApprovalService {
  static submitForApproval(taskId, submitter = null) {
    const db = getDatabase();
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
  }

  static getApproval(id) {
    const db = getDatabase();
    return db.findApproval(a => a.id === id);
  }

  static getApprovals(filters = {}) {
    const db = getDatabase();
    let approvals = db.filterApprovals(() => true);
    
    if (filters.status) {
      approvals = approvals.filter(a => a.status === filters.status);
    }
    if (filters.task_id) {
      approvals = approvals.filter(a => a.task_id === filters.task_id);
    }
    
    return approvals.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  }

  static approve(approvalId, reviewer = null, comment = null) {
    const db = getDatabase();
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
  }

  static reject(approvalId, reviewer = null, comment = null) {
    const db = getDatabase();
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
  }

  static completeDestruction(taskId, photos, uploader = null) {
    const db = getDatabase();
    const task = TaskService.getTask(taskId);
    if (!task) throw new Error('任务不存在');
    if (task.status !== 'approved') {
      throw new Error('只有已批准的任务才能完成销毁');
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
      db.save();
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
  }

  static getTaskPhotos(taskId) {
    const db = getDatabase();
    return db.filterPhotos(p => p.task_id === taskId)
      .sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
  }
}

module.exports = ApprovalService;
