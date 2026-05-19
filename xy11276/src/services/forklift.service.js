const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const logger = require('../utils/logger');
const HistoryService = require('./history.service');
const { maskSensitiveFields } = require('../utils/security');
const config = require('../../config/default');

class ForkliftService {
  static async create(data, operatorName = 'system') {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      const existing = await db.getOne('SELECT id FROM forklifts WHERE code = ?', [data.code]);
      if (existing) {
        throw new Error(`叉车编号 ${data.code} 已存在`);
      }
      
      await db.runQuery(
        `INSERT INTO forklifts (id, code, name, batteryLevel, status, operatorName, operatorPhone, operatorIdCard, lastMaintenanceDate, maintainerContact, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.code, data.name, data.batteryLevel || 100, data.status || 'idle', 
         data.operatorName, data.operatorPhone, data.operatorIdCard, 
         data.lastMaintenanceDate, data.maintainerContact, now, now]
      );
      
      const forklift = await this.getById(id);
      await HistoryService.log('forklift', id, 'create', null, forklift, operatorName, 'operator');
      
      return forklift;
    } catch (error) {
      logger.error('创建叉车失败:', error);
      throw error;
    }
  }

  static async update(id, data, operatorName = 'system') {
    try {
      const oldForklift = await this.getById(id);
      if (!oldForklift) {
        throw new Error('叉车不存在');
      }
      
      const updates = [];
      const params = [];
      
      const allowedFields = ['name', 'batteryLevel', 'status', 'operatorName', 'operatorPhone', 'operatorIdCard', 'lastMaintenanceDate', 'maintainerContact'];
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(data[field]);
        }
      }
      
      if (updates.length === 0) {
        return oldForklift;
      }
      
      updates.push('updatedAt = ?');
      params.push(new Date().toISOString(), id);
      
      await db.runQuery(
        `UPDATE forklifts SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      const newForklift = await this.getById(id);
      await HistoryService.log('forklift', id, 'update', oldForklift, newForklift, operatorName, 'operator');
      
      return newForklift;
    } catch (error) {
      logger.error('更新叉车失败:', error);
      throw error;
    }
  }

  static async getById(id, mask = true) {
    try {
      const forklift = await db.getOne('SELECT * FROM forklifts WHERE id = ?', [id]);
      if (forklift && mask) {
        return maskSensitiveFields(forklift);
      }
      return forklift;
    } catch (error) {
      logger.error('查询叉车失败:', error);
      throw error;
    }
  }

  static async getByCode(code, mask = true) {
    try {
      const forklift = await db.getOne('SELECT * FROM forklifts WHERE code = ?', [code]);
      if (forklift && mask) {
        return maskSensitiveFields(forklift);
      }
      return forklift;
    } catch (error) {
      logger.error('查询叉车失败:', error);
      throw error;
    }
  }

  static async getAll(mask = true) {
    try {
      const forklifts = await db.getAll('SELECT * FROM forklifts ORDER BY code');
      if (mask) {
        return maskSensitiveFields(forklifts);
      }
      return forklifts;
    } catch (error) {
      logger.error('查询叉车列表失败:', error);
      throw error;
    }
  }

  static async getLowBattery(mask = true) {
    try {
      const forklifts = await db.getAll(
        'SELECT * FROM forklifts WHERE batteryLevel <= ? AND status != ? ORDER BY batteryLevel',
        [config.forklift.minSafeBattery, 'charging']
      );
      if (mask) {
        return maskSensitiveFields(forklifts);
      }
      return forklifts;
    } catch (error) {
      logger.error('查询低电量叉车失败:', error);
      throw error;
    }
  }

  static async getAvailable(mask = true) {
    try {
      const forklifts = await db.getAll(
        `SELECT * FROM forklifts 
         WHERE status = 'idle' AND batteryLevel >= ? 
         ORDER BY batteryLevel DESC`,
        [config.forklift.minSafeBattery]
      );
      if (mask) {
        return maskSensitiveFields(forklifts);
      }
      return forklifts;
    } catch (error) {
      logger.error('查询可用叉车失败:', error);
      throw error;
    }
  }

  static async delete(id, operatorName = 'system') {
    try {
      const forklift = await this.getById(id);
      if (!forklift) {
        throw new Error('叉车不存在');
      }
      
      const activeTasks = await db.getOne(
        `SELECT COUNT(*) as count FROM tasks 
         WHERE forkliftId = ? AND status IN ('pending', 'assigned', 'in_progress')`,
        [id]
      );
      
      if (activeTasks.count > 0) {
        throw new Error('该叉车有未完成的任务，无法删除');
      }
      
      const chargingStation = await db.getOne(
        'SELECT id FROM charging_stations WHERE forkliftId = ?',
        [id]
      );
      
      if (chargingStation) {
        throw new Error('该叉车正在充电，无法删除');
      }
      
      await db.runQuery('DELETE FROM forklifts WHERE id = ?', [id]);
      await HistoryService.log('forklift', id, 'delete', forklift, null, operatorName, 'admin');
      
      return true;
    } catch (error) {
      logger.error('删除叉车失败:', error);
      throw error;
    }
  }

  static async updateBattery(id, newLevel, operatorName = 'system') {
    try {
      if (newLevel < 0 || newLevel > 100) {
        throw new Error('电量值必须在0-100之间');
      }
      
      const oldForklift = await this.getById(id, false);
      if (!oldForklift) {
        throw new Error('叉车不存在');
      }
      
      let newStatus = oldForklift.status;
      if (newLevel <= config.forklift.minSafeBattery && oldForklift.status === 'idle') {
        newStatus = 'low_battery';
      } else if (newLevel > config.forklift.minSafeBattery && oldForklift.status === 'low_battery') {
        newStatus = 'idle';
      }
      
      await db.runQuery(
        'UPDATE forklifts SET batteryLevel = ?, status = ?, updatedAt = ? WHERE id = ?',
        [newLevel, newStatus, new Date().toISOString(), id]
      );
      
      const newForklift = await this.getById(id);
      await HistoryService.log('forklift', id, 'battery_update', 
        { batteryLevel: oldForklift.batteryLevel, status: oldForklift.status },
        { batteryLevel: newLevel, status: newStatus },
        operatorName, 'operator'
      );
      
      return newForklift;
    } catch (error) {
      logger.error('更新叉车电量失败:', error);
      throw error;
    }
  }
}

module.exports = ForkliftService;