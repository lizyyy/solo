const { Device, Room } = require('../models');
const { NotFoundError, ValidationError, ConflictError } = require('../errors');
const { ErrorCodes } = require('../enums');

class DeviceService {
  static async getAll() {
    return await Device.findAll({ include: ['room'] });
  }

  static async getById(id) {
    const device = await Device.findByPk(id, { include: ['room'] });
    if (!device) {
      throw new NotFoundError('Device', id);
    }
    return device;
  }

  static async getByRoom(roomId) {
    return await Device.findAll({ where: { roomId }, include: ['room'] });
  }

  static async create(data) {
    if (!data.id) {
      throw new ValidationError('Device id is required', { field: 'id' });
    }
    if (!data.name) {
      throw new ValidationError('Device name is required', { field: 'name' });
    }
    if (!data.type) {
      throw new ValidationError('Device type is required', { field: 'type' });
    }
    if (!data.roomId) {
      throw new ValidationError('Device roomId is required', { field: 'roomId' });
    }

    const room = await Room.findByPk(data.roomId);
    if (!room) {
      throw new NotFoundError('Room', data.roomId);
    }

    const existing = await Device.findByPk(data.id);
    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_SUBMISSION,
        'Device with this id already exists',
        { id: data.id }
      );
    }

    return await Device.create(data);
  }

  static async update(id, data) {
    const device = await this.getById(id);
    return await device.update(data);
  }

  static async delete(id) {
    const device = await this.getById(id);
    await device.destroy();
    return { success: true };
  }
}

module.exports = DeviceService;
