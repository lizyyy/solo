const { Parser } = require('json2csv');
const RefundService = require('./RefundService');
const LogService = require('./LogService');

class ExportService {
  static async exportRefundReport(filters = {}) {
    const refunds = await RefundService.getAll();
    const reversals = await RefundService.getReversals(filters);
    const logs = await LogService.getOperationLogs(filters);

    const reportData = [];

    for (const refund of refunds) {
      const timeline = await RefundService.getTimeline(refund.id);
      const refundReversals = reversals.filter(r => r.refund_request_id === refund.id);
      
      for (const reversal of refundReversals) {
        reportData.push({
          退款申请ID: refund.id,
          员工姓名: refund.employee_name,
          部门: refund.department_name,
          退款金额: refund.amount,
          退款原因: refund.reason || '',
          退款状态: refund.status,
          操作类型: '退款逆转',
          操作人: reversal.operator_name,
          操作时间: reversal.created_at,
          逆转原因: reversal.reason,
          原状态: reversal.previous_status,
          新状态: reversal.new_status,
          影响记录: reversal.affected_records,
          审核人: refund.reviewer_id ? refund.reviewer_id : '',
          审核时间: refund.reviewed_at || '',
          审核意见: refund.review_comment || ''
        });
      }

      if (refundReversals.length === 0) {
        reportData.push({
          退款申请ID: refund.id,
          员工姓名: refund.employee_name,
          部门: refund.department_name,
          退款金额: refund.amount,
          退款原因: refund.reason || '',
          退款状态: refund.status,
          操作类型: '退款申请',
          操作人: '',
          操作时间: refund.created_at,
          逆转原因: '',
          原状态: '',
          新状态: '',
          影响记录: '',
          审核人: refund.reviewer_id ? refund.reviewer_id : '',
          审核时间: refund.reviewed_at || '',
          审核意见: refund.review_comment || ''
        });
      }
    }

    const fields = [
      '退款申请ID', '员工姓名', '部门', '退款金额', '退款原因', '退款状态',
      '操作类型', '操作人', '操作时间', '逆转原因', '原状态', '新状态',
      '影响记录', '审核人', '审核时间', '审核意见'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(reportData);
  }

  static async exportAuditLog(filters = {}) {
    const logs = await LogService.getOperationLogs(filters);
    
    const reportData = logs.map(log => ({
      日志ID: log.id,
      实体类型: log.entity_type,
      实体ID: log.entity_id,
      操作: log.action,
      操作人ID: log.operator_id,
      操作人: log.operator_name,
      操作时间: log.created_at,
      修改前值: log.before_value || '',
      修改后值: log.after_value || ''
    }));

    const fields = [
      '日志ID', '实体类型', '实体ID', '操作', '操作人ID', '操作人',
      '操作时间', '修改前值', '修改后值'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(reportData);
  }
}

module.exports = ExportService;
