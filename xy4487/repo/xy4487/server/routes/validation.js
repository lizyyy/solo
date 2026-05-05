const express = require('express');
const router = express.Router();
const moment = require('moment');

function checkMaintenanceOverdue(machine) {
  if (!machine.last_maintenance) return null;
  
  const daysSinceMaintenance = moment().diff(moment(machine.last_maintenance), 'days');
  const isOverdue = daysSinceMaintenance > machine.maintenance_interval_days;
  
  if (isOverdue) {
    return {
      risk_type: 'maintenance_overdue',
      risk_level: 'high',
      description: `机具保养已逾期 ${daysSinceMaintenance - machine.maintenance_interval_days} 天，上次保养日期：${machine.last_maintenance}`,
      is_blocked: 1
    };
  }
  
  const isWarning = daysSinceMaintenance > machine.maintenance_interval_days - 7;
  if (isWarning) {
    return {
      risk_type: 'maintenance_warning',
      risk_level: 'medium',
      description: `机具保养即将逾期，剩余 ${machine.maintenance_interval_days - daysSinceMaintenance} 天`,
      is_blocked: 0
    };
  }
  
  return null;
}

function checkLicenseExpired(operator) {
  if (!operator.license_expiry) return null;
  
  const expiryDate = moment(operator.license_expiry);
  const daysUntilExpiry = expiryDate.diff(moment(), 'days');
  
  if (daysUntilExpiry < 0) {
    return {
      risk_type: 'license_expired',
      risk_level: 'high',
      description: `机手驾驶证已过期，过期日期：${operator.license_expiry}`,
      is_blocked: 1
    };
  }
  
  if (daysUntilExpiry < 30) {
    return {
      risk_type: 'license_expiring',
      risk_level: 'medium',
      description: `机手驾驶证即将过期，剩余 ${daysUntilExpiry} 天`,
      is_blocked: 0
    };
  }
  
  return null;
}

function checkTimeConflict(db, reservation, excludeId = null) {
  const { machine_id, start_time, end_time } = reservation;
  
  let query = `
    SELECT r.*, 
           p.plot_name,
           o.operator_name
    FROM reservations r
    LEFT JOIN plots p ON r.plot_id = p.id
    LEFT JOIN operators o ON r.operator_id = o.id
    WHERE r.machine_id = ? 
      AND r.id != ?
      AND (
        (r.start_time < ? AND r.end_time > ?)
        OR (r.start_time >= ? AND r.start_time < ?)
        OR (r.end_time > ? AND r.end_time <= ?)
      )
  `;
  
  const conflicts = db.prepare(query).all(
    machine_id, 
    excludeId || -1,
    end_time, start_time,
    start_time, end_time,
    start_time, end_time
  );
  
  if (conflicts.length > 0) {
    return {
      risk_type: 'time_conflict',
      risk_level: 'high',
      description: `机具时段冲突，与 ${conflicts.length} 个其他预约重叠：${conflicts.map(c => c.plot_name).join('、')}`,
      is_blocked: 1,
      conflicts: conflicts
    };
  }
  
  return null;
}

function checkSubsidyAbnormality(db, plot, reservation) {
  const subsidies = db.prepare(`
    SELECT * FROM oil_subsidies 
    WHERE plot_id = ? AND reservation_id = ?
  `).all(plot.id, reservation.id);
  
  const totalSubsidy = subsidies.reduce((sum, s) => sum + (s.subsidy_amount || 0), 0);
  const totalFuel = subsidies.reduce((sum, s) => sum + (s.fuel_consumption || 0), 0);
  
  const expectedFuelPerMu = 2;
  const expectedSubsidyPerMu = 10;
  const expectedFuel = plot.area * expectedFuelPerMu;
  const expectedSubsidy = plot.area * expectedSubsidyPerMu;
  
  const fuelDeviation = totalFuel > 0 ? Math.abs(totalFuel - expectedFuel) / expectedFuel : 0;
  const subsidyDeviation = totalSubsidy > 0 ? Math.abs(totalSubsidy - expectedSubsidy) / expectedSubsidy : 0;
  
  if (fuelDeviation > 0.5 || subsidyDeviation > 0.5) {
    return {
      risk_type: 'subsidy_abnormality',
      risk_level: 'high',
      description: `地块面积与油耗/补贴异常：面积 ${plot.area} 亩，预期油耗约 ${expectedFuel}L，实际油耗 ${totalFuel}L；预期补贴约 ${expectedSubsidy}元，实际补贴 ${totalSubsidy}元`,
      is_blocked: 1
    };
  }
  
  if (fuelDeviation > 0.2 || subsidyDeviation > 0.2) {
    return {
      risk_type: 'subsidy_warning',
      risk_level: 'medium',
      description: `地块面积与油耗/补贴偏差较大，请核实`,
      is_blocked: 0
    };
  }
  
  return null;
}

