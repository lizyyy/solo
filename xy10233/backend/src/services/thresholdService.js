const TankModel = require('../models/tank');
const AlertModel = require('../models/alert');
const WaterQualityModel = require('../models/waterQuality');
const BatchModel = require('../models/batch');

function checkThreshold(tank, value, min, max, typeHigh, typeLow, paramName) {
  const alerts = [];
  
  if (value > max) {
    alerts.push({
      tank_id: tank.id,
      alert_type: typeHigh,
      message: `${tank.name} ${paramName}过高: ${value} > ${max}`,
      threshold_value: max,
      actual_value: value
    });
  } else if (value < min) {
    alerts.push({
      tank_id: tank.id,
      alert_type: typeLow,
      message: `${tank.name} ${paramName}过低: ${value} < ${min}`,
      threshold_value: min,
      actual_value: value
    });
  }
  
  return alerts;
}

function checkWaterQuality(tankId, temperature, salinity, oxygen, waterQualityId) {
  const tank = TankModel.getById(tankId);
  if (!tank) {
    return { success: false, error: '暂养池不存在' };
  }
  
  const activeBatches = BatchModel.getByTankId(tankId)
    .filter(b => b.status === 'active');
  
  const alerts = [];
  
  const tempAlerts = checkThreshold(
    tank, temperature,
    tank.temperature_min, tank.temperature_max,
    AlertModel.ALERT_TYPE.TEMPERATURE_HIGH,
    AlertModel.ALERT_TYPE.TEMPERATURE_LOW,
    '温度'
  );
  alerts.push(...tempAlerts);
  
  const salinityAlerts = checkThreshold(
    tank, salinity,
    tank.salinity_min, tank.salinity_max,
    AlertModel.ALERT_TYPE.SALINITY_HIGH,
    AlertModel.ALERT_TYPE.SALINITY_LOW,
    '盐度'
  );
  alerts.push(...salinityAlerts);
  
  const oxygenAlerts = checkThreshold(
    tank, oxygen,
    tank.oxygen_min, tank.oxygen_max,
    AlertModel.ALERT_TYPE.OXYGEN_HIGH,
    AlertModel.ALERT_TYPE.OXYGEN_LOW,
    '溶氧'
  );
  alerts.push(...oxygenAlerts);
  
  const createdAlerts = [];
  if (alerts.length > 0) {
    for (const alert of alerts) {
      for (const batch of activeBatches) {
        const alertData = {
          ...alert,
          batch_id: batch.id,
          water_quality_id: waterQualityId
        };
        const createdAlert = AlertModel.create(alertData);
        createdAlerts.push(createdAlert);
      }
    }
  }
  
  let newStatus = TankModel.TANK_STATUS.NORMAL;
  if (alerts.length > 0) {
    const hasCritical = alerts.some(a => 
      a.alert_type.includes('temperature') || a.alert_type.includes('oxygen')
    );
    newStatus = hasCritical ? TankModel.TANK_STATUS.ALERT : TankModel.TANK_STATUS.WARNING;
  }
  
  TankModel.updateCurrentReadings(tankId, temperature, salinity, oxygen);
  TankModel.updateStatus(tankId, newStatus);
  
  return {
    success: true,
    tankStatus: newStatus,
    alertsGenerated: createdAlerts.length,
    alerts: createdAlerts
  };
}

function importWaterQuality(record, operator = null) {
  const tank = TankModel.getById(record.tank_id);
  if (!tank) {
    return { success: false, error: '暂养池不存在' };
  }
  
  const wqRecord = WaterQualityModel.create({
    ...record,
    operator,
    source: record.source || 'manual'
  });
  
  const checkResult = checkWaterQuality(
    record.tank_id,
    record.temperature,
    record.salinity,
    record.oxygen,
    wqRecord.id
  );
  
  return {
    success: true,
    waterQuality: wqRecord,
    checkResult
  };
}

function bulkImport(records, operator = null) {
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  let totalAlerts = 0;
  
  for (const record of records) {
    const result = importWaterQuality(record, operator);
    if (result.success) {
      successCount++;
      if (result.checkResult && result.checkResult.alertsGenerated) {
        totalAlerts += result.checkResult.alertsGenerated;
      }
    } else {
      failureCount++;
    }
    results.push({ record, result });
  }
  
  return {
    success: true,
    successCount,
    failureCount,
    totalAlerts,
    results
  };
}

module.exports = {
  checkWaterQuality,
  importWaterQuality,
  bulkImport
};
