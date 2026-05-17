const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const OrderFreeze = require('../models/OrderFreeze');
const FreezeOperationLog = require('../models/FreezeOperationLog');

class ExportService {
  static ensureExportDir() {
    const exportDir = path.join(__dirname, '../../data/exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }

  static formatTimestamp(timestamp) {
    return timestamp ? moment(timestamp).format('YYYY-MM-DD HH:mm:ss') : '';
  }

  static async exportFreezeRecords(filters = {}) {
    const exportDir = this.ensureExportDir();
    const filename = `freeze_records_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    const filepath = path.join(exportDir, filename);

    const records = OrderFreeze.findAll(filters);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'id', title: '冻结ID' },
        { id: 'order_no', title: '订单编号' },
        { id: 'risk_reason', title: '风险原因' },
        { id: 'freeze_action', title: '冻结动作' },
        { id: 'freeze_action_details', title: '冻结详情' },
        { id: 'reviewer', title: '复核人' },
        { id: 'release_condition', title: '释放条件' },
        { id: 'status', title: '状态' },
        { id: 'processing_summary', title: '处理摘要' },
        { id: 'final_conclusion', title: '最终结论' },
        { id: 'created_at', title: '创建时间' },
        { id: 'frozen_at', title: '冻结时间' },
        { id: 'released_at', title: '释放时间' },
        { id: 'version', title: '版本号' }
      ]
    });

    const formattedRecords = records.map(r => ({
      ...r,
      created_at: this.formatTimestamp(r.created_at),
      frozen_at: this.formatTimestamp(r.frozen_at),
      released_at: this.formatTimestamp(r.released_at),
      cancelled_at: this.formatTimestamp(r.cancelled_at),
      reviewed_at: this.formatTimestamp(r.reviewed_at)
    }));

    await csvWriter.writeRecords(formattedRecords);

    return {
      filename: filename,
      filepath: filepath,
      count: records.length
    };
  }

  static async exportOperationLogs(freezeId = null, filters = {}) {
    const exportDir = this.ensureExportDir();
    const filename = `operation_logs_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    const filepath = path.join(exportDir, filename);

    let logs;
    if (freezeId) {
      logs = FreezeOperationLog.findByFreezeId(freezeId);
    } else {
      logs = FreezeOperationLog.findAll(filters);
    }

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'id', title: '日志ID' },
        { id: 'freeze_id', title: '冻结ID' },
        { id: 'operation_type', title: '操作类型' },
        { id: 'operator', title: '操作人' },
        { id: 'before_status', title: '变更前状态' },
        { id: 'after_status', title: '变更后状态' },
        { id: 'operation_details', title: '操作详情' },
        { id: 'processing_basis', title: '处理依据' },
        { id: 'ip_address', title: 'IP地址' },
        { id: 'created_at', title: '操作时间' }
      ]
    });

    const formattedLogs = logs.map(l => ({
      ...l,
      created_at: this.formatTimestamp(l.created_at)
    }));

    await csvWriter.writeRecords(formattedLogs);

    return {
      filename: filename,
      filepath: filepath,
      count: logs.length
    };
  }

  static async exportFullTrace(freezeId) {
    const exportDir = this.ensureExportDir();
    const filename = `full_trace_${freezeId}_${moment().format('YYYYMMDD_HHmmss')}.json`;
    const filepath = path.join(exportDir, filename);

    const freeze = OrderFreeze.findById(freezeId);
    if (!freeze) {
      throw new Error('冻结记录不存在');
    }

    const logs = FreezeOperationLog.findByFreezeId(freezeId);

    const traceData = {
      freezeRecord: {
        ...freeze,
        created_at: this.formatTimestamp(freeze.created_at),
        frozen_at: this.formatTimestamp(freeze.frozen_at),
        released_at: this.formatTimestamp(freeze.released_at),
        cancelled_at: this.formatTimestamp(freeze.cancelled_at)
      },
      operationLogs: logs.map(l => ({
        ...l,
        created_at: this.formatTimestamp(l.created_at)
      })),
      exportTime: moment().format('YYYY-MM-DD HH:mm:ss')
    };

    fs.writeFileSync(filepath, JSON.stringify(traceData, null, 2), 'utf8');

    return {
      filename: filename,
      filepath: filepath
    };
  }

  static getExportFile(filename) {
    const exportDir = this.ensureExportDir();
    const filepath = path.join(exportDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return null;
    }

    return {
      filename: filename,
      filepath: filepath,
      stats: fs.statSync(filepath)
    };
  }

  static listExportFiles() {
    const exportDir = this.ensureExportDir();
    const files = fs.readdirSync(exportDir);
    
    return files.map(filename => {
      const filepath = path.join(exportDir, filename);
      const stats = fs.statSync(filepath);
      return {
        filename: filename,
        size: stats.size,
        created_at: this.formatTimestamp(stats.birthtimeMs)
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

module.exports = ExportService;
