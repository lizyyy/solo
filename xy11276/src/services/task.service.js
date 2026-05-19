const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const logger = require('../utils/logger');
const HistoryService = require('./history.service');
const ForkliftService = require('./forklift.service');
const ShiftService = require('./shift.service');
const { maskSensitiveFields } = require('../utils/security');
const config = require('../../config/default');

class TaskService {
  static async create(data, operatorName = 'system') {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      const existing = await db.getOne('SELECT id FROM tasks WHERE code = ?', [data.code]);
      if (existing) {
        throw new Error(`任务编号 ${data.code} 已存在`);
      }
      
      const shift = await ShiftService.getById(data.shiftId);
      if (!shift) {
        throw new Error('班次不存在');
      }
      
      await db.runQuery(
        `INSERT INTO tasks (id, code, shiftId, forkliftId, type, priority, description, location, estimatedDuration, status, startTime, endTime, operatorName, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.code, data.shiftId, data.forkliftId || null, data.type, 
         data.priority || 'normal', data.description, data.location, 
         data.estimatedDuration, data.status || 'pending', 
         null, null, data.operatorName, now, now]
      );
      
      if (data.forkliftId) {
        await ForkliftService.update(data.forkliftId, { status: 'working' }, operatorName);
      }
      
      const task = await this.getById(id);
      await HistoryService.log('task', id, 'create', null, task, operatorName, 'operator');
      
      return task;
    } catch (error) {
      logger.error('创建任务失败:', error);
      throw error;
    }
  }

  static async getById(id, mask = true) {
    try {
      const task = await db.getOne('SELECT * FROM tasks WHERE id = ?', [id]);
      if (task && mask) {
        return maskSensitiveFields(task);
      }
      return task;
    } catch (error) {
      logger.error('查询任务失败:', error);
      throw error;
    }
  }

  static async getAll(mask = true) {
    try {
      const tasks = await db.getAll('SELECT * FROM tasks ORDER BY createdAt DESC');
      if (mask) {
        return maskSensitiveFields(tasks);
      }
      return tasks;
    } catch (error) {
      logger.error('查询任务列表失败:', error);
      throw error;
    }
  }

  static async getByShiftId(shiftId, mask = true) {
    try {
      const tasks = await db.getAll(
        `SELECT t.*, f.code as forkliftCode, f.name as forkliftName
         FROM tasks t
         LEFT JOIN forklifts f ON t.forkliftId = f.id
         WHERE t.shiftId = ?
         ORDER BY CASE t.priority 
           WHEN 'urgent' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'normal' THEN 3 
           WHEN 'low' THEN 4 
           END, t.createdAt`,
        [shiftId]
      );
      if (mask) {
        return maskSensitiveFields(tasks);
      }
      return tasks;
    } catch (error) {
      logger.error('查询班次任务失败:', error);
      throw error;
    }
  }

  static async assign(taskId, forkliftId, taskOperatorName, operatorName = 'system') {
    try {
      const task = await this.getById(taskId, false);
      if (!task) {
        throw new Error('任务不存在');
      }
      
      if (task.status !== 'pending') {
        throw new Error('只能分配待处理的任务');
      }
      
      const forklift = await ForkliftService.getById(forkliftId, false);
      if (!forklift) {
        throw new Error('叉车不存在');
      }
      
      if (forklift.status !== 'idle') {
        throw new Error('叉车不可用，当前状态: ' + forklift.status);
      }
      
      if (forklift.batteryLevel < config.forklift.minSafeBattery) {
        throw new Error('叉车电量不足，无法分配任务');
      }
      
      const forkliftTasks = await db.getAll(
        `SELECT COUNT(*) as count FROM tasks 
         WHERE forkliftId = ? AND status IN ('assigned', 'in_progress')`,
        [forkliftId]
      );
      
      if (forkliftTasks[0].count >= config.shift.maxTasksPerForklift) {
        throw new Error('该叉车已达到最大任务数限制');
      }
      
      const now = new Date().toISOString();
      await db.runQuery(
        `UPDATE tasks 
         SET forkliftId = ?, operatorName = ?, status = 'assigned', updatedAt = ?
         WHERE id = ?`,
        [forkliftId, taskOperatorName, now, taskId]
      );
      
      await ForkliftService.update(forkliftId, { status: 'working' }, operatorName);
      
      const updatedTask = await this.getById(taskId);
      await HistoryService.log('task', taskId, 'assign', 
        { forkliftId: task.forkliftId, status: task.status },
        { forkliftId, status: 'assigned', operatorName: taskOperatorName },
        operatorName, 'operator');
      
      return updatedTask;
    } catch (error) {
      logger.error('分配任务失败:', error);
      throw error;
    }
  }

  static async startTask(taskId, operatorName = 'system') {
    try {
      const task = await this.getById(taskId, false);
      if (!task) {
        throw new Error('任务不存在');
      }
      
      if (task.status !== 'assigned') {
        throw new Error('只能开始已分配的任务');
      }
      
      const now = new Date().toISOString();
      await db.runQuery(
        `UPDATE tasks SET status = 'in_progress', startTime = ?, updatedAt = ? WHERE id = ?`,
        [now, now, taskId]
      );
      
      const updatedTask = await this.getById(taskId);
      await HistoryService.log('task', taskId, 'start', 
        { status: task.status },
        { status: 'in_progress', startTime: now },
        operatorName, 'operator');
      
      return updatedTask;
    } catch (error) {
      logger.error('开始任务失败:', error);
      throw error;
    }
  }

  static async completeTask(taskId, operatorName = 'system') {
    try {
      const task = await this.getById(taskId, false);
      if (!task) {
        throw new Error('任务不存在');
      }
      
      if (task.status !== 'in_progress') {
        throw new Error('只能完成进行中的任务');
      }
      
      const now = new Date().toISOString();
      await db.runQuery(
        `UPDATE tasks SET status = 'completed', endTime = ?, updatedAt = ? WHERE id = ?`,
        [now, now, taskId]
      );
      
      if (task.forkliftId) {
        const remainingTasks = await db.getOne(
          `SELECT COUNT(*) as count FROM tasks 
           WHERE forkliftId = ? AND status IN ('assigned', 'in_progress') AND id != ?`,
          [task.forkliftId, taskId]
        );
        
        if (remainingTasks.count === 0) {
          await ForkliftService.update(task.forkliftId, { status: 'idle' }, operatorName);
        }
      }
      
      const updatedTask = await this.getById(taskId);
      await HistoryService.log('task', taskId, 'complete', 
        { status: task.status },
        { status: 'completed', endTime: now },
        operatorName, 'operator');
      
      return updatedTask;
    } catch (error) {
      logger.error('完成任务失败:', error);
      throw error;
    }
  }

  static async cancelTask(taskId, operatorName = 'system') {
    try {
      const task = await this.getById(taskId, false);
      if (!task) {
        throw new Error('任务不存在');
      }
      
      if (!['pending', 'assigned'].includes(task.status)) {
        throw new Error('只能取消待处理或已分配的任务');
      }
      
      const now = new Date().toISOString();
      await db.runQuery(
        `UPDATE tasks SET status = 'cancelled', updatedAt = ? WHERE id = ?`,
        [now, taskId]
      );
      
      if (task.forkliftId) {
        const remainingTasks = await db.getOne(
          `SELECT COUNT(*) as count FROM tasks 
           WHERE forkliftId = ? AND status IN ('assigned', 'in_progress') AND id != ?`,
          [task.forkliftId, taskId]
        );
        
        if (remainingTasks.count === 0) {
          await ForkliftService.update(task.forkliftId, { status: 'idle' }, operatorName);
        }
      }
      
      const updatedTask = await this.getById(taskId);
      await HistoryService.log('task', taskId, 'cancel', 
        { status: task.status },
        { status: 'cancelled' },
        operatorName, 'operator');
      
      return updatedTask;
    } catch (error) {
      logger.error('取消任务失败:', error);
      throw error;
    }
  }

  static async getConflicts(shiftId) {
    try {
      const conflicts = [];
      
      const overloadedForklifts = await db.getAll(
        `SELECT f.id, f.code, f.name, COUNT(t.id) as taskCount
         FROM forklifts f
         JOIN tasks t ON f.id = t.forkliftId
         WHERE t.shiftId = ? AND t.status IN ('assigned', 'in_progress')
         GROUP BY f.id, f.code, f.name
         HAVING taskCount > ?`,
        [shiftId, config.shift.maxTasksPerForklift]
      );
      
      if (overloadedForklifts.length > 0) {
        conflicts.push({
          type: 'overloaded_forklift',
          message: '存在叉车任务过载',
          details: overloadedForklifts
        });
      }
      
      const lowBatteryWorking = await db.getAll(
        `SELECT f.id, f.code, f.name, f.batteryLevel, COUNT(t.id) as taskCount
         FROM forklifts f
         LEFT JOIN tasks t ON f.id = t.forkliftId AND t.shiftId = ? AND t.status IN ('assigned', 'in_progress')
         WHERE f.status = 'working' AND f.batteryLevel < ?
         GROUP BY f.id, f.code, f.name, f.batteryLevel`,
        [shiftId, config.forklift.minSafeBattery]
      );
      
      if (lowBatteryWorking.length > 0) {
        conflicts.push({
          type: 'low_battery_working',
          message: '存在低电量叉车仍在工作',
          details: lowBatteryWorking
        });
      }
      
      return conflicts;
    } catch (error) {
      logger.error('检查冲突失败:', error);
      throw error;
    }
  }
}

module.exports = TaskService;