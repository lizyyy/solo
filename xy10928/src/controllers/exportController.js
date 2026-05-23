const { all, get } = require('../config/database');
const { logException } = require('../utils/exceptionLogger');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

function ensureExportDir() {
  const exportDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  return exportDir;
}

async function exportRetentionReport(req, res) {
  try {
    const { retention_level, status, format = 'json' } = req.query;
    
    let query = `
      SELECT 
        p.id, p.tracking_number, p.courier_company, p.status, p.storage_location,
        p.in_time, p.reminder_count, p.retention_level,
        r.name as recipient_name, r.phone as recipient_phone
      FROM packages p
      JOIN recipients r ON p.recipient_id = r.id
      WHERE 1=1
    `;
    const params = [];
    
    if (retention_level) {
      query += ' AND p.retention_level = ?';
      params.push(retention_level);
    }
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY p.in_time ASC';
    
    const packages = await all(query, params);
    
    const data = packages.map(pkg => ({
      ...pkg,
      retention_hours: moment().diff(moment(pkg.in_time), 'hours'),
      export_time: moment().format('YYYY-MM-DD HH:mm:ss')
    }));
    
    if (format === 'csv') {
      const exportDir = ensureExportDir();
      const filename = `retention_report_${moment().format('YYYYMMDD_HHmmss')}.csv`;
      const filePath = path.join(exportDir, filename);
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'tracking_number', title: '运单号' },
          { id: 'courier_company', title: '快递公司' },
          { id: 'status', title: '状态' },
          { id: 'storage_location', title: '存放位置' },
          { id: 'in_time', title: '入库时间' },
          { id: 'retention_hours', title: '滞留时长(小时)' },
          { id: 'reminder_count', title: '催取次数' },
          { id: 'retention_level', title: '滞留等级' },
          { id: 'recipient_name', title: '收件人' },
          { id: 'recipient_phone', title: '联系电话' }
        ]
      });
      
      await csvWriter.writeRecords(data);
      
      res.json({
        success: true,
        format: 'csv',
        filename,
        filepath: filePath,
        record_count: data.length,
        download_url: `/exports/${filename}`
      });
    } else {
      res.json({
        success: true,
        format: 'json',
        export_time: moment().format('YYYY-MM-DD HH:mm:ss'),
        record_count: data.length,
        data
      });
    }
  } catch (error) {
    await logException('/api/export/retention', 'GET', req.query, error.name, error.message);
    res.status(500).json({ error: '导出滞留报告失败', detail: error.message });
  }
}

async function exportExceptionLog(req, res) {
  try {
    const { resolved, format = 'json' } = req.query;
    
    let query = 'SELECT * FROM exception_logs WHERE 1=1';
    const params = [];
    
    if (resolved !== undefined) {
      query += ' AND is_resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY occurred_at DESC';
    
    const logs = await all(query, params);
    
    if (format === 'csv') {
      const exportDir = ensureExportDir();
      const filename = `exception_log_${moment().format('YYYYMMDD_HHmmss')}.csv`;
      const filePath = path.join(exportDir, filename);
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'api_path', title: 'API路径' },
          { id: 'request_method', title: '请求方法' },
          { id: 'raw_input', title: '原始输入' },
          { id: 'error_type', title: '错误类型' },
          { id: 'error_message', title: '错误信息' },
          { id: 'processing_conclusion', title: '处理结论' },
          { id: 'occurred_at', title: '发生时间' },
          { id: 'handled_by', title: '处理人' },
          { id: 'is_resolved', title: '是否已解决' }
        ]
      });
      
      await csvWriter.writeRecords(logs);
      
      res.json({
        success: true,
        format: 'csv',
        filename,
        filepath: filePath,
        record_count: logs.length
      });
    } else {
      res.json({
        success: true,
        format: 'json',
        export_time: moment().format('YYYY-MM-DD HH:mm:ss'),
        record_count: logs.length,
        data: logs
      });
    }
  } catch (error) {
    await logException('/api/export/exceptions', 'GET', req.query, error.name, error.message);
    res.status(500).json({ error: '导出异常日志失败', detail: error.message });
  }
}

function getExportFiles(req, res) {
  try {
    const exportDir = ensureExportDir();
    const files = fs.readdirSync(exportDir)
      .filter(f => f.endsWith('.csv'))
      .map(f => {
        const stat = fs.statSync(path.join(exportDir, f));
        return {
          filename: f,
          size: stat.size,
          created_at: stat.birthtime
        };
      });
    
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: '获取导出文件列表失败', detail: error.message });
  }
}

module.exports = {
  exportRetentionReport,
  exportExceptionLog,
  getExportFiles
};
