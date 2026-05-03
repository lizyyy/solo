const { Op } = require('sequelize');
const moment = require('moment');
const {
  Reservation,
  Item,
  User,
  Loan,
  Waitlist,
  Deposit,
} = require('../models');
const {
  ReservationConflictError,
  InsufficientStockError,
  MaintenanceError,
  InsufficientBalanceError,
  UserSuspendedError,
  NotFoundError,
  ValidationError,
} = require('../utils/errors');

class ReservationService {
  static async checkAvailability(itemId, startTime, endTime, quantity = 1, excludeReservationId = null) {
    const item = await Item.findByPk(itemId);
    if (!item) {
      throw new NotFoundError('物品不存在');
    }

    if (item.status === 'maintenance') {
      throw new MaintenanceError(item.name);
    }

    if (item.status === 'unavailable') {
      throw new MaintenanceError(`${item.name}当前不可用`);
    }

    if (quantity > item.total_quantity) {
      throw new InsufficientStockError(item.total_quantity, quantity, item.name);
    }

    const whereClause = {
      item_id: itemId,
      status: {
        [Op.in]: ['confirmed', 'checkout'],
      },
      start_time: {
        [Op.lt]: endTime,
      },
      end_time: {
        [Op.gt]: startTime,
      },
    };

    if (excludeReservationId) {
      whereClause.id = { [Op.ne]: excludeReservationId };
    }

    const overlappingReservations = await Reservation.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name'],
        },
      ],
    });

    const reservedQuantity = overlappingReservations.reduce(
      (sum, res) => sum + res.quantity,
      0
    );

    const availableQuantity = item.total_quantity - reservedQuantity;

    if (quantity > availableQuantity) {
      throw new ReservationConflictError(
        overlappingReservations,
        item.name
      );
    }

    return {
      available: true,
      availableQuantity,
      item,
      overlappingReservations,
    };
  }

  static async createReservation(userId, itemId, startTime, endTime, quantity = 1, notes = '') {
    const item = await Item.findByPk(itemId);
    const user = await User.findByPk(userId);

    if (!item) {
      throw new NotFoundError('物品不存在');
    }

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    if (user.status !== 'active') {
      throw new UserSuspendedError(user.name);
    }

    const start = moment(startTime);
    const end = moment(endTime);

    if (!start.isValid() || !end.isValid()) {
      throw new ValidationError('时间格式无效');
    }

    if (end.isBefore(start)) {
      throw new ValidationError('结束时间不能早于开始时间');
    }

    if (start.isBefore(moment())) {
      throw new ValidationError('预约时间不能早于当前时间');
    }

    if (item.max_loan_hours) {
      const loanHours = end.diff(start, 'hours', true);
      if (loanHours > item.max_loan_hours) {
        throw new ValidationError(
          `预约时长不能超过${item.max_loan_hours}小时，当前预约${Math.ceil(loanHours)}小时`
        );
      }
    }

    await this.checkAvailability(itemId, startTime, endTime, quantity);

    const requiredDeposit = item.deposit_amount * quantity;
    if (parseFloat(user.balance) < requiredDeposit) {
      throw new InsufficientBalanceError(
        requiredDeposit,
        user.balance,
        item.name
      );
    }

    const transaction = await Reservation.sequelize.transaction();

    try {
      await user.decrement('balance', { by: requiredDeposit, transaction });

      const reservation = await Reservation.create(
        {
          user_id: userId,
          item_id: itemId,
          start_time: startTime,
          end_time: endTime,
          quantity,
          status: 'confirmed',
          deposit_held: requiredDeposit,
          notes,
        },
        { transaction }
      );

      await Deposit.create(
        {
          user_id: userId,
          reservation_id: reservation.id,
          amount: requiredDeposit,
          status: 'held',
          notes: `预约${item.name}${quantity}件，押金冻结`,
        },
        { transaction }
      );

      await transaction.commit();

      return reservation.reload({
        include: [
          { model: User, as: 'user', attributes: ['id', 'name'] },
          { model: Item, as: 'item' },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async cancelReservation(reservationId, cancelReason = '用户主动取消') {
    const reservation = await Reservation.findByPk(reservationId, {
      include: [
        { model: User, as: 'user' },
        { model: Item, as: 'item' },
      ],
    });

    if (!reservation) {
      throw new NotFoundError('预约不存在');
    }

    if (['completed', 'cancelled', 'timeout', 'transferred'].includes(reservation.status)) {
      throw new ValidationError(`该预约状态为${reservation.status}，无法取消`);
    }

    const transaction = await Reservation.sequelize.transaction();

    try {
      if (reservation.status === 'checkout') {
        await Loan.update(
          { status: 'returned' },
          { 
            where: { reservation_id: reservationId, status: 'active' },
            transaction 
          }
        );
      }

      const deposit = await Deposit.findOne({
        where: { reservation_id: reservationId, status: 'held' },
        transaction,
      });

      if (deposit && reservation.user) {
        await reservation.user.increment('balance', { 
          by: deposit.amount, 
          transaction 
        });
        await deposit.update(
          {
            status: 'refunded',
            refunded_amount: deposit.amount,
            processed_at: moment().toDate(),
          },
          { transaction }
        );
      }

      await reservation.update(
        {
          status: 'cancelled',
          cancel_reason: cancelReason,
        },
        { transaction }
      );

      const waitlistResult = await this.processWaitlistAfterCancellation(
        reservation,
        transaction
      );

      await transaction.commit();

      return {
        reservation: reservation.toJSON(),
        waitlistProcessed: waitlistResult,
        message: '预约已取消，押金已退还',
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async processWaitlistAfterCancellation(reservation, transaction) {
    const waitlistItems = await Waitlist.findAll({
      where: {
        item_id: reservation.item_id,
        status: 'waiting',
        requested_start_time: {
          [Op.lte]: reservation.end_time,
        },
        requested_end_time: {
          [Op.gte]: reservation.start_time,
        },
      },
      order: [['position', 'ASC']],
      include: [
        { model: User, as: 'user' },
        { model: Item, as: 'item' },
      ],
      transaction,
    });

    const processedItems = [];
    let quantityToFill = reservation.quantity;

    for (const waitlist of waitlistItems) {
      if (quantityToFill <= 0) break;

      if (waitlist.quantity <= quantityToFill) {
        try {
          await this.convertWaitlistToReservation(
            waitlist,
            '原预约取消，候补成功',
            transaction
          );
          processedItems.push({
            waitlistId: waitlist.id,
            userId: waitlist.user_id,
            userName: waitlist.user?.name,
            converted: true,
          });
          quantityToFill -= waitlist.quantity;
        } catch (error) {
          processedItems.push({
            waitlistId: waitlist.id,
            userId: waitlist.user_id,
            userName: waitlist.user?.name,
            converted: false,
            error: error.message,
          });
        }
      }
    }

    return processedItems;
  }

  static async convertWaitlistToReservation(waitlist, convertReason, transaction) {
    const item = waitlist.item || (await Item.findByPk(waitlist.item_id));
    const user = waitlist.user || (await User.findByPk(waitlist.user_id));

    const requiredDeposit = item.deposit_amount * waitlist.quantity;
    if (parseFloat(user.balance) < requiredDeposit) {
      await waitlist.update(
        {
          status: 'expired',
          convert_reason: '账户余额不足，无法转换',
        },
        { transaction }
      );
      throw new Error('账户余额不足');
    }

    await user.decrement('balance', { by: requiredDeposit, transaction });

    const reservation = await Reservation.create(
      {
        user_id: waitlist.user_id,
        item_id: waitlist.item_id,
        start_time: waitlist.requested_start_time,
        end_time: waitlist.requested_end_time,
        quantity: waitlist.quantity,
        status: 'confirmed',
        deposit_held: requiredDeposit,
        notes: `由候补转换而来：${convertReason}`,
      },
      { transaction }
    );

    await Deposit.create(
      {
        user_id: waitlist.user_id,
        reservation_id: reservation.id,
        amount: requiredDeposit,
        status: 'held',
        notes: `候补转换预约${item.name}${waitlist.quantity}件，押金冻结`,
      },
      { transaction }
    );

    await waitlist.update(
      {
        status: 'converted',
        converted_reservation_id: reservation.id,
        convert_reason: convertReason,
        converted_at: moment().toDate(),
      },
      { transaction }
    );

    return reservation;
  }

  static async getReservationById(reservationId) {
    const reservation = await Reservation.findByPk(reservationId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Item, as: 'item' },
        { model: Loan, as: 'loan' },
      ],
    });

    if (!reservation) {
      throw new NotFoundError('预约不存在');
    }

    return reservation;
  }

  static async getUserReservations(userId, status = null) {
    const where = { user_id: userId };
    if (status) {
      where.status = status;
    }

    return await Reservation.findAll({
      where,
      include: [
        { model: Item, as: 'item' },
        { model: Loan, as: 'loan' },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  static async getOverdueReservations() {
    const now = moment();
    const timeoutMinutes = process.env.CHECKOUT_TIMEOUT_MINUTES || 30;

    return await Reservation.findAll({
      where: {
        status: 'confirmed',
        start_time: {
          [Op.lt]: now.clone().subtract(timeoutMinutes, 'minutes').toDate(),
        },
      },
      include: [
        { model: User, as: 'user' },
        { model: Item, as: 'item' },
      ],
    });
  }

  static async processTimeoutReservations() {
    const overdueReservations = await this.getOverdueReservations();
    const results = [];

    for (const reservation of overdueReservations) {
      try {
        const result = await this.cancelReservation(
          reservation.id,
          `超时未取货（超过${process.env.CHECKOUT_TIMEOUT_MINUTES || 30}分钟）`
        );
        results.push({
          reservationId: reservation.id,
          success: true,
          ...result,
        });
      } catch (error) {
        results.push({
          reservationId: reservation.id,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      total: overdueReservations.length,
      processed: results.filter(r => r.success).length,
      results,
    };
  }
}

module.exports = ReservationService;
