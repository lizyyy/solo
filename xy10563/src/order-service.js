const store = require('./data-store');

class OrderService {
  createOrder(data, idempotencyKey) {
    if (idempotencyKey) {
      const existing = store.idempotentKeys.get(idempotencyKey);
      if (existing) {
        return { success: true, data: existing, isDuplicate: true };
      }
    }

    const ticket = store.getTicketById(data.ticketId);
    if (!ticket) {
      return { success: false, error: '门票不存在', errorCode: 'TICKET_NOT_FOUND' };
    }

    const ferry = store.getFerryClassById(data.ferryClassId);
    if (!ferry) {
      return { success: false, error: '船班不存在', errorCode: 'FERRY_NOT_FOUND' };
    }

    if (ferry.status !== 'available') {
      return { success: false, error: '船班不可用', errorCode: 'FERRY_NOT_AVAILABLE' };
    }

    if (ferry.bookedCount >= ferry.capacity) {
      return { success: false, error: '船班已满员', errorCode: 'FERRY_FULL' };
    }

    const suspension = store.getSuspensionByFerryClass(data.ferryClassId);
    if (suspension) {
      return { success: false, error: `船班已停航: ${suspension.reason}`, errorCode: 'FERRY_SUSPENDED' };
    }

    if (ticket.stock <= 0) {
      return { success: false, error: '门票库存不足', errorCode: 'TICKET_NO_STOCK' };
    }

    const order = store.createOrder({
      ...data,
      ticketAmount: ticket.price,
      ferryAmount: ferry.price,
      totalAmount: ticket.price + ferry.price
    });

    store.updateFerryClass(data.ferryClassId, {
      bookedCount: ferry.bookedCount + 1
    });

    ticket.stock -= 1;

    store.addOrderHistory(order.id, '订单创建', {
      orderNo: order.orderNo,
      ticketName: ticket.name,
      ferryRoute: ferry.route,
      departureTime: ferry.departureTime
    });

    this.confirmPayment(order.id);

    const result = { success: true, data: order };
    if (idempotencyKey) {
      store.checkIdempotency(idempotencyKey, order);
    }
    return result;
  }

  confirmPayment(orderId, idempotencyKey = null) {
    if (idempotencyKey) {
      const existing = store.idempotentKeys.get(idempotencyKey);
      if (existing) {
        return { success: true, data: existing, isDuplicate: true };
      }
    }

    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status !== 'pending') {
      return { success: false, error: '订单状态不允许支付确认', errorCode: 'INVALID_STATUS' };
    }

    const updated = store.updateOrder(orderId, { status: 'confirmed' }, 'system', '支付确认');
    store.addOrderHistory(orderId, '支付确认', { oldStatus: 'pending', newStatus: 'confirmed' });

