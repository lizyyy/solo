const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

class ExportService {
  async exportDegradeRecords(records, format = 'csv') {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filename = `degrade_records_${Date.now()}.${format}`;
    const filePath = path.join(exportDir, filename);

    if (format === 'csv') {
      const csvWriter = createCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'cache_key', title: '缓存Key' },
          { id: 'business_line', title: '业务线' },
          { id: 'degrade_reason', title: '降级原因' },
          { id: 'executor', title: '执行人' },
          { id: 'status', title: '状态' },
          { id: 'restore_time', title: '恢复时间' },
          { id: 'restore_applicant', title: '恢复申请人' },
          { id: 'created_at', title: '创建时间' },
          { id: 'updated_at', title: '更新时间' }
        ]
      });
      await csvWriter.writeRecords(records);
    } else if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
    }

    return { filePath, filename };
  }

  async exportCleanupTasks(tasks, format = 'csv') {
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filename = `cleanup_tasks_${Date.now()}.${format}`;
    const filePath = path.join(exportDir, filename);

    if (format === 'csv') {
      const csvWriter = createCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: '任务ID' },
          { id: 'degrade_record_id', title: '降级记录ID' },
          { id: 'cache_key', title: '缓存Key' },
          { id: 'business_line', title: '业务线' },
          { id: 'degrade_reason', title: '降级原因' },
          { id: 'hit_count', title: '命中次数' },
          { id: 'status', title: '状态' },
          { id: 'marked_at', title: '标记时间' },
          { id: 'confirmed_at', title: '确认时间' },
          { id: 'confirmed_by', title: '确认人' }
        ]
      });
      await csvWriter.writeRecords(tasks);
    } else if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2));
    }

    return { filePath, filename };
  }
}

module.exports = new ExportService();