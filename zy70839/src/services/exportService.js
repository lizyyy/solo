const { Parser } = require('json2csv');
const { TaskDAO, MaterialDAO, ExportDAO, AuditLogDAO } = require('../daos');
const { TASK_STATUS } = require('../utils');

class ExportService {
  static async exportTask(taskId, exportedBy) {
    const task = await TaskDAO.findById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const oldStatus = task.status;
    const oldLastProcessor = task.last_processor;

    await AuditLogDAO.create({
      taskId,
      operator: exportedBy,
      changeReason: '导出任务数据',
      oldStatus,
      newStatus: TASK_STATUS.EXPORTED,
      oldData: JSON.stringify({ status: oldStatus, last_processor: oldLastProcessor }),
      newData: JSON.stringify({ status: TASK_STATUS.EXPORTED, last_processor: exportedBy })
    });

    await TaskDAO.updateStatus(taskId, TASK_STATUS.EXPORTED, exportedBy);

    const updatedTask = await TaskDAO.findById(taskId);

    const materials = await MaterialDAO.findByTaskId(taskId);

    const exportData = {
      task: {
        id: updatedTask.id,
        submitter: updatedTask.submitter,
        status: updatedTask.status,
        created_at: updatedTask.created_at,
        last_processor: updatedTask.last_processor
      },
      materials: materials.map(m => ({
        key_number: m.key_number,
        key_status: m.key_status,
        fuel_card_number: m.fuel_card_number,
        fuel_card_balance: m.fuel_card_balance,
        violation_records: m.violation_records,
        manual_registration: m.manual_registration
      })),
      exportedBy,
      exportedAt: new Date().toISOString()
    };

    await ExportDAO.create({
      taskId,
      exportedBy,
      exportData
    });

    return exportData;
  }

  static async exportToCSV(taskId, exportedBy) {
    const exportData = await this.exportTask(taskId, exportedBy);

    const csvData = exportData.materials.map(m => ({
      任务ID: exportData.task.id,
      提交人: exportData.task.submitter,
      任务状态: exportData.task.status,
      创建时间: exportData.task.created_at,
      最后处理人: exportData.task.last_processor,
      试驾车钥匙编号: m.key_number,
      试驾车钥匙状态: m.key_status,
      油卡编号: m.fuel_card_number,
      油卡余额: m.fuel_card_balance,
      违章记录手工登记: m.violation_records,
      备注: m.manual_registration,
      导出人: exportData.exportedBy,
      导出时间: exportData.exportedAt
    }));

    const parser = new Parser();
    const csv = parser.parse(csvData);

    return {
      csv,
      exportData
    };
  }

  static async getExportHistory(taskId) {
    return ExportDAO.findByTaskId(taskId);
  }
}

module.exports = ExportService;