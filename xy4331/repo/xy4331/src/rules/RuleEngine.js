const { allAsync, getAsync } = require('../config/database');
const ValidationViolation = require('../models/ValidationViolation');
const TransferRecord = require('../models/TransferRecord');
const VeterinaryOrder = require('../models/VeterinaryOrder');
const SensorAlert = require('../models/SensorAlert');
const Cage = require('../models/Cage');

class RuleEngine {
  static async runAllRules() {
    const results = {
      violations: [],
      statistics: {
        total_checked: 0,
        new_violations: 0,
        existing_violations: 0
      }
    };

    const ruleResults = await Promise.all([
      this.checkCageOccupancyConflict(),
      this.checkOpenAlerts(),
      this.checkUnsignedVeterinaryOrders(),
      this.checkObservationTimeout(),
      this.checkDuplicateTransfers(),
      this.checkCageCapacityOverload()
    ]);

    ruleResults.forEach(ruleResult => {
      results.violations.push(...ruleResult.violations);
      results.statistics.total_checked += ruleResult.checked;
      results.statistics.new_violations += ruleResult.new_count;
      results.statistics.existing_violations += ruleResult.existing_count;
    });

    return results;
  }

  static async checkCageOccupancyConflict() {
    const violations = [];
    let checked = 0;
    let newCount = 0;
    let existingCount = 0;

    const conflicts = await allAsync(`
      SELECT 
        co1.animal_id as animal1,
        co2.animal_id as animal2,
        co1.cage_id,
        co1.start_date as start1,
        co2.start_date as start2,
        co1.end_date as end1,
        co2.end_date as end2
      FROM cage_occupancy co1
      JOIN cage_occupancy co2 ON co1.cage_id = co2.cage_id 
        AND co1.animal_id != co2.animal_id
        AND co1.is_active = 1
        AND co2.is_active = 1
      WHERE co1.rowid < co2.rowid
    `);

    checked += conflicts.length;

    for (const conflict of conflicts) {
      const existingViolation = await allAsync(`
        SELECT * FROM validation_violations 
        WHERE violation_type = 'cage_occupancy_conflict'
        AND related_entity_id = ?
        AND status = 'open'
      `, [`${conflict.cage_id}-${conflict.animal1}-${conflict.animal2}`]);

      if (existingViolation.length > 0) {
        existingCount++;
        continue;
      }

      const violation = await ValidationViolation.create({
        violation_type: 'cage_occupancy_conflict',
        severity: 'high',
        related_entity_type: 'cage',
        related_entity_id: `${conflict.cage_id}-${conflict.animal1}-${conflict.animal2}`,
        description: `笼位 ${conflict.cage_id} 存在占用冲突：动物 ${conflict.animal1} 和 ${conflict.animal2} 同时占用该笼位`,
        status: 'open'
      });
      violations.push(violation);
      newCount++;
    }

    const activeOccupancies = await allAsync(`
      SELECT co.animal_id, co.cage_id, co.start_date
      FROM cage_occupancy co
      WHERE co.is_active = 1
    `);

    for (const occupancy of activeOccupancies) {
      const otherActive = await allAsync(`
        SELECT * FROM transfer_records tr
        WHERE tr.animal_id = ?
        AND tr.status IN ('pending', 'completed')
        AND tr.to_cage_id != ?
        AND tr.transfer_date >= ?
      `, [occupancy.animal_id, occupancy.cage_id, occupancy.start_date]);

      checked++;

      for (const transfer of otherActive) {
        const existingViolation = await allAsync(`
          SELECT * FROM validation_violations 
          WHERE violation_type = 'multiple_active_cages'
          AND related_entity_id = ?
          AND status = 'open'
        `, [`${occupancy.animal_id}`]);

        if (existingViolation.length > 0) {
          existingCount++;
          continue;
        }

        const violation = await ValidationViolation.create({
          violation_type: 'multiple_active_cages',
          severity: 'critical',
          related_entity_type: 'animal',
          related_entity_id: occupancy.animal_id,
          description: `动物 ${occupancy.animal_id} 存在多个活动笼位记录：当前笼位 ${occupancy.cage_id}，但有转笼记录到 ${transfer.to_cage_id}`,
          status: 'open'
        });
        violations.push(violation);
        newCount++;
      }
    }

    return { violations, checked, new_count: newCount, existing_count: existingCount };
  }

