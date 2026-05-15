const { ExportTaskDAO, TaskStatusHistoryDAO, EvidenceRecordDAO, OperationEventDAO, DownloadPermissionDAO } = require('../database/dao');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const EXPORT_DIR = path.join(__dirname, '../../exports');
const EXPORT_EXPIRE_HOURS = 24;

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

class ExportService {
  static validateFilter(filter) {
    const errors = [];
    
    if (!filter.operator_ids || filter.operator_ids.length === 0) {
      errors.push('必须选择操作人员');
    }
    if (!filter.start_time || !filter.end_time) {
      errors.push('必须指定时间范围');
    }
    if (filter.start_time && filter.end_time) {
      if (new Date(filter.end_time) < new Date(filter.start_time)) {
        errors.push('结束时间不能早于开始时间');
      }
    }
    
    return errors;
  }

  static async createTask(taskData, operator) {
    const filterErrors = this.validateFilter(taskData.filter_snapshot);
    if (filterErrors.length > 0) {
      throw new Error(filterErrors.join('; '));
    }

    const duplicate = await ExportTaskDAO.checkDuplicate(operator.id, taskData.filter_snapshot);
    if (duplicate) {
      throw new Error('存在相同筛选条件的待处理任务，请等待完成后重试');
    }

    const expireAt = moment().add(EXPORT_EXPIRE_HOURS, 'hours').toISOString();
    const task = await ExportTaskDAO.create({
      task_name: taskData.task_name || `导出任务_${moment().format('YYYYMMDD_HHmmss')}`,
      creator_id: operator.id,
      creator_name: operator.name,
      filter_snapshot: taskData.filter_snapshot,
      expire_at: expireAt
    });

    await TaskStatusHistoryDAO.create({
      task_id: task.id,
      from_status: null,
      to_status: 'pending',
      operator_id: operator.id,
      operator_name: operator.name,
      reason: '创建导出任务'
    });

    await EvidenceRecordDAO.create({
      task_id: task.id,
      action_type: 'create',
      operator_id: operator.id,
      operator_name: operator.name,
      details: {
        task_name: task.task_name,
        filter_snapshot: taskData.filter_snapshot
      }
    });

    setImmediate(() => this.processExport(task.id, operator));

    return task;
  }

  static async processExport(taskId, operator) {
    try {
      const task = await ExportTaskDAO.getById(taskId);
      if (!task) return;

      await ExportTaskDAO.updateStatus(taskId, 'processing');
      await TaskStatusHistoryDAO.create({
        task_id: taskId,
        from_status: 'pending',
        to_status: 'processing',
        operator_id: operator.id,
        operator_name: operator.name,
        reason: '开始处理导出'
      });

      const filter = task.filter_snapshot;
      const totalCount = await OperationEventDAO.count(filter);
      
      if (totalCount === 0) {
        throw new Error('筛选条件下没有匹配的数据');
      }

      const events = await OperationEventDAO.query(filter, totalCount, 0);
      const csvData = events.map(event => ({
        事件ID: event.id,
        事件类型: event.event_type,
        操作模块: event.module,
        操作人ID: event.operator_id,
        操作人姓名: event.operator_name,
        IP地址: event.ip_address,
        操作详情: event.details,
        状态: event.status,
        操作时间: event.created_at
      }));

      const parser = new Parser();
      const csv = parser.parse(csvData);

      const fileName = `audit_export_${taskId}_${moment().format('YYYYMMDD_HHmmss')}.csv`;
      const filePath = path.join(EXPORT_DIR, fileName);
      fs.writeFileSync(filePath, csv, 'utf8');

      const stats = fs.statSync(filePath);

      await ExportTaskDAO.updateFileInfo(taskId, filePath, fileName, stats.size, events.length, totalCount);
      await ExportTaskDAO.updateStatus(taskId, 'completed');

      await TaskStatusHistoryDAO.create({
        task_id: taskId,
        from_status: 'processing',
        to_status: 'completed',
        operator_id: operator.id,
        operator_name: operator.name,
        reason: '导出完成'
      });

      await EvidenceRecordDAO.create({
        task_id: taskId,
        action_type: 'complete',
        operator_id: operator.id,
        operator_name: operator.name,
        details: {
          file_name: fileName,
          file_size: stats.size,
          total_count: totalCount,
          exported_count: events.length
        }
      });

    } catch (error) {
      await ExportTaskDAO.updateStatus(taskId, 'failed', error.message);
      await TaskStatusHistoryDAO.create({
        task_id: taskId,
        from_status: 'processing',
        to_status: 'failed',
        operator_id: operator.id,
        operator_name: operator.name,
        reason: `导出失败: ${error.message}`
      });
    }
  }

