const moment = require('moment');
const {
  ReturnRecord,
  Loan,
  Reservation,
  Item,
  User,
  Deposit,
  Dispute,
} = require('../models');
const {
  NotFoundError,
  ValidationError,
  LoanAlreadyReturnedError,
} = require('../utils/errors');

class ReturnService {
  static async processReturn(
    loanId,
    condition = 'good',
    damageDescription = '',
    damageEstimate = 0,
    adminId = null,
    notes = ''
  ) {
    const loan = await Loan.findByPk(loanId, {
      include: [
        { model: User, as: 'user' },
        { model: Item, as: 'item' },
        { model: Reservation, as: 'reservation' },
      ],
    });

    if (!loan) {
      throw new NotFoundError('借出记录不存在');
    }

    if (loan.status === 'returned') {
      throw new LoanAlreadyReturnedError();
    }

    if (!['active', 'overdue'].includes(loan.status)) {
      throw new ValidationError(`该借出记录状态为${loan.status}，无法归还`);
    }

    const now = moment();
    const expectedReturn = moment(loan.expected_return_time);
    
    const overdueHours = Math.max(0, now.diff(expectedReturn, 'hours', true));
    const overdueRate = loan.item?.overdue_rate || 
                       parseFloat(process.env.OVERDUE_RATE_PER_HOUR) || 10;
    const overdueFee = Math.round(overdueHours * overdueRate * 100) / 100;

    const totalDeduction = overdueFee + parseFloat(damageEstimate || 0);
    const depositRefunded = Math.max(0, loan.deposit_amount - totalDeduction);

    const transaction = await ReturnRecord.sequelize.transaction();

    try {
      const returnRecord = await ReturnRecord.create(
        {
          loan_id: loanId,
          return_time: now.toDate(),
          quantity: loan.quantity,
          condition,
          damage_description: damageDescription || null,
          damage_estimate: parseFloat(damageEstimate) || 0,
          overdue_hours: overdueHours,
          overdue_fee: overdueFee,
          total_deduction: totalDeduction,
          deposit_refunded: depositRefunded,
          received_by: adminId,
          notes,
          has_dispute: false,
        },
        { transaction }
      );

      let newLoanStatus = 'returned';
      if (['damaged', 'lost'].includes(condition)) {
        newLoanStatus = 'lost';
      }
      
      await loan.update(
        { status: newLoanStatus },
        { transaction }
      );

      if (loan.reservation) {
        await loan.reservation.update(
          { status: 'completed' },
          { transaction }
        );
      }

      let deposit = await Deposit.findOne({
        where: { loan_id: loanId, status: 'held' },
        transaction,
      });

      if (!deposit && loan.reservation_id) {
        deposit = await Deposit.findOne({
          where: { reservation_id: loan.reservation_id, status: 'held' },
          transaction,
        });
        
        if (deposit) {
          await deposit.update({ loan_id: loanId }, { transaction });
        }
      }

      if (deposit && loan.user) {
        const deductionReason = [];
        if (overdueFee > 0) {
          deductionReason.push(`逾期费${overdueFee}元（逾期${overdueHours.toFixed(1)}小时）`);
        }
        if (parseFloat(damageEstimate) > 0) {
          deductionReason.push(`损坏赔偿${damageEstimate}元（${damageDescription || '未说明'}）`);
        }

        if (depositRefunded > 0) {
          await loan.user.increment('balance', { 
            by: depositRefunded, 
            transaction 
          });
        }

        await deposit.update(
          {
            status: totalDeduction > 0 
              ? (depositRefunded > 0 ? 'partially_refunded' : 'deducted')
              : 'refunded',
            refunded_amount: depositRefunded,
            deducted_amount: totalDeduction,
            deduction_reason: deductionReason.join('；') || null,
            processed_at: now.toDate(),
            processed_by: adminId,
          },
          { transaction }
        );
      }

      await transaction.commit();

      return {
        returnRecord: returnRecord.toJSON(),
        loan: loan.toJSON(),
        summary: {
          originalDeposit: loan.deposit_amount,
          overdueHours,
          overdueFee,
          damageEstimate: parseFloat(damageEstimate) || 0,
          totalDeduction,
          depositRefunded,
        },
        message: totalDeduction > 0 
          ? `归还完成，扣除${totalDeduction}元，退还${depositRefunded}元`
          : `归还完成，押金${depositRefunded}元已全额退还`,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getReturnRecordById(returnId) {
    const returnRecord = await ReturnRecord.findByPk(returnId, {
      include: [
        { 
          model: Loan, 
          as: 'loan',
          include: [
            { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
            { model: Item, as: 'item' },
          ],
        },
        { model: User, as: 'receiver', attributes: ['id', 'name'] },
      ],
    });

    if (!returnRecord) {
      throw new NotFoundError('归还记录不存在');
    }

    return returnRecord;
  }

  static async getReturnRecordsByLoan(loanId) {
    return await ReturnRecord.findAll({
      where: { loan_id: loanId },
      include: [
        { model: User, as: 'receiver', attributes: ['id', 'name'] },
      ],
      order: [['return_time', 'DESC']],
    });
  }

  static async createDispute(
    returnId,
    userId,
    type,
    title,
    description,
    disputedAmount,
    evidence = null
  ) {
    const returnRecord = await ReturnRecord.findByPk(returnId, {
      include: [
        { model: Loan, as: 'loan' },
      ],
    });

    if (!returnRecord) {
      throw new NotFoundError('归还记录不存在');
    }

    if (returnRecord.loan.user_id !== userId) {
      throw new ValidationError('您不是该笔交易的相关用户');
    }

    const transaction = await Dispute.sequelize.transaction();

    try {
      const dispute = await Dispute.create(
        {
          user_id: userId,
          loan_id: returnRecord.loan_id,
          return_record_id: returnId,
          type,
          title,
          description,
          disputed_amount: disputedAmount,
          status: 'open',
          priority: 'medium',
          evidence: evidence ? JSON.stringify(evidence) : null,
        },
        { transaction }
      );

      await returnRecord.update(
        { has_dispute: true },
        { transaction }
      );

      await transaction.commit();

      return dispute;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async resolveDispute(
    disputeId,
    resolution,
    resolvedAmount,
    adminId,
    status = 'resolved'
  ) {
    const dispute = await Dispute.findByPk(disputeId, {
      include: [
        { 
          model: ReturnRecord, 
          as: 'returnRecord',
          include: [{ model: Loan, as: 'loan' }],
        },
        { model: User, as: 'user' },
      ],
    });

    if (!dispute) {
      throw new NotFoundError('争议记录不存在');
    }

    if (!['resolved', 'closed', 'rejected'].includes(status)) {
      throw new ValidationError(`无效的解决状态：${status}`);
    }

    const transaction = await Dispute.sequelize.transaction();

    try {
      await dispute.update(
        {
          resolution,
          resolved_amount: resolvedAmount,
          resolved_by: adminId,
          resolved_at: moment().toDate(),
          status,
          closed_at: moment().toDate(),
        },
        { transaction }
      );

      if (status === 'resolved' && resolvedAmount > 0 && dispute.user) {
        await dispute.user.increment('balance', { 
          by: resolvedAmount, 
          transaction 
        });
      }

      await transaction.commit();

      return dispute.reload();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getUserDisputes(userId, status = null) {
    const where = { user_id: userId };
    if (status) {
      where.status = status;
    }

    return await Dispute.findAll({
      where,
      include: [
        { 
          model: ReturnRecord, 
          as: 'returnRecord',
          include: [{ model: Loan, as: 'loan', include: [{ model: Item, as: 'item' }] }],
        },
        { model: User, as: 'resolver', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  static async getAllDisputes(status = null) {
    const where = {};
    if (status) {
      where.status = status;
    }

    return await Dispute.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
        { 
          model: ReturnRecord, 
          as: 'returnRecord',
          include: [{ model: Loan, as: 'loan', include: [{ model: Item, as: 'item' }] }],
        },
        { model: User, as: 'resolver', attributes: ['id', 'name'] },
      ],
      order: [
        ['priority', 'DESC'],
        ['created_at', 'ASC'],
      ],
    });
  }
}

module.exports = ReturnService;
