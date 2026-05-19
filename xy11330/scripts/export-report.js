const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const db = require('../src/config/database');

async function exportReport(filters = {}, outputPath = null) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        t.id,
        t.task_no,
        t.status,
        t.escort_id,
        e.name as escort_name,
        e.employee_id,
        a.patient_name,
        a.patient_id,
        a.department,
        a.exam_type,
        a.appointment_date,
        a.appointment_time,
        t.is_inserted,
        t.inserted_by,
        t.inserted_at,
        t.is_overdue,
        t.overdue_reason,
        t.cancel_reason,
        t.estimated_duration,
        t.actual_duration,
        t.waiting_time,
        t.created_by,
        t.created_at,
        t.assigned_at,
        t.accepted_at,
        t.started_at,
        t.completed_at,
        t.cancelled_at
      FROM tasks t
      LEFT JOIN escorts e ON t.escort_id = e.id
      JOIN appointments a ON t.appointment_id = a.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.escort_id) {
      query += ' AND t.escort_id = ?';
      params.push(filters.escort_id);
    }
    
    if (filters.status) {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }
    
    if (filters.start_date) {
      query += ' AND DATE(t.created_at) >= ?';
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      query += ' AND DATE(t.created_at) <= ?';
      params.push(filters.end_date);
    }
    
    if (filters.is_overdue === 'true' || filters.is_overdue === true) {
      query += ' AND t.is_overdue = 1';
    } else if (filters.is_overdue === 'false' || filters.is_overdue === false) {
      query += ' AND t.is_overdue = 0';
    }
    
    if (filters.is_inserted === 'true' || filters.is_inserted === true) {
      query += ' AND t.is_inserted = 1';
    } else if (filters.is_inserted === 'false' || filters.is_inserted === false) {
      query += ' AND t.is_inserted = 0';
    }
    
    if (filters.department) {
      query += ' AND a.department = ?';
      params.push(filters.department);
    }
    
    query += ' ORDER BY t.created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      
      if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        outputPath = path.join(__dirname, `../data/report_${timestamp}.csv`);
      }
      
      try {
        const fields = [
          'id', 'task_no', 'status', 'escort_id', 'escort_name', 'employee_id',
          'patient_name', 'patient_id', 'department', 'exam_type',
          'appointment_date', 'appointment_time',
          'is_inserted', 'inserted_by', 'inserted_at',
          'is_overdue', 'overdue_reason', 'cancel_reason',
          'estimated_duration', 'actual_duration', 'waiting_time',
          'created_by', 'created_at', 'assigned_at', 'accepted_at',
          'started_at', 'completed_at', 'cancelled_at'
        ];
        
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(rows);
        
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, csv, 'utf-8');
        
        resolve({
          success: true,
          total: rows.length,
          outputPath: outputPath,
          data: rows
        });
      } catch (csvErr) {
        reject(csvErr);
      }
    });
  });
}

if (require.main === module) {
  const filters = {};
  
  process.argv.forEach((arg, index) => {
    if (arg.startsWith('--escort=')) {
      filters.escort_id = arg.split('=')[1];
    } else if (arg.startsWith('--status=')) {
      filters.status = arg.split('=')[1];
    } else if (arg.startsWith('--start-date=')) {
      filters.start_date = arg.split('=')[1];
    } else if (arg.startsWith('--end-date=')) {
      filters.end_date = arg.split('=')[1];
    } else if (arg.startsWith('--overdue=')) {
      filters.is_overdue = arg.split('=')[1] === 'true';
    } else if (arg.startsWith('--inserted=')) {
      filters.is_inserted = arg.split('=')[1] === 'true';
    } else if (arg.startsWith('--department=')) {
      filters.department = arg.split('=')[1];
    }
  });
  
  const outputArg = process.argv.find(arg => arg.startsWith('--output='));
  const outputPath = outputArg ? outputArg.split('=')[1] : null;
  
  console.log('开始导出报表...');
  console.log('筛选条件:', JSON.stringify(filters, null, 2));
  
  exportReport(filters, outputPath)
    .then(result => {
      console.log('');
      console.log('='.repeat(50));
      console.log('导出成功!');
      console.log(`记录数: ${result.total}`);
      console.log(`输出文件: ${result.outputPath}`);
      console.log('='.repeat(50));
      process.exit(0);
    })
    .catch(err => {
      console.error('导出失败:', err);
      process.exit(1);
    });
}

module.exports = exportReport;
