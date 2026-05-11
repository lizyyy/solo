const { LanguageChannel, Conference } = require('../models');
const { NotFoundError, ValidationError, ConflictError } = require('../errors');
const { ErrorCodes } = require('../enums');

class ChannelService {
  static async getAll() {
    return await LanguageChannel.findAll({
      include: ['conference']
    });
  }

  static async getById(id) {
    const channel = await LanguageChannel.findByPk(id, {
      include: ['conference']
    });
    if (!channel) {
      throw new NotFoundError('LanguageChannel', id);
    }
    return channel;
  }

  static async getByConference(conferenceId) {
    return await LanguageChannel.findAll({
      where: { conferenceId },
      include: ['conference']
    });
  }

  static async create(data) {
    if (!data.id) {
      throw new ValidationError('Channel id is required', { field: 'id' });
    }
    if (!data.conferenceId) {
      throw new ValidationError('Conference id is required', { field: 'conferenceId' });
    }
    if (!data.language) {
      throw new ValidationError('Language is required', { field: 'language' });
    }
    if (data.channelNumber === undefined || data.channelNumber === null) {
      throw new ValidationError('Channel number is required', { field: 'channelNumber' });
    }

    const conference = await Conference.findByPk(data.conferenceId);
    if (!conference) {
      throw new NotFoundError('Conference', data.conferenceId);
    }

    const existing = await LanguageChannel.findByPk(data.id);
    if (existing) {
      throw new ConflictError(
        ErrorCodes.DUPLICATE_SUBMISSION,
        'Channel with this id already exists',
        { id: data.id }
      );
    }

    return await LanguageChannel.create(data);
  }

  static async update(id, data) {
    const channel = await this.getById(id);
    return await channel.update(data);
  }

  static async delete(id) {
    const channel = await this.getById(id);
    await channel.destroy();
    return { success: true };
  }
}

module.exports = ChannelService;
