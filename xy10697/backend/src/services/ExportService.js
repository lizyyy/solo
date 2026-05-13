const XLSX = require('xlsx');
const storage = require('../storage/memoryStorage');
const { StatusLabels } = require('../models/CylinderStatus');

class ExportService {
  static exportHistories(filters = {}) {
    const { operator, startTime, endTime } = filters;
    let histories = storage.getAllHistories();

    if (operator) {
      histories = histories.filter(h => h.operator === operator);
    }
    if (startTime) {
      histories = histories.filter(h => new Date(h.createdAt) >= new Date(startTime));
    }
    if (endTime) {
      histories = histories.filter(h => new Date(h.createdAt) <= new Date(endTime));
    }

    const data = histories.map(h => ({
      '气瓶编号': h.cylinderNo,
      '时间': new Date(h.createdAt).toLocaleString('zh-CN'),
      '原状态': h.fromStatus ? StatusLabels[h.fromStatus] || h.fromStatus : '无',
      '新状态': StatusLabels[h.toStatus] || h.toStatus,
      '变更原因': h.changeReason,
      '操作人': h.operator,
      '充装批次': h.batchNo || '',
      '客户': h.customer || '',
      '修改前值': JSON.stringify(h.oldValues || {}),
      '修改后值': JSON.stringify(h.newValues || {}),
      '备注': h.remark || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '操作记录');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  static exportCylinders(status) {
    let cylinders = storage.getAllCylinders();

    if (status) {
      cylinders = cylinders.filter(c => c.currentStatus === status);
    }

    const data = cylinders.map(c => ({
      '气瓶编号': c.cylinderNo,
      '规格': c.specification,
      '材质': c.material,
      '当前状态': StatusLabels[c.currentStatus] || c.currentStatus,
      '当前批次': c.currentBatchNo || '',
      '当前客户': c.currentCustomer || '',
      '制造日期': c.manufactureDate ? new Date(c.manufactureDate).toLocaleDateString('zh-CN') : '',
      '上次检验日期': c.lastInspectionDate ? new Date(c.lastInspectionDate).toLocaleDateString('zh-CN') : '',
      '下次检验日期': c.nextInspectionDate ? new Date(c.nextInspectionDate).toLocaleDateString('zh-CN') : '',
      '是否报废': c.isScrapped ? '是' : '否',
      '报废日期': c.scrapDate ? new Date(c.scrapDate).toLocaleDateString('zh-CN') : '',
      '报废原因': c.scrapReason || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '气瓶列表');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  static getAllOperators() {
    const histories = storage.getAllHistories();
    const operators = new Set();
    histories.forEach(h => {
      if (h.operator) operators.add(h.operator);
    });
    return Array.from(operators);
  }
}

module.exports = ExportService;
