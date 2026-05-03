const { Op } = require('sequelize');
const moment = require('moment');
const {
  Waitlist,
  Item,
  User,
  Reservation,
} = require('../models');
const {
  NotFoundError,
  ValidationError,
} = require('../utils/errors');

class WaitlistService {
  static async addToWaitlist(
    userId,
    itemId,
    startTime,
    endTime,
    quantity = 1,
    originalReservationId = null,
    notes = ''
  ) {
    const item = await Item.findByPk(itemId);
    const user = await User.findByPk(userId);

    if (!item) {
      throw new NotFoundError('物品不存在');
    }

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    if (user.status !== 'active') {
      throw new ValidationError('您的账户已被暂停，无法加入候补队列');
    }

    const start = moment(startTime);
    const end = moment(endTime);

    if (!start.isValid() || !end.isValid()) {
      throw new ValidationError('时间格式无效');
    }

    if (end.isBefore(start)) {
      throw new ValidationError('结束时间不能早于开始时间');
    }

    if (end.isBefore(moment())) {
      throw new ValidationError('候补时间已过期');
    }

    const existingWaitlist = await Waitlist.findOne({
      where: {
        user_id: userId,
        item_id: itemId,
        status: 'waiting',
        requested_start_time: { [Op.lte]: endTime },
        requested_end_time: { [Op.gte]: startTime },
      },
    });

    if (existingWaitlist) {
      throw new ValidationError('您已在该时间段的候补队列中');
    }

    const maxPosition = await Waitlist.max('position', {
      where: {
        item_id: itemId,
        status: 'waiting',
      },
    });

    const newPosition = (maxPosition || 0) + 1;

    const waitlist = await Waitlist.create({
      user_id: userId,
      item_id: itemId,
      original_reservation_id: originalReservationId,
      position: newPosition,
      requested_start_time: startTime,
      requested_end_time: endTime,
      quantity,
      status: 'waiting',
      notes,
    });

    return waitlist.reload({
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: Item, as: 'item' },
      ],
    });
  }

  static async removeFromWaitlist(waitlistId, userId, reason = '用户主动取消') {
    const waitlist = await Waitlist.findByPk(waitlistId, {
      include: [
        { model: Item, as: 'item' },
        { model: User, as: 'user' },
      ],
    });

    if (!waitlist) {
      throw new NotFoundError('候补记录不存在');
    }

    if (waitlist.user_id !== userId) {
      throw new ValidationError('您不是该候补记录的所有者');
    }

    if (waitlist.status !== 'waiting') {
      throw new ValidationError(`该候补记录状态为${waitlist.status}，无法取消`);
    }

    const transaction = await Waitlist.sequelize.transaction();

    try {
      await waitlist.update(
        { status: 'cancelled' },
        { transaction }
      );

      await Waitlist.decrement('position', {
        where: {
          item_id: waitlist.item_id,
          status: 'waiting',
          position: { [Op.gt]: waitlist.position },
        },
        by: 1,
        transaction,
      });

      await transaction.commit();

      return {
        message: '已成功从候补队列中移除',
        waitlist: waitlist.toJSON(),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getItemWaitlist(itemId, includeAll = false) {
    const where = { item_id: itemId };
    if (!includeAll) {
      where.status = 'waiting';
    }

    return await Waitlist.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Item, as: 'item' },
      ],
      order: [['position', 'ASC']],
    });
  }

  static async getUserWaitlists(userId, status = null) {
    const where = { user_id: userId };
    if (status) {
      where.status = status;
    }

    return await Waitlist.findAll({
      where,
      include: [
        { model: Item, as: 'item' },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  static async getWaitlistById(waitlistId) {
    const waitlist = await Waitlist.findByPk(waitlistId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Item, as: 'item' },
        { model: Reservation, as: 'originalReservation' },
        { model: Reservation, as: 'convertedReservation' },
      ],
    });

    if (!waitlist) {
      throw new NotFoundError('候补记录不存在');
    }

    return waitlist;
  }

  static async checkWaitlistExpiration() {
    const now = moment();
    const expiredWaitlists = await Waitlist.findAll({
      where: {
        status: 'waiting',
        requested_end_time: { [Op.lt]: now.toDate() },
      },
      include: [
        { model: Item, as: 'item' },
        { model: User, as: 'user' },
      ],
    });

    const results = [];
    for (const waitlist of expiredWaitlists) {
      try {
        const transaction = await Waitlist.sequelize.transaction();

        await waitlist.update(
          { status: 'expired' },
          { transaction }
        );

        await Waitlist.decrement('position', {
          where: {
            item_id: waitlist.item_id,
            status: 'waiting',
            position: { [Op.gt]: waitlist.position },
          },
          by: 1,
          transaction,
        });

        await transaction.commit();

        results.push({
          waitlistId: waitlist.id,
          userId: waitlist.user_id,
          userName: waitlist.user?.name,
          itemName: waitlist.item?.name,
          success: true,
          reason: '候补时间已过期',
        });
      } catch (error) {
        results.push({
          waitlistId: waitlist.id,
          userId: waitlist.user_id,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      total: expiredWaitlists.length,
      processed: results.filter(r => r.success).length,
      results,
    };
  }
}

module.exports = WaitlistService;
