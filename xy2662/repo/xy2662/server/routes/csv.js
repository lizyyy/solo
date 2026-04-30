const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const { Readable } = require('stream');
const { all, run, get, checkTimeConflict, addAuditLog } = require('../database');

const upload = multer({ storage: multer.memoryStorage() });

const STATUS_MAP = {
  'pending': '待收取',
  'deposited': '已收取',
  'verified': '已核销',
  'refunded': '已退款'
};

const ACTION_MAP = {
  'create': '新建',
  'update': '编辑',
  'deposit': '收取押金',
  'verify': '核销',
  'refund': '退款',
  'delete': '删除',
  'status_change': '状态变更'
};

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }

    const results = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const imported = [];
        const errors = [];
        const skipped = [];

        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          const rowNum = i + 2;

          try {
            const customerName = row.customer_name || row['客户姓名'] || row.name;
            const phone = row.phone || row['联系电话'] || row.telephone;
            const studio = row.studio || row['棚位'] || row.room;
            let bookingDate = row.booking_date || row['预约日期'] || row.date;
            let startTime = row.start_time || row['开始时间'] || row.start;
            let endTime = row.end_time || row['结束时间'] || row.end;
            let depositAmount = parseFloat(row.deposit_amount || row['押金金额'] || row.amount || 0);
            let status = (row.status || row['状态'] || 'pending').toLowerCase().trim();

            if (!['pending', 'deposited', 'verified', 'refunded'].includes(status)) {
              status = 'pending';
            }

            if (!customerName || !phone || !studio || !bookingDate || !startTime || !endTime) {
              errors.push({
                row: rowNum,
                error: '缺少必要字段',
                fields: {
                  customer_name: customerName,
                  phone,
                  studio,
                  booking_date: bookingDate,
                  start_time: startTime,
                  end_time: endTime
                }
              });
              continue;
            }

            bookingDate = formatDate(bookingDate);
            startTime = formatTime(startTime);
            endTime = formatTime(endTime);

            if (!bookingDate || !startTime || !endTime) {
              errors.push({
                row: rowNum,
                error: '日期或时间格式无效',
                values: { bookingDate, startTime, endTime }
              });
              continue;
            }

            if (startTime >= endTime) {
              errors.push({
                row: rowNum,
                error: '开始时间必须早于结束时间',
                values: { startTime, endTime }
              });
              continue;
            }

            const conflict = await checkTimeConflict(studio, bookingDate, startTime, endTime);
            if (conflict.conflict) {
              skipped.push({
                row: rowNum,
                customerName,
                reason: '时间冲突',
                conflictWith: conflict.existingBooking.customer_name
              });
              continue;
            }

            const result = await run(`
              INSERT INTO bookings (
                customer_name, phone, studio, booking_date,
                start_time, end_time, deposit_amount, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [customerName, phone, studio, bookingDate, startTime, endTime, depositAmount, status]);

            await addAuditLog(
              result.lastID,
              'create',
              null,
              status,
              `CSV 导入 - 客户: ${customerName}, 棚位: ${studio}`
            );

            imported.push({
              row: rowNum,
              id: result.lastID,
              customerName,
              studio,
              bookingDate,
              status
            });

          } catch (err) {
            errors.push({
              row: rowNum,
              error: err.message
            });
          }
        }

        res.json({
          message: '导入完成',
          summary: {
            total: results.length,
            imported: imported.length,
            skipped: skipped.length,
            errors: errors.length
          },
          imported,
          skipped,
          errors
        });
      });

  } catch (error) {
    console.error('CSV 导入失败:', error);
    res.status(500).json({ error: 'CSV 导入失败' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const bookings = await all(`
      SELECT * FROM bookings 
      WHERE booking_date = ? 
      ORDER BY studio, start_time
    `, [targetDate]);

    const todayAuditLogs = await all(`
      SELECT a.*, b.customer_name, b.studio
      FROM audit_logs a
      LEFT JOIN bookings b ON a.booking_id = b.id
      WHERE date(a.created_at) = ?
      ORDER BY a.created_at
    `, [targetDate]);

    const depositStats = {
      totalBookings: bookings.length,
      pendingDeposit: bookings.filter(b => b.status === 'pending').length,
      deposited: bookings.filter(b => b.status === 'deposited').length,
      verified: bookings.filter(b => b.status === 'verified').length,
      refunded: bookings.filter(b => b.status === 'refunded').length,
      totalAmount: bookings.reduce((sum, b) => sum + (b.deposit_amount || 0), 0),
      verifiedAmount: bookings.filter(b => b.status === 'verified').reduce((sum, b) => sum + (b.deposit_amount || 0), 0),
      refundedAmount: bookings.filter(b => b.status === 'refunded').reduce((sum, b) => sum + (b.deposit_amount || 0), 0)
    };

    const bookingData = bookings.map(b => ({
      '预约编号': b.id,
      '客户姓名': b.customer_name,
      '联系电话': b.phone,
      '棚位': b.studio,
      '预约日期': b.booking_date,
      '开始时间': b.start_time,
      '结束时间': b.end_time,
      '押金金额': b.deposit_amount,
      '状态': STATUS_MAP[b.status] || b.status,
      '备注': b.note || ''
    }));

    const auditData = todayAuditLogs.map(log => ({
      '操作时间': log.created_at,
      '操作类型': ACTION_MAP[log.action] || log.action,
      '预约编号': log.booking_id,
      '客户姓名': log.customer_name || '',
      '棚位': log.studio || '',
      '原状态': log.from_status ? (STATUS_MAP[log.from_status] || log.from_status) : '',
      '新状态': log.to_status ? (STATUS_MAP[log.to_status] || log.to_status) : '',
      '操作备注': log.note || ''
    }));

    res.json({
      date: targetDate,
      statistics: depositStats,
      bookings: bookingData,
      auditLogs: auditData
    });

  } catch (error) {
    console.error('导出报表失败:', error);
    res.status(500).json({ error: '导出报表失败' });
  }
});

router.get('/download', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const bookings = await all(`
      SELECT * FROM bookings 
      WHERE booking_date = ? 
      ORDER BY studio, start_time
    `, [targetDate]);

    const todayAuditLogs = await all(`
      SELECT a.*, b.customer_name, b.studio
      FROM audit_logs a
      LEFT JOIN bookings b ON a.booking_id = b.id
      WHERE date(a.created_at) = ?
      ORDER BY a.created_at
    `, [targetDate]);

    const bookingData = bookings.map(b => ({
      '预约编号': b.id,
      '客户姓名': b.customer_name,
      '联系电话': b.phone,
      '棚位': b.studio,
      '预约日期': b.booking_date,
      '开始时间': b.start_time,
      '结束时间': b.end_time,
      '押金金额': b.deposit_amount,
      '状态': STATUS_MAP[b.status] || b.status,
      '备注': b.note || ''
    }));

    const auditData = todayAuditLogs.map(log => ({
      '操作时间': log.created_at,
      '操作类型': ACTION_MAP[log.action] || log.action,
      '预约编号': log.booking_id,
      '客户姓名': log.customer_name || '',
      '棚位': log.studio || '',
      '原状态': log.from_status ? (STATUS_MAP[log.from_status] || log.from_status) : '',
      '新状态': log.to_status ? (STATUS_MAP[log.to_status] || log.to_status) : '',
      '操作备注': log.note || ''
    }));

    let csvContent = '';
    
    if (bookingData.length > 0) {
      const bookingFields = Object.keys(bookingData[0]);
      csvContent += '=== 当日预约列表 ===\n';
      csvContent += bookingFields.join(',') + '\n';
      bookingData.forEach(row => {
        csvContent += bookingFields.map(f => {
          const val = row[f] !== undefined && row[f] !== null ? String(row[f]) : '';
          return val.includes(',') || val.includes('"') || val.includes('\n') 
            ? `"${val.replace(/"/g, '""')}"` 
            : val;
        }).join(',') + '\n';
      });
      csvContent += '\n';
    }

    if (auditData.length > 0) {
      const auditFields = Object.keys(auditData[0]);
      csvContent += '=== 当日操作流水 ===\n';
      csvContent += auditFields.join(',') + '\n';
      auditData.forEach(row => {
        csvContent += auditFields.map(f => {
          const val = row[f] !== undefined && row[f] !== null ? String(row[f]) : '';
          return val.includes(',') || val.includes('"') || val.includes('\n') 
            ? `"${val.replace(/"/g, '""')}"` 
            : val;
        }).join(',') + '\n';
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=booking_report_${targetDate}.csv`);
    res.send('\uFEFF' + csvContent);

  } catch (error) {
    console.error('下载报表失败:', error);
    res.status(500).json({ error: '下载报表失败' });
  }
});

function formatDate(dateStr) {
  if (!dateStr) return null;
  
  dateStr = String(dateStr).trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
    return dateStr.replace(/\//g, '-');
  }
  
  if (/^\d{4}\d{2}\d{2}$/.test(dateStr)) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return null;
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  
  timeStr = String(timeStr).trim();
  
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }
  
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr.substring(0, 5);
  }
  
  if (/^\d{1,2}[:：]\d{2}$/.test(timeStr)) {
    const parts = timeStr.split(/[:：]/);
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  
  return null;
}

module.exports = router;
