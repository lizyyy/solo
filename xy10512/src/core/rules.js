const dataStore = require('../utils/dataStore');

const RULES = {
  OVER_TEMPERATURE_THRESHOLD: -10,
  UNDER_TEMPERATURE_THRESHOLD: -25,
  SHORT_DURATION_MINUTES: 15,
  LONG_DURATION_MINUTES: 120,
  MAINTENANCE_BUFFER_MINUTES: 10
};

class RuleEngine {
  constructor() {
    this.rules = RULES;
  }

  parseTime(timeStr) {
    return new Date(timeStr).getTime();
  }

  isInMaintenanceWindow(timestamp, maintenanceRecords, warehouseId) {
    const time = this.parseTime(timestamp);
    const buffer = this.rules.MAINTENANCE_BUFFER_MINUTES * 60 * 1000;
    
    return maintenanceRecords.some(m => {
      if (m.warehouseId !== warehouseId && m.warehouseId !== '*') return false;
      const start = this.parseTime(m.startTime) - buffer;
      const end = this.parseTime(m.endTime) + buffer;
      return time >= start && time <= end;
    });
  }

  isDuringDoorOpening(timestamp, doorRecords, warehouseId) {
    const time = this.parseTime(timestamp);
    
    return doorRecords.some(d => {
      if (d.warehouseId !== warehouseId) return false;
      if (!d.closeTime) return false;
      const start = this.parseTime(d.openTime);
      const end = this.parseTime(d.closeTime);
      return time >= start && time <= end;
    });
  }

  isTemperatureViolation(temp) {
    return temp > this.rules.OVER_TEMPERATURE_THRESHOLD || 
           temp < this.rules.UNDER_TEMPERATURE_THRESHOLD;
  }

  classifyDuration(startTime, endTime) {
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);
    const durationMs = end - start;
    const durationMin = durationMs / (60 * 1000);
    
