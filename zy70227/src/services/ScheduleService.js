const { Schedule, Conference, LanguageChannel, Interpreter, Device } = require('../models');
const { NotFoundError, ValidationError, ConflictError } = require('../errors');
const { ScheduleStatus, ErrorCodes } = require('../enums');
const ConflictService = require('./ConflictService');
const InterpreterService = require('./InterpreterService');
const ChannelService = require('./ChannelService');
const DeviceService = require('./DeviceService');
const ConferenceService = require('./ConferenceService');

class ScheduleService {
  static async getAll() {
    return await Schedule.findAll({
      include: ['conference', 'channel', 'interpreter', 'device']
    });
  }

  static async getById(id) {
    const schedule = await Schedule.findByPk(id, {
      include: ['conference', 'channel', 'interpreter', 'device']
    });
    if (!schedule) {
      throw new NotFoundError('Schedule', id);
    }
    return schedule;
  }

  static async getByConference(conferenceId) {
    return await Schedule.findAll({
      where: { conferenceId },
      include: ['conference', 'channel', 'interpreter', 'device']
    });
  }

  static async getByInterpreter(interpreterId) {
    return await Schedule.findAll({
      where: { interpreterId },
      include: ['conference', 'channel', 'interpreter', 'device']
    });
  }

  static async create(data) {
    this.validateScheduleData(data);

    const existing = await Schedule.findByPk(data.id);
    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_SUBMISSION,
        'Schedule with this id already exists',
        { id: data.id }
      );
    }

    await this.validateScheduleReferences(data);

    await ConflictService.checkAllConflicts(
      data.channelId,
      data.interpreterId,
      data.deviceId,
      data.startTime,
      data.endTime
    );

    return await Schedule.create({
      ...data,
      status: ScheduleStatus.DRAFT
    });
  }

  static validateScheduleData(data) {
    if (!data.id) {
      throw new ValidationError('Schedule id is required', { field: 'id' });
    }
    if (!data.conferenceId) {
      throw new ValidationError('Conference id is required', { field: 'conferenceId' });
    }
    if (!data.channelId) {
      throw new ValidationError('Channel id is required', { field: 'channelId' });
    }
    if (!data.interpreterId) {
      throw new ValidationError('Interpreter id is required', { field: 'interpreterId' });
    }
    if (!data.deviceId) {
      throw new ValidationError('Device id is required', { field: 'deviceId' });
    }
    if (!data.startTime) {
      throw new ValidationError('Start time is required', { field: 'startTime' });
    }
    if (!data.endTime) {
      throw new ValidationError('End time is required', { field: 'endTime' });
    }
  }

  static async validateScheduleReferences(data) {
    const channel = await ChannelService.getById(data.channelId);
    if (channel.conferenceId !== data.conferenceId) {
      throw new ConflictError(
        ErrorCodes.SOURCE_RECORD_MISSING,
        'Channel does not belong to the specified conference',
        { conferenceId: data.conferenceId, channelConferenceId: channel.conferenceId }
      );
    }

    await InterpreterService.checkLanguageAbility(data.interpreterId, channel.language);

    const device = await DeviceService.getById(data.deviceId);
    if (device.status !== 'available') {
      throw new ConflictError(
        ErrorCodes.STATE_CONFLICT,
        `Device is not available (current status: ${device.status})`,
        { deviceId: data.deviceId, deviceStatus: device.status }
      );
    }
  }

  static async update(id, data) {
    const schedule = await this.getById(id);
    
    if (schedule.status !== ScheduleStatus.DRAFT) {
      throw new ConflictError(
        ErrorCodes.STATE_CONFLICT,
        'Only draft schedules can be updated',
        { currentStatus: schedule.status }
      );
    }

    if (data.startTime || data.endTime || data.channelId || data.interpreterId || data.deviceId) {
      const updateData = {
        ...schedule.toJSON(),
        ...data
      };
      await ConflictService.checkAllConflicts(
        updateData.channelId,
        updateData.interpreterId,
        updateData.deviceId,
        updateData.startTime,
        updateData.endTime,
        id
      );
    }

    return await schedule.update(data);
  }

  static async delete(id) {
    const schedule = await this.getById(id);
    await schedule.destroy();
    return { success: true };
  }

  static async updateStatus(id, newStatus) {
    const schedule = await this.getById(id);
    const currentStatus = schedule.status;

    const validTransitions = {
      [ScheduleStatus.DRAFT]: [ScheduleStatus.CONFIRMED, ScheduleStatus.CANCELLED],
      [ScheduleStatus.CONFIRMED]: [ScheduleStatus.IN_USE, ScheduleStatus.CANCELLED],
      [ScheduleStatus.IN_USE]: [ScheduleStatus.COMPLETED, ScheduleStatus.CANCELLED],
      [ScheduleStatus.COMPLETED]: [],
      [ScheduleStatus.CANCELLED]: []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new ConflictError(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        { currentStatus, newStatus }
      );
    }

    return await schedule.update({ status: newStatus });
  }

  static async confirm(id) {
    return await this.updateStatus(id, ScheduleStatus.CONFIRMED);
  }

  static async start(id) {
    return await this.updateStatus(id, ScheduleStatus.IN_USE);
  }

  static async complete(id) {
    return await this.updateStatus(id, ScheduleStatus.COMPLETED);
  }

  static async cancel(id) {
    return await this.updateStatus(id, ScheduleStatus.CANCELLED);
  }
}

module.exports = ScheduleService;
