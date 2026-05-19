const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Escort = require('../src/models/Escort');
const ImportError = require('../src/models/ImportError');

const RESULTS = {
  success: 0,
  failed: 0,
  errors: []
};

function validateEscort(escort, index) {
  const errors = [];
  const suggestions = [];

  if (!escort.employee_id || escort.employee_id.trim() === '') {
    errors.push('员工工号不能为空');
    suggestions.push('请填写employee_id字段');
  }

  if (!escort.name || escort.name.trim() === '') {
    errors.push('姓名不能为空');
    suggestions.push('请填写name字段');
  }

  if (escort.schedules && !Array.isArray(escort.schedules)) {
    errors.push('schedules必须是数组格式');
    suggestions.push('schedules字段应为数组，每个元素包含date和shift_type');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.join('; '),
    suggestions: suggestions.join('; ')
  };
}

function validateSchedule(schedule, escortName) {
  const errors = [];
  const suggestions = [];

  if (!schedule.date || schedule.date.trim() === '') {
    errors.push('日期不能为空');
    suggestions.push('请填写date字段，格式如：2024-01-01');
  } else {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(schedule.date)) {
      errors.push(`日期格式错误: ${schedule.date}`);
      suggestions.push('请使用YYYY-MM-DD格式，如：2024-01-01');
    } else if (!moment(schedule.date, 'YYYY-MM-DD', true).isValid()) {
      errors.push(`日期无效: ${schedule.date}`);
      suggestions.push('请检查日期是否有效');
    }
  }

  if (!schedule.shift_type || schedule.shift_type.trim() === '') {
    errors.push('班次类型不能为空');
    suggestions.push('请填写shift_type字段，如：早班、中班、晚班');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.join('; '),
    suggestions: suggestions.join('; ')
  };
}

async function importSchedule(filePath) {
  console.log('开始导入陪检员班表...');
  console.log(`文件路径: ${filePath}`);
  console.log('='.repeat(50));

  await ImportError.clear('schedule');

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let data;
    
    try {
      data = JSON.parse(content);
    } catch (jsonErr) {
      console.error('JSON格式解析失败:', jsonErr.message);
      await ImportError.create({
        import_type: 'schedule',
        file_name: path.basename(filePath),
        row_number: null,
        original_data: content.substring(0, 500),
        error_message: 'JSON格式错误: ' + jsonErr.message,
        suggestion: '请检查JSON文件格式是否正确，使用在线JSON校验工具验证'
      });
      process.exit(1);
    }

    if (!Array.isArray(data)) {
      console.error('JSON根节点必须是数组');
      await ImportError.create({
        import_type: 'schedule',
        file_name: path.basename(filePath),
        row_number: null,
        original_data: JSON.stringify(data).substring(0, 500),
        error_message: 'JSON根节点必须是数组',
        suggestion: '请确保JSON文件根节点是数组格式，包含陪检员对象'
      });
      process.exit(1);
    }

    console.log(`共读取 ${data.length} 名陪检员数据`);
    console.log('');

    for (let i = 0; i < data.length; i++) {
      const escort = data[i];
      const itemNumber = i + 1;
      
      const escortValidation = validateEscort(escort, itemNumber);
      
      if (!escortValidation.isValid) {
        RESULTS.failed++;
        await ImportError.create({
          import_type: 'schedule',
          file_name: path.basename(filePath),
          row_number: itemNumber,
          original_data: JSON.stringify(escort),
          error_message: escortValidation.errors,
          suggestion: escortValidation.suggestions
        });
        console.log(`❌ 第${itemNumber}项失败: ${escortValidation.errors}`);
        continue;
      }

      try {
        let existingEscort = await Escort.findByEmployeeId(escort.employee_id.trim());
        
        if (!existingEscort) {
          existingEscort = await Escort.create({
            employee_id: escort.employee_id.trim(),
            name: escort.name.trim(),
            phone: escort.phone ? escort.phone.trim() : null,
            department: escort.department ? escort.department.trim() : null
          });
          console.log(`  新建陪检员: ${escort.name} (${escort.employee_id})`);
        } else {
          console.log(`  已存在陪检员: ${escort.name} (${escort.employee_id})`);
        }

        let scheduleSuccess = 0;
        let scheduleFailed = 0;

        if (escort.schedules && Array.isArray(escort.schedules)) {
          for (let j = 0; j < escort.schedules.length; j++) {
            const schedule = escort.schedules[j];
            const scheduleValidation = validateSchedule(schedule, escort.name);
            
            if (!scheduleValidation.isValid) {
              scheduleFailed++;
              RESULTS.failed++;
              await ImportError.create({
                import_type: 'schedule',
                file_name: path.basename(filePath),
                row_number: itemNumber,
                original_data: JSON.stringify(schedule),
                error_message: `${escort.name} - ${scheduleValidation.errors}`,
                suggestion: scheduleValidation.suggestions
              });
              console.log(`    ❌ 班次${j + 1}失败: ${scheduleValidation.errors}`);
              continue;
            }

            await Escort.addSchedule(
              existingEscort.id,
              schedule.date.trim(),
              schedule.shift_type.trim(),
              schedule.start_time ? schedule.start_time.trim() : null,
              schedule.end_time ? schedule.end_time.trim() : null
            );
            scheduleSuccess++;
            RESULTS.success++;
          }
        }

        console.log(`✅ 第${itemNumber}项成功: ${escort.name} - 班表${scheduleSuccess}条${scheduleFailed > 0 ? `，失败${scheduleFailed}条` : ''}`);
      } catch (err) {
        RESULTS.failed++;
        await ImportError.create({
          import_type: 'schedule',
          file_name: path.basename(filePath),
          row_number: itemNumber,
          original_data: JSON.stringify(escort),
          error_message: err.message,
          suggestion: '请检查数据格式是否正确'
        });
        console.log(`❌ 第${itemNumber}项失败: ${err.message}`);
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

    return RESULTS;
  } catch (err) {
    console.error('导入失败:', err.message);
    throw err;
  }
}

if (require.main === module) {
  const filePath = process.argv[2] || path.join(__dirname, '../data/schedule.json');
  
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    console.log('请提供正确的JSON文件路径，例如:');
    console.log('  npm run import-schedule ./data/schedule.json');
    process.exit(1);
  }

  importSchedule(filePath)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('导入失败:', err);
      process.exit(1);
    });
}

module.exports = importSchedule;
