const { Op } = require('sequelize');
const moment = require('moment');
const {
  Reservation,
  Loan,
  ReturnRecord,
  Waitlist,
  Deposit,
  Dispute,
  User,
  Item,
} = require('../models');

class ReportService {
  static async getWeeklySummary(startDate = null, endDate = null) {
    const now = moment();
    
    let start, end;
    if (startDate && endDate) {
      start = moment(startDate).startOf('day');
      end = moment(endDate).endOf('day');
    } else {
      start = now.clone().startOf('week');
      end = now.clone().endOf('week');
    }

    const [
      reservationStats,
      loanStats,
      returnStats,
      waitlistStats,
      depositStats,
      disputeStats,
      itemStats,
      topItems,
    ] = await Promise.all([
      this.getReservationStats(start, end),
      this.getLoanStats(start, end),
      this.getReturnStats(start, end),
      this.getWaitlistStats(start, end),
      this.getDepositStats(start, end),
      this.getDisputeStats(start, end),
      this.getItemStats(),
      this.getTopItems(start, end),
    ]);

    const summary = {
      period: {
        start: start.format('YYYY-MM-DD HH:mm'),
        end: end.format('YYYY-MM-DD HH:mm'),
        type: (!startDate && !endDate) ? '本周' : '自定义',
      },
      overview: {
        totalReservations: reservationStats.total,
        totalLoans: loanStats.total,
        totalReturns: returnStats.total,
        totalDisputes: disputeStats.total,
      },
      reservations: reservationStats,
      loans: loanStats,
      returns: returnStats,
      waitlist: waitlistStats,
      deposits: depositStats,
      disputes: disputeStats,
      items: itemStats,
      topItems,
      financialSummary: {
        totalDepositsCollected: depositStats.totalHeld,
        totalDepositsRefunded: depositStats.totalRefunded,
        totalOverdueFees: returnStats.totalOverdueFees,
        totalDamageFees: returnStats.totalDamageFees,
        totalDeductions: returnStats.totalOverdueFees + returnStats.totalDamageFees,
        netDeposits: depositStats.totalHeld - depositStats.totalRefunded,
      },
      generatedAt: now.format('YYYY-MM-DD HH:mm:ss'),
    };

    return summary;
  }

