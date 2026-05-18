const { Parser } = require('json2csv');
const ReceivableService = require('./receivableService');
const moment = require('moment');

class ExportService {
  static async exportToCSV(params = {}) {
    const data = await ReceivableService.exportReceivables(params);
    
    const flatData = data.map(item => ({
      账款编号: item.receivableNo,
      客户ID: item.customerId,
      客户名称: item.customerName,
      账款金额: item.amount,
      到期日: moment(item.dueDate).format('YYYY-MM-DD'),
      状态: this.translateStatus(item.status),
      锁定原因: item.lockReason,
      融资单编号: item.financeOrderNo || '',
      融资单是否冻结: item.financeFrozen ? '是' : '否',
      操作来源: item.operationSource || '',
      当前处理人: item.currentOperator || '',
      创建时间: moment(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      更新时间: moment(item.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
      历史记录数: item.histories.length,
      历史操作记录: item.histories.map(h => 
        `${moment(h.createdAt).format('YYYY-MM-DD HH:mm:ss')} ${h.operator} ${h.operationType} ${this.translateStatus(h.newStatus)} 融资冻结:${h.financeFrozen ? '是' : '否'}`
      ).join(' | ')
    }));

    const fields = [
      '账款编号', '客户ID', '客户名称', '账款金额', '到期日', '状态',
      '锁定原因', '融资单编号', '融资单是否冻结', '操作来源', '当前处理人',
      '创建时间', '更新时间', '历史记录数', '历史操作记录'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(flatData);
  }

  static translateStatus(status) {
    const statusMap = {
      'LOCKED': '已锁定',
      'UNLOCK_APPLY': '解锁申请',
      'UNLOCKED': '已解锁',
      'REJECTED': '被拒绝'
    };
    return statusMap[status] || status;
  }

  static async exportHistoryToCSV(params = {}) {
    const { rows: histories } = await require('./historyService').default.getAllHistories(params);
    
    const flatData = histories.map(item => ({
      账款编号: item.receivableNo,
      操作类型: item.operationType,
      操作来源: item.operationSource,
      操作者: item.operator,
      原状态: this.translateStatus(item.oldStatus),
      新状态: this.translateStatus(item.newStatus),
      融资单冻结状态: item.financeFrozen ? '是' : '否',
      备注: item.remark || '',
      操作时间: moment(item.createdAt).format('YYYY-MM-DD HH:mm:ss')
    }));

    const fields = [
      '账款编号', '操作类型', '操作来源', '操作者', '原状态', '新状态',
      '融资单冻结状态', '备注', '操作时间'
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(flatData);
  }
}

module.exports = ExportService;