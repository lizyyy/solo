const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const logger = require('../utils/logger');
const HistoryService = require('./history.service');
const ForkliftService = require('./forklift.service');
const config = require('../../config/default');

class ChargingService {
  static async create(data, operatorName = 'system') {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      const existing = await db.getOne('SELECT id FROM charging_stations WHERE code = ?', [data.code]);
      if (existing) {
        throw new Error(`充电桩编号 ${data.code} 已存在`);
      }
      
      await db.runQuery(
        `INSERT INTO charging_stations (id, code, name, status, forkliftId, chargingStartTime, estimatedEndTime, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.code, data.name, data.status || 'available', null, null, null, now, now]
      );
      
      const station = await this.getById(id);
      await HistoryService.log('charging_station', id, 'create', null, station, operatorName, 'operator');
      
      return station;
    } catch (error) {
      logger.error('创建充电桩失败:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      return await db.getOne('SELECT * FROM charging_stations WHERE id = ?', [id]);
    } catch (error) {
      logger.error('查询充电桩失败:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      return await db.getAll('SELECT * FROM charging_stations ORDER BY code');
    } catch (error) {
      logger.error('查询充电桩列表失败:', error);
      throw error;
    }
  }

  static async getAvailable() {
    try {
      return await db.getAll(
        `SELECT * FROM charging_stations WHERE status = 'available' ORDER BY code`
      );
    } catch (error) {
      logger.error('查询可用充电桩失败:', error);
      throw error;
    }
  }

  static async startCharging(stationId, forkliftId, operatorName = 'system') {
    try {
      const station = await this.getById(stationId);
      if (!station) {
        throw new Error('充电桩不存在');
      }
      
      if (station.status !== 'available') {
        throw new Error('充电桩不可用');
      }
      
      const forklift = await ForkliftService.getById(forkliftId, false);
      if (!forklift) {
        throw new Error('叉车不存在');
      }
      
      if (forklift.status === 'charging') {
        throw new Error('该叉车正在充电中');
      }
      
      if (forklift.batteryLevel >= 100) {
        throw new Error('叉车电量已满，无需充电');
      }
      
      const now = new Date();
      const batteryNeeded = 100 - forklift.batteryLevel;
      const chargingMinutes = Math.ceil(batteryNeeded / config.forklift.chargingRatePerMinute);
      const estimatedEndTime = new Date(now.getTime() + chargingMinutes * 60000);
      
      await db.runQuery(
        `UPDATE charging_stations 
         SET status = 'occupied', forkliftId = ?, chargingStartTime = ?, estimatedEndTime = ?, updatedAt = ?
         WHERE id = ?`,
        [forkliftId, now.toISOString(), estimatedEndTime.toISOString(), now.toISOString(), stationId]
      );
      
      await ForkliftService.update(forkliftId, { status: 'charging' }, operatorName);
      
      const updatedStation = await this.getById(stationId);
      await HistoryService.log('charging_station', stationId, 'start_charging', 
        station, updatedStation, operatorName, 'operator');
      
      return updatedStation;
    } catch (error) {
      logger.error('开始充电失败:', error);
      throw error;
    }
  }

  static async stopCharging(stationId, operatorName = 'system') {
    try {
      const station = await this.getById(stationId);
      if (!station) {
        throw new Error('充电桩不存在');
      }
      
      if (station.status !== 'occupied' || !station.forkliftId) {
        throw new Error('该充电桩没有在充电');
      }
      
      const forklift = await ForkliftService.getById(station.forkliftId, false);
      
      let newBatteryLevel = 100;
      if (station.chargingStartTime) {
        const startTime = new Date(station.chargingStartTime);
        const now = new Date();
        const chargingMinutes = (now - startTime) / 60000;
        const batteryGained = Math.floor(chargingMinutes * config.forklift.chargingRatePerMinute);
        newBatteryLevel = Math.min(100, (forklift?.batteryLevel || 50) + batteryGained);
      }
      
      const now = new Date().toISOString();
      await db.runQuery(
        `UPDATE charging_stations 
         SET status = 'available', forkliftId = NULL, chargingStartTime = NULL, estimatedEndTime = NULL, updatedAt = ?
         WHERE id = ?`,
        [now, stationId]
      );
      
      if (station.forkliftId) {
        const newStatus = newBatteryLevel <= config.forklift.minSafeBattery ? 'low_battery' : 'idle';
        await ForkliftService.update(station.forkliftId, { 
          batteryLevel: newBatteryLevel,
          status: newStatus
        }, operatorName);
      }
      
      const updatedStation = await this.getById(stationId);
      await HistoryService.log('charging_station', stationId, 'stop_charging', 
        station, updatedStation, operatorName, 'operator');
      
      return { station: updatedStation, finalBatteryLevel: newBatteryLevel };
    } catch (error) {
      logger.error('停止充电失败:', error);
      throw error;
    }
  }

  static async delete(id, operatorName = 'system') {
    try {
      const station = await this.getById(id);
      if (!station) {
        throw new Error('充电桩不存在');
      }
      
      if (station.status === 'occupied') {
        throw new Error('充电桩正在使用中，无法删除');
      }
      
      await db.runQuery('DELETE FROM charging_stations WHERE id = ?', [id]);
      await HistoryService.log('charging_station', id, 'delete', station, null, operatorName, 'admin');
      
      return true;
    } catch (error) {
      logger.error('删除充电桩失败:', error);
      throw error;
    }
  }

  static async getChargingStatus() {
    try {
      const stations = await db.getAll(
        `SELECT cs.*, f.code as forkliftCode, f.name as forkliftName, f.batteryLevel
         FROM charging_stations cs
         LEFT JOIN forklifts f ON cs.forkliftId = f.id
         ORDER BY cs.code`
      );
      
      return stations.map(station => ({
        ...station,
        remainingTime: station.estimatedEndTime ? 
          Math.max(0, Math.ceil((new Date(station.estimatedEndTime) - new Date()) / 60000)) : 
          null
      }));
    } catch (error) {
      logger.error('查询充电状态失败:', error);
      throw error;
    }
  }
}

module.exports = ChargingService;