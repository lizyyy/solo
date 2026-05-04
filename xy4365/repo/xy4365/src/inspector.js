const { v4: uuidv4 } = require('uuid');

class Inspector {
  constructor(db, maxContinuousHours = 8) {
    this.db = db;
    this.maxContinuousHours = maxContinuousHours;
  }

  // 生成唯一ID
  generateId() {
    return uuidv4();
  }

  // 运行所有检查
  runAllChecks() {
    const violations = [];
    
    // 运行各项检查
    violations.push(...this.checkForbiddenMaterials());
    violations.push(...this.checkThicknessPowerMismatch());
    violations.push(...this.checkMaintenanceConflicts());
    violations.push(...this.checkContinuousOperationTimeout());
    violations.push(...this.checkUntrainedUsers());

    // 保存违规记录
    if (violations.length > 0) {
      this.saveViolations(violations);
    }

    return {
      total: violations.length,
      byType: this.groupViolationsByType(violations),
      violations: violations
    };
  }

  // 按类型分组违规记录
  groupViolationsByType(violations) {
    const groups = {};
    for (const v of violations) {
      if (!groups[v.violation_type]) {
        groups[v.violation_type] = [];
      }
      groups[v.violation_type].push(v);
    }
    return groups;
  }

  // 检查禁切材料
  checkForbiddenMaterials() {
    const violations = [];
    
    // 检查预约中的禁切材料
    const appointments = this.db.all(`
      SELECT a.*, m.is_forbidden, m.material_name
      FROM appointments a
      LEFT JOIN materials m ON a.material_type = m.material_type
      WHERE a.material_type IS NOT NULL
    `);

    for (const apt of appointments) {
      if (apt.is_forbidden === 1) {
        violations.push({
          violation_id: this.generateId(),
          violation_type: 'FORBIDDEN_MATERIAL',
          severity: 'high',
          description: `预约使用禁切材料: ${apt.material_type} (${apt.material_name})`,
          related_record_type: 'appointment',
          related_record_id: apt.appointment_id,
          user_id: apt.user_id,
          machine_id: apt.machine_id,
          timestamp: apt.start_time,
          status: 'pending'
        });
      }
    }

    // 检查开机记录中的禁切材料
    const records = this.db.all(`
      SELECT r.*, m.is_forbidden, m.material_name
      FROM operation_records r
      LEFT JOIN materials m ON r.material_used = m.material_type
      WHERE r.material_used IS NOT NULL
    `);

    for (const rec of records) {
      if (rec.is_forbidden === 1) {
        violations.push({
          violation_id: this.generateId(),
          violation_type: 'FORBIDDEN_MATERIAL',
          severity: 'high',
          description: `实际使用禁切材料: ${rec.material_used} (${rec.material_name})`,
          related_record_type: 'operation',
          related_record_id: rec.record_id,
          user_id: rec.user_id,
          machine_id: rec.machine_id,
          timestamp: rec.start_time,
          status: 'pending'
        });
      }
    }

    return violations;
  }

