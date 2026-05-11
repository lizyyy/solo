const { Conference, Room, LanguageChannel } = require('../models');
const { NotFoundError, ValidationError, ConflictError } = require('../errors');
const { ConferenceStatus, ErrorCodes } = require('../enums');

class ConferenceService {
  static async getAll() {
    return await Conference.findAll({
      include: [{ model: Room, as: 'room' }]
    });
  }

  static async getById(id) {
    const conference = await Conference.findByPk(id, {
      include: [
        { model: Room, as: 'room' },
        { model: LanguageChannel, as: 'channels' }
      ]
    });
    if (!conference) {
      throw new NotFoundError('Conference', id);
    }
    return conference;
  }

  static async create(data) {
    this.validateConferenceData(data);

    const existing = await Conference.findByPk(data.id);
    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_SUBMISSION,
        'Conference with this id already exists',
        { id: data.id }
      );
    }

    if (data.roomId) {
      const room = await Room.findByPk(data.roomId);
      if (!room) {
        throw new NotFoundError('Room', data.roomId);
      }
    }

    return await Conference.create(data);
  }

  static validateConferenceData(data) {
    if (!data.id) {
      throw new ValidationError('Conference id is required', { field: 'id' });
    }
    if (!data.title) {
      throw new ValidationError('Conference title is required', { field: 'title' });
    }
    if (!data.startTime) {
      throw new ValidationError('Conference startTime is required', { field: 'startTime' });
    }
    if (!data.endTime) {
      throw new ValidationError('Conference endTime is required', { field: 'endTime' });
    }

    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    
    if (isNaN(start.getTime())) {
      throw new ValidationError('Invalid startTime format', { field: 'startTime' });
    }
    if (isNaN(end.getTime())) {
      throw new ValidationError('Invalid endTime format', { field: 'endTime' });
    }
    if (start >= end) {
      throw new ValidationError('startTime must be before endTime', { startTime: data.startTime, endTime: data.endTime });
    }
  }

  static async update(id, data) {
    const conference = await this.getById(id);
    return await conference.update(data);
  }

  static async delete(id) {
    const conference = await this.getById(id);
    await conference.destroy();
    return { success: true };
  }

  static async updateStatus(id, newStatus) {
    const conference = await this.getById(id);
    const currentStatus = conference.status;

    const validTransitions = {
      [ConferenceStatus.PLANNED]: [ConferenceStatus.IN_PROGRESS, ConferenceStatus.CANCELLED],
      [ConferenceStatus.IN_PROGRESS]: [ConferenceStatus.COMPLETED, ConferenceStatus.CANCELLED],
      [ConferenceStatus.COMPLETED]: [],
      [ConferenceStatus.CANCELLED]: []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new ConflictError(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        { currentStatus, newStatus }
      );
    }

    return await conference.update({ status: newStatus });
  }

  static async start(id) {
    return await this.updateStatus(id, ConferenceStatus.IN_PROGRESS);
  }

  static async complete(id) {
    return await this.updateStatus(id, ConferenceStatus.COMPLETED);
  }

  static async cancel(id) {
    return await this.updateStatus(id, ConferenceStatus.CANCELLED);
  }
}

module.exports = ConferenceService;
