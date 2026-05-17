const { Parser } = require('json2csv');
const { DeactivationService, STATUS } = require('./deactivationService');

class ReportService {
  constructor() {
    this.deactivationService = new DeactivationService();
  }

  generateReport(taskId, format = 'json') {
    const task = this.deactivationService.getTask(taskId);
    if (!task) throw new Error('任务不存在');

    const reportData = this._buildReportData(task);

    if (format === 'csv') {
      return this._generateCSV(reportData);
    } else if (format === 'json') {
      return JSON.stringify(reportData, null, 2);
    } else {
      throw new Error('不支持的导出格式');
    }
  }

  _buildReportData(task) {
    const statusMap = {
      [STATUS.PENDING]: '待处理',
      [STATUS.PROCESSING]: '处理中',
      [STATUS.PARTIAL_SUCCESS]: '部分成功',
      [STATUS.SUCCESS]: '全部成功',
      [STATUS.FAILED]: '失败',
      [STATUS.NEEDS_MANUAL]: '需人工处理',
      [STATUS.MANUALLY_COMPLETED]: '人工已处理'
    };

    const systemStatusMap = {
      [STATUS.PENDING]: '待处理',
      [STATUS.PROCESSING]: '处理中',
      [STATUS.SUCCESS]: '停用成功',
      [STATUS.FAILED]: '停用失败',
      [STATUS.NEEDS_MANUAL]: '需人工处理',
      [STATUS.MANUALLY_COMPLETED]: '人工已处理'
    };

    const summary = {
      任务编号: task.id,
      人员编号: task.employee_id,
      人员姓名: task.employee_name || '-',
      申请人: task.requested_by,
      申请时间: task.created_at,
      开始处理时间: task.started_at || '-',
      完成时间: task.completed_at || '-',
      任务状态: statusMap[task.status] || task.status,
      系统总数: task.total_systems,
      已完成数: task.completed_systems,
      失败数: task.failed_systems,
      完成率: task.total_systems > 0 
        ? Math.round((task.completed_systems / task.total_systems) * 100) + '%' 
        : '0%'
    };

    const systemDetails = task.items.map(item => ({
      系统ID: item.system_id,
      系统名称: item.system_name,
      账号标识: item.account_identifier,
      处理状态: systemStatusMap[item.status] || item.status,
      尝试次数: item.attempts,
      最后尝试时间: item.last_attempt_at || '-',
      完成时间: item.completed_at || '-',
      错误代码: item.error_code || '-',
      错误说明: item.error_message || '-',
      是否人工修正: item.manually_corrected ? '是' : '否',
      修正人: item.corrected_by || '-',
      修正时间: item.corrected_at || '-',
      修正备注: item.correction_note || '-'
    }));

    const successful = systemDetails.filter(s => s.处理状态 === '停用成功' || s.处理状态 === '人工已处理');
    const failed = systemDetails.filter(s => s.处理状态 === '停用失败' || s.处理状态 === '需人工处理');
    const pending = systemDetails.filter(s => s.处理状态 === '待处理' || s.处理状态 === '处理中');

    const analysis = {
      停用成功系统: successful.map(s => s.系统名称),
      停用失败系统: failed.map(s => ({
        系统: s.系统名称,
        错误: s.错误说明,
        建议: this._getErrorSuggestion(s.错误代码)
      })),
      待处理系统: pending.map(s => s.系统名称)
    };

    const originalRequest = {
      原始申请信息: task.original_request,
      说明: '此字段保留申请人提交时的原始数据，用于追溯和审计'
    };

    return {
      报告说明: '离职人员账号停用处理报告 - 此报告为业务人员友好格式，包含所有系统的处理详情和建议',
      报告生成时间: new Date().toISOString(),
      任务概览: summary,
      系统处理详情: systemDetails,
      结果分析: analysis,
      原始申请记录: originalRequest
    };
  }

  _getErrorSuggestion(errorCode) {
    const suggestions = {
      'API_TIMEOUT': '建议稍后重试，或联系系统管理员检查系统可用性',
      'ACCOUNT_NOT_FOUND': '请核实该人员在系统中的账号是否存在，可能已被提前删除或从未创建',
      'PERMISSION_DENIED': '请联系系统管理员检查API权限配置',
      'SYSTEM_MAINTENANCE': '请等待系统维护完成后重试',
      'DEPENDENCY_ERROR': '请检查是否有其他依赖账号需要先处理，或联系系统管理员'
    };
    return suggestions[errorCode] || '请联系技术支持人员协助处理';
  }

  _generateCSV(reportData) {
    const rows = [];

    rows.push(['=== 账号停用报告 ===']);
    rows.push(['生成时间:', reportData.报告生成时间]);
    rows.push([]);

    rows.push(['--- 任务概览 ---']);
    Object.entries(reportData.任务概览).forEach(([key, value]) => {
      rows.push([key, value]);
    });
    rows.push([]);

    rows.push(['--- 系统处理详情 ---']);
    if (reportData.系统处理详情.length > 0) {
      rows.push(Object.keys(reportData.系统处理详情[0]));
      reportData.系统处理详情.forEach(item => {
        rows.push(Object.values(item));
      });
    }
    rows.push([]);

    rows.push(['--- 结果分析 ---']);
    rows.push(['停用成功系统:', reportData.结果分析.停用成功系统.join(', ')]);
    rows.push([]);
    rows.push(['停用失败系统及处理建议:']);
    reportData.结果分析.停用失败系统.forEach(f => {
      rows.push([`- ${f.系统}: ${f.错误}`, `建议: ${f.建议}`]);
    });
    rows.push([]);
    rows.push(['待处理系统:', reportData.结果分析.待处理系统.join(', ')]);

    return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  getReportMetadata(taskId) {
    const task = this.deactivationService.getTask(taskId);
    if (!task) throw new Error('任务不存在');

    return {
      taskId: task.id,
      employeeId: task.employee_id,
      employeeName: task.employee_name,
      status: task.status,
      canExport: task.status !== STATUS.PENDING,
      hasFailures: task.failed_systems > 0,
      needsManual: task.items.some(i => i.status === STATUS.NEEDS_MANUAL || i.status === STATUS.FAILED && i.attempts >= 3)
    };
  }
}

module.exports = ReportService;
