const db = require('../database/db');
const { generateMaterialHash } = require('../utils/hash');
const { validateMaterial, validateTimeConsistency } = require('../utils/validator');
const schedulerService = require('./schedulerService');

class TaskService {
  async checkDuplicate(batchNo, materialHash) {
    const task = await db.get(
      'SELECT * FROM tasks WHERE batch_no = ? OR material_hash = ?',
      [batchNo, materialHash]
    );
    
    if (task) {
      const assignments = await db.all(
        'SELECT * FROM berth_assignments WHERE task_id = ?',
        [task.id]
      );
      const ships = await db.all(
        'SELECT * FROM ships WHERE task_id = ?',
        [task.id]
      );
      return {
        isDuplicate: true,
        task,
        assignments,
        ships
      };
    }
    return { isDuplicate: false };
  }

  async trackFields(taskId, material) {
    const fields = [];
    
    fields.push({
      taskId,
      fieldPath: 'batch_no',
      originalValue: material.batch_no,
      sourcePosition: '材料头部'
    });

    material.ships.forEach((ship, index) => {
      Object.keys(ship).forEach(key => {
        fields.push({
          taskId,
          fieldPath: `ships[${index}].${key}`,
          originalValue: String(ship[key]),
          sourcePosition: `第${index + 1}条船舶记录`
        });
      });
      
      fields.push({
        taskId,
        fieldPath: `ships[${index}].berth_no`,
        originalValue: '',
        sourcePosition: `第${index + 1}条船舶记录-调度结果`
      });
      fields.push({
        taskId,
        fieldPath: `ships[${index}].estimated_berth_time`,
        originalValue: '',
        sourcePosition: `第${index + 1}条船舶记录-调度结果`
      });
      fields.push({
        taskId,
        fieldPath: `ships[${index}].estimated_departure_time`,
        originalValue: '',
        sourcePosition: `第${index + 1}条船舶记录-调度结果`
      });
    });

    for (const field of fields) {
      await db.run(`
        INSERT INTO field_tracking (task_id, field_path, original_value, source_position)
        VALUES (?, ?, ?, ?)
      `, [field.taskId, field.fieldPath, field.originalValue, field.sourcePosition]);
    }
  }

