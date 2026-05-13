const moment = require('moment');
const db = require('../config/database');
const { checkQualificationMatch, calculateConsecutiveHours, getShiftHours } = require('../utils/helpers');

class RulesEngine {
  async validateSchedule(caregiverId, wardDemandId, date, shiftType, excludeScheduleId = null) {
    const errors = [];
    const warnings = [];

    const caregiver = await this.getCaregiverById(caregiverId);
    if (!caregiver) {
      errors.push('陪护人员不存在');
      return { valid: false, errors, warnings };
    }

    if (caregiver.status !== 'active') {
      errors.push('陪护人员状态非激活');
    }

    const wardDemand = await this.getWardDemandById(wardDemandId);
    if (!wardDemand) {
      errors.push('病区需求不存在');
      return { valid: false, errors, warnings };
    }

    if (!checkQualificationMatch(caregiver.qualifications, wardDemand.required_qualifications)) {
      errors.push(`陪护资质不匹配，需要：${wardDemand.required_qualifications}`);
    }

    if (caregiver.skill_level < wardDemand.min_skill_level) {
      errors.push(`技能等级不足，需要等级：${wardDemand.min_skill_level}，当前等级：${caregiver.skill_level}`);
    }

    const shiftHours = getShiftHours(shiftType);
    const startTime = moment(`${date} ${shiftHours.start}`);
    const endTime = shiftHours.end === '00:00' 
      ? moment(date).add(1, 'day').startOf('day')
      : moment(`${date} ${shiftHours.end}`);

    const hasOverlap = await this.checkScheduleOverlap(caregiverId, startTime.toDate(), endTime.toDate(), excludeScheduleId);
    if (hasOverlap) {
      errors.push('该时间段已有排班冲突');
    }

    const consecutiveHours = await calculateConsecutiveHours(caregiverId, date, db);
    const newConsecutiveHours = consecutiveHours + shiftHours.hours;
    
    if (newConsecutiveHours > caregiver.max_consecutive_hours) {
      errors.push(`连续工时超过限制，最大：${caregiver.max_consecutive_hours}小时，预计：${newConsecutiveHours}小时`);
    }

    const dailyHours = await this.getDailyHours(caregiverId, date);
    const newDailyHours = dailyHours + shiftHours.hours;
    if (newDailyHours > caregiver.max_daily_hours) {
      warnings.push(`当日工时将超过建议值，建议：${caregiver.max_daily_hours}小时，预计：${newDailyHours}小时`);
    }

    const weeklyHours = await this.getWeeklyHours(caregiverId, date);
    const newWeeklyHours = weeklyHours + shiftHours.hours;
    if (newWeeklyHours > caregiver.max_weekly_hours) {
      warnings.push(`当周工时将超过建议值，建议：${caregiver.max_weekly_hours}小时，预计：${newWeeklyHours}小时`);
    }

    const hasLeave = await this.checkLeaveConflict(caregiverId, startTime.toDate(), endTime.toDate());
    if (hasLeave) {
      errors.push('该时间段已有请假记录');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      caregiver,
      wardDemand
    };
  }

  async validateLeave(caregiverId, startTime, endTime, excludeLeaveId = null) {
    const errors = [];
    const warnings = [];

    const hasOverlap = await this.checkLeaveOverlap(caregiverId, startTime, endTime, excludeLeaveId);
    if (hasOverlap) {
      errors.push('该时间段已有请假冲突');
    }

    const overlappingSchedules = await this.getOverlappingSchedules(caregiverId, startTime, endTime);
    if (overlappingSchedules.length > 0) {
      warnings.push(`该时间段包含${overlappingSchedules.length}个排班，需要安排替代人员`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      overlappingSchedules
    };
  }

  async validateSubstitute(originalScheduleId, substituteCaregiverId) {
    const errors = [];
    const warnings = [];

    const originalSchedule = await this.getScheduleById(originalScheduleId);
    if (!originalSchedule) {
      errors.push('原排班不存在');
      return { valid: false, errors, warnings };
    }

    const validation = await this.validateSchedule(
      substituteCaregiverId,
      originalSchedule.ward_demand_id,
      originalSchedule.date,
      originalSchedule.shift_type,
      originalScheduleId
    );

    return {
      ...validation,
      originalSchedule
    };
  }

  getCaregiverById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM caregivers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getWardDemandById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM ward_demands WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getScheduleById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM schedules WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  checkScheduleOverlap(caregiverId, startTime, endTime, excludeId = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT COUNT(*) as count FROM schedules 
                  WHERE caregiver_id = ? AND status IN ('scheduled', 'completed')
                  AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))`;
      let params = [caregiverId, startTime, startTime, endTime, endTime, startTime, endTime];
      
      if (excludeId) {
        sql += ` AND id != ?`;
        params.push(excludeId);
      }
      
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });
  }

  getDailyHours(caregiverId, date) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT SUM(actual_hours) as total FROM schedules 
                    WHERE caregiver_id = ? AND date = ? AND status IN ('scheduled', 'completed')`;
      db.get(sql, [caregiverId, date], (err, row) => {
        if (err) reject(err);
        else resolve(row.total || 0);
      });
    });
  }

  getWeeklyHours(caregiverId, date) {
    return new Promise((resolve, reject) => {
      const weekStart = moment(date).startOf('week').format('YYYY-MM-DD');
      const weekEnd = moment(date).endOf('week').format('YYYY-MM-DD');
      const sql = `SELECT SUM(actual_hours) as total FROM schedules 
                    WHERE caregiver_id = ? AND date BETWEEN ? AND ? AND status IN ('scheduled', 'completed')`;
      db.get(sql, [caregiverId, weekStart, weekEnd], (err, row) => {
        if (err) reject(err);
        else resolve(row.total || 0);
      });
    });
  }

  checkLeaveConflict(caregiverId, startTime, endTime) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(*) as count FROM leave_records 
                    WHERE caregiver_id = ? AND status IN ('approved', 'pending')
                    AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))`;
      db.get(sql, [caregiverId, endTime, startTime, endTime, startTime], (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });
  }

  checkLeaveOverlap(caregiverId, startTime, endTime, excludeId = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT COUNT(*) as count FROM leave_records 
                  WHERE caregiver_id = ? AND status IN ('approved', 'pending')
                  AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))`;
      let params = [caregiverId, endTime, startTime, endTime, startTime];
      
      if (excludeId) {
        sql += ` AND id != ?`;
        params.push(excludeId);
      }
      
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });
  }

  getOverlappingSchedules(caregiverId, startTime, endTime) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM schedules 
                    WHERE caregiver_id = ? AND status IN ('scheduled')
                    AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))`;
      db.all(sql, [caregiverId, endTime, startTime, endTime, startTime], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new RulesEngine();