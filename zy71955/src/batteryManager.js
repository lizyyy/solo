const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createError, wrapError } = require('./utils/errors');

class BatteryManager {
  constructor() {
    this.warningVoltage = config.battery.warningVoltage;
    this.criticalVoltage = config.battery.criticalVoltage;
  }

  parseLog(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      const filename = filePath.split('/').pop();
      
      if (!content) {
        throw createError('BATTERY_FILE_EMPTY', filename);
      }
      
      const lines = content.split('\n').filter(l => l.trim());
      const records = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || line.startsWith('//')) continue;
        
        const record = this._parseLine(line, i + 1);
        if (record) {
          records.push(record);
        }
      }
      
      return {
        filename,
        records,
        summary: this._generateSummary(records),
        parsedAt: new Date().toISOString()
      };
      
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw createError('FILE_NOT_FOUND', filePath.split('/').pop());
      }
      throw wrapError(e, '读取电池记录');
    }
  }

  _parseLine(line, lineNum) {
    const match = line.match(/^(\d{1,2}:\d{2})\s+(\S+)\s+(\d+\.?\d*)V?\s+(\d+)%?$/i);
    
    if (!match) {
      throw createError('INVALID_BATTERY_RECORD', lineNum, line);
    }
    
    const [, time, batteryId, voltage, capacity] = match;
    
    return {
      time,
      batteryId: batteryId.toUpperCase(),
      voltage: parseFloat(voltage),
      capacity: parseInt(capacity, 10),
      status: this._getStatus(parseFloat(voltage), parseInt(capacity, 10))
    };
  }

  _getStatus(voltage, capacity) {
    if (voltage < this.criticalVoltage || capacity < config.battery.minReturnCapacity) {
      return 'critical';
    }
    if (voltage < this.warningVoltage) {
      return 'warning';
    }
    return 'normal';
  }

  _generateSummary(records) {
    const batteries = new Set(records.map(r => r.batteryId));
    const critical = records.filter(r => r.status === 'critical');
    const warning = records.filter(r => r.status === 'warning');
    
    return {
      batteryCount: batteries.size,
      batteries: Array.from(batteries),
      recordCount: records.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      lowestVoltage: Math.min(...records.map(r => r.voltage)),
      lowestCapacity: Math.min(...records.map(r => r.capacity))
    };
  }

  checkSafety(batteryData) {
    const issues = [];
    const { records, summary } = batteryData;
    
    if (summary.lowestVoltage < this.criticalVoltage) {
      issues.push({
        type: 'critical',
        message: `电池最低电压 ${summary.lowestVoltage}V，低于安全值 ${this.criticalVoltage}V`
      });
    }
    
    if (summary.lowestCapacity < config.battery.minReturnCapacity) {
      issues.push({
        type: 'critical',
        message: `电池最低剩余 ${summary.lowestCapacity}%，返航电量不足`
      });
    }
    
    return {
      safe: issues.filter(i => i.type === 'critical').length === 0,
      issues,
      summary: issues.length === 0 ? '电池状态良好' : `发现 ${issues.length} 个电池问题`
    };
  }

  compareVersions(oldData, newData) {
    const changes = [];
    
    const oldMap = new Map();
    oldData.records.forEach(r => oldMap.set(`${r.time}-${r.batteryId}`, r));
    
    for (const newRecord of newData.records) {
      const key = `${newRecord.time}-${newRecord.batteryId}`;
      const oldRecord = oldMap.get(key);
      
      if (oldRecord) {
        if (Math.abs(oldRecord.voltage - newRecord.voltage) > 0.1) {
          changes.push({
            field: 'voltage',
            batteryId: newRecord.batteryId,
            time: newRecord.time,
            oldValue: `${oldRecord.voltage}V`,
            newValue: `${newRecord.voltage}V`,
            message: `${newRecord.batteryId} 在 ${newRecord.time} 的电压不一样`
          });
        }
        if (oldRecord.capacity !== newRecord.capacity) {
          changes.push({
            field: 'capacity',
            batteryId: newRecord.batteryId,
            time: newRecord.time,
            oldValue: `${oldRecord.capacity}%`,
            newValue: `${newRecord.capacity}%`,
            message: `${newRecord.batteryId} 在 ${newRecord.time} 的剩余电量不一样`
          });
        }
      } else {
        changes.push({
          field: 'new_record',
          batteryId: newRecord.batteryId,
          time: newRecord.time,
          oldValue: '无记录',
          newValue: `${newRecord.voltage}V ${newRecord.capacity}%`,
          message: `新增了 ${newRecord.batteryId} 在 ${newRecord.time} 的记录`
        });
      }
    }
    
    const newKeys = new Set(newData.records.map(r => `${r.time}-${r.batteryId}`));
    for (const [key, oldRecord] of oldMap) {
      if (!newKeys.has(key)) {
        changes.push({
          field: 'missing_record',
          batteryId: oldRecord.batteryId,
          time: oldRecord.time,
          oldValue: `${oldRecord.voltage}V ${oldRecord.capacity}%`,
          newValue: '记录不见了',
          message: `${oldRecord.batteryId} 在 ${oldRecord.time} 的记录没了`
        });
      }
    }
    
    return {
      hasChanges: changes.length > 0,
      changes,
      summary: changes.length === 0 ? '两份记录完全一致' : `发现 ${changes.length} 处不同`
    };
  }
}

module.exports = BatteryManager;
