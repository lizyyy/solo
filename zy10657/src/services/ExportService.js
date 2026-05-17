const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

class ExportService {
  constructor() {
    this.exportDir = process.env.EXPORT_DIR || './exports';
    this._ensureExportDir();
  }

  _ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportCallRecordsToCSV(records, filename = null) {
    this._ensureExportDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const actualFilename = filename || `call_records_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, actualFilename);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'taskBatchId', title: '任务批次ID' },
        { id: 'phoneNumber', title: '手机号码' },
        { id: 'customerName', title: '客户姓名' },
        { id: 'status', title: '状态' },
        { id: 'statusText', title: '状态说明' },
        { id: 'callResult', title: '呼叫结果' },
        { id: 'callTime', title: '呼叫时间' },
        { id: 'interceptReason', title: '拦截原因' },
        { id: 'interceptTime', title: '拦截时间' },
        { id: 'reviewedBy', title: '审核人' },
        { id: 'reviewTime', title: '审核时间' },
        { id: 'reviewComment', title: '审核意见' },
        { id: 'importError', title: '导入错误' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    const statusMap = {
      'pending': '待呼叫',
      'intercepted': '已拦截',
      'called': '已呼叫',
      'archived': '已归档',
      'import_error': '导入错误'
    };

    const data = records.map(record => ({
      id: record.id,
      taskBatchId: record.taskBatchId,
      phoneNumber: record.phoneNumber,
      customerName: record.customerName,
      status: record.status,
      statusText: statusMap[record.status] || record.status,
      callResult: record.callResult || '',
      callTime: record.callTime ? record.callTime.toISOString() : '',
      interceptReason: record.interceptReason || '',
      interceptTime: record.interceptTime ? record.interceptTime.toISOString() : '',
      reviewedBy: record.reviewedBy || '',
      reviewTime: record.reviewTime ? record.reviewTime.toISOString() : '',
      reviewComment: record.reviewComment || '',
      importError: record.importError || '',
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    }));

    await csvWriter.writeRecords(data);
    return { filePath, filename: actualFilename };
  }

  async exportHistoryToCSV(callRecordId, history, filename = null) {
    this._ensureExportDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const actualFilename = filename || `history_${callRecordId}_${timestamp}.csv`;
    const filePath = path.join(this.exportDir, actualFilename);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '历史记录ID' },
        { id: 'callRecordId', title: '呼叫记录ID' },
        { id: 'action', title: '操作类型' },
        { id: 'operator', title: '操作人' },
        { id: 'details', title: '操作详情' },
        { id: 'previousStatus', title: '之前状态' },
        { id: 'newStatus', title: '新状态' },
        { id: 'timestamp', title: '操作时间' }
      ]
    });

    const data = history.map(log => ({
      id: log.id,
      callRecordId: log.callRecordId,
      action: log.action,
      operator: log.operator,
      details: log.details,
      previousStatus: log.previousStatus || '',
      newStatus: log.newStatus || '',
      timestamp: log.timestamp.toISOString()
    }));

    await csvWriter.writeRecords(data);
    return { filePath, filename: actualFilename };
  }

  getExportFiles() {
    this._ensureExportDir();
    const files = fs.readdirSync(this.exportDir);
    return files.map(file => ({
      filename: file,
      path: path.join(this.exportDir, file),
      createdAt: fs.statSync(path.join(this.exportDir, file)).birthtime
    })).sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = new ExportService();
