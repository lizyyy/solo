const { Parser } = require('json2csv');
const { formatDate, RESPONSIBILITY_NAMES, ORDER_STATUS, REJUDGE_STATUS } = require('../utils');

class ExportService {
  exportOrdersToCSV(orders) {
    const fields = [
      { label: '返修单ID', value: 'id' },
      { label: '产品序列号', value: 'product_sn' },
      { label: '产品名称', value: 'product_name' },
      { label: '返修类型', value: 'repair_type' },
      { label: '描述', value: 'description' },
      { label: '状态', value: (row) => ORDER_STATUS[row.status] || row.status },
      { label: '当前责任方', value: (row) => RESPONSIBILITY_NAMES[row.current_responsibility] || row.current_responsibility || '-' },
      { label: '创建时间', value: (row) => formatDate(row.created_at) },
      { label: '更新时间', value: (row) => formatDate(row.updated_at) }
    ];

    const json2csvParser = new Parser({ fields, withBOM: true });
    return json2csvParser.parse(orders);
  }

  exportCostsToCSV(costs) {
    const fields = [
      { label: '费用ID', value: 'id' },
      { label: '返修单ID', value: 'repair_order_id' },
      { label: '责任方', value: (row) => RESPONSIBILITY_NAMES[row.responsibility] || row.responsibility },
      { label: '费用类型', value: 'cost_type' },
      { label: '金额', value: 'amount' },
      { label: '币种', value: 'currency' },
      { label: '描述', value: 'description' },
      { label: '是否已结算', value: (row) => row.is_settled ? '是' : '否' },
      { label: '结算批次', value: 'settlement_batch' },
      { label: '记录时间', value: (row) => formatDate(row.recorded_at) }
    ];

    const json2csvParser = new Parser({ fields, withBOM: true });
    return json2csvParser.parse(costs);
  }

  exportRejudgesToCSV(rejudges) {
    const fields = [
      { label: '复判ID', value: 'id' },
      { label: '返修单ID', value: 'repair_order_id' },
      { label: '原责任方', value: (row) => RESPONSIBILITY_NAMES[row.previous_responsibility] || row.previous_responsibility || '-' },
      { label: '新责任方', value: (row) => RESPONSIBILITY_NAMES[row.new_responsibility] || row.new_responsibility },
      { label: '复判原因', value: 'reason' },
      { label: '状态', value: (row) => REJUDGE_STATUS[row.status] || row.status },
      { label: '审批意见', value: 'approve_comment' },
      { label: '申请人', value: 'operator' },
      { label: '申请时间', value: (row) => formatDate(row.operated_at) },
      { label: '审批人', value: 'approver' },
      { label: '审批时间', value: (row) => row.approved_at ? formatDate(row.approved_at) : '-' }
    ];

    const json2csvParser = new Parser({ fields, withBOM: true });
    return json2csvParser.parse(rejudges);
  }

  exportSettlementToCSV(batch) {
    const lines = [];
    
    lines.push('【结算批次摘要】');
    lines.push(`批次ID,${batch.id}`);
    lines.push(`责任方,${RESPONSIBILITY_NAMES[batch.responsibility] || batch.responsibility}`);
    lines.push(`费用数量,${batch.cost_count}`);
    lines.push(`总金额,${batch.total_amount}`);
    lines.push(`币种,${batch.currency}`);
    lines.push(`创建时间,${formatDate(batch.created_at)}`);
    lines.push(`状态,${batch.status}`);
    lines.push('');
    
    lines.push('【费用明细】');
    lines.push('费用ID,返修单ID,费用类型,金额,币种,描述,记录时间');
    
    if (batch.costs && batch.costs.length > 0) {
      for (const cost of batch.costs) {
        lines.push([
          cost.id,
          cost.repair_order_id,
          cost.cost_type,
          cost.amount,
          cost.currency,
          (cost.description || '').replace(/,/g, '，'),
          formatDate(cost.recorded_at)
        ].join(','));
      }
    }
    
    return lines.join('\n');
  }

  exportOperationLogsToCSV(logs) {
    const fields = [
      { label: '日志ID', value: 'id' },
      { label: '模块', value: 'module' },
      { label: '操作类型', value: 'action' },
      { label: '目标ID', value: 'target_id' },
      { label: '操作人', value: 'operator' },
      { label: '操作时间', value: (row) => formatDate(row.operated_at) },
      { label: '详情', value: 'details' },
      { label: 'IP地址', value: 'ip_address' }
    ];

    const json2csvParser = new Parser({ fields, withBOM: true });
    return json2csvParser.parse(logs);
  }

  exportLiabilityHistoryToCSV(freezes) {
    const fields = [
      { label: '冻结ID', value: 'id' },
      { label: '返修单ID', value: 'repair_order_id' },
      { label: '责任方', value: (row) => RESPONSIBILITY_NAMES[row.responsibility] || row.responsibility },
      { label: '冻结原因', value: 'reason' },
      { label: '是否当前有效', value: (row) => row.is_active ? '是' : '否' },
      { label: '冻结操作人', value: 'frozen_by' },
      { label: '冻结时间', value: (row) => formatDate(row.frozen_at) }
    ];

    const json2csvParser = new Parser({ fields, withBOM: true });
    return json2csvParser.parse(freezes);
  }
}

module.exports = new ExportService();