router.post('/reservation/:id', (req, res) => {
  const db = req.app.locals.db;
  const reservationId = req.params.id;
  
  try {
    const reservation = db.prepare(`
      SELECT r.*,
             m.*,
             o.*,
             p.*
      FROM reservations r
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
      LEFT JOIN plots p ON r.plot_id = p.id
      WHERE r.id = ?
    `).get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: '预约不存在' });
    }
    
    const risks = [];
    
    const maintenanceRisk = checkMaintenanceOverdue(reservation);
    if (maintenanceRisk) risks.push(maintenanceRisk);
    
    if (reservation.operator_id) {
      const licenseRisk = checkLicenseExpired(reservation);
      if (licenseRisk) risks.push(licenseRisk);
    }
    
    const timeConflictRisk = checkTimeConflict(db, reservation, reservation.id);
    if (timeConflictRisk) risks.push(timeConflictRisk);
    
    const subsidyRisk = checkSubsidyAbnormality(db, reservation, reservation);
    if (subsidyRisk) risks.push(subsidyRisk);
    
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM risk_assessments WHERE reservation_id = ?').run(reservationId);
      
      risks.forEach(risk => {
        db.prepare(`
          INSERT INTO risk_assessments (reservation_id, risk_type, risk_level, description, is_blocked, manual_override)
          VALUES (?, ?, ?, ?, ?, 0)
        `).run(reservationId, risk.risk_type, risk.risk_level, risk.description, risk.is_blocked);
      });
    });
    
    transaction();
    
    const blockedCount = risks.filter(r => r.is_blocked).length;
    
    res.json({
      reservation_id: reservationId,
      total_risks: risks.length,
      blocked_count: blockedCount,
      can_proceed: blockedCount === 0,
      risks: risks
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/all', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const reservations = db.prepare(`
      SELECT r.id, r.plot_id, r.machine_id, r.operator_id, r.start_time, r.end_time,
             m.*,
             o.*,
             p.*
      FROM reservations r
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
      LEFT JOIN plots p ON r.plot_id = p.id
      WHERE r.status = 'pending'
    `).all();
    
    const results = [];
    
    const transaction = db.transaction(() => {
      reservations.forEach(reservation => {
        const risks = [];
        
        const maintenanceRisk = checkMaintenanceOverdue(reservation);
        if (maintenanceRisk) risks.push(maintenanceRisk);
        
        if (reservation.operator_id) {
          const licenseRisk = checkLicenseExpired(reservation);
          if (licenseRisk) risks.push(licenseRisk);
        }
        
        const timeConflictRisk = checkTimeConflict(db, reservation, reservation.id);
        if (timeConflictRisk) risks.push(timeConflictRisk);
        
        const subsidyRisk = checkSubsidyAbnormality(db, reservation, reservation);
        if (subsidyRisk) risks.push(subsidyRisk);
        
        db.prepare('DELETE FROM risk_assessments WHERE reservation_id = ?').run(reservation.id);
        
        risks.forEach(risk => {
          db.prepare(`
            INSERT INTO risk_assessments (reservation_id, risk_type, risk_level, description, is_blocked, manual_override)
            VALUES (?, ?, ?, ?, ?, 0)
          `).run(reservation.id, risk.risk_type, risk.risk_level, risk.description, risk.is_blocked);
        });
        
        const blockedCount = risks.filter(r => r.is_blocked).length;
        
        results.push({
          reservation_id: reservation.id,
          plot_name: reservation.plot_name,
          farmer_name: reservation.farmer_name,
          total_risks: risks.length,
          blocked_count: blockedCount,
          can_proceed: blockedCount === 0,
          risks: risks
        });
      });
    });
    
    transaction();
    
    const blockedReservations = results.filter(r => !r.can_proceed).length;
    const allowedReservations = results.filter(r => r.can_proceed).length;
    
    res.json({
      total: results.length,
      blocked: blockedReservations,
      allowed: allowedReservations,
      details: results
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/override/:riskId', (req, res) => {
  const db = req.app.locals.db;
  const { override_reason } = req.body;
  
  try {
    const risk = db.prepare('SELECT * FROM risk_assessments WHERE id = ?').get(req.params.riskId);
    
    if (!risk) {
      return res.status(404).json({ error: '风险评估不存在' });
    }
    
    db.prepare(`
      UPDATE risk_assessments 
      SET manual_override = 1, override_reason = ?
      WHERE id = ?
    `).run(override_reason || '手动改判', req.params.riskId);
    
    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('override', 'risk_assessment', ?, ?)
    `).run(req.params.riskId, JSON.stringify({ risk_id: req.params.riskId, reason: override_reason }));
    
    res.json({ message: '手动改判成功', risk_id: req.params.riskId });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/cancel-override/:riskId', (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const risk = db.prepare('SELECT * FROM risk_assessments WHERE id = ?').get(req.params.riskId);
    
    if (!risk) {
      return res.status(404).json({ error: '风险评估不存在' });
    }
    
    db.prepare(`
      UPDATE risk_assessments 
      SET manual_override = 0, override_reason = NULL
      WHERE id = ?
    `).run(req.params.riskId);
    
    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, details)
      VALUES ('cancel_override', 'risk_assessment', ?, ?)
    `).run(req.params.riskId, JSON.stringify({ risk_id: req.params.riskId }));
    
    res.json({ message: '取消手动改判成功', risk_id: req.params.riskId });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
