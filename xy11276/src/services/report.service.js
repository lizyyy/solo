const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const logger = require('../utils/logger');
const { maskSensitiveFields } = require('../utils/security');

class ReportService {
  static async exportShiftTasks(shiftId, format = 'csv') {
    try {
      const tasks = await db.getAll(
        `SELECT t.code, t.type, t.priority, t.status, t.description, t.location,
                t.estimatedDuration, t.startTime, t.endTime, t.operatorName,
                f.code as forkliftCode, f.name as forkliftName,
                s.date as shiftDate, s.type as shiftType
         FROM tasks t
         LEFT JOIN forklifts f ON t.forkliftId = f.id
         LEFT JOIN shifts s ON t.shiftId = s.id
         WHERE t.shiftId = ?
         ORDER BY CASE t.priority 
           WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 
           WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END`,
        [shiftId]
      );
      
      const maskedTasks = maskSensitiveFields(tasks);
      
      if (format === 'csv') {
        return this.generateCSV(maskedTasks);
      }
      
      return maskedTasks;
    } catch (error) {
      logger.error('导出班次任务失败:', error);
      throw error;
    }
  }

  static async exportForkliftStatus(format = 'csv') {
    try {
      const forklifts = await db.getAll(
        `SELECT code, name, batteryLevel, status, operatorName,
                lastMaintenanceDate, createdAt
         FROM forklifts
         ORDER BY code`
      );
      
      const maskedForklifts = maskSensitiveFields(forklifts);
      
      if (format === 'csv') {
        return this.generateCSV(maskedForklifts);
      }
      
      return maskedForklifts;
    } catch (error) {
      logger.error('导出叉车状态失败:', error);
      throw error;
    }
  }

  static async exportChargingStatus(format = 'csv') {
    try {
      const stations = await db.getAll(
        `SELECT cs.code, cs.name, cs.status, cs.chargingStartTime, cs.estimatedEndTime,
                f.code as forkliftCode, f.name as forkliftName, f.batteryLevel
         FROM charging_stations cs
         LEFT JOIN forklifts f ON cs.forkliftId = f.id
         ORDER BY cs.code`
      );
      
      if (format === 'csv') {
        return this.generateCSV(stations);
      }
      
      return stations;
    } catch (error) {
      logger.error('导出充电状态失败:', error);
      throw error;
    }
  }

  static async exportHistoryLogs(entityType, startDate, endDate, format = 'csv') {
    try {
      let sql = `SELECT id, entityType, entityId, action, operatorName, operatorRole, createdAt
                  FROM history_logs
                  WHERE 1=1`;
      const params = [];
      
      if (entityType) {
        sql += ` AND entityType = ?`;
        params.push(entityType);
      }
      if (startDate) {
        sql += ` AND createdAt >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND createdAt <= ?`;
        params.push(endDate);
      }
      
      sql += ` ORDER BY createdAt DESC`;
      
      const logs = await db.getAll(sql, params);
      
      if (format === 'csv') {
        return this.generateCSV(logs);
      }
      
      return logs;
    } catch (error) {
      logger.error('导出历史记录失败:', error);
      throw error;
    }
  }

  static generateCSV(data) {
    if (!data || data.length === 0) {
      return '';
    }
    
    const fields = Object.keys(data[0]);
    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
  }

  static saveToFile(content, filename) {
    const exportDir = path.resolve('./exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    logger.info(`文件已保存: ${filePath}`);
    return filePath;
  }

  static async generateShiftSummaryReport(shiftId) {
    try {
      const shift = await db.getOne('SELECT * FROM shifts WHERE id = ?', [shiftId]);
      if (!shift) {
        throw new Error('班次不存在');
      }
      
      const summary = await db.getOne(
        `SELECT 
          COUNT(*) as totalTasks,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingTasks,
          SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assignedTasks,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgressTasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedTasks,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledTasks,
          SUM(estimatedDuration) as totalEstimatedMinutes,
          COUNT(DISTINCT forkliftId) as usedForklifts
         FROM tasks WHERE shiftId = ?`,
        [shiftId]
      );
      
      const lowBatteryCount = await db.getOne(
        `SELECT COUNT(*) as count FROM forklifts WHERE batteryLevel < 20`,
        []
      );
      
      const report = {
        shift: maskSensitiveFields(shift),
        summary: {
          ...summary,
          completionRate: summary.totalTasks > 0 
            ? Math.round((summary.completedTasks / summary.totalTasks) * 100) 
            : 0
        },
        warnings: {
          lowBatteryForklifts: lowBatteryCount.count
        },
        generatedAt: new Date().toISOString()
      };
      
      return report;
    } catch (error) {
      logger.error('生成班次摘要报告失败:', error);
      throw error;
    }
  }
}

module.exports = ReportService;