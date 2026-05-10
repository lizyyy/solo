const db = require('../config/database');
const { logProcessStep } = require('./processLogService');

function requestCountChange(classId, mealPlanId, changeType, newCount, reason, createdBy) {
  return new Promise(async (resolve, reject) => {
    const oldCount = await new Promise((res, rej) => {
      db.get('SELECT student_count + teacher_count as total FROM classes WHERE id = ?', [classId], 
        (err, row) => err ? rej(err) : res(row ? row.total : 0));
    });

    db.run(
      `INSERT INTO student_count_changes (class_id, meal_plan_id, change_type, old_count, new_count, reason, created_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      [classId, mealPlanId, changeType, oldCount, newCount, reason, createdBy],
      function(err) {
        if (err) reject(err);
        else resolve({
          id: this.lastID,
          classId,
          mealPlanId,
          changeType,
          oldCount,
          newCount,
          difference: newCount - oldCount,
          reason,
          createdBy,
          status: 'pending'
        });
      }
    );
  });
}

function reviewCountChange(changeId, action, reviewedBy, reviewNote) {
  return new Promise(async (resolve, reject) => {
    const change = await new Promise((res, rej) => {
      db.get('SELECT * FROM student_count_changes WHERE id = ?', [changeId], 
        (err, row) => err ? rej(err) : res(row));
    });

    if (!change) {
      return reject(new Error('人数变更申请不存在'));
    }

    if (change.status !== 'pending') {
      return reject(new Error(`该申请已被${change.status === 'approved' ? '批准' : '拒绝'}`));
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    if (action === 'approve') {
      const diff = change.new_count - change.old_count;
      await new Promise((res, rej) => {
        db.run(
          `UPDATE meal_plan_items SET meal_count = meal_count + ? WHERE meal_plan_id = ? AND class_id = ?`,
          [diff, change.meal_plan_id, change.class_id],
          err => err ? rej(err) : res()
        );
      });
    }

    db.run(
      `UPDATE student_count_changes SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = datetime('now') WHERE id = ?`,
      [newStatus, reviewedBy, reviewNote, changeId],
      async (err) => {
        if (err) reject(err);
        
        const message = action === 'approve' ? 
          `人数变更已批准: ${change.old_count}人 → ${change.new_count}人` : 
          `人数变更被拒绝: 原因: ${reviewNote || '未说明'}`;
        
        await logProcessStep(
          change.meal_plan_id, 
          '人数变更审核', 
          action === 'approve' ? 'completed' : 'rejected', 
          message, 
          reviewedBy,
          { changeId, changeType: change.change_type, oldCount: change.old_count, newCount: change.new_count }
        );

        resolve({
          success: true,
          changeId,
          action,
          newStatus,
          message
        });
      }
    );
  });
}

function getPendingChanges(mealPlanId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT scc.*, s.name as school_name, c.name as class_name
      FROM student_count_changes scc
      JOIN classes c ON scc.class_id = c.id
      JOIN schools s ON c.school_id = s.id
      WHERE scc.meal_plan_id = ? AND scc.status = 'pending'
      ORDER BY scc.created_at DESC
    `, [mealPlanId], (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function getAllChanges(mealPlanId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT scc.*, s.name as school_name, c.name as class_name
      FROM student_count_changes scc
      JOIN classes c ON scc.class_id = c.id
      JOIN schools s ON c.school_id = s.id
      WHERE scc.meal_plan_id = ?
      ORDER BY scc.created_at DESC
    `, [mealPlanId], (err, rows) => err ? reject(err) : resolve(rows));
  });
}

module.exports = {
  requestCountChange,
  reviewCountChange,
  getPendingChanges,
  getAllChanges
};
