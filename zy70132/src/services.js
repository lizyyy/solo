const config = require('./config');
const { transaction } = require('./database');
const models = require('./models');

const {
  TicketStatus,
  QueueStatus,
  TransactionType,
  TransactionStatus,
  NotificationType,
  now,
  getTicketById,
  updateTicketStatus,
  joinWaitlist,
  getWaitlist,
  getNextWaitlistUser,
  updateQueueStatus,
  createTransaction,
  updateTransactionStatus,
  getTransactionById,
  createNotification,
  createEscalationReport,
  createFailedTask,
} = models;

function purchaseTicket(eventId, userId) {
  return transaction(() => {
    const availableTickets = models.getAvailableTickets(eventId);
    
    if (availableTickets.length === 0) {
      return {
        success: false,
        code: 'NO_TICKETS_AVAILABLE',
        message: '暂无可用票，请加入候补队列',
      };
    }
    
    const ticket = availableTickets[0];
    const paymentDeadline = now() + config.paymentWindowSeconds;
    
    updateTicketStatus(ticket.id, TicketStatus.PENDING_PAYMENT, userId, paymentDeadline);
    const transactionId = createTransaction(
      ticket.id, 
      userId, 
      TransactionType.PURCHASE, 
      ticket.price, 
      paymentDeadline
    );
    
    createNotification(userId, eventId, NotificationType.TICKET_OFFER, ticket.id);
    
    return {
      success: true,
      ticketId: ticket.id,
      transactionId,
      paymentDeadline,
      message: '请在支付时限内完成支付',
    };
  });
}

function confirmPayment(transactionId) {
  return transaction(() => {
    const tx = getTransactionById(transactionId);
    
    if (!tx) {
      return { success: false, code: 'TRANSACTION_NOT_FOUND', message: '交易不存在' };
    }
    
    if (tx.status === TransactionStatus.PAID) {
      return { success: true, message: '支付已确认' };
    }
    
    if (tx.status !== TransactionStatus.PENDING) {
      return { success: false, code: 'INVALID_TRANSACTION_STATUS', message: '交易状态无效' };
    }
    
    if (tx.payment_deadline && now() > tx.payment_deadline) {
      cancelTransaction(tx);
      return { success: false, code: 'PAYMENT_EXPIRED', message: '支付已超时' };
    }
    
    const ticket = getTicketById(tx.ticket_id);
    if (!ticket) {
      return { success: false, code: 'TICKET_NOT_FOUND', message: '票据不存在' };
    }
    
    updateTicketStatus(tx.ticket_id, TicketStatus.SOLD, tx.user_id, null);
    updateTransactionStatus(transactionId, TransactionStatus.PAID, now());
    
    createNotification(tx.user_id, ticket.event_id, NotificationType.PAYMENT_SUCCESS, tx.ticket_id);
    
    return {
      success: true,
      ticketId: tx.ticket_id,
      message: '支付成功',
    };
  });
}

function cancelTransaction(tx) {
  const ticket = getTicketById(tx.ticket_id);
  if (!ticket) return;
  
  updateTicketStatus(tx.ticket_id, TicketStatus.AVAILABLE, null, null);
  updateTransactionStatus(tx.id, TransactionStatus.CANCELLED);
  createNotification(tx.user_id, ticket.event_id, NotificationType.PAYMENT_EXPIRED, tx.ticket_id);
}

function joinQueue(eventId, userId, priority = 0) {
  const queueId = joinWaitlist(eventId, userId, priority);
  const waitlist = getWaitlist(eventId);
  const position = waitlist.findIndex(q => q.user_id === userId) + 1;
  
  return {
    success: true,
    queueId,
    position,
    totalWaiting: waitlist.length,
    message: `已加入候补队列，当前位置：${position}`,
  };
}

function refundTicket(ticketId, reason = '') {
  return transaction(() => {
    const ticket = getTicketById(ticketId);
    
    if (!ticket) {
      return { success: false, code: 'TICKET_NOT_FOUND', message: '票据不存在' };
    }
    
    if (ticket.status !== TicketStatus.SOLD) {
      return { success: false, code: 'INVALID_TICKET_STATUS', message: '只有已售出的票可以退票' };
    }
    
    const eventId = ticket.event_id;
    const originalHolder = ticket.holder_id;
    
    createTransaction(ticketId, originalHolder, TransactionType.REFUND, ticket.price);
    updateTicketStatus(ticketId, TicketStatus.REFUNDED, null, null);
    createNotification(originalHolder, eventId, NotificationType.REFUND_SUCCESS, ticketId);
    
    const nextUser = getNextWaitlistUser(eventId);
    
    if (nextUser) {
      try {
        const result = escalateToNextUser(eventId, ticket, nextUser, originalHolder);
        return {
          success: true,
          refunded: true,
          escalated: true,
          nextUserId: result.userId,
          message: '退票成功，已递补给下一位候补用户',
        };
      } catch (err) {
        createFailedTask('ESCALATION', {
          eventId,
          ticketId,
          fromUserId: originalHolder,
          reason,
        }, err.message);
        
        return {
          success: true,
          refunded: true,
          escalated: false,
          message: '退票成功，递补任务已记录将重试',
        };
      }
    }
    
    return {
      success: true,
      refunded: true,
      escalated: false,
      message: '退票成功，无候补用户',
    };
  });
}