  static async checkOpenAlerts() {
    const violations = [];
    let checked = 0;
    let newCount = 0;
    let existingCount = 0;

    const openAlerts = await allAsync(`
      SELECT sa.*, c.rack_id, c.position,
        (SELECT GROUP_CONCAT(a.animal_id, ', ') 
         FROM cage_occupancy co 
         JOIN animals a ON co.animal_id = a.animal_id 
         WHERE co.cage_id = sa.cage_id AND co.is_active = 1) as animals_in_cage
      FROM sensor_alerts sa
      JOIN cages c ON sa.cage_id = c.cage_id
      WHERE sa.status IN ('open', 'acknowledged')
      ORDER BY sa.alert_time ASC
    `);

    const now = new Date();
    
    for (const alert of openAlerts) {
      checked++;
      
      const alertTime = new Date(alert.alert_time);
      const hoursOpen = (now - alertTime) / (1000 * 60 * 60);

      let severity = 'medium';
      let urgency = '';

      if (alert.severity === 'critical') {
        severity = 'critical';
        urgency = '【紧急】';
      } else if (hoursOpen > 24) {
        severity = 'high';
        urgency = '【超时】';
      }

      const existingViolation = await allAsync(`
        SELECT * FROM validation_violations 
        WHERE violation_type = 'open_alert'
        AND related_entity_id = ?
        AND status = 'open'
      `, [alert.alert_id]);

      if (existingViolation.length > 0) {
        existingCount++;
        continue;
      }

      const violation = await ValidationViolation.create({
        violation_type: 'open_alert',
        severity: severity,
        related_entity_type: 'sensor_alert',
        related_entity_id: alert.alert_id,
        description: `${urgency}笼位 ${alert.cage_id} (架:${alert.rack_id} 位置:${alert.position}) 的 ${alert.sensor_type} 告警未闭环。测量值: ${alert.measured_value}, 阈值: ${alert.threshold_value}。已开放 ${Math.floor(hoursOpen)} 小时。笼内动物: ${alert.animals_in_cage || '无'}`,
        status: 'open'
      });
      violations.push(violation);
      newCount++;
    }

    return { violations, checked, new_count: newCount, existing_count: existingCount };
  }

  static async checkUnsignedVeterinaryOrders() {
    const violations = [];
    let checked = 0;
    let newCount = 0;
    let existingCount = 0;

    const unsignedOrders = await allAsync(`
      SELECT vo.*, a.species, a.strain, a.gender
      FROM veterinary_orders vo
      JOIN animals a ON vo.animal_id = a.animal_id
      WHERE (vo.status = 'draft' OR vo.veterinarian_signature IS NULL)
      ORDER BY vo.examination_date ASC
    `);

    const now = new Date();

    for (const order of unsignedOrders) {
      checked++;
      
      const examDate = new Date(order.examination_date);
      const daysPending = Math.floor((now - examDate) / (1000 * 60 * 60 * 24));

      let severity = 'medium';
      if (daysPending > 3) {
        severity = 'high';
      } else if (daysPending > 7) {
        severity = 'critical';
      }

      const existingViolation = await allAsync(`
        SELECT * FROM validation_violations 
        WHERE violation_type = 'unsigned_veterinary_order'
        AND related_entity_id = ?
        AND status = 'open'
      `, [order.order_id]);

      if (existingViolation.length > 0) {
        existingCount++;
        continue;
      }

      const violation = await ValidationViolation.create({
        violation_type: 'unsigned_veterinary_order',
        severity: severity,
        related_entity_type: 'veterinary_order',
        related_entity_id: order.order_id,
        description: `兽医处置单 ${order.order_id} 缺少兽医签名。动物: ${order.animal_id} (${order.species} ${order.strain}), 诊断: ${order.diagnosis || '未填写'}, 检查日期: ${order.examination_date.substring(0, 10)}, 已等待 ${daysPending} 天`,
        status: 'open'
      });
      violations.push(violation);
      newCount++;
    }

    return { violations, checked, new_count: newCount, existing_count: existingCount };
  }

