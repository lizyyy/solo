const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class ExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '../../exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  exportToCsv(data, filename, headers) {
    const filePath = path.join(this.exportDir, filename);
    
    const csvWriter = createCsvWriter({
      path: filePath,
      header: headers
    });

    return csvWriter.writeRecords(data)
      .then(() => ({
        success: true,
        filePath,
        recordCount: data.length
      }))
      .catch(err => ({
        success: false,
        error: err.message
      }));
  }

  async exportLogs(logData, filename = null) {
    const finalFilename = filename || `logs_${new Date().toISOString().split('T')[0]}.csv`;
    const headers = [
      { id: 'id', title: 'ID' },
      { id: 'operation_type', title: '操作类型' },
      { id: 'entity_type', title: '实体类型' },
      { id: 'entity_id', title: '实体ID' },
      { id: 'operator', title: '操作人' },
      { id: 'status', title: '状态' },
      { id: 'reason', title: '原因' },
      { id: 'created_at', title: '创建时间' }
    ];

    return this.exportToCsv(logData, finalFilename, headers);
  }

  async exportExceptions(exceptionData, filename = null) {
    const finalFilename = filename || `exceptions_${new Date().toISOString().split('T')[0]}.csv`;
    const headers = [
      { id: 'id', title: 'ID' },
      { id: 'exception_type', title: '异常类型' },
      { id: 'entity_type', title: '实体类型' },
      { id: 'entity_id', title: '实体ID' },
      { id: 'severity', title: '严重程度' },
      { id: 'description', title: '描述' },
      { id: 'handled', title: '是否处理' },
      { id: 'handler', title: '处理人' },
      { id: 'created_at', title: '创建时间' }
    ];

    return this.exportToCsv(exceptionData, finalFilename, headers);
  }

  async exportDailyReport(reportData, filename = null) {
    const finalFilename = filename || `daily_report_${reportData.date}.csv`;
    
    const summaryData = [{
      item: '总班次',
      value: reportData.summary.totalShifts
    }, {
      item: '活跃锁桩',
      value: reportData.summary.activeLocks
    }, {
      item: '总操作数',
      value: reportData.summary.totalOperations
    }, {
      item: '成功操作',
      value: reportData.summary.successfulOperations
    }, {
      item: '拦截操作',
      value: reportData.summary.blockedOperations
    }, {
      item: '总异常数',
      value: reportData.summary.totalExceptions
    }, {
      item: '未处理异常',
      value: reportData.summary.unhandledExceptions
    }, {
      item: '低电量叉车',
      value: reportData.summary.lowBatteryForklifts
    }];

    const summaryPath = path.join(this.exportDir, `summary_${finalFilename}`);
    const summaryWriter = createCsvWriter({
      path: summaryPath,
      header: [
        { id: 'item', title: '项目' },
        { id: 'value', title: '数值' }
      ]
    });
    await summaryWriter.writeRecords(summaryData);

    const shiftsPath = path.join(this.exportDir, `shifts_${finalFilename}`);
    const shiftsWriter = createCsvWriter({
      path: shiftsPath,
      header: [
        { id: 'shiftId', title: '班次ID' },
        { id: 'shiftName', title: '班次名称' },
        { id: 'manager', title: '负责人' },
        { id: 'lockCount', title: '锁桩数' },
        { id: 'status', title: '状态' }
      ]
    });
    await shiftsWriter.writeRecords(reportData.shifts);

    const exceptionsPath = path.join(this.exportDir, `exceptions_${finalFilename}`);
    const exceptionsWriter = createCsvWriter({
      path: exceptionsPath,
      header: [
        { id: 'id', title: '异常ID' },
        { id: 'type', title: '异常类型' },
        { id: 'severity', title: '严重程度' },
        { id: 'description', title: '描述' },
        { id: 'handled', title: '是否处理' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });
    await exceptionsWriter.writeRecords(reportData.exceptions);

    return {
      success: true,
      files: {
        summary: summaryPath,
        shifts: shiftsPath,
        exceptions: exceptionsPath
      }
    };
  }

  exportLocks(locksData, filename = null) {
    const finalFilename = filename || `locks_${new Date().toISOString().split('T')[0]}.csv`;
    const headers = [
      { id: 'id', title: '锁ID' },
      { id: 'station_id', title: '充电桩ID' },
      { id: 'forklift_id', title: '叉车ID' },
      { id: 'driver', title: '司机' },
      { id: 'shift_id', title: '班次ID' },
      { id: 'lock_time', title: '锁定时间' },
      { id: 'expected_release_time', title: '预计释放时间' },
      { id: 'status', title: '状态' },
      { id: 'reason', title: '原因' }
    ];

    return this.exportToCsv(locksData, finalFilename, headers);
  }

  exportToJson(data, filename) {
    const filePath = path.join(this.exportDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return {
      success: true,
      filePath
    };
  }
}

module.exports = ExportService;