  async createTask(material) {
    const validation = validateMaterial(material);
    if (!validation.valid) {
      return {
        success: false,
        error: '字段验证失败',
        errorDetails: validation.errors
      };
    }

    const timeErrors = validateTimeConsistency(material.ships);
    if (timeErrors.length > 0) {
      return {
        success: false,
        error: '数据一致性验证失败',
        errorDetails: timeErrors
      };
    }

    const materialHash = generateMaterialHash(material);
    const duplicateCheck = await this.checkDuplicate(material.batch_no, materialHash);
    
    if (duplicateCheck.isDuplicate) {
      return {
        success: true,
        isDuplicate: true,
        message: '检测到重复提交，返回历史处理结果',
        task: duplicateCheck.task,
        assignments: duplicateCheck.assignments,
        ships: duplicateCheck.ships
      };
    }

    await db.beginTransaction();

    try {
      const taskResult = await db.run(`
        INSERT INTO tasks (batch_no, material_hash, status, submitted_by, raw_material)
        VALUES (?, ?, 'processing', ?, ?)
      `, [material.batch_no, materialHash, material.submitted_by, JSON.stringify(material)]);

      const taskId = taskResult.lastID;

      await db.run(`
        INSERT INTO task_status_history (task_id, status, changed_by, reason)
        VALUES (?, 'processing', ?, '任务创建，开始处理')
      `, [taskId, material.submitted_by]);

      await this.trackFields(taskId, material);

      const shipsWithDbId = [];
      for (const ship of material.ships) {
        const shipResult = await db.run(`
          INSERT INTO ships (task_id, ship_name, imo_no, draught, length, arrival_time, priority, is_jump_queue, jump_queue_approved_by, jump_queue_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          taskId,
          ship.ship_name,
          ship.imo_no,
          ship.draught,
          ship.length,
          ship.arrival_time,
          ship.priority || 0,
          ship.is_jump_queue ? 1 : 0,
          ship.jump_queue_approved_by || null,
          ship.jump_queue_reason || null
        ]);
        shipsWithDbId.push({ ...ship, db_id: shipResult.lastID });
      }

      const scheduleResults = await schedulerService.scheduleShips(
        taskId,
        shipsWithDbId,
        material.schedule_date
      );

      for (let i = 0; i < shipsWithDbId.length; i++) {
        const shipId = shipsWithDbId[i].db_id;
        const shipResult = scheduleResults.find(r => r.imo_no === shipsWithDbId[i].imo_no);
        const shipData = await db.get('SELECT * FROM ships WHERE id = ?', [shipId]);
        
        if (shipData) {
          await db.run(`
            UPDATE field_tracking SET final_value = ?
            WHERE task_id = ? AND field_path = ?
          `, [shipData.estimated_berth_time || '', taskId, `ships[${i}].estimated_berth_time`]);
          
          await db.run(`
            UPDATE field_tracking SET final_value = ?
            WHERE task_id = ? AND field_path = ?
          `, [shipData.estimated_departure_time || '', taskId, `ships[${i}].estimated_departure_time`]);
        }
        
        if (shipResult && shipResult.success) {
          await db.run(`
            UPDATE field_tracking SET final_value = ?
            WHERE task_id = ? AND field_path = ?
          `, [shipResult.berth_no || '', taskId, `ships[${i}].berth_no`]);
        }
      }

      const successCount = scheduleResults.filter(r => r.success).length;
      const totalCount = scheduleResults.length;
      const finalStatus = successCount === totalCount ? 'completed' : 
                          successCount > 0 ? 'partial_completed' : 'failed';

      await db.run(`
        UPDATE tasks SET status = ?, result = ? WHERE id = ?
      `, [finalStatus, JSON.stringify(scheduleResults), taskId]);

      await db.run(`
        INSERT INTO task_status_history (task_id, status, changed_by, reason)
        VALUES (?, ?, 'system', ?)
      `, [taskId, finalStatus, `调度完成：${successCount}/${totalCount} 艘船成功分配泊位`]);

      await db.commit();

      const finalTask = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
      const finalAssignments = await db.all('SELECT * FROM berth_assignments WHERE task_id = ?', [taskId]);
      const finalShips = await db.all('SELECT * FROM ships WHERE task_id = ?', [taskId]);

      return {
        success: true,
        isDuplicate: false,
        task: finalTask,
        assignments: finalAssignments,
        ships: finalShips,
        scheduleResults
      };

    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async updateTaskStatus(taskId, newStatus, changedBy, reason) {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('任务不存在');
    }

    const validStatuses = ['processing', 'failed', 'manual_confirm', 'exported', 'completed', 'partial_completed'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error('无效的状态值');
    }

    const oldStatus = task.status;

    await db.run(`
      UPDATE tasks SET status = ? WHERE id = ?
    `, [newStatus, taskId]);

    await db.run(`
      INSERT INTO task_status_history (task_id, status, changed_by, reason)
      VALUES (?, ?, ?, ?)
    `, [taskId, newStatus, changedBy, reason]);

    await this.logAudit(taskId, 'status_change', 'status', oldStatus, newStatus, changedBy, reason);

    return await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
  }

  async logAudit(taskId, action, fieldName, beforeValue, afterValue, changedBy, reason) {
    await db.run(`
      INSERT INTO audit_logs (task_id, action, field_name, before_value, after_value, changed_by, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [taskId, action, fieldName, String(beforeValue), String(afterValue), changedBy, reason]);
  }

  async getTask(taskId) {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return null;

    const ships = await db.all('SELECT * FROM ships WHERE task_id = ?', [taskId]);
    const assignments = await db.all('SELECT * FROM berth_assignments WHERE task_id = ?', [taskId]);
    const statusHistory = await db.all('SELECT * FROM task_status_history WHERE task_id = ? ORDER BY changed_at ASC', [taskId]);
    const auditLogs = await db.all('SELECT * FROM audit_logs WHERE task_id = ? ORDER BY changed_at ASC', [taskId]);
    const fieldTracking = await db.all('SELECT * FROM field_tracking WHERE task_id = ?', [taskId]);

    return {
      task,
      ships,
      assignments,
      statusHistory,
      auditLogs,
      fieldTracking
    };
  }

  async listTasks(status = null, page = 1, pageSize = 20) {
    let sql = 'SELECT * FROM tasks';
    let countSql = 'SELECT COUNT(*) as total FROM tasks';
    const params = [];

    if (status) {
      sql += ' WHERE status = ?';
      countSql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const tasks = await db.all(sql, params);
    const countResult = await db.get(countSql, status ? [status] : []);

    return {
      tasks,
      total: countResult.total,
      page,
      pageSize
    };
  }

  async getAuditLogs(taskId) {
    return await db.all(`
      SELECT * FROM audit_logs 
      WHERE task_id = ? 
      ORDER BY changed_at DESC
    `, [taskId]);
  }

  async updateFieldFinalValue(taskId, fieldPath, finalValue) {
    await db.run(`
      UPDATE field_tracking SET final_value = ?
      WHERE task_id = ? AND field_path = ?
    `, [String(finalValue), taskId, fieldPath]);
  }

  async generateFinalReport(taskId) {
    const taskData = await this.getTask(taskId);
    if (!taskData) return null;

    const { task, ships, assignments, statusHistory, auditLogs } = taskData;

    for (const ship of ships) {
      const shipIndex = ships.findIndex(s => s.id === ship.id);
      
      this.updateFieldFinalValue(taskId, `ships[${shipIndex}].estimated_berth_time`, ship.estimated_berth_time || '');
      this.updateFieldFinalValue(taskId, `ships[${shipIndex}].estimated_departure_time`, ship.estimated_departure_time || '');
      
      const assignment = assignments.find(a => a.ship_id === ship.id);
      if (assignment) {
        this.updateFieldFinalValue(taskId, `ships[${shipIndex}].berth_no`, assignment.berth_no || '');
      }
    }

    const report = {
      report_id: `RPT-${taskId}-${Date.now()}`,
      generated_at: new Date().toISOString(),
      task_info: {
        batch_no: task.batch_no,
        submitted_by: task.submitted_by,
        submitted_at: task.submitted_at,
        status: task.status
      },
      ships_summary: ships.map(ship => {
        const assignment = assignments.find(a => a.ship_id === ship.id);
        return {
          ship_name: ship.ship_name,
          imo_no: ship.imo_no,
          draught: ship.draught,
          length: ship.length,
          arrival_time: ship.arrival_time,
          berth_no: assignment ? assignment.berth_no : null,
          estimated_berth_time: ship.estimated_berth_time,
          estimated_departure_time: ship.estimated_departure_time,
          is_jump_queue: ship.is_jump_queue
        };
      }),
      status_history: statusHistory,
      audit_trail: auditLogs
    };

    return report;
  }

  async exportTask(taskId, exportedBy) {
    const report = await this.generateFinalReport(taskId);
    
    await db.run(`
      UPDATE tasks SET status = 'exported', exported_at = CURRENT_TIMESTAMP, exported_by = ?
      WHERE id = ?
    `, [exportedBy, taskId]);

    await db.run(`
      INSERT INTO task_status_history (task_id, status, changed_by, reason)
      VALUES (?, 'exported', ?, '任务已导出')
    `, [taskId, exportedBy]);

    return {
      success: true,
      message: '任务已导出，最终报告已生成',
      report,
      task: await this.getTask(taskId)
    };
  }
}

module.exports = new TaskService();
