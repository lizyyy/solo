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
const { NotFoundError } = require('../utils/errors');

class TimelineService {
  static async getItemTimeline(itemId, startDate = null, endDate = null) {
    const item = await Item.findByPk(itemId);
    
    if (!item) {
      throw new NotFoundError('物品不存在');
    }

    const now = moment();
    const start = startDate ? moment(startDate) : now.clone().subtract(30, 'days');
    const end = endDate ? moment(endDate) : now.clone().add(30, 'days');

    const timelineEvents = [];

    const reservations = await Reservation.findAll({
      where: {
        item_id: itemId,
        [Op.or]: [
          { start_time: { [Op.between]: [start.toDate(), end.toDate()] } },
          { end_time: { [Op.between]: [start.toDate(), end.toDate()] } },
        ],
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
      order: [['start_time', 'ASC']],
    });

    for (const res of reservations) {
      let eventType = 'reservation';
      let statusText = '已预约';
      
      if (res.status === 'checkout') {
        eventType = 'loan';
        statusText = '已取货';
      } else if (res.status === 'completed') {
        eventType = 'return';
        statusText = '已完成';
      } else if (res.status === 'cancelled') {
        eventType = 'cancellation';
        statusText = '已取消';
      } else if (res.status === 'timeout') {
        eventType = 'timeout';
        statusText = '超时未取';
      }

      timelineEvents.push({
        id: res.id,
        type: eventType,
        title: `${res.user?.name || '未知用户'} - ${statusText}`,
        description: res.notes || '',
        startTime: res.start_time,
        endTime: res.end_time,
        status: res.status,
        quantity: res.quantity,
        user: res.user,
        createdAt: res.created_at,
      });
    }

    const loans = await Loan.findAll({
      where: {
        item_id: itemId,
        checkout_time: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
      order: [['checkout_time', 'ASC']],
    });

    for (const loan of loans) {
      const hasReservationEvent = timelineEvents.some(
        e => e.type === 'loan' && e.id === loan.reservation_id
      );
      
      if (!hasReservationEvent || !loan.reservation_id) {
        timelineEvents.push({
          id: loan.id,
          type: 'loan',
          title: `${loan.user?.name || '未知用户'} - 借出`,
          description: loan.checkout_notes || '',
          startTime: loan.checkout_time,
          endTime: loan.expected_return_time,
          status: loan.status,
          quantity: loan.quantity,
          user: loan.user,
          createdAt: loan.created_at,
        });
      }
    }

    const returns = await ReturnRecord.findAll({
      where: {
        return_time: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      include: [
        { 
          model: Loan, 
          as: 'loan',
          where: { item_id: itemId },
          include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
        },
      ],
      order: [['return_time', 'ASC']],
    });

    for (const ret of returns) {
      if (ret.loan) {
        const deductions = [];
        if (ret.overdue_fee > 0) {
          deductions.push(`逾期费${ret.overdue_fee}元`);
        }
        if (ret.damage_estimate > 0) {
          deductions.push(`损坏费${ret.damage_estimate}元`);
        }
        
        timelineEvents.push({
          id: ret.id,
          type: 'return',
          title: `${ret.loan.user?.name || '未知用户'} - 归还`,
          description: deductions.join('，') || '正常归还',
          startTime: ret.return_time,
          endTime: ret.return_time,
          condition: ret.condition,
          quantity: ret.quantity,
          overdueFee: ret.overdue_fee,
          damageEstimate: ret.damage_estimate,
          totalDeduction: ret.total_deduction,
          depositRefunded: ret.deposit_refunded,
          user: ret.loan.user,
          createdAt: ret.return_time,
        });
      }
    }

    const waitlists = await Waitlist.findAll({
      where: {
        item_id: itemId,
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'ASC']],
    });

    for (const wl of waitlists) {
      let statusText = '等待中';
      if (wl.status === 'converted') statusText = '已转换';
      else if (wl.status === 'expired') statusText = '已过期';
      else if (wl.status === 'cancelled') statusText = '已取消';

      timelineEvents.push({
        id: wl.id,
        type: 'waitlist',
        title: `${wl.user?.name || '未知用户'} - 候补`,
        description: `位置${wl.position}，${statusText}`,
        startTime: wl.requested_start_time,
        endTime: wl.requested_end_time,
        status: wl.status,
        position: wl.position,
        quantity: wl.quantity,
        convertReason: wl.convert_reason,
        user: wl.user,
        createdAt: wl.created_at,
      });
    }

    timelineEvents.sort((a, b) => {
      const timeA = moment(a.startTime || a.createdAt);
      const timeB = moment(b.startTime || b.createdAt);
      return timeA.isBefore(timeB) ? -1 : 1;
    });

    return {
      item: item.toJSON(),
      period: {
        start: start.format('YYYY-MM-DD HH:mm'),
        end: end.format('YYYY-MM-DD HH:mm'),
      },
      eventCount: timelineEvents.length,
      events: timelineEvents,
    };
  }

  static async getUserTimeline(userId, startDate = null, endDate = null) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const now = moment();
    const start = startDate ? moment(startDate) : now.clone().subtract(90, 'days');
    const end = endDate ? moment(endDate) : now.clone().add(30, 'days');

    const timelineEvents = [];

    const reservations = await Reservation.findAll({
      where: {
        user_id: userId,
        [Op.or]: [
          { start_time: { [Op.between]: [start.toDate(), end.toDate()] } },
          { end_time: { [Op.between]: [start.toDate(), end.toDate()] } },
        ],
      },
      include: [{ model: Item, as: 'item' }],
      order: [['start_time', 'ASC']],
    });

    for (const res of reservations) {
      let statusText = '预约';
      if (res.status === 'checkout') statusText = '已取货';
      else if (res.status === 'completed') statusText = '已完成';
      else if (res.status === 'cancelled') statusText = '已取消';
      else if (res.status === 'timeout') statusText = '超时未取';

      timelineEvents.push({
        id: res.id,
        type: 'reservation',
        title: `${res.item?.name || '未知物品'} - ${statusText}`,
        description: res.notes || res.cancel_reason || '',
        startTime: res.start_time,
        endTime: res.end_time,
        status: res.status,
        quantity: res.quantity,
        item: res.item,
        createdAt: res.created_at,
      });
    }

    const loans = await Loan.findAll({
      where: {
        user_id: userId,
        checkout_time: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      include: [{ model: Item, as: 'item' }],
      order: [['checkout_time', 'ASC']],
    });

    for (const loan of loans) {
      timelineEvents.push({
        id: loan.id,
        type: 'loan',
        title: `${loan.item?.name || '未知物品'} - 借出`,
        description: loan.checkout_notes || '',
        startTime: loan.checkout_time,
        endTime: loan.expected_return_time,
        status: loan.status,
        quantity: loan.quantity,
        item: loan.item,
        createdAt: loan.created_at,
      });
    }

    const returns = await ReturnRecord.findAll({
      where: {},
      include: [
        {
          model: Loan,
          as: 'loan',
          where: { user_id: userId },
          include: [{ model: Item, as: 'item' }],
        },
      ],
      order: [['return_time', 'ASC']],
    });

    const filteredReturns = returns.filter(r => {
      const returnTime = moment(r.return_time);
      return returnTime.isBetween(start, end, null, '[]');
    });

    for (const ret of filteredReturns) {
      if (ret.loan) {
        const deductions = [];
        if (ret.overdue_fee > 0) {
          deductions.push(`逾期费${ret.overdue_fee}元`);
        }
        if (ret.damage_estimate > 0) {
          deductions.push(`损坏费${ret.damage_estimate}元`);
        }
        
        timelineEvents.push({
          id: ret.id,
          type: 'return',
          title: `${ret.loan.item?.name || '未知物品'} - 归还`,
          description: deductions.join('，') || '正常归还',
          startTime: ret.return_time,
          endTime: ret.return_time,
          condition: ret.condition,
          quantity: ret.quantity,
          overdueFee: ret.overdue_fee,
          damageEstimate: ret.damage_estimate,
          totalDeduction: ret.total_deduction,
          depositRefunded: ret.deposit_refunded,
          item: ret.loan.item,
          createdAt: ret.return_time,
        });
      }
    }

    const deposits = await Deposit.findAll({
      where: {
        user_id: userId,
        held_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      order: [['held_at', 'ASC']],
    });

    for (const dep of deposits) {
      let statusText = '押金冻结';
      if (dep.status === 'refunded') statusText = '押金已退还';
      else if (dep.status === 'partially_refunded') statusText = '押金部分退还';
      else if (dep.status === 'deducted') statusText = '押金已扣除';

      timelineEvents.push({
        id: dep.id,
        type: 'deposit',
        title: `${statusText} - ${dep.amount}元`,
        description: dep.notes || dep.deduction_reason || '',
        startTime: dep.held_at,
        endTime: dep.processed_at || dep.held_at,
        status: dep.status,
        amount: dep.amount,
        refundedAmount: dep.refunded_amount,
        deductedAmount: dep.deducted_amount,
        createdAt: dep.held_at,
      });
    }

    const disputes = await Dispute.findAll({
      where: {
        user_id: userId,
        created_at: { [Op.between]: [start.toDate(), end.toDate()] },
      },
      include: [
        {
          model: ReturnRecord,
          as: 'returnRecord',
          include: [
            {
              model: Loan,
              as: 'loan',
              include: [{ model: Item, as: 'item' }],
            },
          ],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    for (const disp of disputes) {
      let statusText = '争议中';
      if (disp.status === 'resolved') statusText = '已解决';
      else if (disp.status === 'closed') statusText = '已关闭';
      else if (disp.status === 'rejected') statusText = '已拒绝';

      timelineEvents.push({
        id: disp.id,
        type: 'dispute',
        title: `争议 - ${disp.title}`,
        description: disp.description || disp.resolution || '',
        startTime: disp.created_at,
        endTime: disp.resolved_at || disp.closed_at || disp.created_at,
        status: disp.status,
        disputedAmount: disp.disputed_amount,
        resolvedAmount: disp.resolved_amount,
        item: disp.returnRecord?.loan?.item,
        createdAt: disp.created_at,
      });
    }

    timelineEvents.sort((a, b) => {
      const timeA = moment(a.startTime || a.createdAt);
      const timeB = moment(b.startTime || b.createdAt);
      return timeA.isBefore(timeB) ? -1 : 1;
    });

    return {
      user: user.toJSON(),
      period: {
        start: start.format('YYYY-MM-DD HH:mm'),
        end: end.format('YYYY-MM-DD HH:mm'),
      },
      eventCount: timelineEvents.length,
      events: timelineEvents,
    };
  }
}

module.exports = TimelineService;
