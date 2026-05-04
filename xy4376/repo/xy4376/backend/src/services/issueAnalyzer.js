export function analyzeIssues({ geojson, fanWindowData, sensorData }) {
  const issues = [];
  
  const fanIssues = analyzeFanDirection(fanWindowData);
  issues.push(...fanIssues);
  
  const concentrationIssues = analyzeConcentrationThreshold(sensorData);
  issues.push(...concentrationIssues);
  
  const exitBlockedIssues = analyzeExitBlocked(geojson, sensorData);
  issues.push(...exitBlockedIssues);
  
  const sensorOfflineIssues = analyzeSensorOffline(sensorData);
  issues.push(...sensorOfflineIssues);
  
  return issues;
}

function analyzeFanDirection(fanWindowData) {
  const issues = [];
  
  if (!fanWindowData || !fanWindowData.fans) {
    return issues;
  }
  
  const fans = fanWindowData.fans;
  const windows = fanWindowData.windows || [];
  
  const intakeFans = fans.filter(f => f.mode === 'intake' || f.direction === 'in');
  const exhaustFans = fans.filter(f => f.mode === 'exhaust' || f.direction === 'out');
  const openWindows = windows.filter(w => w.status === 'open');
  
  if (intakeFans.length > 0 && exhaustFans.length === 0 && openWindows.length === 0) {
    issues.push({
      type: 'fan_direction_abnormal',
      severity: 'high',
      description: '所有风机均为进风模式且无排气出口，可能导致正压过大烟雾无法排出',
      details: {
        intakeCount: intakeFans.length,
        exhaustCount: exhaustFans.length,
        openWindows: openWindows.length
      }
    });
  }
  
  if (exhaustFans.length > 0 && intakeFans.length === 0 && openWindows.length === 0) {
    issues.push({
      type: 'fan_direction_abnormal',
      severity: 'medium',
      description: '所有风机均为排风模式且无补风口，可能导致负压影响排烟效率',
      details: {
        intakeCount: intakeFans.length,
        exhaustCount: exhaustFans.length,
        openWindows: openWindows.length
      }
    });
  }
  
  for (const fan of fans) {
    if (fan.status === 'off' && fan.required === true) {
      issues.push({
        type: 'fan_direction_abnormal',
        severity: 'high',
        description: `风机 "${fan.name || fan.id}" 应开启但处于关闭状态`,
        location: fan.location || `坐标 (${fan.x}, ${fan.y})`,
        details: fan
      });
    }
    
    if (fan.expectedDirection && fan.direction !== fan.expectedDirection) {
      issues.push({
        type: 'fan_direction_abnormal',
        severity: 'medium',
        description: `风机 "${fan.name || fan.id}" 方向异常`,
        location: fan.location || `坐标 (${fan.x}, ${fan.y})`,
        details: {
          expected: fan.expectedDirection,
          actual: fan.direction,
          ...fan
        }
      });
    }
  }
  
  return issues;
}

function analyzeConcentrationThreshold(sensorData) {
  const issues = [];
  
  if (!sensorData || !sensorData.readings) {
    return issues;
  }
  
  const threshold = sensorData.threshold || 100;
  const criticalThreshold = sensorData.criticalThreshold || 200;
  
  for (const reading of sensorData.readings) {
    const sensorName = reading.sensorName || reading.sensorId;
    const values = reading.values || [];
    
    for (const value of values) {
      const concentration = value.concentration;
      const timestamp = value.timestamp;
      
      if (concentration >= criticalThreshold) {
        issues.push({
          type: 'concentration_exceeded',
          severity: 'critical',
          description: `传感器 "${sensorName}" 烟雾浓度严重超标`,
          timestamp: timestamp,
          location: reading.location || sensorName,
          details: {
            concentration: concentration,
            threshold: criticalThreshold,
            thresholdType: 'critical'
          }
        });
      } else if (concentration >= threshold) {
        issues.push({
          type: 'concentration_exceeded',
          severity: 'high',
          description: `传感器 "${sensorName}" 烟雾浓度超出阈值`,
          timestamp: timestamp,
          location: reading.location || sensorName,
          details: {
            concentration: concentration,
            threshold: threshold,
            thresholdType: 'warning'
          }
        });
      }
    }
  }
  
  return issues;
}

