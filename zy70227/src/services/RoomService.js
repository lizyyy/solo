const { Room } = require('../models');
const { NotFoundError, ValidationError } = require('../errors');
const { ErrorCodes } = require('../enums');

class RoomService {
  static async getAll() {
    return await Room.findAll();
  }

  static async getById(id) {
    const room = await Room.findByPk(id);
    if (!room) {
      throw new NotFoundError('Room', id);
    }
    return room;
  }

  static async create(data) {
    if (!data.id) {
      throw new ValidationError('Room id is required', { field: 'id' });
    }
    if (!data.name) {
      throw new ValidationError('Room name is required', { field: 'name' });
    }

    const existing = await Room.findByPk(data.id);
    if (existing) {
      const { ConflictError } = require('../errors');
      throw new ConflictError(
        ErrorCodes.DUPLICATE_SUBMISSION,
        'Room with this id already exists',
        { id: data.id }
      );
    }

    return await Room.create(data);
  }

  static async update(id, data) {
    const room = await this.getById(id);
    return await room.update(data);
  }

  static async delete(id) {
    const room = await this.getById(id);
    await room.destroy();
    return { success: true };
  }
}

module.exports = RoomService;