  static async checkObservationTimeout() {
    const violations = [];
    let checked = 0;
    let newCount = 0;
    let existingCount = 0;

    const observingOrders = await allAsync(`
      SELECT vo.*, a.species, a.strain
      FROM veterinary_orders vo
      JOIN animals a ON vo.animal_id = a.animal_id
      WHERE vo.status = 'observing'
      AND vo.start_observation_date IS NOT NULL
    `);

    const now = new Date();

    for (const order of observingOrders) {
      checked++;
      
      const startDate = new Date(order.start_observation_date);
      const daysObserved = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      const daysOverdue = daysObserved - order.observation_period_days;

      if (daysOverdue <= 0) {
        continue;
      }

      let severity = 'medium';
      if (daysOverdue > 3) {
        severity = 'high';
      } else if (daysOverdue > 7) {
        severity = 'critical';
      }

      const existingViolation = await allAsync(`
        SELECT * FROM validation_violations 
        WHERE violation_type = 'observation_timeout'
        AND related_entity_id = ?
        AND status = 'open'
      `, [order.order_id]);

      if (existingViolation.length > 0) {
        existingCount++;
        continue;
      }

      const violation = await ValidationViolation.create({
        violation_type: 'observation_timeout',
        severity: severity,
        related_entity_type: 'veterinary_order',
        related_entity_id: order.order_id,
        description: `动物 ${order.animal_id} (${order.species} ${order.strain}) 的观察期已超时。处置单: ${order.order_id}, 观察期: ${order.observation_period_days} 天, 实际: ${daysObserved} 天, 超期: ${daysOverdue} 天。诊断: ${order.diagnosis || '未记录'}`,
        status: 'open'
      });
      violations.push(violation);
      newCount++;
    }

    return { violations, checked, new_count: newCount, existing_count: existingCount };
  }

  static async checkDuplicateTransfers() {
    const violations = [];
    let checked = 0;
    let newCount = 0;
    let existingCount = 0;

    const duplicates = await allAsync(`
      SELECT 
        animal_id,
        from_cage_id,
        to_cage_id,
        DATE(transfer_date) as transfer_day,
        COUNT(*) as count,
        GROUP_CONCAT(transfer_id, ', ') as transfer_ids
      FROM transfer_records
      WHERE status IN ('pending', 'completed')
      GROUP BY animal_id, from_cage_id, to_cage_id, DATE(transfer_date)
      HAVING count > 1
    `);

    for (const dup of duplicates) {
      checked++;

      const existingViolation = await allAsync(`
        SELECT * FROM validation_violations 
        WHERE violation_type = 'duplicate_transfer'
        AND related_entity_id = ?
        AND status = 'open'
      `, [`${dup.animal_id}-${dup.transfer_day}`]);

      if (existingViolation.length > 0) {
        existingCount++;
        continue;
      }

      const violation = await ValidationViolation.create({
        violation_type: 'duplicate_transfer',
        severity: 'high',
        related_entity_type: 'transfer_record',
        related_entity_id: `${dup.animal_id}-${dup.transfer_day}`,
        description: `检测到重复转笼记录：动物 ${dup.animal_id} 在 ${dup.transfer_day} 从 ${dup.from_cage_id || '未知'} 到 ${dup.to_cage_id} 有 ${dup.count} 条转笼记录。涉及转笼ID: ${dup.transfer_ids}`,
        status: 'open'
      });
      violations.push(violation);
      newCount++;
    }

    return { violations, checked, new_count: newCount, existing_count: existingCount };
  }