function escalateToNextUser(eventId, originalTicket, nextUser, fromUserId) {
  return transaction(() => {
    const skippedUserIds = [];
    let currentUser = nextUser;
    let ticketReassigned = false;
    let assignedUserId = null;
    
    while (currentUser && !ticketReassigned) {
      const paymentDeadline = now() + config.paymentWindowSeconds;
      
      updateQueueStatus(currentUser.id, QueueStatus.OFFERED, originalTicket.id, paymentDeadline);
      createNotification(currentUser.user_id, eventId, NotificationType.TICKET_OFFER, originalTicket.id);
      
      createEscalationReport(
        eventId,
        originalTicket.id,
        fromUserId,
        currentUser.user_id,
        skippedUserIds,
        '退票递补'
      );
      
      ticketReassigned = true;
      assignedUserId = currentUser.user_id;
    }
    
    return {
      success: ticketReassigned,
      userId: assignedUserId,
      skippedCount: skippedUserIds.length,
    };
  });
}

function rejectOffer(queueId, userId) {
  return transaction(() => {
    const db = require('./database').getDb();
    const queue = db.prepare('SELECT * FROM waitlist_queue WHERE id = ?').get(queueId);
    
    if (!queue) {
      return { success: false, code: 'QUEUE_NOT_FOUND', message: '候补记录不存在' };
    }
    
    if (queue.user_id !== userId) {
      return { success: false, code: 'PERMISSION_DENIED', message: '无权操作' };
    }
    
    if (queue.status !== QueueStatus.OFFERED) {
      return { success: false, code: 'INVALID_STATUS', message: '当前状态不可拒绝' };
    }
    
    updateQueueStatus(queueId, QueueStatus.REJECTED);
    createNotification(userId, queue.event_id, NotificationType.QUEUE_SKIPPED, queue.ticket_id);
    
    const nextUser = getNextWaitlistUser(queue.event_id);
    if (nextUser && queue.ticket_id) {
      const ticket = getTicketById(queue.ticket_id);
      if (ticket) {
        escalateToNextUser(queue.event_id, ticket, nextUser, userId);
      }
    }
    
    return {
      success: true,
      message: '已拒绝候补资格，将递补给下一位用户',
    };
  });
}

function getQueueStatus(eventId, userId) {
  const db = require('./database').getDb();
  const queue = db.prepare(`
    SELECT * FROM waitlist_queue 
    WHERE event_id = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(eventId, userId);
  
  if (!queue) {
    return { inQueue: false };
  }
  
  const waitlist = getWaitlist(eventId);
  const position = queue.status === QueueStatus.WAITING 
    ? waitlist.findIndex(q => q.id === queue.id) + 1
    : null;
  
  return {
    inQueue: queue.status === QueueStatus.WAITING,
    status: queue.status,
    position,
    totalWaiting: waitlist.length,
    ticketId: queue.ticket_id,
    paymentDeadline: queue.payment_deadline,
  };
}

function processPaymentTimeouts() {
  const db = require('./database').getDb();
  const expiredTickets = models.getExpiredPaymentTickets();
  const processed = [];
  
  for (const ticket of expiredTickets) {
    try {
      transaction(() => {
        const tx = db.prepare(`
          SELECT * FROM transactions 
          WHERE ticket_id = ? AND status = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).get(ticket.id, TransactionStatus.PENDING);
        
        if (tx) {
          cancelTransaction(tx);
          
          const nextUser = getNextWaitlistUser(ticket.event_id);
          if (nextUser) {
            escalateToNextUser(ticket.event_id, ticket, nextUser, tx.user_id);
          }
        }
      });
      processed.push(ticket.id);
    } catch (err) {
      createFailedTask('TIMEOUT_PROCESS', {
        ticketId: ticket.id,
        eventId: ticket.event_id,
      }, err.message);
    }
  }
  
  return { processedCount: processed.length, ticketIds: processed };
}

function processQueueTimeouts() {
  const expiredOffers = models.getExpiredQueueOffers();
  const processed = [];
  
  for (const offer of expiredOffers) {
    try {
      transaction(() => {
        updateQueueStatus(offer.id, QueueStatus.EXPIRED);
        createNotification(offer.user_id, offer.event_id, NotificationType.PAYMENT_EXPIRED, offer.ticket_id);
        
        const nextUser = getNextWaitlistUser(offer.event_id);
        if (nextUser && offer.ticket_id) {
          const ticket = getTicketById(offer.ticket_id);
          if (ticket) {
            escalateToNextUser(offer.event_id, ticket, nextUser, offer.user_id);
          }
        }
      });
      processed.push(offer.id);
    } catch (err) {
      createFailedTask('QUEUE_TIMEOUT', {
        queueId: offer.id,
        eventId: offer.event_id,
        ticketId: offer.ticket_id,
      }, err.message);
    }
  }
  
  return { processedCount: processed.length, queueIds: processed };
}

module.exports = {
  purchaseTicket,
  confirmPayment,
  joinQueue,
  refundTicket,
  rejectOffer,
  getQueueStatus,
  processPaymentTimeouts,
  processQueueTimeouts,
  escalateToNextUser,
};