  // 检查厚度功率不匹配
  checkThicknessPowerMismatch() {
    const violations = [];

    // 检查预约
    const appointments = this.db.all(`
      SELECT a.*, 
             m.min_thickness, m.max_thickness,
             m.recommended_power_min, m.recommended_power_max,
             m.material_name
      FROM appointments a
      LEFT JOIN materials m ON a.material_type = m.material_type
      WHERE a.material_type IS NOT NULL 
        AND a.material_thickness IS NOT NULL 
        AND a.power IS NOT NULL
    `);

    for (const apt of appointments) {
      const issues = [];

      // 检查厚度范围
      if (apt.min_thickness !== null && apt.max_thickness !== null) {
        if (apt.material_thickness < apt.min_thickness) {
          issues.push(`厚度 ${apt.material_thickness}mm 低于最小值 ${apt.min_thickness}mm`);
        }
        if (apt.material_thickness > apt.max_thickness) {
          issues.push(`厚度 ${apt.material_thickness}mm 超过最大值 ${apt.max_thickness}mm`);
        }
      }

      // 检查功率范围
      if (apt.recommended_power_min !== null && apt.recommended_power_max !== null) {
        if (apt.power < apt.recommended_power_min) {
          issues.push(`功率 ${apt.power}% 低于推荐最小值 ${apt.recommended_power_min}%`);
        }
        if (apt.power > apt.recommended_power_max) {
          issues.push(`功率 ${apt.power}% 超过推荐最大值 ${apt.recommended_power_max}%`);
        }
      }

      if (issues.length > 0) {
        violations.push({
          violation_id: this.generateId(),
          violation_type: 'THICKNESS_POWER_MISMATCH',
          severity: 'medium',
          description: `预约参数不匹配: ${issues.join('; ')}`,
          related_record_type: 'appointment',
          related_record_id: apt.appointment_id,
          user_id: apt.user_id,
          machine_id: apt.machine_id,
          timestamp: apt.start_time,
          status: 'pending'
        });
      }
    }

    // 检查开机记录
    const records = this.db.all(`
      SELECT r.*, 
             m.min_thickness, m.max_thickness,
             m.recommended_power_min, m.recommended_power_max,
             m.material_name
      FROM operation_records r
      LEFT JOIN materials m ON r.material_used = m.material_type
      WHERE r.material_used IS NOT NULL 
        AND r.material_thickness_actual IS NOT NULL 
        AND r.actual_power IS NOT NULL
    `);

    for (const rec of records) {
      const issues = [];

      if (rec.min_thickness !== null && rec.max_thickness !== null) {
        if (rec.material_thickness_actual < rec.min_thickness) {
          issues.push(`厚度 ${rec.material_thickness_actual}mm 低于最小值 ${rec.min_thickness}mm`);
        }
        if (rec.material_thickness_actual > rec.max_thickness) {
          issues.push(`厚度 ${rec.material_thickness_actual}mm 超过最大值 ${rec.max_thickness}mm`);
        }
      }

      if (rec.recommended_power_min !== null && rec.recommended_power_max !== null) {
        if (rec.actual_power < rec.recommended_power_min) {
          issues.push(`功率 ${rec.actual_power}% 低于推荐最小值 ${rec.recommended_power_min}%`);
        }
        if (rec.actual_power > rec.recommended_power_max) {
          issues.push(`功率 ${rec.actual_power}% 超过推荐最大值 ${rec.recommended_power_max}%`);
        }
      }

      if (issues.length > 0) {
        violations.push({
          violation_id: this.generateId(),
          violation_type: 'THICKNESS_POWER_MISMATCH',
          severity: 'medium',
          description: `实际参数不匹配: ${issues.join('; ')}`,
          related_record_type: 'operation',
          related_record_id: rec.record_id,
          user_id: rec.user_id,
          machine_id: rec.machine_id,
          timestamp: rec.start_time,
          status: 'pending'
        });
      }
    }

    return violations;
  }

  // 检查维护时段冲突
  checkMaintenanceConflicts() {
    const violations = [];

    // 检查预约与维护时段冲突
    const appointments = this.db.all(`
      SELECT a.*, 
             m.slot_id, m.start_time as maint_start, m.end_time as maint_end,
             m.maintenance_type, m.description as maint_description
      FROM appointments a
      JOIN maintenance_slots m ON a.machine_id = m.machine_id
      WHERE a.start_time < m.end_time AND a.end_time > m.start_time
    `);

    for (const apt of appointments) {
      violations.push({
        violation_id: this.generateId(),
        violation_type: 'MAINTENANCE_CONFLICT',
        severity: 'high',
        description: `预约时段与维护时段冲突: 预约 ${apt.start_time} - ${apt.end_time} 与维护 ${apt.maint_start} - ${apt.maint_end}`,
        related_record_type: 'appointment',
        related_record_id: apt.appointment_id,
        user_id: apt.user_id,
        machine_id: apt.machine_id,
        timestamp: apt.start_time,
        status: 'pending'
      });
    }

    // 检查开机记录与维护时段冲突
    const records = this.db.all(`
      SELECT r.*, 
             m.slot_id, m.start_time as maint_start, m.end_time as maint_end,
             m.maintenance_type, m.description as maint_description
      FROM operation_records r
      JOIN maintenance_slots m ON r.machine_id = m.machine_id
      WHERE r.start_time < m.end_time 
        AND (r.end_time IS NULL OR r.end_time > m.start_time)
    `);

    for (const rec of records) {
      violations.push({
        violation_id: this.generateId(),
        violation_type: 'MAINTENANCE_CONFLICT',
        severity: 'high',
        description: `开机时段与维护时段冲突: 开机 ${rec.start_time}${rec.end_time ? ' - ' + rec.end_time : ''} 与维护 ${rec.maint_start} - ${rec.maint_end}`,
        related_record_type: 'operation',
        related_record_id: rec.record_id,
        user_id: rec.user_id,
        machine_id: rec.machine_id,
        timestamp: rec.start_time,
        status: 'pending'
      });
    }

    return violations;
  }

