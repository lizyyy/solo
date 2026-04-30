const Papa = require('papaparse');
const RecordModel = require('../models/recordModel');

const csvController = {
  export: function(req, res) {
    RecordModel.getAllForExport((err, records) => {
      if (err) {
        return res.status(500).json({ error: '导出失败', details: err.message });
      }

      const csvData = records.map(r => ({
        'ID': r.id,
        '房号': r.room_number,
        '住户姓名': r.resident_name,
        '手机号': r.phone,
        '寄存物类型': r.storage_type,
        '领取人': r.receiver_name || '',
        '有效期开始': r.valid_from,
        '有效期结束': r.valid_to,
        '备注': r.remarks || '',
        '状态': r.status,
        '创建时间': r.created_at,
        '更新时间': r.updated_at,
        '领取时间': r.received_at || '',
        '领取操作人': r.received_by || ''
      }));

      const csv = Papa.unparse(csvData);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=storage_records_' + 
        new Date().toISOString().split('T')[0] + '.csv');
      
      res.write('\uFEFF');
      res.send(csv);
    });
  },

  import: function(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }

    const fileContent = req.file.buffer.toString('utf8');

    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        const mappedRecords = results.data.map(row => ({
          room_number: row['房号'] || row['room_number'],
          resident_name: row['住户姓名'] || row['resident_name'],
          phone: row['手机号'] || row['phone'],
          storage_type: row['寄存物类型'] || row['storage_type'],
          receiver_name: row['领取人'] || row['receiver_name'],
          valid_from: row['有效期开始'] || row['valid_from'],
          valid_to: row['有效期结束'] || row['valid_to'],
          remarks: row['备注'] || row['remarks']
        }));

        const validRecords = mappedRecords.filter(r => 
          r.room_number || r.resident_name || r.phone
        );

        if (validRecords.length === 0) {
          return res.status(400).json({ 
            error: '未识别到有效数据，请检查 CSV 表头格式' 
          });
        }

        RecordModel.batchCreate(validRecords, (err, result) => {
          if (err) {
            return res.status(500).json({ error: '批量导入失败', details: err.message });
          }
          
          res.json({
            success: true,
            summary: {
              total: validRecords.length,
              success: result.success,
              skipped: result.skipped,
              failed: result.failed
            },
            details: result.details
          });
        });
      },
      error: function(err) {
        return res.status(500).json({ error: '解析 CSV 失败', details: err.message });
      }
    });
  }
};

module.exports = csvController;