    const result = { success: true, data: updated };
    if (idempotencyKey) {
      store.checkIdempotency(idempotencyKey, updated);
    }
    return result;
  }

  getOrder(id) {
    const order = store.getOrderById(id) || store.getOrderByNo(id);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    const ticket = store.getTicketById(order.ticketId);
    const ferry = store.getFerryClassById(order.ferryClassId);
    const suspension = ferry ? store.getSuspensionByFerryClass(ferry.id) : null;

    return {
      success: true,
      data: {
        ...order,
        ticketInfo: ticket,
        ferryInfo: ferry,
        suspensionInfo: suspension
      }
    };
  }

  validateSegment(orderId, segment, operator, idempotencyKey = null) {
    if (idempotencyKey) {
      const existing = store.idempotentKeys.get(idempotencyKey);
      if (existing) {
        return { success: true, data: existing, isDuplicate: true };
      }
    }

    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status !== 'confirmed' && order.status !== 'partially_validated') {
      return { success: false, error: '订单状态不允许核销', errorCode: 'INVALID_STATUS' };
    }

    if (!['ticket', 'ferry'].includes(segment)) {
      return { success: false, error: '无效的分段', errorCode: 'INVALID_SEGMENT' };
    }

    const segmentInfo = order.segments[segment];
    if (segmentInfo.status === 'validated') {
      return { success: false, error: '该分段已核销', errorCode: 'ALREADY_VALIDATED' };
    }

    if (segment === 'ferry') {
      const ferry = store.getFerryClassById(order.ferryClassId);
      if (ferry && ferry.status === 'suspended') {
        return { success: false, error: '船班已停航，无法核销船票', errorCode: 'FERRY_SUSPENDED' };
      }
    }

    const updatedSegments = { ...order.segments };
    updatedSegments[segment] = { status: 'validated', validatedAt: new Date().toISOString() };

    const allValidated = Object.values(updatedSegments).every(s => s.status === 'validated');
    const someValidated = Object.values(updatedSegments).some(s => s.status === 'validated');
    const newStatus = allValidated ? 'completed' : (someValidated ? 'partially_validated' : order.status);

    const updated = store.updateOrder(
      orderId,
      { segments: updatedSegments, status: newStatus },
      operator,
      `核销${segment === 'ticket' ? '门票' : '船票'}`
    );

    store.createValidation({ orderId, segment, operator });
    store.addOrderHistory(orderId, `${segment === 'ticket' ? '门票' : '船票'}核销`, { operator });

    const result = { success: true, data: updated };
    if (idempotencyKey) {
      store.checkIdempotency(idempotencyKey, updated);
    }
    return result;
  }

  getAvailableRebookClasses(orderId) {
    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status === 'completed') {
      return { success: false, error: '订单已完成，不可改签', errorCode: 'ORDER_COMPLETED' };
    }

    if (order.rebookCount >= order.maxRebookCount) {
      return { success: false, error: '改签次数已达上限', errorCode: 'REBOOK_LIMIT_EXCEEDED' };
    }

    const ferry = store.getFerryClassById(order.ferryClassId);
    const available = store.findAvailableFerryClasses(order.ferryClassId, ferry ? ferry.date : null);

    return { success: true, data: available };
  }

  rebook(orderId, newFerryClassId, reason, operator, idempotencyKey = null) {
    if (idempotencyKey) {
      const existing = store.idempotentKeys.get(idempotencyKey);
      if (existing) {
        return { success: true, data: existing, isDuplicate: true };
      }
    }

    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status === 'completed') {
      return { success: false, error: '订单已完成，不可改签', errorCode: 'ORDER_COMPLETED' };
    }

    if (order.rebookCount >= order.maxRebookCount) {
      return { success: false, error: '改签次数已达上限', errorCode: 'REBOOK_LIMIT_EXCEEDED' };
    }

    const newFerry = store.getFerryClassById(newFerryClassId);
    if (!newFerry) {
      return { success: false, error: '新船班不存在', errorCode: 'FERRY_NOT_FOUND' };
    }

    if (newFerry.status !== 'available') {
      return { success: false, error: '新船班不可用', errorCode: 'FERRY_NOT_AVAILABLE' };
    }

    if (newFerry.bookedCount >= newFerry.capacity) {
      return { success: false, error: '新船班已满员', errorCode: 'FERRY_FULL' };
    }

    const oldFerryId = order.ferryClassId;
    const oldFerry = store.getFerryClassById(oldFerryId);

    store.updateFerryClass(oldFerryId, { bookedCount: oldFerry.bookedCount - 1 });
    store.updateFerryClass(newFerryClassId, { bookedCount: newFerry.bookedCount + 1 });

    const updated = store.updateOrder(
      orderId,
      {
        ferryClassId: newFerryClassId,
        ferryAmount: newFerry.price,
        totalAmount: order.ticketAmount + newFerry.price,
        rebookCount: order.rebookCount + 1
      },
      operator,
      reason
    );

    store.createRebooking({
      orderId,
      oldFerryClassId: oldFerryId,
      newFerryClassId,
      reason,
      operator
    });

    store.addOrderHistory(orderId, '船票改签', {
      oldFerry: oldFerry ? `${oldFerry.route} ${oldFerry.departureTime}` : oldFerryId,
      newFerry: `${newFerry.route} ${newFerry.departureTime}`,
      reason,
      operator
    });

    const result = { success: true, data: updated };
    if (idempotencyKey) {
      store.checkIdempotency(idempotencyKey, updated);
    }
    return result;
  }

  processRefund(orderId, refundType, operator, idempotencyKey = null) {
    if (idempotencyKey) {
      const existing = store.idempotentKeys.get(idempotencyKey);
      if (existing) {
        return { success: true, data: existing, isDuplicate: true };
      }
    }

    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status === 'refunded' || order.status === 'partially_refunded') {
      return { success: false, error: '该订单已存在退款记录', errorCode: 'ALREADY_REFUNDED' };
    }

    const ticketValidated = order.segments.ticket.status === 'validated';
    const ferryValidated = order.segments.ferry.status === 'validated';

    let refundAmount = 0;
    let reason = '';
    const details = {};

    if (refundType === 'full') {
      if (ticketValidated || ferryValidated) {
        return { success: false, error: '订单已有部分核销，无法全额退款', errorCode: 'PARTIALLY_USED' };
      }
      refundAmount = order.totalAmount;
      reason = '全额退款';
      details.type = 'full';
    } else if (refundType === 'partial_ferry') {
      if (ferryValidated) {
        return { success: false, error: '船票已核销，无法退款', errorCode: 'FERRY_USED' };
      }
      refundAmount = order.ferryAmount;
      reason = '船票部分退款（因停航）';
      details.type = 'partial_ferry';
      details.ferryAmount = order.ferryAmount;
    } else if (refundType === 'suspension') {
      if (ferryValidated) {
        return { success: false, error: '船票已核销，无法退款', errorCode: 'FERRY_USED' };
      }
      refundAmount = order.ferryAmount;
      reason = '天气原因停航退款';
      details.type = 'suspension';
      details.ferryAmount = order.ferryAmount;
    } else {
      return { success: false, error: '无效的退款类型', errorCode: 'INVALID_REFUND_TYPE' };
    }

    const newStatus = refundType === 'full' ? 'refunded' : 'partially_refunded';
    const updated = store.updateOrder(orderId, { status: newStatus }, operator, reason);

    const ferry = store.getFerryClassById(order.ferryClassId);
    if (ferry) {
      store.updateFerryClass(order.ferryClassId, { bookedCount: ferry.bookedCount - 1 });
    }

    const refund = store.createRefund({
      orderId,
      refundType,
      amount: refundAmount,
      reason,
      operator,
      details
    });

    store.addOrderHistory(orderId, '退款处理', {
      refundType,
      refundAmount,
      reason,
      operator
    });

    const result = { success: true, data: { order: updated, refund } };
    if (idempotencyKey) {
      store.checkIdempotency(idempotencyKey, { order: updated, refund });
    }
    return result;
  }

  suspendFerryClass(ferryClassId, reason, operator) {
    const ferry = store.getFerryClassById(ferryClassId);
    if (!ferry) {
      return { success: false, error: '船班不存在', errorCode: 'FERRY_NOT_FOUND' };
    }

    if (ferry.status === 'suspended') {
      return { success: false, error: '船班已停航', errorCode: 'ALREADY_SUSPENDED' };
    }

    const suspension = store.createWeatherSuspension({
      ferryClassId,
      reason
    });

    const affectedOrders = store.getAllOrders().filter(
      o => o.ferryClassId === ferryClassId && 
           o.status !== 'refunded' && 
           o.status !== 'completed'
    );

    affectedOrders.forEach(order => {
      store.addOrderHistory(order.id, '天气停航通知', {
        ferryRoute: ferry.route,
        departureTime: ferry.departureTime,
        reason
      });
    });

    return { success: true, data: { suspension, affectedCount: affectedOrders.length } };
  }

  manualCorrect(orderId, field, beforeValue, afterValue, operator, reason) {
    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    const updateData = {};
    if (field === 'passengerName') {
      updateData.passengerName = afterValue;
    } else if (field === 'passengerId') {
      updateData.passengerId = afterValue;
    } else if (field === 'maxRebookCount') {
      updateData.maxRebookCount = parseInt(afterValue);
    } else {
      return { success: false, error: '不支持的字段修正', errorCode: 'UNSUPPORTED_FIELD' };
    }

    const updated = store.updateOrder(orderId, updateData, operator, `人工修正: ${reason}`);

    store.createManualCorrection({
      orderId,
      field,
      beforeValue,
      afterValue,
      operator,
      reason
    });

    store.addOrderHistory(orderId, '人工修正', {
      field,
      beforeValue,
      afterValue,
      operator,
      reason
    });

    return { success: true, data: updated };
  }

  generateReport() {
    const orders = store.getAllOrders();
    const refunds = store.getAllRefunds();
    const rebookings = store.getAllRebookings();
    const ferryClasses = store.ferryClasses;

    const stats = {
      totalOrders: orders.length,
      orderStatusBreakdown: {},
      segmentStatusBreakdown: {
        ticket: { pending: 0, validated: 0 },
        ferry: { pending: 0, validated: 0 }
      },
      totalRevenue: 0,
      totalRefundAmount: 0,
      refundCount: refunds.length,
      rebookingCount: rebookings.length,
      ferryCapacity: {},
      suspendedFerries: 0
    };

    orders.forEach(order => {
      stats.orderStatusBreakdown[order.status] = (stats.orderStatusBreakdown[order.status] || 0) + 1;
      if (order.status === 'completed' || order.status === 'partially_validated') {
        stats.totalRevenue += order.totalAmount;
      }
      Object.keys(order.segments).forEach(seg => {
        const status = order.segments[seg].status;
        stats.segmentStatusBreakdown[seg][status] = (stats.segmentStatusBreakdown[seg][status] || 0) + 1;
      });
    });

    refunds.forEach(r => {
      stats.totalRefundAmount += r.amount;
    });

    ferryClasses.forEach(f => {
      stats.ferryCapacity[f.route] = stats.ferryCapacity[f.route] || { total: 0, booked: 0, available: 0 };
      stats.ferryCapacity[f.route].total += f.capacity;
      stats.ferryCapacity[f.route].booked += f.bookedCount;
      stats.ferryCapacity[f.route].available += (f.capacity - f.bookedCount);
      if (f.status === 'suspended') {
        stats.suspendedFerries++;
      }
    });

    return {
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        statistics: stats,
        recentOrders: orders.slice(-5).map(o => ({
          orderNo: o.orderNo,
          status: o.status,
          segments: o.segments,
          totalAmount: o.totalAmount
        })),
        recentRefunds: refunds.slice(-5),
        recentRebookings: rebookings.slice(-5)
      }
    };
  }

  getOrderHistory(orderId) {
    const order = store.getOrderById(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        history: order.history
      }
    };
  }

  getAuditLogs(recordId = null) {
    let logs = store.getAllAuditLogs();
    if (recordId) {
      logs = logs.filter(l => l.recordId === recordId);
    }
    return { success: true, data: logs };
  }
}

module.exports = new OrderService();
