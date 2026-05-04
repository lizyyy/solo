const moment = require('moment');
const { runAsync, getAsync, allAsync } = require('../config/database');

async function getSystemConfig() {
  const configs = await allAsync('SELECT config_key, config_value FROM system_config');
  const result = {};
  configs.forEach(c => {
    result[c.config_key] = parseFloat(c.config_value);
  });
  return result;
}

async function calculateTemperatureRisks() {
  const config = await getSystemConfig();
  const minTemp = config.min_temp || 2;
  const maxTemp = config.max_temp || 8;
  
  const risks = [];
  
  const loggers = await allAsync(`
    SELECT DISTINCT logger_id FROM temperature_records
    WHERE date(record_time) = date('now')
  `);

  for (const logger of loggers) {
    const records = await allAsync(`
      SELECT record_time, temperature 
      FROM temperature_records 
      WHERE logger_id = ? 
      AND date(record_time) = date('now')
      ORDER BY record_time
    `, [logger.logger_id]);

    if (records.length > 0) {
      let overTempDuration = 0;
      let underTempDuration = 0;
      let chainBreakDuration = 0;
      let hasChainBreak = false;

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const temp = parseFloat(record.temperature);

        if (temp > maxTemp) {
          overTempDuration += 5;
        }
        if (temp < minTemp) {
          underTempDuration += 5;
        }

        if (i > 0) {
          const prevTime = moment(records[i-1].record_time);
          const currTime = moment(record.record_time);
          const gapMinutes = currTime.diff(prevTime, 'minutes');
          
          if (gapMinutes > 30) {
            chainBreakDuration += gapMinutes;
            hasChainBreak = true;
          }
        }
      }

      if (overTempDuration > 0) {
        risks.push({
          risk_type: 'over_temperature',
          risk_level: overTempDuration > 30 ? 'high' : 'medium',
          description: `记录仪 ${logger.logger_id} 存在超温记录，超温时长约 ${overTempDuration} 分钟`,
          affected_item: logger.logger_id,
          affected_type: 'temperature_logger',
          details: { overTempDuration, maxTemp }
        });
      }

      if (underTempDuration > 0) {
        risks.push({
          risk_type: 'under_temperature',
          risk_level: underTempDuration > 30 ? 'high' : 'medium',
          description: `记录仪 ${logger.logger_id} 存在低温记录，低温时长约 ${underTempDuration} 分钟`,
          affected_item: logger.logger_id,
          affected_type: 'temperature_logger',
          details: { underTempDuration, minTemp }
        });
      }

      if (hasChainBreak) {
        risks.push({
          risk_type: 'chain_break',
          risk_level: 'high',
          description: `记录仪 ${logger.logger_id} 存在冷链断链，断链时长约 ${chainBreakDuration} 分钟`,
          affected_item: logger.logger_id,
          affected_type: 'temperature_logger',
          details: { chainBreakDuration }
        });
      }
    }
  }

  return risks;
}

async function calculateBatchMismatchRisks() {
  const risks = [];
  
  const batches = await allAsync(`
    SELECT 
      ab.batch_number,
      ab.vaccine_name,
      ab.expected_container_id,
      ba.container_id as actual_container_id
    FROM appointment_batches ab
    LEFT JOIN batch_assignments ba ON ab.batch_number = ba.batch_number
    WHERE date(ab.appointment_date) = date('now')
  `);

  for (const batch of batches) {
    if (batch.expected_container_id && batch.actual_container_id) {
      if (batch.expected_container_id !== batch.actual_container_id) {
        risks.push({
          risk_type: 'batch_mismatch',
          risk_level: 'high',
          description: `批次 ${batch.batch_number} (${batch.vaccine_name}) 箱体不匹配：预期 ${batch.expected_container_id}，实际 ${batch.actual_container_id}`,
          affected_item: batch.batch_number,
          affected_type: 'batch',
          details: {
            expected: batch.expected_container_id,
            actual: batch.actual_container_id
          }
        });
      }
    } else if (!batch.actual_container_id) {
      risks.push({
        risk_type: 'batch_no_container',
        risk_level: 'high',
        description: `批次 ${batch.batch_number} (${batch.vaccine_name}) 未分配到任何箱体`,
        affected_item: batch.batch_number,
        affected_type: 'batch',
        details: {}
      });
    }
  }

  return risks;
}

async function calculateCalibrationRisks() {
  const config = await getSystemConfig();
  const warningDays = config.calibration_warning_days || 30;
  const today = moment().format('YYYY-MM-DD');
  const warningDate = moment().add(warningDays, 'days').format('YYYY-MM-DD');
  
  const risks = [];
  
  const expiringRecords = await allAsync(`
    SELECT * FROM calibration_records 
    WHERE expire_date <= ? 
    ORDER BY expire_date ASC
  `, [warningDate]);

  for (const record of expiringRecords) {
    const expireDate = moment(record.expire_date);
    const daysUntilExpire = expireDate.diff(moment(today), 'days');
    
    if (daysUntilExpire < 0) {
      risks.push({
        risk_type: 'calibration_expired',
        risk_level: 'high',
        description: `设备 ${record.device_id} (${record.device_type}) 校准已过期 ${Math.abs(daysUntilExpire)} 天`,
        affected_item: record.device_id,
        affected_type: record.device_type,
        details: {
          expire_date: record.expire_date,
          certificate_number: record.certificate_number
        }
      });
    } else if (daysUntilExpire <= warningDays) {
      risks.push({
        risk_type: 'calibration_warning',
        risk_level: 'medium',
        description: `设备 ${record.device_id} (${record.device_type}) 校准将在 ${daysUntilExpire} 天后过期`,
        affected_item: record.device_id,
        affected_type: record.device_type,
        details: {
          expire_date: record.expire_date,
          days_until_expire: daysUntilExpire
        }
      });
    }
  }

  return risks;
}

