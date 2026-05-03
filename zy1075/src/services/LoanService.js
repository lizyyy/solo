const { Op } = require('sequelize');
const moment = require('moment');
const {
  Loan,
  Reservation,
  Item,
  User,
  Deposit,
} = require('../models');
const {
  NotFoundError,
  ValidationError,
  LoanAlreadyReturnedError,
} = require('../utils/errors');

class LoanService {
  static async checkoutFromReservation(reservationId, adminId = null, checkoutNotes = '') {
    const reservation = await Reservation.findByPk(reservationId, {
      include: [
        { model: User, as: 'user' },
        { model: Item, as: 'item' },
      ],
    });

    if (!reservation) {
      throw new NotFoundError('预约不存在');
    }

    if (reservation.status === 'checkout') {
      throw new ValidationError('该预约已取货');
    }

    if (['cancelled', 'timeout', 'completed', 'transferred'].includes(reservation.status)) {
      throw new ValidationError(`该预约状态为${reservation.status}，无法取货`);
    }

    const now = moment();
    const startTime = moment(reservation.start_time);
    const timeoutMinutes = process.env.CHECKOUT_TIMEOUT_MINUTES || 30;

    if (now.isBefore(startTime)) {
      throw new ValidationError(
        `还未到取货时间，最早可在${startTime.format('YYYY-MM-DD HH:mm')}取货`
      );
    }

    if (now.isAfter(startTime.clone().add(timeoutMinutes, 'minutes'))) {
      throw new ValidationError(
        `已超过取货时间（超过${timeoutMinutes}分钟），预约已失效`
      );
    }

    const transaction = await Loan.sequelize.transaction();

    try {
      await reservation.update(
        { status: 'checkout' },
        { transaction }
      );

      const loan = await Loan.create(
        {
          user_id: reservation.user_id,
          item_id: reservation.item_id,
          reservation_id: reservation.id,
          checkout_time: now.toDate(),
          expected_return_time: reservation.end_time,
          quantity: reservation.quantity,
          status: 'active',
          deposit_amount: reservation.deposit_held,
          checkout_notes: checkoutNotes,
          checked_out_by: adminId,
        },
        { transaction }
      );

      const deposit = await Deposit.findOne({
        where: { reservation_id: reservationId },
        transaction,
      });

      if (deposit) {
        await deposit.update(
          { loan_id: loan.id },
          { transaction }
        );
      }

      await transaction.commit();

      return loan.reload({
        include: [
          { model: User, as: 'user', attributes: ['id', 'name'] },
          { model: Item, as: 'item' },
          { model: Reservation, as: 'reservation' },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async directCheckout(userId, itemId, startTime, endTime, quantity = 1, adminId = null, notes = '') {
    const item = await Item.findByPk(itemId);
    const user = await User.findByPk(userId);

    if (!item) {
      throw new NotFoundError('物品不存在');
    }

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    if (item.status === 'maintenance') {
      throw new ValidationError(`${item.name}正在维护中，无法借出`);
    }

    if (item.status === 'unavailable') {
      throw new ValidationError(`${item.name}当前不可用`);
    }

    const start = moment(startTime);
    const end = moment(endTime);

    if (!start.isValid() || !end.isValid()) {
      throw new ValidationError('时间格式无效');
    }

    if (end.isBefore(start)) {
      throw new ValidationError('结束时间不能早于开始时间');
    }

    const activeLoans = await Loan.findAll({
      where: {
        item_id: itemId,
        status: { [Op.in]: ['active', 'overdue'] },
      },
    });

    const loanedQuantity = activeLoans.reduce((sum, loan) => sum + loan.quantity, 0);
    const availableQuantity = item.total_quantity - loanedQuantity;

    if (quantity > availableQuantity) {
      throw new ValidationError(
        `${item.name}库存不足，当前可借${availableQuantity}件，需要${quantity}件`
      );
    }

    const requiredDeposit = item.deposit_amount * quantity;
    if (parseFloat(user.balance) < requiredDeposit) {
      throw new ValidationError(
        `账户余额不足，需要${requiredDeposit}元押金，当前余额${user.balance}元`
      );
    }

    const transaction = await Loan.sequelize.transaction();

    try {
      await user.decrement('balance', { by: requiredDeposit, transaction });

      const loan = await Loan.create(
        {
          user_id: userId,
          item_id: itemId,
          reservation_id: null,
          checkout_time: start.toDate(),
          expected_return_time: end.toDate(),
          quantity,
          status: 'active',
          deposit_amount: requiredDeposit,
          checkout_notes: notes,
          checked_out_by: adminId,
        },
        { transaction }
      );

      await Deposit.create(
        {
          user_id: userId,
          loan_id: loan.id,
          amount: requiredDeposit,
          status: 'held',
          notes: `直接借出${item.name}${quantity}件，押金冻结`,
        },
        { transaction }
      );

      await transaction.commit();

      return loan.reload({
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

  static async getLoanById(loanId) {
    const loan = await Loan.findByPk(loanId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Item, as: 'item' },
        { model: Reservation, as: 'reservation' },
      ],
    });

    if (!loan) {
      throw new NotFoundError('借出记录不存在');
    }

    return loan;
  }

  static async getUserLoans(userId, status = null) {
    const where = { user_id: userId };
    if (status) {
      where.status = status;
    }

    return await Loan.findAll({
      where,
      include: [
        { model: Item, as: 'item' },
        { model: Reservation, as: 'reservation' },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  static async getActiveLoans() {
    return await Loan.findAll({
      where: {
        status: { [Op.in]: ['active', 'overdue'] },
      },
      include: [
        { model: User, as: 'user' },
        { model: Item, as: 'item' },
      ],
      order: [['expected_return_time', 'ASC']],
    });
  }

  static async checkAndUpdateOverdueStatus() {
    const now = moment();
    const activeLoans = await Loan.findAll({
      where: { status: 'active' },
      include: [{ model: Item, as: 'item' }],
    });

    const updatedLoans = [];
    for (const loan of activeLoans) {
      const expectedReturn = moment(loan.expected_return_time);
      if (now.isAfter(expectedReturn)) {
        await loan.update({ status: 'overdue' });
        updatedLoans.push({
          loanId: loan.id,
          userId: loan.user_id,
          itemName: loan.item?.name,
          overdueHours: now.diff(expectedReturn, 'hours', true),
        });
      }
    }

    return {
      total: updatedLoans.length,
      updatedLoans,
    };
  }
}

module.exports = LoanService;
