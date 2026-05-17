const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class ExportService {
  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportToCSV(compensations) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `compensation-export-${timestamp}.csv`;
    const filepath = path.join(this.exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'riderId', title: '骑手ID' },
        { id: 'riderName', title: '骑手姓名' },
        { id: 'orderId', title: '订单ID' },
        { id: 'orderNo', title: '订单编号' },
        { id: 'reassignmentType', title: '改派类型' },
        { id: 'reason', title: '改派原因' },
        { id: 'compensationAmount', title: '补偿金额(元)' },
        { id: 'status', title: '状态' },
        { id: 'conflict', title: '是否冲突' },
        { id: 'conflictNote', title: '冲突说明' },
        { id: 'importError', title: '导入错误' },
        { id: 'importErrorMsg', title: '错误信息' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    const records = compensations.map(c => ({
      ...c.toJSON(),
      conflict: c.conflict ? '是' : '否',
      importError: c.importError ? '是' : '否'
    }));

    await csvWriter.writeRecords(records);
    return { filepath, filename, recordCount: records.length };
  }

  getExportFilePath(filename) {
    return path.join(this.exportDir, filename);
  }

  listExports() {
    if (!fs.existsSync(this.exportDir)) return [];
    return fs.readdirSync(this.exportDir)
      .filter(f => f.endsWith('.csv'))
      .sort()
      .reverse();
  }
}

module.exports = new ExportService();
