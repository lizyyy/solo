export const DEFAULT_RULES = {
  sensorGapMinutes: 60,
  temperature: { min: 36.0, max: 38.0 },
  humidity: { min: 80, max: 95 },
  doorRecoveryMinutes: 15,
  alarmCodes: {
    TEMP_HIGH: 'TEMP_HIGH',
    TEMP_LOW: 'TEMP_LOW',
    HUMID_HIGH: 'HUMID_HIGH',
    HUMID_LOW: 'HUMID_LOW',
    DOOR_OPEN: 'DOOR_OPEN',
    SENSOR_ERROR: 'SENSOR_ERROR'
  }
};

export function checkAllAnomalies(deviceRecords, batchRecords, rules = DEFAULT_RULES) {
  const anomalies = [];
  const boxGroups = groupByBoxId(deviceRecords);

  for (const [boxId, records] of Object.entries(boxGroups)) {
    const sortedRecords = sortByTimestamp(records);
    
    anomalies.push(...checkSensorGaps(sortedRecords, boxId, rules.sensorGapMinutes));
    anomalies.push(...checkTemperatureRange(sortedRecords, boxId, rules.temperature));
    anomalies.push(...checkHumidityRange(sortedRecords, boxId, rules.humidity));
    anomalies.push(...checkDoorRecoveryTime(sortedRecords, boxId, rules.doorRecoveryMinutes));
    anomalies.push(...checkDuplicateRecords(sortedRecords, boxId));
  }

  anomalies.push(...checkBatchTimeWindow(deviceRecords, batchRecords));

  return anomalies;
}

export function checkSensorGaps(records, boxId, gapMinutes = 60) {
  const gaps = [];
  const gapMs = gapMinutes * 60 * 1000;

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    const timeDiff = curr.timestamp.getTime() - prev.timestamp.getTime();

    if (timeDiff > gapMs) {
      gaps.push({
        type: 'SENSOR_GAP',
        severity: 'WARNING',
        boxId,
        startTime: prev.timestamp,
        endTime: curr.timestamp,
        gapMinutes: Math.round(timeDiff / 60000),
        description: `传感器数据断点，间隔 ${Math.round(timeDiff / 60000)} 分钟`,
        previousRecord: { ...prev, timestamp: prev.timestamp.toISOString() },
        currentRecord: { ...curr, timestamp: curr.timestamp.toISOString() }
      });
    }
  }

  return gaps;
}

export function checkTemperatureRange(records, boxId, tempRange = DEFAULT_RULES.temperature) {
  const violations = [];

  for (const record of records) {
    if (record.temperature < tempRange.min || record.temperature > tempRange.max) {
      violations.push({
        type: 'TEMPERATURE_VIOLATION',
        severity: 'ERROR',
        boxId,
        timestamp: record.timestamp,
        temperature: record.temperature,
        expectedMin: tempRange.min,
        expectedMax: tempRange.max,
        description: `温度越界: ${record.temperature}°C (范围: ${tempRange.min}-${tempRange.max}°C)`,
        record: { ...record, timestamp: record.timestamp.toISOString() }
      });
    }
  }

  return violations;
}

export function checkHumidityRange(records, boxId, humidityRange = DEFAULT_RULES.humidity) {
  const violations = [];

  for (const record of records) {
    if (record.humidity < humidityRange.min || record.humidity > humidityRange.max) {
      violations.push({
        type: 'HUMIDITY_VIOLATION',
        severity: 'ERROR',
        boxId,
        timestamp: record.timestamp,
        humidity: record.humidity,
        expectedMin: humidityRange.min,
        expectedMax: humidityRange.max,
        description: `湿度越界: ${record.humidity}% (范围: ${humidityRange.min}-${humidityRange.max}%)`,
        record: { ...record, timestamp: record.timestamp.toISOString() }
      });
    }
  }

  return violations;
}