async function calculateSpareContainerRisks() {
  const config = await getSystemConfig();
  const requiredSpare = config.required_spare_count || 2;
  
  const risks = [];
  
  const activeContainers = await allAsync(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_spare = 1 THEN 1 ELSE 0 END) as spare_count
    FROM containers 
    WHERE status = 'active'
  `);

  const { total, spare_count: spareCount } = activeContainers[0] || { total: 0, spare_count: 0 };
  
  if (spareCount < requiredSpare) {
    risks.push({
      risk_type: 'insufficient_spare',
      risk_level: 'high',
      description: `备用箱数量不足：要求 ${requiredSpare} 个，实际 ${spareCount} 个`,
      affected_item: 'containers',
      affected_type: 'system',
      details: {
        required: requiredSpare,
        actual: spareCount,
        total_active: total
      }
    });
  }

  return risks;
}

async function calculateIcePackRisks() {
  const risks = [];
  
  const inactiveIcePacks = await allAsync(`
    SELECT pack_id, frozen_status, container_id 
    FROM ice_packs 
    WHERE status != 'active' OR frozen_status != 'frozen'
  `);

  for (const pack of inactiveIcePacks) {
    if (pack.status !== 'active') {
      risks.push({
        risk_type: 'ice_pack_inactive',
        risk_level: 'medium',
        description: `冰排 ${pack.pack_id} 状态为非活动`,
        affected_item: pack.pack_id,
        affected_type: 'ice_pack',
        details: { status: pack.status }
      });
    }
    if (pack.frozen_status !== 'frozen') {
      risks.push({
        risk_type: 'ice_pack_not_frozen',
        risk_level: 'high',
        description: `冰排 ${pack.pack_id} 未完全冻结，状态: ${pack.frozen_status}`,
        affected_item: pack.pack_id,
        affected_type: 'ice_pack',
        details: { frozen_status: pack.frozen_status }
      });
    }
  }

  return risks;
}

async function calculateAllRisks() {
  const allRisks = [];
  
  const [tempRisks, batchRisks, calibrationRisks, spareRisks, icePackRisks] = await Promise.all([
    calculateTemperatureRisks(),
    calculateBatchMismatchRisks(),
    calculateCalibrationRisks(),
    calculateSpareContainerRisks(),
    calculateIcePackRisks()
  ]);

  allRisks.push(...tempRisks, ...batchRisks, ...calibrationRisks, ...spareRisks, ...icePackRisks);

  for (const risk of allRisks) {
    try {
      await runAsync(`
        INSERT OR REPLACE INTO risk_assessments 
        (risk_type, risk_level, description, affected_item, affected_type)
        VALUES (?, ?, ?, ?, ?)
      `, [risk.risk_type, risk.risk_level, risk.description, risk.affected_item, risk.affected_type]);
    } catch (e) {
    }
  }

  return allRisks;
}

async function getRiskList(filter = {}) {
  let whereClause = '1=1';
  const params = [];

  if (filter.risk_type) {
    whereClause += ' AND risk_type = ?';
    params.push(filter.risk_type);
  }
  if (filter.risk_level) {
    whereClause += ' AND risk_level = ?';
    params.push(filter.risk_level);
  }
  if (filter.review_status) {
    whereClause += ' AND review_status = ?';
    params.push(filter.review_status);
  }
  if (filter.affected_type) {
    whereClause += ' AND affected_type = ?';
    params.push(filter.affected_type);
  }

  const risks = await allAsync(`
    SELECT * FROM risk_assessments 
    WHERE ${whereClause}
    ORDER BY 
      CASE risk_level 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      calculated_at DESC
  `, params);

  return risks;
}

async function updateRiskReview(riskId, reviewData) {
  const { review_status, review_comment, reviewer_name } = reviewData;
  
  await runAsync(`
    UPDATE risk_assessments 
    SET review_status = ?, review_comment = ?, reviewer_name = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `, [review_status, review_comment || null, reviewer_name || null, riskId]);

  const updatedRisk = await getAsync('SELECT * FROM risk_assessments WHERE id = ?', [riskId]);
  return updatedRisk;
}

module.exports = {
  calculateAllRisks,
  calculateTemperatureRisks,
  calculateBatchMismatchRisks,
  calculateCalibrationRisks,
  calculateSpareContainerRisks,
  calculateIcePackRisks,
  getRiskList,
  updateRiskReview
};
