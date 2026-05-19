const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const moment = require('moment');
const Appointment = require('../src/models/Appointment');
const Task = require('../src/models/Task');
const ImportError = require('../src/models/ImportError');

const RESULTS = {
  success: 0,
  failed: 0,
  errors: []
};

function validateRow(row, rowNumber) {
  const errors = [];
  const suggestions = [];

  if (!row.appointment_no || row.appointment_no.trim() === '') {
    errors.push('预约单号不能为空');
    suggestions.push('请填写appointment_no列，格式如：A20240101001');
  }

  if (!row.patient_name || row.patient_name.trim() === '') {
    errors.push('患者姓名不能为空');
    suggestions.push('请填写patient_name列');
  }

  if (!row.appointment_date || row.appointment_date.trim() === '') {
    errors.push('预约日期不能为空');
    suggestions.push('请填写appointment_date列，格式如：2024-01-01');
  } else {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(row.appointment_date)) {
      errors.push(`预约日期格式错误: ${row.appointment_date}`);
      suggestions.push('请使用YYYY-MM-DD格式，如：2024-01-01');
    } else if (!moment(row.appointment_date, 'YYYY-MM-DD', true).isValid()) {
      errors.push(`预约日期无效: ${row.appointment_date}`);
      suggestions.push('请检查日期是否有效');
    }
  }

  if (!row.appointment_time || row.appointment_time.trim() === '') {
    errors.push('预约时间不能为空');
    suggestions.push('请填写appointment_time列，格式如：09:00');
  } else {
    const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;
    if (!timePattern.test(row.appointment_time)) {
      errors.push(`预约时间格式错误: ${row.appointment_time}`);
      suggestions.push('请使用HH:MM格式，如：09:00');
    }
  }

  if (row.priority && !/^\d+$/.test(row.priority)) {
    errors.push(`优先级必须是数字: ${row.priority}`);
    suggestions.push('优先级请填写0-9的数字，数字越大优先级越高');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.join('; '),
    suggestions: suggestions.join('; ')
  };
}

async function importAppointments(filePath) {
  console.log('开始导入预约单...');
  console.log(`文件路径: ${filePath}`);
  console.log('='.repeat(50));

  await ImportError.clear('appointment');

  const rows = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', async () => {
        console.log(`共读取 ${rows.length} 条数据`);
        console.log('');

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNumber = i + 2;
          
          const validation = validateRow(row, rowNumber);
          
          if (!validation.isValid) {
            RESULTS.failed++;
            await ImportError.create({
              import_type: 'appointment',
              file_name: path.basename(filePath),
              row_number: rowNumber,
              original_data: JSON.stringify(row),
              error_message: validation.errors,
              suggestion: validation.suggestions
            });
            console.log(`❌ 第${rowNumber}行失败: ${validation.errors}`);
            continue;
          }

          try {
            const existing = await Appointment.findByAppointmentNo(row.appointment_no.trim());
            
            if (existing) {
              RESULTS.failed++;
              await ImportError.create({
                import_type: 'appointment',
                file_name: path.basename(filePath),
                row_number: rowNumber,
                original_data: JSON.stringify(row),
                error_message: `预约单号已存在: ${row.appointment_no}`,
                suggestion: '请检查预约单号是否重复，或使用新的预约单号'
              });
              console.log(`❌ 第${rowNumber}行失败: 预约单号已存在`);
              continue;
            }

            const appointmentData = {
              appointment_no: row.appointment_no.trim(),
              patient_name: row.patient_name.trim(),
              patient_id: row.patient_id ? row.patient_id.trim() : null,
              phone: row.phone ? row.phone.trim() : null,
              department: row.department ? row.department.trim() : null,
              exam_type: row.exam_type ? row.exam_type.trim() : null,
              appointment_date: row.appointment_date.trim(),
              appointment_time: row.appointment_time.trim().substring(0, 5),
              priority: row.priority ? parseInt(row.priority) : 0,
              notes: row.notes ? row.notes.trim() : null
            };

            const appointment = await Appointment.create(appointmentData);
            await Task.create(appointment.id, 'import');
            
            RESULTS.success++;
            console.log(`✅ 第${rowNumber}行成功: ${appointmentData.appointment_no} - ${appointmentData.patient_name}`);
          } catch (err) {
            RESULTS.failed++;
            await ImportError.create({
              import_type: 'appointment',
              file_name: path.basename(filePath),
              row_number: rowNumber,
              original_data: JSON.stringify(row),
              error_message: err.message,
              suggestion: '请检查数据格式是否正确'
            });
            console.log(`❌ 第${rowNumber}行失败: ${err.message}`);
          }
        }

        console.log('');
        console.log('='.repeat(50));
        console.log('导入完成!');
        console.log(`成功: ${RESULTS.success} 条`);
        console.log(`失败: ${RESULTS.failed} 条`);
        
        if (RESULTS.failed > 0) {
          console.log('');
          console.log('失败记录已保存到 import_errors 表中');
          console.log('可查询失败原因并进行修正后重新导入');
        }

        resolve(RESULTS);
      })
      .on('error', (err) => {
        console.error('读取CSV文件失败:', err.message);
        reject(err);
      });
  });
}

if (require.main === module) {
  const filePath = process.argv[2] || path.join(__dirname, '../data/appointments.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    console.log('请提供正确的CSV文件路径，例如:');
    console.log('  npm run import-appointments ./data/appointments.csv');
    process.exit(1);
  }

  importAppointments(filePath)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('导入失败:', err);
      process.exit(1);
    });
}

module.exports = importAppointments;
