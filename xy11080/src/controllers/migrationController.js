const db = require('../database/init');
const { calculateMigrationSummary } = require('../utils/calculator');
const { STANDARD_TEMPS } = require('../utils/constants');

function insertHistoricalRecord(oldData) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO historical_records_v1 (old_system_id, pool_name, record_date, water_temp, status, remark) VALUES (?, ?, ?, ?, ?, ?)',
      [oldData.old_system_id, oldData.pool_name, oldData.record_date, oldData.water_temp, oldData.status, oldData.remark || ''],
      function(err) {
        if (err) reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function insertMigratedRecord(data, operator) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    const standardTemp = STANDARD_TEMPS[data.pool_type || '亲子池'] || { min: 31, max: 33 };
    const isTempCompliant = data.water_temp >= standardTemp.min && data.water_temp <= standardTemp.max ? 1 : 0;
    
    const statusMap = {
      '待处理': 'pending',
      '已处理': 'completed',
      '已取消': 'cancelled',
      '待审核': 'pending',
      '待人工处理': 'manual_review'
    };
    
    const status = statusMap[data.status] || 'pending';

    db.run(
      `INSERT INTO water_temp_records (
        record_no, pool_name, pool_no, pool_type, record_date, time_slot,
        time_slot_start, time_slot_end, standard_temp_min, standard_temp_max,
        actual_temp, measure_time, measure_person, is_temp_compliant, affected_periods,
        course_id, course_name, coach_name, registered_count, attended_count,
        need_compensation, compensation_type, compensation_amount, compensation_quantity,
        compensation_table_version, is_compensation_consistent, status, manual_remark,
        import_operator, import_time, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `MIG_${data.old_system_id || Date.now()}`,
        data.pool_name || '迁移数据',
        data.pool_no || 'POOL_001',
        data.pool_type || '亲子池',
        data.record_date || new Date().toISOString().slice(0, 10),
        data.time_slot || '上午',
        '09:00',
        '12:00',
        standardTemp.min,
        standardTemp.max,
        data.water_temp || 32,
        data.measure_time || '09:30',
        data.measure_person || '系统迁移',
        isTempCompliant,
        data.affected_periods || '',
        '', '', '', 0, 0, 0, '', 0, 0, '', 1,
        status,
        data.remark || '历史数据迁移',
        operator || 'migration_system',
        now, now, now
      ],
      function(err) {
        if (err) reject(err);
        resolve(this.lastID);
      }
    );
  });
}

async function migrateHistoricalData(req, res) {
  const { records, operator } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      success: false,
      message: '请提供要迁移的记录数组'
    });
  }

  const migrationResults = [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const oldRecord = records[i];
    try {
      await insertHistoricalRecord(oldRecord);
      const newId = await insertMigratedRecord(oldRecord, operator);
      successCount++;
      migrationResults.push({
        old_id: oldRecord.old_system_id,
        new_id: newId,
        status: 'success'
      });
    } catch (err) {
      failedCount++;
      migrationResults.push({
        old_id: oldRecord.old_system_id,
        status: 'failed',
        error: err.message
      });
    }
  }

  db.all('SELECT * FROM water_temp_records WHERE record_no LIKE ?', ['MIG_%'], (err, newRecords) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const summary = calculateMigrationSummary(records, newRecords);

    res.json({
      success: true,
      message: `迁移完成：成功 ${successCount} 条，失败 ${failedCount} 条`,
      summary: {
        ...summary,
        successCount,
        failedCount
      },
      results: migrationResults
    });
  });
}

function getMigrationRecords(req, res) {
  db.all('SELECT * FROM historical_records_v1 ORDER BY migrated_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: rows });
  });
}

function getMigrationComparison(req, res) {
  const { old_system_id } = req.params;

  db.get('SELECT * FROM historical_records_v1 WHERE old_system_id = ?', [old_system_id], (err, oldRecord) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!oldRecord) {
      return res.status(404).json({ success: false, message: '历史记录不存在' });
    }

    db.get('SELECT * FROM water_temp_records WHERE record_no = ?', [`MIG_${old_system_id}`], (err, newRecord) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: {
          old_record: oldRecord,
          new_record: newRecord,
          field_mapping: {
            'old_system_id': '旧系统ID → 记录编号前缀',
            'pool_name': '游泳馆名称 → 直接映射',
            'record_date': '记录日期 → 直接映射',
            'water_temp': '水温 → actual_temp',
            'status': '状态 → 映射到新系统状态码',
            'remark': '备注 → manual_remark'
          }
        }
      });
    });
  });
}

module.exports = {
  migrateHistoricalData,
  getMigrationRecords,
  getMigrationComparison
};