export function checkDoorRecoveryTime(records, boxId, recoveryMinutes = 15) {
  const violations = [];
  const recoveryMs = recoveryMinutes * 60 * 1000;
  
  let openTime = null;
  let openRecord = null;

  for (const record of records) {
    if (record.doorEvent === 'OPEN') {
      openTime = record.timestamp.getTime();
      openRecord = record;
    } else if (record.doorEvent === 'CLOSE' && openTime !== null) {
      const recoveryTime = record.timestamp.getTime() - openTime;
      
      if (recoveryTime > recoveryMs) {
        violations.push({
          type: 'DOOR_RECOVERY_TIMEOUT',
          severity: 'WARNING',
          boxId,
          openTimestamp: openRecord.timestamp,
          closeTimestamp: record.timestamp,
          recoveryMinutes: Math.round(recoveryTime / 60000),
          expectedRecoveryMinutes: recoveryMinutes,
          description: `开门后恢复超时: ${Math.round(recoveryTime / 60000)} 分钟 (阈值: ${recoveryMinutes} 分钟)`,
          openRecord: { ...openRecord, timestamp: openRecord.timestamp.toISOString() },
          closeRecord: { ...record, timestamp: record.timestamp.toISOString() }
        });
      }
      
      openTime = null;
      openRecord = null;
    }
  }

  if (openTime !== null && openRecord) {
    violations.push({
      type: 'DOOR_STILL_OPEN',
      severity: 'ERROR',
      boxId,
      openTimestamp: openRecord.timestamp,
      description: '门保持打开状态，未检测到关闭事件',
      openRecord: { ...openRecord, timestamp: openRecord.timestamp.toISOString() }
    });
  }

  return violations;
}

export function checkDuplicateRecords(records, boxId) {
  const duplicates = [];
  const seen = new Map();

  for (const record of records) {
    const key = `${record.timestamp.getTime()}-${record.temperature}-${record.humidity}`;
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      duplicates.push({
        type: 'DUPLICATE_RECORD',
        severity: 'WARNING',
        boxId,
        timestamp: record.timestamp,
        description: '检测到重复记录',
        records: [
          { ...existing, timestamp: existing.timestamp.toISOString() },
          { ...record, timestamp: record.timestamp.toISOString() }
        ]
      });
    } else {
      seen.set(key, record);
    }
  }

  return duplicates;
}

export function checkBatchTimeWindow(deviceRecords, batchRecords) {
  const missing = [];
  const boxDeviceGroups = groupByBoxId(deviceRecords);

  for (const batch of batchRecords) {
    const boxRecords = boxDeviceGroups[batch.boxId] || [];
    const sortedRecords = sortByTimestamp(boxRecords);
    
    const recordsInWindow = sortedRecords.filter(record => {
      return record.timestamp >= batch.startTime && 
             (batch.endTime ? record.timestamp <= batch.endTime : true);
    });

    if (recordsInWindow.length === 0) {
      missing.push({
        type: 'BATCH_TIME_WINDOW_MISSING',
        severity: 'ERROR',
        batchId: batch.batchId,
        boxId: batch.boxId,
        startTime: batch.startTime,
        endTime: batch.endTime,
        description: `批次 ${batch.batchId} 在时间窗口内没有设备数据`,
        batch: {
          ...batch,
          startTime: batch.startTime?.toISOString(),
          endTime: batch.endTime?.toISOString()
        }
      });
    }
  }

  return missing;
}

export function groupByBoxId(records) {
  const groups = {};
  for (const record of records) {
    const key = record.boxId;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
  }
  return groups;
}

export function sortByTimestamp(records) {
  return [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function mergeRecords(deviceRecords, batchRecords) {
  const merged = [];
  const boxGroups = groupByBoxId(deviceRecords);

  for (const [boxId, records] of Object.entries(boxGroups)) {
    const sortedRecords = sortByTimestamp(records);
    const boxBatches = batchRecords.filter(b => b.boxId === boxId);

    for (const record of sortedRecords) {
      const matchedBatches = boxBatches.filter(batch => {
        return record.timestamp >= batch.startTime && 
               (batch.endTime ? record.timestamp <= batch.endTime : true);
      });

      merged.push({
        ...record,
        timestamp: record.timestamp,
        batches: matchedBatches.map(b => ({
          batchId: b.batchId,
          startTime: b.startTime?.toISOString(),
          endTime: b.endTime?.toISOString(),
          sampleCount: b.sampleCount,
          operator: b.operator
        }))
      });
    }
  }

  return sortByTimestamp(merged);
}

export function getAnomalySummary(anomalies) {
  const summary = {
    total: anomalies.length,
    byType: {},
    bySeverity: {},
    byBoxId: {}
  };

  for (const anomaly of anomalies) {
    summary.byType[anomaly.type] = (summary.byType[anomaly.type] || 0) + 1;
    summary.bySeverity[anomaly.severity] = (summary.bySeverity[anomaly.severity] || 0) + 1;
    
    if (anomaly.boxId) {
      summary.byBoxId[anomaly.boxId] = (summary.byBoxId[anomaly.boxId] || 0) + 1;
    }
  }

  return summary;
}
