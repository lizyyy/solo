const fs = require('fs');
const yaml = require('js-yaml');

class TrafficParser {
  constructor() {}

  parse(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.load(content);
    return this.normalizeTrafficWindows(data);
  }

  normalizeTrafficWindows(data) {
    const result = [];

    // 支持多种格式
    if (data.windows && Array.isArray(data.windows)) {
      for (const window of data.windows) {
        result.push(this.normalizeWindow(window));
      }
    } else if (data.traffic_windows && Array.isArray(data.traffic_windows)) {
      for (const window of data.traffic_windows) {
        result.push(this.normalizeWindow(window));
      }
    } else if (Array.isArray(data)) {
      for (const window of data) {
        result.push(this.normalizeWindow(window));
      }
    }

    return result;
  }

  normalizeWindow(window) {
    const result = {
      name: window.name || '未命名窗口',
      startTime: window.start_time || window.startTime || null,
      endTime: window.end_time || window.endTime || null,
      description: window.description || '',
      riskLevel: window.risk_level || window.riskLevel || 'medium',
      tables: []
    };

    // 解析表的流量配置
    if (window.tables && Array.isArray(window.tables)) {
      for (const tableConfig of window.tables) {
        result.tables.push(this.normalizeTableTraffic(tableConfig));
      }
    } else if (window.tables && typeof window.tables === 'object') {
      for (const [tableName, tableConfig] of Object.entries(window.tables)) {
        result.tables.push(this.normalizeTableTraffic({ name: tableName, ...tableConfig }));
      }
    }

    return result;
  }

  normalizeTableTraffic(tableConfig) {
    return {
      name: tableConfig.name || tableConfig.table_name || null,
      trafficLevel: tableConfig.traffic_level || tableConfig.trafficLevel || 'medium',
      readQPS: tableConfig.read_qps || tableConfig.readQPS || 0,
      writeQPS: tableConfig.write_qps || tableConfig.writeQPS || 0,
      concurrentConnections: tableConfig.concurrent_connections || tableConfig.concurrentConnections || 0,
      description: tableConfig.description || '',
      highRisk: tableConfig.high_risk || tableConfig.highRisk || false,
      maintenanceWindow: tableConfig.maintenance_window || tableConfig.maintenanceWindow || null
    };
  }

  getWindowForTime(trafficWindows, time) {
    // 时间格式: "HH:MM" 或 "YYYY-MM-DD HH:MM"
    const targetTime = this.parseTime(time);
    
    for (const window of trafficWindows) {
      const start = this.parseTime(window.startTime);
      const end = this.parseTime(window.endTime);
      
      if (this.isTimeInRange(targetTime, start, end)) {
        return window;
      }
    }
    
    return null;
  }

  parseTime(timeStr) {
    if (!timeStr) return null;
    
    // 支持多种时间格式
    // 1. "HH:MM"
    // 2. "HH:MM:SS"
    // 3. "YYYY-MM-DD HH:MM"
    // 4. "YYYY-MM-DD HH:MM:SS"
    
    const timeOnlyMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeOnlyMatch) {
      return {
        hours: parseInt(timeOnlyMatch[1]),
        minutes: parseInt(timeOnlyMatch[2]),
        seconds: parseInt(timeOnlyMatch[3] || '0'),
        date: null
      };
    }
    
    const fullDateTimeMatch = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (fullDateTimeMatch) {
      return {
        hours: parseInt(fullDateTimeMatch[4]),
        minutes: parseInt(fullDateTimeMatch[5]),
        seconds: parseInt(fullDateTimeMatch[6] || '0'),
        date: {
          year: parseInt(fullDateTimeMatch[1]),
          month: parseInt(fullDateTimeMatch[2]),
          day: parseInt(fullDateTimeMatch[3])
        }
      };
    }
    
    return null;
  }

  isTimeInRange(target, start, end) {
    if (!target || !start || !end) return false;
    
    const targetMinutes = target.hours * 60 + target.minutes;
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    
    // 处理跨天的情况，例如 23:00 - 02:00
    if (startMinutes > endMinutes) {
      return targetMinutes >= startMinutes || targetMinutes <= endMinutes;
    }
    
    return targetMinutes >= startMinutes && targetMinutes <= endMinutes;
  }

  getTableTraffic(trafficWindows, tableName, time) {
    const window = this.getWindowForTime(trafficWindows, time);
    if (!window) return null;
    
    return window.tables.find(t => t.name === tableName) || null;
  }

  estimateRiskLevel(trafficWindows, tableName, time) {
    const tableTraffic = this.getTableTraffic(trafficWindows, tableName, time);
    
    if (!tableTraffic) {
      return {
        level: 'medium',
        reason: '未找到该表的流量配置'
      };
    }
    
    // 根据 QPS 和并发连接评估风险
    const writeQPS = tableTraffic.writeQPS || 0;
    const concurrentConnections = tableTraffic.concurrentConnections || 0;
    
    if (tableTraffic.highRisk) {
      return {
        level: 'high',
        reason: '该表被标记为高风险表'
      };
    }
    
    if (writeQPS > 1000 || concurrentConnections > 100) {
      return {
        level: 'high',
        reason: `高写入负载: writeQPS=${writeQPS}, 并发连接=${concurrentConnections}`
      };
    }
    
    if (writeQPS > 100 || concurrentConnections > 20) {
      return {
        level: 'medium',
        reason: `中等写入负载: writeQPS=${writeQPS}, 并发连接=${concurrentConnections}`
      };
    }
    
    return {
      level: 'low',
      reason: `低写入负载: writeQPS=${writeQPS}, 并发连接=${concurrentConnections}`
    };
  }
}

module.exports = TrafficParser;