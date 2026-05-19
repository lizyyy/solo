const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const logger = require('../utils/logger');
const HistoryService = require('./history.service');
const { maskSensitiveFields } = require('../utils/security');

class ShiftService {
  static async create(data, operatorName = 'system') {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      const existing = await db.getOne(
        'SELECT id FROM shifts WHERE date = ? AND type = ?',
        [data.date, data.type || 'night']
      );
      if (existing) {
        throw new Error(`${data.date} 的${data.type === 'night' ? '夜班' : '白班'}已存在`);
      }
      
      await db.runQuery(
        `INSERT INTO shifts (id, date, type, startTime, endTime, supervisorName, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.date, data.type || 'night', data.startTime, data.endTime, 
         data.supervisorName, data.status || 'scheduled', now, now]
      );
      
      const shift = await this.getById(id);
      await HistoryService.log('shift', id, 'create', null, shift, operatorName, 'supervisor');
      
      return shift;
    } catch (error) {
      logger.error('创建班次失败:', error);
      throw error;
    }
  }

  static async getById(id, mask = true) {
    try {
      const shift = await db.getOne('SELECT * FROM shifts WHERE id = ?', [id]);
      if (shift && mask) {
        return maskSensitiveFields(shift);
      }
      return shift;
    } catch (error) {
      logger.error('查询班次失败:', error);
      throw error;
    }
  }

  static async getAll(mask = true) {
    try {
      const shifts = await db.getAll('SELECT * FROM shifts ORDER BY date DESC, type');
      if (mask) {
        return maskSensitiveFields(shifts);
      }
      return shifts;
    } catch (error) {
      logger.error('查询班次列表失败:', error);
      throw error;
    }
  }

  static async getByDate(date, mask = true) {
    try {
      const shifts = await db.getAll(
        'SELECT * FROM shifts WHERE date = ? ORDER BY type',
        [date]
      );
      if (mask) {
        return maskSensitiveFields(shifts);
      }
      return shifts;
    } catch (error) {
      logger.error('查询班次失败:', error);
      throw error;
    }
  }

  static async updateStatus(id, status, operatorName = 'system') {
    try {
      const oldShift = await this.getById(id);
      if (!oldShift) {
        throw new Error('班次不存在');
      }
      
      const now = new Date().toISOString();
      await db.runQuery(
        'UPDATE shifts SET status = ?, updatedAt = ? WHERE id = ?',
        [status, now, id]
      );
      
      const newShift = await this.getById(id);
      await HistoryService.log('shift', id, 'status_update', 
        { status: oldShift.status }, 
        { status }, 
        operatorName, 'supervisor');
      
      return newShift;
    } catch (error) {
      logger.error('更新班次状态失败:', error);
      throw error;
    }
  }

  static async delete(id, operatorName = 'system') {
    try {
      const shift = await this.getById(id);
      if (!shift) {
        throw new Error('班次不存在');
      }
      
      const taskCount = await db.getOne(
        'SELECT COUNT(*) as count FROM tasks WHERE shiftId = ?',
        [id]
      );
      
      if (taskCount.count > 0) {
        throw new Error('该班次下存在任务，无法删除');
      }
      
      await db.runQuery('DELETE FROM shifts WHERE id = ?', [id]);
      await HistoryService.log('shift', id, 'delete', shift, null, operatorName, 'admin');
      
      return true;
    } catch (error) {
      logger.error('删除班次失败:', error);
      throw error;
    }
  }

  static async getShiftSummary(shiftId) {
    try {
      const tasks = await db.getAll(
        `SELECT status, COUNT(*) as count, SUM(estimatedDuration) as totalDuration
         FROM tasks WHERE shiftId = ? GROUP BY status`,
        [shiftId]
      );
      
      const forkliftCount = await db.getOne(
        `SELECT COUNT(DISTINCT forkliftId) as count FROM tasks WHERE shiftId = ? AND forkliftId IS NOT NULL`,
        [shiftId]
      );
      
      const summary = {
        pending: 0,
        assigned: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        totalTasks: 0,
        totalDuration: 0,
        activeForklifts: forkliftCount.count
      };
      
      tasks.forEach(task => {
        summary[task.status] = task.count;
        summary.totalTasks += task.count;
        summary.totalDuration += task.totalDuration || 0;
      });
      
      return summary;
    } catch (error) {
      logger.error('获取班次摘要失败:', error);
      throw error;
    }
  }
}

module.exports = ShiftService;