  static async checkCageCapacityOverload() {
    const violations = [];
    let checked = 0;
    let newCount = 0;
    let existingCount = 0;

    const overloadedCages = await allAsync(`
      SELECT 
        c.cage_id,
        c.rack_id,
        c.position,
        c.max_capacity,
        COUNT(co.animal_id) as current_count,
        GROUP_CONCAT(a.animal_id, ', ') as animals
      FROM cages c
      LEFT JOIN cage_occupancy co ON c.cage_id = co.cage_id AND co.is_active = 1
      LEFT JOIN animals a ON co.animal_id = a.animal_id
      GROUP BY c.cage_id, c.rack_id, c.position, c.max_capacity
      HAVING current_count > c.max_capacity
    `);

    for (const cage of overloadedCages) {
      checked++;

      const existingViolation = await allAsync(`
        SELECT * FROM validation_violations 
        WHERE violation_type = 'cage_capacity_overload'
        AND related_entity_id = ?
        AND status = 'open'
      `, [cage.cage_id]);

      if (existingViolation.length > 0) {
        existingCount++;
        continue;
      }

      const violation = await ValidationViolation.create({
        violation_type: 'cage_capacity_overload',
        severity: 'high',
        related_entity_type: 'cage',
        related_entity_id: cage.cage_id,
        description: `笼位 ${cage.cage_id} (架:${cage.rack_id} 位置:${cage.position}) 容量过载。最大容量: ${cage.max_capacity}, 当前数量: ${cage.current_count}。笼内动物: ${cage.animals || '未知'}`,
        status: 'open'
      });
      violations.push(violation);
      newCount++;
    }

    return { violations, checked, new_count: newCount, existing_count: existingCount };
  }

  static async validateTransfer(transferData) {
    const issues = [];

    if (transferData.from_cage_id === transferData.to_cage_id) {
      issues.push({
        type: 'same_cage_transfer',
        severity: 'error',
        message: '原笼位与目标笼位相同'
      });
    }

    if (transferData.from_cage_id) {
      const fromOccupancy = await allAsync(`
        SELECT * FROM cage_occupancy 
        WHERE cage_id = ? AND animal_id = ? AND is_active = 1
      `, [transferData.from_cage_id, transferData.animal_id]);

      if (fromOccupancy.length === 0) {
        issues.push({
          type: 'animal_not_in_source',
          severity: 'warning',
          message: `动物 ${transferData.animal_id} 不在原笼位 ${transferData.from_cage_id}`
        });
      }
    }

    const toCage = await getAsync(`
      SELECT c.*, COUNT(co.animal_id) as current_occupancy
      FROM cages c
      LEFT JOIN cage_occupancy co ON c.cage_id = co.cage_id AND co.is_active = 1
      WHERE c.cage_id = ?
    `, [transferData.to_cage_id]);

    if (toCage) {
      const futureOccupancy = toCage.current_occupancy + 1;
      if (futureOccupancy > toCage.max_capacity) {
        issues.push({
          type: 'target_cage_full',
          severity: 'error',
          message: `目标笼位 ${transferData.to_cage_id} 已满。当前: ${toCage.current_occupancy}, 最大: ${toCage.max_capacity}`
        });
      }
    }

    const existingTransfers = await allAsync(`
      SELECT * FROM transfer_records
      WHERE animal_id = ?
      AND from_cage_id = ?
      AND to_cage_id = ?
      AND DATE(transfer_date) = DATE(?)
      AND status IN ('pending', 'completed')
    `, [transferData.animal_id, transferData.from_cage_id, transferData.to_cage_id, transferData.transfer_date]);

    if (existingTransfers.length > 0) {
      issues.push({
        type: 'duplicate_transfer',
        severity: 'warning',
        message: `动物 ${transferData.animal_id} 在同一天已有相同转笼记录`
      });
    }

    const pendingTransfers = await allAsync(`
      SELECT * FROM transfer_records
      WHERE animal_id = ? AND status = 'pending'
    `, [transferData.animal_id]);

    if (pendingTransfers.length > 0) {
      issues.push({
        type: 'pending_transfer_exists',
        severity: 'warning',
        message: `动物 ${transferData.animal_id} 已有 ${pendingTransfers.length} 条待处理转笼记录`
      });
    }

    return issues;
  }
}

module.exports = RuleEngine;
