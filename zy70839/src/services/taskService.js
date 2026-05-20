const { TaskDAO, MaterialDAO, AuditLogDAO, ExportDAO } = require('../daos');
const { generateBatchHash, TASK_STATUS } = require('../utils');

class TaskService {
  static async submitMaterials(submitter, materials) {
    const batchHash = generateBatchHash(materials);
    
    const existingTask = await TaskDAO.findByBatchHash(batchHash);
    if (existingTask) {
      const existingMaterials = await MaterialDAO.findByTaskId(existingTask.id);
      return {
        isDuplicate: true,
        task: existingTask,
        materials: existingMaterials,
        message: '检测到重复提交，返回原有处理结果'
      };
    }

    const task = await TaskDAO.create({
      batchHash,
      submitter
    });

    await MaterialDAO.batchCreate(materials, task.id);

    await AuditLogDAO.create({
      taskId: task.id,
      operator: submitter,
      changeReason: '提交材料',
      oldStatus: null,
      newStatus: TASK_STATUS.PROCESSING,
      oldData: null,
      newData: JSON.stringify(materials)
    });

    const savedMaterials = await MaterialDAO.findByTaskId(task.id);

    return {
      isDuplicate: false,
      task,
      materials: savedMaterials
    };
  }

  static async updateTaskStatus(taskId, newStatus, operator, changeReason) {
    const task = await TaskDAO.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const oldStatus = task.status;
    const materials = await MaterialDAO.findByTaskId(taskId);

    await AuditLogDAO.create({
      taskId,
      operator,
      changeReason,
      oldStatus,
      newStatus,
      oldData: JSON.stringify({ status: oldStatus }),
      newData: JSON.stringify({ status: newStatus })
    });

    await TaskDAO.updateStatus(taskId, newStatus, operator);

    return {
      taskId,
      oldStatus,
      newStatus,
      operator,
      changeReason
    };
  }

  static async getTaskDetail(taskId) {
    const task = await TaskDAO.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const materials = await MaterialDAO.findByTaskId(taskId);
    const auditLogs = await AuditLogDAO.findByTaskId(taskId);

    return {
      task,
      materials,
      auditLogs
    };
  }

  static async getTaskList(filters = {}) {
    return TaskDAO.findAll(filters);
  }

  static async getStatistics() {
    return TaskDAO.getStatistics();
  }

  static async getAuditLogs(taskId) {
    return AuditLogDAO.findByTaskId(taskId);
  }
}

module.exports = TaskService;