  static async getReservationStats(start, end) {
    const total = await Reservation.count({
      where: {
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const byStatus = await Reservation.findAll({
      where: {
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      attributes: [
        'status',
        [Reservation.sequelize.fn('COUNT', Reservation.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const statusBreakdown = {};
    byStatus.forEach(item => {
      statusBreakdown[item.status] = parseInt(item.count);
    });

    const cancellations = await Reservation.count({
      where: {
        status: 'cancelled',
        updated_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const timeouts = await Reservation.count({
      where: {
        status: 'timeout',
        updated_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    return {
      total,
      statusBreakdown,
      cancellations,
      timeouts,
      cancellationRate: total > 0 ? ((cancellations / total) * 100).toFixed(2) + '%' : '0%',
    };
  }

  static async getLoanStats(start, end) {
    const total = await Loan.count({
      where: {
        checkout_time: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const activeLoans = await Loan.count({
      where: {
        status: { [Op.in]: ['active', 'overdue'] },
      },
    });

    const overdueLoans = await Loan.findAll({
      where: {
        checkout_time: { [Op.between]: [start.toDate(), end.toDate()] },
        status: 'overdue',
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: Item, as: 'item' },
      ],
    });

    return {
      total,
      activeLoans,
      overdueCount: overdueLoans.length,
      overdueLoans: overdueLoans.map(l => ({
        id: l.id,
        user: l.user,
        item: l.item,
        checkoutTime: l.checkout_time,
        expectedReturn: l.expected_return_time,
      })),
    };
  }

  static async getReturnStats(start, end) {
    const total = await ReturnRecord.count({
      where: {
        return_time: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const returns = await ReturnRecord.findAll({
      where: {
        return_time: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      include: [
        {
          model: Loan,
          as: 'loan',
          include: [
            { model: Item, as: 'item' },
          ],
        },
      ],
    });

    const totalOverdueFees = returns.reduce(
      (sum, r) => sum + parseFloat(r.overdue_fee || 0),
      0
    );

    const totalDamageFees = returns.reduce(
      (sum, r) => sum + parseFloat(r.damage_estimate || 0),
      0
    );

    const byCondition = {};
    returns.forEach(r => {
      byCondition[r.condition] = (byCondition[r.condition] || 0) + 1;
    });

    const overdueReturns = returns.filter(r => parseFloat(r.overdue_fee) > 0);
    const damagedReturns = returns.filter(r => 
      ['damaged', 'lost', 'poor'].includes(r.condition)
    );

    return {
      total,
      totalOverdueFees,
      totalDamageFees,
      byCondition,
      overdueCount: overdueReturns.length,
      damagedCount: damagedReturns.length,
      averageOverdueHours: overdueReturns.length > 0
        ? (overdueReturns.reduce((sum, r) => sum + parseFloat(r.overdue_hours || 0), 0) / overdueReturns.length).toFixed(2)
        : 0,
    };
  }

  static async getWaitlistStats(start, end) {
    const totalAdded = await Waitlist.count({
      where: {
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const converted = await Waitlist.count({
      where: {
        status: 'converted',
        converted_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const expired = await Waitlist.count({
      where: {
        status: 'expired',
        updated_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const cancelled = await Waitlist.count({
      where: {
        status: 'cancelled',
        updated_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const currentWaiting = await Waitlist.count({
      where: { status: 'waiting' },
    });

    return {
      totalAdded,
      converted,
      expired,
      cancelled,
      currentWaiting,
      conversionRate: totalAdded > 0 
        ? ((converted / totalAdded) * 100).toFixed(2) + '%' 
        : '0%',
    };
  }

  static async getDepositStats(start, end) {
    const deposits = await Deposit.findAll({
      where: {
        held_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const totalHeld = deposits.reduce(
      (sum, d) => sum + parseFloat(d.amount || 0),
      0
    );

    const refundedDeposits = await Deposit.findAll({
      where: {
        status: { [Op.in]: ['refunded', 'partially_refunded'] },
        processed_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const totalRefunded = refundedDeposits.reduce(
      (sum, d) => sum + parseFloat(d.refunded_amount || 0),
      0
    );

    const deductedDeposits = await Deposit.findAll({
      where: {
        status: { [Op.in]: ['deducted', 'partially_refunded'] },
        processed_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const totalDeducted = deductedDeposits.reduce(
      (sum, d) => sum + parseFloat(d.deducted_amount || 0),
      0
    );

    const currentHeld = await Deposit.sum('amount', {
      where: { status: 'held' },
    });

    return {
      totalHeld,
      totalRefunded,
      totalDeducted,
      currentHeld: currentHeld || 0,
      depositCount: deposits.length,
    };
  }

  static async getDisputeStats(start, end) {
    const total = await Dispute.count({
      where: {
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    const byStatus = await Dispute.findAll({
      where: {
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      attributes: [
        'status',
        [Dispute.sequelize.fn('COUNT', Dispute.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const statusBreakdown = {};
    byStatus.forEach(item => {
      statusBreakdown[item.status] = parseInt(item.count);
    });

    const byType = await Dispute.findAll({
      where: {
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      attributes: [
        'type',
        [Dispute.sequelize.fn('COUNT', Dispute.sequelize.col('id')), 'count'],
      ],
      group: ['type'],
      raw: true,
    });

    const typeBreakdown = {};
    byType.forEach(item => {
      typeBreakdown[item.type] = parseInt(item.count);
    });

    const openDisputes = await Dispute.count({
      where: { status: { [Op.in]: ['open', 'investigating'] } },
    });

    const resolvedAmount = await Dispute.sum('resolved_amount', {
      where: {
        status: 'resolved',
        resolved_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
    });

    return {
      total,
      statusBreakdown,
      typeBreakdown,
      openDisputes,
      resolvedAmount: resolvedAmount || 0,
    };
  }

  static async getItemStats() {
    const totalItems = await Item.count();
    
    const byStatus = await Item.findAll({
      attributes: [
        'status',
        [Item.sequelize.fn('COUNT', Item.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const statusBreakdown = {};
    byStatus.forEach(item => {
      statusBreakdown[item.status] = parseInt(item.count);
    });

    const byCategory = await Item.findAll({
      attributes: [
        'category',
        [Item.sequelize.fn('COUNT', Item.sequelize.col('id')), 'count'],
        [Item.sequelize.fn('SUM', Item.sequelize.col('total_quantity')), 'totalQuantity'],
        [Item.sequelize.fn('SUM', Item.sequelize.col('available_quantity')), 'availableQuantity'],
      ],
      group: ['category'],
      raw: true,
    });

    return {
      totalItems,
      statusBreakdown,
      byCategory,
    };
  }

  static async getTopItems(start, end, limit = 10) {
    const loans = await Loan.findAll({
      where: {
        checkout_time: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      include: [{ model: Item, as: 'item' }],
    });

    const itemLoanCount = {};
    loans.forEach(loan => {
      if (loan.item) {
        const itemId = loan.item_id;
        if (!itemLoanCount[itemId]) {
          itemLoanCount[itemId] = {
            item: loan.item,
            count: 0,
            totalQuantity: 0,
          };
        }
        itemLoanCount[itemId].count++;
        itemLoanCount[itemId].totalQuantity += loan.quantity;
      }
    });

    const sortedItems = Object.values(itemLoanCount).sort((a, b) => b.count - a.count);
    
    return sortedItems.slice(0, limit).map(item => ({
      id: item.item.id,
      name: item.item.name,
      category: item.item.category,
      loanCount: item.count,
      totalQuantity: item.totalQuantity,
      depositAmount: item.item.deposit_amount,
    }));
  }

  static async exportWeeklySummary(startDate, endDate) {
    const summary = await this.getWeeklySummary(startDate, endDate);
    
    return {
      format: 'json',
      data: summary,
      generatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
      downloadUrl: null,
    };
  }
}

module.exports = ReportService;