  // 检查连续开机超时
  checkContinuousOperationTimeout() {
    const violations = [];
    
    // 获取所有开机记录，按机器和时间排序
    const records = this.db.all(`
      SELECT * FROM operation_records 
      WHERE end_time IS NOT NULL
      ORDER BY machine_id, start_time
    `);

    // 按机器分组
    const byMachine = {};
    for (const rec of records) {
      if (!byMachine[rec.machine_id]) {
        byMachine[rec.machine_id] = [];
      }
      byMachine[rec.machine_id].push(rec);
    }

    // 检查每台机器的连续运行时间
    for (const [machineId, machineRecords] of Object.entries(byMachine)) {
      let continuousStart = null;
      let totalDuration = 0;
      let lastEnd = null;

      for (const rec of machineRecords) {
        const startTime = new Date(rec.start_time);
        const endTime = new Date(rec.end_time);
        const duration = (endTime - startTime) / (1000 * 60 * 60); // 小时

        // 检查是否与上次记录连续（间隔小于30分钟视为连续）
        if (lastEnd === null || (startTime - lastEnd) > (30 * 60 * 1000)) {
          // 新的连续时段
          if (continuousStart !== null && totalDuration > this.maxContinuousHours) {
            violations.push({
              violation_id: this.generateId(),
              violation_type: 'CONTINUOUS_TIMEOUT',
              severity: 'high',
              description: `机器 ${machineId} 连续运行 ${totalDuration.toFixed(1)} 小时，超过限制 ${this.maxContinuousHours} 小时`,
              related_record_type: 'operation',
              related_record_id: null,
              user_id: null,
              machine_id: machineId,
              timestamp: continuousStart.toISOString(),
              status: 'pending'
            });
          }
          continuousStart = startTime;
          totalDuration = duration;
        } else {
          // 累加连续时间
          totalDuration += duration;
        }
        lastEnd = endTime;
      }

      // 检查最后一个连续时段
      if (continuousStart !== null && totalDuration > this.maxContinuousHours) {
        violations.push({
          violation_id: this.generateId(),
          violation_type: 'CONTINUOUS_TIMEOUT',
          severity: 'high',
          description: `机器 ${machineId} 连续运行 ${totalDuration.toFixed(1)} 小时，超过限制 ${this.maxContinuousHours} 小时`,
          related_record_type: 'operation',
          related_record_id: null,
          user_id: null,
          machine_id: machineId,
          timestamp: continuousStart.toISOString(),
          status: 'pending'
        });
      }
    }

    return violations;
  }

  // 检查未培训人员
  checkUntrainedUsers() {
    const violations = [];

    // 检查预约中的未培训用户
    const appointments = this.db.all(`
      SELECT a.*, u.name, u.is_trained, u.training_date
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE u.is_trained = 0 OR u.is_trained IS NULL
    `);

    for (const apt of appointments) {
      violations.push({
        violation_id: this.generateId(),
        violation_type: 'UNTRAINED_USER',
        severity: 'high',
        description: `用户 ${apt.user_id} (${apt.name || '未知'}) 未经过激光切割机培训`,
        related_record_type: 'appointment',
        related_record_id: apt.appointment_id,
        user_id: apt.user_id,
        machine_id: apt.machine_id,
        timestamp: apt.start_time,
        status: 'pending'
      });
    }

    // 检查开机记录中的未培训用户
    const records = this.db.all(`
      SELECT r.*, u.name, u.is_trained, u.training_date
      FROM operation_records r
      LEFT JOIN users u ON r.user_id = u.user_id
      WHERE u.is_trained = 0 OR u.is_trained IS NULL
    `);

    for (const rec of records) {
      violations.push({
        violation_id: this.generateId(),
        violation_type: 'UNTRAINED_USER',
        severity: 'high',
        description: `用户 ${rec.user_id} (${rec.name || '未知'}) 未经过激光切割机培训`,
        related_record_type: 'operation',
        related_record_id: rec.record_id,
        user_id: rec.user_id,
        machine_id: rec.machine_id,
        timestamp: rec.start_time,
        status: 'pending'
      });
    }

    return violations;
  }

  // 保存违规记录到数据库
  saveViolations(violations) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO violations 
      (violation_id, violation_type, severity, description, 
       related_record_type, related_record_id, user_id, machine_id, 
       timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.violation_id,
          item.violation_type,
          item.severity,
          item.description,
          item.related_record_type,
          item.related_record_id,
          item.user_id,
          item.machine_id,
          item.timestamp,
          item.status
        );
      }
    });

    insertMany(violations);
  }

  // 获取特定状态的违规记录
  getViolationsByStatus(status = 'pending') {
    return this.db.all(
      `SELECT * FROM violations WHERE status = ? ORDER BY timestamp DESC`,
      [status]
    );
  }

  // 获取所有违规记录
  getAllViolations() {
    return this.db.all(`SELECT * FROM violations ORDER BY timestamp DESC`);
  }

  // 清除现有违规记录（用于重新计算）
  clearViolations() {
    this.db.run(`DELETE FROM violations`);
  }
}

module.exports = Inspector;