  static async getTaskList(creatorId = null, limit = 50, offset = 0) {
    if (creatorId) {
      return ExportTaskDAO.getByCreator(creatorId, limit);
    }
    return ExportTaskDAO.getAll(limit, offset);
  }

  static async getTaskDetail(taskId) {
    const task = await ExportTaskDAO.getById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const statusHistory = await TaskStatusHistoryDAO.getByTaskId(taskId);
    const evidenceRecords = await EvidenceRecordDAO.getByTaskId(taskId);

    return {
      task,
      status_history: statusHistory,
      evidence_records: evidenceRecords
    };
  }

  static async retryTask(taskId, operator) {
    const task = await ExportTaskDAO.getById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status !== 'failed') {
      throw new Error('只有失败的任务才能重试');
    }

    if (task.creator_id !== operator.id && operator.role !== 'admin') {
      throw new Error('没有权限重试此任务');
    }

    await ExportTaskDAO.updateStatus(taskId, 'pending');
    await TaskStatusHistoryDAO.create({
      task_id: taskId,
      from_status: 'failed',
      to_status: 'pending',
      operator_id: operator.id,
      operator_name: operator.name,
      reason: '重试导出任务'
    });

    await EvidenceRecordDAO.create({
      task_id: taskId,
      action_type: 'retry',
      operator_id: operator.id,
      operator_name: operator.name,
      details: { previous_error: task.error_message }
    });

    setImmediate(() => this.processExport(taskId, operator));

    return ExportTaskDAO.getById(taskId);
  }

  static async correctAndRetry(taskId, newFilter, operator) {
    const task = await ExportTaskDAO.getById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.creator_id !== operator.id && operator.role !== 'admin') {
      throw new Error('没有权限修改此任务');
    }

    const filterErrors = this.validateFilter(newFilter);
    if (filterErrors.length > 0) {
      throw new Error(filterErrors.join('; '));
    }

    await ExportTaskDAO.updateStatus(taskId, 'pending', null);
    await TaskStatusHistoryDAO.create({
      task_id: taskId,
      from_status: task.status,
      to_status: 'pending',
      operator_id: operator.id,
      operator_name: operator.name,
      reason: '人工修正筛选条件后重试'
    });

    await EvidenceRecordDAO.create({
      task_id: taskId,
      action_type: 'correct',
      operator_id: operator.id,
      operator_name: operator.name,
      details: {
        old_filter: task.filter_snapshot,
        new_filter: newFilter
      }
    });

    const { db } = require('../database/schema');
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE export_tasks SET filter_snapshot = ? WHERE id = ?`,
        [JSON.stringify(newFilter), taskId],
        (err) => err ? reject(err) : resolve()
      );
    });

    setImmediate(() => this.processExport(taskId, operator));

    return ExportTaskDAO.getById(taskId);
  }

  static async downloadTask(taskId, operator) {
    const task = await ExportTaskDAO.getById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status !== 'completed') {
      throw new Error('任务未完成，无法下载');
    }

    if (new Date(task.expire_at) < new Date()) {
      throw new Error('下载链接已过期，请重新导出');
    }

    if (task.creator_id !== operator.id && operator.role !== 'admin') {
      const permission = await DownloadPermissionDAO.checkPermission(taskId, operator.id);
      if (!permission) {
        throw new Error('没有下载权限');
      }
    }

    if (!fs.existsSync(task.file_path)) {
      throw new Error('文件不存在');
    }

    await EvidenceRecordDAO.create({
      task_id: taskId,
      action_type: 'download',
      operator_id: operator.id,
      operator_name: operator.name,
      details: {
        file_name: task.file_name,
        file_size: task.file_size
      }
    });

    return task.file_path;
  }

  static async grantDownloadPermission(taskId, targetUserId, operator) {
    const task = await ExportTaskDAO.getById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.creator_id !== operator.id && operator.role !== 'admin') {
      throw new Error('没有权限授权下载');
    }

    const expiresAt = moment().add(7, 'days').toISOString();
    const permission = await DownloadPermissionDAO.create({
      task_id: taskId,
      user_id: targetUserId,
      granted_by: operator.id,
      expires_at: expiresAt
    });

    await EvidenceRecordDAO.create({
      task_id: taskId,
      action_type: 'grant_permission',
      operator_id: operator.id,
      operator_name: operator.name,
      details: {
        target_user_id: targetUserId,
        expires_at: expiresAt
      }
    });

    return permission;
  }
}

module.exports = ExportService;
