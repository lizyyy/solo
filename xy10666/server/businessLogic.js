const db = require('./database');

function saveChangeHistory(entityType, entityId, fieldName, oldValue, newValue, changedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO change_history (entity_type, entity_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)',
      [entityType, entityId, fieldName, String(oldValue), String(newValue), changedBy],
      function(err) {
        if (err) {
          console.error('保存变更历史失败:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function saveFlowRecord(flowType, relatedId, action, operator, remarks) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO flow_records (flow_type, related_id, action, operator, remarks) VALUES (?, ?, ?, ?, ?)',
      [flowType, relatedId, action, operator, remarks],
      function(err) {
        if (err) {
          console.error('保存流转记录失败:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function checkBusinessRules(type, data) {
  return new Promise((resolve, reject) => {
    switch (type) {
      case 'maintenance':
        checkMaintenanceRules(data, resolve, reject);
        break;
      case 'production':
        checkProductionRules(data, resolve, reject);
        break;
      default:
        resolve({ passed: true });
    }
  });
}

function checkMaintenanceRules(data, resolve, reject) {
  const { mold_id, end_stroke } = data;

  db.get('SELECT * FROM maintenance_records WHERE mold_id = ? AND end_stroke = ?', [mold_id, end_stroke], (err, record) => {
    if (err) {
      reject({ passed: false, message: '数据库查询错误', details: err.message });
      return;
    }

    if (record) {
      resolve({ passed: false, message: '重复提交：该冲次范围的保养记录已存在', details: { record_id: record.id } });
      return;
    }

    db.get('SELECT * FROM maintenance_records WHERE mold_id = ? AND end_stroke >= ? ORDER BY end_stroke DESC LIMIT 1', [mold_id, end_stroke], (err2, prevRecord) => {
      if (err2) {
        reject({ passed: false, message: '数据库查询错误', details: err2.message });
        return;
      }

      if (prevRecord) {
        db.run(
          'INSERT INTO exceptions (mold_id, exception_type, severity, description) VALUES (?, ?, ?, ?)',
          [mold_id, 'maintenance_overlap', 'warning', `保养记录冲次重叠：新记录冲次 ${end_stroke} 与已有记录 ${prevRecord.id} 重叠`],
          (err3) => {
            if (err3) console.error('创建异常记录失败:', err3);
          }
        );
      }

      resolve({ passed: true });
    });
  });
}

function checkProductionRules(data, resolve, reject) {
  const { mold_id, task_code, start_stroke, end_stroke } = data;

  db.get('SELECT * FROM production_tasks WHERE task_code = ?', [task_code], (err, task) => {
    if (err) {
      reject({ passed: false, message: '数据库查询错误', details: err.message });
      return;
    }

    if (task) {
      resolve({ passed: false, message: '重复提交：该任务编号已存在', details: { task_id: task.id } });
      return;
    }

    db.get('SELECT * FROM maintenance_plans WHERE mold_id = ? AND status = "active"', [mold_id], (err2, plan) => {
      if (err2) {
        reject({ passed: false, message: '数据库查询错误', details: err2.message });
        return;
      }

      if (plan && start_stroke >= plan.next_maintenance_stroke) {
        db.run(
          'INSERT INTO exceptions (mold_id, exception_type, severity, description) VALUES (?, ?, ?, ?)',
          [mold_id, 'needs_maintenance', 'error', `排产任务触发保养拦截：当前冲次 ${start_stroke} 已达到保养触发点 ${plan.next_maintenance_stroke}`],
          (err3) => {
            if (err3) console.error('创建异常记录失败:', err3);
          }
        );
        resolve({ 
          passed: false, 
          message: '保养拦截：该模具需要先进行保养才能排产', 
          details: { 
            current_stroke: start_stroke, 
            next_maintenance: plan.next_maintenance_stroke,
            plan_type: plan.plan_type
          } 
        });
        return;
      }

      if (plan && end_stroke >= plan.next_maintenance_stroke) {
        db.run(
          'INSERT INTO exceptions (mold_id, exception_type, severity, description) VALUES (?, ?, ?, ?)',
          [mold_id, 'maintenance_soon', 'warning', `排产任务期间将达到保养点：预计结束冲次 ${end_stroke} 将超过保养触发点 ${plan.next_maintenance_stroke}`],
          (err3) => {
            if (err3) console.error('创建异常记录失败:', err3);
          }
        );
      }

      db.get('SELECT max_strokes, current_strokes FROM molds WHERE id = ?', [mold_id], (err4, mold) => {
        if (err4) {
          reject({ passed: false, message: '数据库查询错误', details: err4.message });
          return;
        }

        if (mold && end_stroke >= mold.max_strokes) {
          db.run(
            'INSERT INTO exceptions (mold_id, exception_type, severity, description) VALUES (?, ?, ?, ?)',
            [mold_id, 'exceeds_max_strokes', 'error', `模具即将达到最大寿命：预计结束冲次 ${end_stroke} 接近最大寿命 ${mold.max_strokes}`],
            (err5) => {
              if (err5) console.error('创建异常记录失败:', err5);
            }
          );
        }

        resolve({ passed: true });
      });
    });
  });
}

module.exports = {
  saveChangeHistory,
  saveFlowRecord,
  checkBusinessRules
};