    if (durationMin <= this.rules.SHORT_DURATION_MINUTES) {
      return 'SHORT';
    } else if (durationMin <= this.rules.LONG_DURATION_MINUTES) {
      return 'MEDIUM';
    } else {
      return 'LONG';
    }
  }

  findAffectedBatches(warehouseId, startTime, endTime) {
    const batches = dataStore.list('batch');
    const alertStart = this.parseTime(startTime);
    const alertEnd = this.parseTime(endTime);
    
    return batches.filter(b => {
      if (b.warehouseId !== warehouseId) return false;
      const inTime = this.parseTime(b.inTime);
      const outTime = b.outTime ? this.parseTime(b.outTime) : Date.now();
      
      return alertStart < outTime && alertEnd > inTime;
    });
  }

  analyzeAlert(alert) {
    const temperatureData = dataStore.get('temperature', alert.temperatureId);
    if (!temperatureData) {
      return { status: 'ERROR', reason: `温度数据不存在: ${alert.temperatureId}` };
    }

    const maintenanceRecords = dataStore.list('maintenance');
    const doorRecords = dataStore.list('door');
    
    const warehouseId = temperatureData.warehouseId;
    const startTime = temperatureData.startTime;
    const endTime = temperatureData.endTime || temperatureData.timestamp;
    
    const violations = [];
    const mitigations = [];
    
    temperatureData.readings?.forEach(reading => {
      if (this.isTemperatureViolation(reading.temperature)) {
        violations.push({
          timestamp: reading.timestamp,
          temperature: reading.temperature,
          isOverTemp: reading.temperature > this.rules.OVER_TEMPERATURE_THRESHOLD,
          isUnderTemp: reading.temperature < this.rules.UNDER_TEMPERATURE_THRESHOLD,
          inMaintenance: this.isInMaintenanceWindow(reading.timestamp, maintenanceRecords, warehouseId),
          duringDoorOpen: this.isDuringDoorOpening(reading.timestamp, doorRecords, warehouseId)
        });
      }
    });
    
    if (violations.length === 0) {
      return {
        status: 'LOW',
        severity: 'INFO',
        reason: '无温度违规记录',
        details: { violations: 0 }
      };
    }
    
    const duration = this.classifyDuration(startTime, endTime);
    
    const inMaintenance = violations.some(v => v.inMaintenance);
    const duringDoorOpen = violations.some(v => v.duringDoorOpen);
    
    if (inMaintenance) {
      mitigations.push('维护窗口短时波动 - 已降级');
    }
    if (duringDoorOpen) {
      mitigations.push('开门升温期间 - 需确认');
    }
    
    const allInMaintenance = violations.length > 0 && violations.every(v => v.inMaintenance);
    const allDuringDoor = violations.length > 0 && violations.every(v => v.duringDoorOpen);
    const hasNonMaintenanceViolations = violations.some(v => !v.inMaintenance && !v.duringDoorOpen);
    
    let severity = 'MEDIUM';
    let status = 'PENDING';
    let recommendation = '需人工复检';
    
    if (allInMaintenance && (duration === 'SHORT' || duration === 'MEDIUM')) {
      severity = 'LOW';
      status = 'RESOLVED';
      recommendation = '维护期间正常波动 - 已自动降级';
    } else if (inMaintenance && !hasNonMaintenanceViolations) {
      severity = 'LOW';
      status = 'RESOLVED';
      recommendation = '维护期间正常波动 - 已自动降级';
    } else if (allDuringDoor && duration === 'SHORT') {
      severity = 'LOW';
      status = 'PENDING';
      recommendation = '开门期间升温，确认关门后温度已恢复';
    } else if (duringDoorOpen && !hasNonMaintenanceViolations) {
      severity = 'LOW';
      status = 'PENDING';
      recommendation = '开门期间升温，需确认温度已恢复';
    } else if (duration === 'LONG' || violations.length >= 10) {
      severity = 'HIGH';
      status = 'CRITICAL';
      recommendation = '长时间超温，需立即检查商品批次，评估报损';
    }
    
    const affectedBatches = this.findAffectedBatches(warehouseId, startTime, endTime);
    
    return {
      status,
      severity,
      duration,
      violations: violations.length,
      mitigations,
      recommendation,
      affectedBatches: affectedBatches.map(b => ({
        id: b.id,
        productName: b.productName,
        quantity: b.quantity,
        inTime: b.inTime,
        outTime: b.outTime,
        requiredTemp: b.requiredTemperature
      })),
      details: {
        hasMaintenanceContext: inMaintenance,
        hasDoorContext: duringDoorOpen,
        durationType: duration
      }
    };
  }

  detectDuplicateSensor(newRecord) {
    const existing = dataStore.list('temperature');
    const sameSensor = existing.filter(r => 
      r.sensorId === newRecord.sensorId &&
      r.warehouseId === newRecord.warehouseId
    );
    
    return sameSensor.some(r => {
      if (!r.readings || !newRecord.readings) return false;
      const existingTimestamps = new Set(r.readings.map(reading => reading.timestamp));
      return newRecord.readings.some(reading => existingTimestamps.has(reading.timestamp));
    });
  }

  detectBreakpoint(record) {
    if (!record.readings || record.readings.length < 2) return null;
    
    const sorted = [...record.readings].sort((a, b) => 
      this.parseTime(a.timestamp) - this.parseTime(b.timestamp)
    );
    
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = this.parseTime(sorted[i - 1].timestamp);
      const curr = this.parseTime(sorted[i].timestamp);
      const gapMin = (curr - prev) / (60 * 1000);
      
      if (gapMin > 30) {
        gaps.push({
          index: i,
          from: sorted[i - 1].timestamp,
          to: sorted[i].timestamp,
          gapMinutes: Math.round(gapMin)
        });
      }
    }
    
    return gaps.length > 0 ? gaps : null;
  }
}

module.exports = new RuleEngine();
