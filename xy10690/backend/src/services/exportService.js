const ExcelJS = require('exceljs');
const makeupService = require('./makeupService');

class ExportService {
  async exportSessions(filters = {}) {
    const sessions = await makeupService.getSessions(filters);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('试妆项目');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: '客户', key: 'customer_name', width: 15 },
      { header: '顾问', key: 'consultant_name', width: 15 },
      { header: '产品', key: 'product_name', width: 20 },
      { header: '日期', key: 'date', width: 12 },
      { header: '状态', key: 'status', width: 15 },
      { header: '风险等级', key: 'risk_level', width: 12 },
      { header: '备注', key: 'notes', width: 30 },
      { header: '创建时间', key: 'created_at', width: 25 }
    ];

    const statusMap = {
      'approved': '已通过',
      'blocked': '已拦截',
      'manual_approved': '人工通过',
      'pending': '待处理'
    };

    sessions.forEach(session => {
      worksheet.addRow({
        ...session,
        status: statusMap[session.status] || session.status
      });
    });

    return workbook;
  }

  async exportLogs(filters = {}) {
    const logs = await makeupService.getOperationLogs(filters);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('操作日志');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: '操作类型', key: 'operation_type', width: 15 },
      { header: '实体类型', key: 'entity_type', width: 15 },
      { header: '实体ID', key: 'entity_id', width: 36 },
      { header: '状态', key: 'status', width: 12 },
      { header: '失败原因', key: 'failure_reason', width: 30 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '时间', key: 'created_at', width: 25 }
    ];

    const statusMap = {
      'success': '成功',
      'failed': '失败',
      'blocked': '拦截',
      'duplicate': '重复',
      'manual': '人工'
    };

    logs.forEach(log => {
      worksheet.addRow({
        ...log,
        status: statusMap[log.status] || log.status
      });
    });

    return workbook;
  }
}

module.exports = new ExportService();