function analyzeExitBlocked(geojson, sensorData) {
  const issues = [];
  
  if (!geojson || !geojson.features || !sensorData) {
    return issues;
  }
  
  const exits = geojson.features.filter(f => 
    f.properties && (f.properties.type === 'exit' || f.properties.category === 'exit')
  );
  
  const sensors = sensorData.sensors || [];
  const readings = sensorData.readings || [];
  const threshold = sensorData.threshold || 100;
  
  for (const exit of exits) {
    const exitName = exit.properties.name || exit.properties.id || '未命名出口';
    const exitCoords = exit.geometry.coordinates;
    
    const nearbySensors = sensors.filter(s => {
      if (!s.x || !s.y || !exitCoords) return false;
      const distance = Math.sqrt(
        Math.pow(s.x - exitCoords[0], 2) + 
        Math.pow(s.y - exitCoords[1], 2)
      );
      return distance < 5;
    });
    
    for (const sensor of nearbySensors) {
      const sensorReading = readings.find(r => 
        r.sensorId === sensor.id || r.sensorName === sensor.name
      );
      
      if (sensorReading && sensorReading.values) {
        for (const value of sensorReading.values) {
          if (value.concentration >= threshold) {
            issues.push({
              type: 'exit_blocked',
              severity: 'critical',
              description: `出口 "${exitName}" 被烟雾遮挡，影响疏散路线`,
              timestamp: value.timestamp,
              location: exitName,
              details: {
                exitName: exitName,
                sensorName: sensor.name || sensor.id,
                concentration: value.concentration,
                threshold: threshold,
                exitCoordinates: exitCoords
              }
            });
          }
        }
      }
    }
  }
  
  return issues;
}

function analyzeSensorOffline(sensorData) {
  const issues = [];
  
  if (!sensorData) {
    return issues;
  }
  
  const sensors = sensorData.sensors || [];
  const readings = sensorData.readings || [];
  
  const activeSensorIds = new Set(
    readings.map(r => r.sensorId).filter(id => id)
  );
  
  for (const sensor of sensors) {
    const sensorId = sensor.id;
    const sensorName = sensor.name || sensorId;
    
    if (!activeSensorIds.has(sensorId)) {
      issues.push({
        type: 'sensor_offline',
        severity: 'high',
        description: `传感器 "${sensorName}" 离线，无数据上报`,
        location: sensor.location || `坐标 (${sensor.x}, ${sensor.y})`,
        details: {
          sensorId: sensorId,
          sensorName: sensorName,
          lastSeen: sensor.lastSeen || null,
          status: 'offline'
        }
      });
    } else {
      const sensorReading = readings.find(r => 
        r.sensorId === sensorId || r.sensorName === sensor.name
      );
      
      if (sensorReading && sensorReading.values && sensorReading.values.length > 0) {
        const lastValue = sensorReading.values[sensorReading.values.length - 1];
        if (lastValue.status === 'offline' || lastValue.value === null) {
          issues.push({
            type: 'sensor_offline',
            severity: 'medium',
            description: `传感器 "${sensorName}" 数据异常或已离线`,
            timestamp: lastValue.timestamp,
            location: sensor.location || `坐标 (${sensor.x}, ${sensor.y})`,
            details: {
              sensorId: sensorId,
              sensorName: sensorName,
              status: lastValue.status,
              lastTimestamp: lastValue.timestamp
            }
          });
        }
      }
    }
  }
  
  return issues;
}

export function calculateRiskScore(issues) {
  let score = 0;
  const weights = {
    critical: 100,
    high: 50,
    medium: 20,
    low: 5
  };
  
  const categories = {};
  
  for (const issue of issues) {
    const weight = weights[issue.severity] || 10;
    score += weight;
    
    if (!categories[issue.type]) {
      categories[issue.type] = 0;
    }
    categories[issue.type] += weight;
  }
  
  let riskLevel = 'low';
  if (score >= 200) riskLevel = 'critical';
  else if (score >= 100) riskLevel = 'high';
  else if (score >= 50) riskLevel = 'medium';
  
  return {
    score,
    riskLevel,
    categories,
    totalIssues: issues.length,
    breakdown: {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }
  };
}
