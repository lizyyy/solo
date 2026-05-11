const { Op } = require('sequelize');
const { Schedule } = require('../models');
const { ScheduleStatus, ErrorCodes } = require('../enums');
const { ConflictError, ValidationError } = require('../errors');

class ConflictService {
  static isTimeOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();
    return s1 < e2 && e1 > s2;
  }

  static async checkInterpreterConflict(interpreterId, startTime, endTime, excludeScheduleId = null) {
    const where = {
      interpreterId,
      status: {
        [Op.in]: [ScheduleStatus.DRAFT, ScheduleStatus.CONFIRMED, ScheduleStatus.IN_USE]
      },
      [Op.not]: {
        id: excludeScheduleId
      }
    };

    const schedules = await Schedule.findAll({ where });

    const conflicts = schedules.filter(schedule => 
      this.isTimeOverlap(schedule.startTime, schedule.endTime, startTime, endTime)
    );

    if (conflicts.length > 0) {
      throw new ConflictError(
        ErrorCodes.INTERPRETER_CONFLICT,
        'Interpreter has conflicting schedule',
        {
          interpreterId,
          conflictingSchedules: conflicts.map(c => ({
            id: c.id,
            startTime: c.startTime,
            endTime: c.endTime
          }))
        }
      );
    }

    return true;
  }

  static async checkDeviceConflict(deviceId, startTime, endTime, excludeScheduleId = null) {
    const where = {
      deviceId,
      status: {
        [Op.in]: [ScheduleStatus.DRAFT, ScheduleStatus.CONFIRMED, ScheduleStatus.IN_USE]
      },
      [Op.not]: {
        id: excludeScheduleId
      }
    };

    const schedules = await Schedule.findAll({ where });

    const conflicts = schedules.filter(schedule => 
      this.isTimeOverlap(schedule.startTime, schedule.endTime, startTime, endTime)
    );

    if (conflicts.length > 0) {
      throw new ConflictError(
        ErrorCodes.DEVICE_CONFLICT,
        'Device has conflicting schedule',
        {
          deviceId,
          conflictingSchedules: conflicts.map(c => ({
            id: c.id,
            startTime: c.startTime,
            endTime: c.endTime
          }))
        }
      );
    }

    return true;
  }

  static async checkChannelConflict(channelId, startTime, endTime, excludeScheduleId = null) {
    const where = {
      channelId,
      status: {
        [Op.in]: [ScheduleStatus.DRAFT, ScheduleStatus.CONFIRMED, ScheduleStatus.IN_USE]
      },
      [Op.not]: {
        id: excludeScheduleId
      }
    };

    const schedules = await Schedule.findAll({ where });

    const conflicts = schedules.filter(schedule => 
      this.isTimeOverlap(schedule.startTime, schedule.endTime, startTime, endTime)
    );

    if (conflicts.length > 0) {
      throw new ConflictError(
        ErrorCodes.CHANNEL_CONFLICT,
        'Channel has conflicting schedule',
        {
          channelId,
          conflictingSchedules: conflicts.map(c => ({
            id: c.id,
            startTime: c.startTime,
            endTime: c.endTime
          }))
        }
      );
    }

    return true;
  }

  static validateTimeRange(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime())) {
      throw new ValidationError('Invalid startTime', { field: 'startTime' });
    }

    if (isNaN(end.getTime())) {
      throw new ValidationError('Invalid endTime', { field: 'endTime' });
    }

    if (start >= end) {
      throw new ValidationError('startTime must be before endTime', {
        startTime,
        endTime
      });
    }

    return true;
  }

  static async checkAllConflicts(channelId, interpreterId, deviceId, startTime, endTime, excludeScheduleId = null) {
    this.validateTimeRange(startTime, endTime);
    
    await Promise.all([
      this.checkChannelConflict(channelId, startTime, endTime, excludeScheduleId),
      this.checkInterpreterConflict(interpreterId, startTime, endTime, excludeScheduleId),
      this.checkDeviceConflict(deviceId, startTime, endTime, excludeScheduleId)
    ]);

    return true;
  }
}

module.exports = ConflictService;
