const ExcelJS = require('exceljs');
const { RevisitResult, ReturnVisitSurvey, RemedyTask, OperationLog, LowScoreReason, Department } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

class ExportService {
  static async exportRevisitResults(params = {}) {
    const { handledBy, startDate, endDate } = params;
    const where = {};

    if (handledBy) where.handledBy = handledBy;
    if (startDate && endDate) {
      where.revisitTime = { [Op.between]: [startDate, endDate] };
    }

    const results = await RevisitResult.findAll({
      where,
      include: [
        { 
          association: 'survey', 
          include: ['lowScoreReason', 'department'] 
        }, 
        'task'
      ],
      order: [['createdAt', 'DESC']]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('复访结果记录');

    worksheet.columns = [
      { header: '复访时间', key: 'revisitTime', width: 20 },
      { header: '客户名称', key: 'customerName', width: 15 },
      { header: '联系电话', key: 'phone', width: 15 },
      { header: '原始评分', key: 'originalScore', width: 12 },
      { header: '新评分', key: 'newScore', width: 12 },
      { header: '低分原因', key: 'lowScoreReason', width: 20 },
      { header: '责任部门', key: 'department', width: 15 },
      { header: '复访结果', key: 'revisitResult', width: 15 },
      { header: '客户反馈', key: 'customerFeedback', width: 30 },
      { header: '处理人', key: 'handledBy', width: 12 },
      { header: '修改原因', key: 'modifyReason', width: 25 },
      { header: '影响记录数', key: 'affectedCount', width: 12 },
      { header: '任务编号', key: 'taskNo', width: 20 }
    ];

    results.forEach(r => {
      const survey = r.survey || {};
      const task = r.task || {};
      const affectedRecords = r.affectedRecords ? JSON.parse(r.affectedRecords) : [];

      worksheet.addRow({
        revisitTime: dayjs(r.revisitTime).format('YYYY-MM-DD HH:mm:ss'),
        customerName: survey.customerName || '',
        phone: survey.phone || '',
        originalScore: survey.score || '',
        newScore: r.newScore || '',
        lowScoreReason: survey.lowScoreReason?.name || '',
        department: survey.department?.name || '',
        revisitResult: this.translateResult(r.revisitResult),
        customerFeedback: r.customerFeedback || '',
        handledBy: r.handledBy || '',
        modifyReason: r.modifyReason || '',
        affectedCount: affectedRecords.length,
        taskNo: task.taskNo || ''
      });
    });

    worksheet.getRow(1).font = { bold: true };

    const logsWorksheet = workbook.addWorksheet('操作日志');
    logsWorksheet.columns = [
      { header: '操作时间', key: 'operationTime', width: 20 },
      { header: '实体类型', key: 'entityType', width: 12 },
      { header: '操作类型', key: 'operation', width: 12 },
      { header: '操作人', key: 'operator', width: 12 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '变更字段', key: 'changedFields', width: 25 }
    ];

    const logs = await OperationLog.findAll({
      where: {
        operationTime: startDate && endDate 
          ? { [Op.between]: [startDate, endDate] } 
          : undefined,
        operator: handledBy || undefined
      },
      order: [['operationTime', 'DESC']]
    });

    logs.forEach(log => {
      const changedFields = log.changedFields ? JSON.parse(log.changedFields) : [];
      logsWorksheet.addRow({
        operationTime: dayjs(log.operationTime).format('YYYY-MM-DD HH:mm:ss'),
        entityType: this.translateEntityType(log.entityType),
        operation: this.translateOperation(log.operation),
        operator: log.operator || '',
        remark: log.remark || '',
        changedFields: changedFields.join(', ')
      });
    });

    logsWorksheet.getRow(1).font = { bold: true };

    return workbook;
  }

  static translateResult(result) {
    const map = {
      resolved: '已解决',
      partially_resolved: '部分解决',
      unresolved: '未解决',
      no_answer: '无人接听'
    };
    return map[result] || result;
  }

  static translateEntityType(type) {
    const map = {
      survey: '回访问卷',
      task: '补救任务',
      result: '复访结果',
      reason: '低分原因',
      department: '部门'
    };
    return map[type] || type;
  }

  static translateOperation(op) {
    const map = {
      create: '创建',
      update: '更新',
      delete: '删除',
      block: '拦截',
      review: '复核',
      complete: '完成'
    };
    return map[op] || op;
  }

  static async getExportFilters() {
    const handlers = await RevisitResult.findAll({
      attributes: ['handledBy'],
      group: ['handledBy'],
      where: { handledBy: { [Op.not]: null } },
      raw: true
    });

    return {
      handlers: handlers.map(h => h.handledBy).filter(Boolean)
    };
  }
}

module.exports = ExportService;
