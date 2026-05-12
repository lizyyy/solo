const store = require('../stores/memoryStore');
const moment = require('moment');
const { ORDER_STATUS, RESCHEDULE_TYPE, PAYMENT_STATUS, MAX_CUSTOMER_RESCHEDULES, CONFIRMATION_TIMEOUT_HOURS, LATE_THRESHOLD_MINUTES, COMPENSATION_RATE, EVENT_TYPES } = require('../config/constants');
const EventService = require('./eventService');
const TechnicianService = require('./technicianService');
const PartsService = require('./partsService');

class OrderService {
  static createOrder(orderData, idempotencyKey = null, operator = 'system') {
    if (idempotencyKey) {
      const cached = store.checkIdempotency(idempotencyKey);
      if (cached) return cached.response;
    }

    const order = store.createOrder({
      customerId: orderData.customerId,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      address: orderData.address,
      applianceType: orderData.applianceType,
      applianceModel: orderData.applianceModel,
      partCodes: orderData.partCodes || [],
      status: ORDER_STATUS.CREATED,
      rescheduleCount: 0,
      customerRescheduleCount: 0,
      technicianRescheduleCount: 0,
      partsAllocated: [],
      confirmations: [],
      compensations: [],
      originalScheduledTime: null,
      scheduledStartTime: null,
      scheduledEndTime: null,
      actualStartTime: null,
      actualEndTime: null,
      technicianId: null
    });

    EventService.logEvent(order.id, EVENT_TYPES.ORDER_CREATED, {
      order: {
        customerName: order.customerName,
        applianceType: order.applianceType,
        address: order.address
      }
    }, operator);

    const result = { success: true, order };
    if (idempotencyKey) store.saveIdempotency(idempotencyKey, result);
    return result;
  }

  static assignTechnician(orderId, technicianId, startTime, endTime, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if ([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(order.status)) {
      return { success: false, error: '已完成或已取消的订单不能分配师傅', errorCode: 'ORDER_NOT_ELIGIBLE' };
    }

    if (order.technicianId) {
      TechnicianService.releaseTechnician(orderId, order.technicianId, operator);
    }

    try {
      TechnicianService.assignTechnician(orderId, technicianId, startTime, endTime, operator);
    } catch (err) {
      return { success: false, error: err.message, errorCode: 'TECHNICIAN_UNAVAILABLE' };
    }

    const updatedOrder = store.updateOrder(orderId, {
      technicianId,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      originalScheduledTime: order.originalScheduledTime || startTime,
      status: ORDER_STATUS.TECHNICIAN_ASSIGNED
    });

    EventService.logEvent(orderId, EVENT_TYPES.TECHNICIAN_ASSIGNED, {
      technicianId,
      startTime,
      endTime
    }, operator);

    return { success: true, order: updatedOrder };
  }

  static allocateParts(orderId, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.partCodes.length === 0) {
      const updatedOrder = store.updateOrder(orderId, {
        status: ORDER_STATUS.PARTS_ALLOCATED
      });
      return { success: true, order: updatedOrder, allocatedParts: [] };
    }

    const result = PartsService.allocateParts(orderId, order.partCodes, operator);

    if (!result.success) {
      return {
        success: false,
        error: '部分配件分配失败',
        errorCode: 'PARTS_ALLOCATION_FAILED',
        details: result
      };
    }

    const updatedOrder = store.updateOrder(orderId, {
      partsAllocated: result.allocatedParts,
      status: ORDER_STATUS.PARTS_ALLOCATED
    });

    return { success: true, order: updatedOrder, ...result };
  }

  static sendConfirmation(orderId, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (![ORDER_STATUS.PARTS_ALLOCATED, ORDER_STATUS.CONFIRMING].includes(order.status)) {
      return { success: false, error: '订单状态不允许发送确认', errorCode: 'INVALID_STATUS' };
    }

    const confirmation = {
      id: store.generateId(),
      sentAt: store.now(),
      expiresAt: moment().add(CONFIRMATION_TIMEOUT_HOURS, 'hours').toISOString(),
      confirmed: false,
      confirmedAt: null,
      channel: 'sms'
    };

    const updatedOrder = store.updateOrder(orderId, {
      confirmations: [...order.confirmations, confirmation],
      status: ORDER_STATUS.CONFIRMING
    });

    EventService.logEvent(orderId, EVENT_TYPES.CONFIRMATION_SENT, {
      confirmationId: confirmation.id,
      expiresAt: confirmation.expiresAt
    }, operator);

    return { success: true, order: updatedOrder, confirmation };
  }

  static confirmAppointment(orderId, confirmationId, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    const confirmation = order.confirmations.find(c => c.id === confirmationId);
    if (!confirmation) {
      return { success: false, error: '确认记录不存在', errorCode: 'CONFIRMATION_NOT_FOUND' };
    }

    if (confirmation.confirmed) {
      return { success: true, order, message: '已确认，幂等返回' };
    }

    if (moment().isAfter(confirmation.expiresAt)) {
      EventService.logEvent(orderId, EVENT_TYPES.CONFIRMATION_TIMEOUT, {
        confirmationId
      }, operator);
      return { success: false, error: '确认已超时', errorCode: 'CONFIRMATION_TIMEOUT' };
    }

    const updatedConfirmations = order.confirmations.map(c => {
      if (c.id === confirmationId) {
        return { ...c, confirmed: true, confirmedAt: store.now() };
      }
      return c;
    });

    const updatedOrder = store.updateOrder(orderId, {
      confirmations: updatedConfirmations,
      status: ORDER_STATUS.CONFIRMED
    });

    EventService.logEvent(orderId, EVENT_TYPES.CONFIRMATION_RECEIVED, {
      confirmationId
    }, operator);

    return { success: true, order: updatedOrder };
  }

  static requestReschedule(orderId, rescheduleRequest, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status === ORDER_STATUS.COMPLETED) {
      return { success: false, error: '已完工的订单不能改期', errorCode: 'ORDER_COMPLETED' };
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
      return { success: false, error: '已取消的订单不能改期', errorCode: 'ORDER_CANCELLED' };
    }

    if (rescheduleRequest.type === RESCHEDULE_TYPE.CUSTOMER) {
      if (order.customerRescheduleCount >= MAX_CUSTOMER_RESCHEDULES) {
        return {
          success: false,
          error: `客户改约次数已达上限 (${MAX_CUSTOMER_RESCHEDULES} 次)`,
          errorCode: 'MAX_REACHED'
        };
      }
    }

    const newStartTime = rescheduleRequest.newStartTime;
    const newEndTime = rescheduleRequest.newEndTime || moment(newStartTime).add(2, 'hours').toISOString();

    let newTechnicianId = rescheduleRequest.newTechnicianId;
    
    if (!newTechnicianId) {
      const availableTech = TechnicianService.findAvailableTechnician(
        order.applianceType,
        newStartTime,
        newEndTime,
        order.technicianId
      );
      if (!availableTech) {
        return { success: false, error: '没有可用的师傅', errorCode: 'NO_TECHNICIAN_AVAILABLE' };
      }
      newTechnicianId = availableTech.id;
    }

    const reschedule = store.createReschedule({
      orderId,
      type: rescheduleRequest.type,
      reason: rescheduleRequest.reason,
      oldTechnicianId: order.technicianId,
      newTechnicianId,
      oldStartTime: order.scheduledStartTime,
      oldEndTime: order.scheduledEndTime,
      newStartTime,
      newEndTime,
      status: 'pending',
      requestedBy: operator,
      requestedAt: store.now()
    });

    const prevStatus = order.status;
    store.updateOrder(orderId, {
      status: ORDER_STATUS.RESCHEDULING,
      previousStatus: prevStatus
    });

    EventService.logEvent(orderId, EVENT_TYPES.RESCHEDULE_REQUESTED, {
      rescheduleId: reschedule.id,
      type: reschedule.type,
      reason: reschedule.reason,
      newStartTime,
      newEndTime
    }, operator);

    return { success: true, reschedule, order: store.getOrder(orderId) };
  }

  static approveReschedule(orderId, rescheduleId, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    const reschedule = store.getReschedule(rescheduleId);
    if (!reschedule) {
      return { success: false, error: '改约记录不存在', errorCode: 'RESCHEDULE_NOT_FOUND' };
    }

    if (reschedule.status !== 'pending') {
      return { success: true, reschedule, message: '已处理，幂等返回' };
    }

    if (order.technicianId && order.technicianId !== reschedule.newTechnicianId) {
      TechnicianService.releaseTechnician(orderId, order.technicianId, operator);
    }

    try {
      TechnicianService.assignTechnician(
        orderId,
        reschedule.newTechnicianId,
        reschedule.newStartTime,
        reschedule.newEndTime,
        operator
      );
    } catch (err) {
      return { success: false, error: err.message, errorCode: 'TECHNICIAN_UNAVAILABLE' };
    }

    PartsService.releaseParts(orderId, operator);
    const partsResult = PartsService.allocateParts(orderId, order.partCodes, operator);

    if (!partsResult.success) {
      store.createReschedule({
        ...reschedule,
        status: 'failed',
        failedReason: '配件重新分配失败'
      });
      return {
        success: false,
        error: '配件重新分配失败',
        errorCode: 'PARTS_REALLOCATION_FAILED',
        details: partsResult
      };
    }

    const customerRescheduleCount = reschedule.type === RESCHEDULE_TYPE.CUSTOMER 
      ? order.customerRescheduleCount + 1 
      : order.customerRescheduleCount;
    const technicianRescheduleCount = reschedule.type === RESCHEDULE_TYPE.TECHNICIAN 
      ? order.technicianRescheduleCount + 1 
      : order.technicianRescheduleCount;

    const updatedOrder = store.updateOrder(orderId, {
      technicianId: reschedule.newTechnicianId,
      scheduledStartTime: reschedule.newStartTime,
      scheduledEndTime: reschedule.newEndTime,
      rescheduleCount: order.rescheduleCount + 1,
      customerRescheduleCount,
      technicianRescheduleCount,
      partsAllocated: partsResult.allocatedParts,
      status: ORDER_STATUS.CONFIRMING,
      previousStatus: null
    });

    const updatedReschedule = store.reschedules.set(rescheduleId, {
      ...reschedule,
      status: 'approved',
      approvedBy: operator,
      approvedAt: store.now()
    });

    EventService.logEvent(orderId, EVENT_TYPES.RESCHEDULE_APPROVED, {
      rescheduleId,
      newTechnicianId: reschedule.newTechnicianId,
      newStartTime: reschedule.newStartTime
    }, operator);

    return {
      success: true,
      order: updatedOrder,
      reschedule: store.getReschedule(rescheduleId)
    };
  }

  static startOrder(orderId, actualStartTime = null, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status !== ORDER_STATUS.CONFIRMED) {
      return { success: false, error: '订单未确认，不能开始', errorCode: 'INVALID_STATUS' };
    }

    const startTime = actualStartTime || store.now();
    const scheduledStart = moment(order.scheduledStartTime);
    const actualStart = moment(startTime);
    const delayMinutes = actualStart.diff(scheduledStart, 'minutes');

    let compensation = null;
    if (delayMinutes > LATE_THRESHOLD_MINUTES) {
      compensation = this._initiateCompensation(orderId, {
        type: 'delay',
        delayMinutes,
        reason: `师傅迟到 ${delayMinutes} 分钟，超过承诺时间 ${LATE_THRESHOLD_MINUTES} 分钟`,
        amount: COMPENSATION_RATE * Math.ceil(delayMinutes / 60)
      }, operator);
    }

    const updatedOrder = store.updateOrder(orderId, {
      status: ORDER_STATUS.IN_PROGRESS,
      actualStartTime: startTime,
      delayMinutes
    });

    EventService.logEvent(orderId, EVENT_TYPES.ORDER_STARTED, {
      startTime,
      delayMinutes,
      compensationInitiated: compensation ? true : false
    }, operator);

    return { success: true, order: updatedOrder, compensation };
  }

  static completeOrder(orderId, actualEndTime = null, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status !== ORDER_STATUS.IN_PROGRESS) {
      return { success: false, error: '进行中的订单才能完工', errorCode: 'INVALID_STATUS' };
    }

    const endTime = actualEndTime || store.now();

    PartsService.releaseParts(orderId, operator);

    const updatedOrder = store.updateOrder(orderId, {
      status: ORDER_STATUS.COMPLETED,
      actualEndTime: endTime
    });

    EventService.logEvent(orderId, EVENT_TYPES.ORDER_COMPLETED, {
      endTime
    }, operator);

    return { success: true, order: updatedOrder };
  }

  static cancelOrder(orderId, reason, operator = 'system') {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    if (order.status === ORDER_STATUS.COMPLETED) {
      return { success: false, error: '已完工订单不能取消', errorCode: 'ORDER_COMPLETED' };
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
      return { success: true, order, message: '已取消，幂等返回' };
    }

    if (order.technicianId) {
      TechnicianService.releaseTechnician(orderId, order.technicianId, operator);
    }

    PartsService.releaseParts(orderId, operator);

    const updatedOrder = store.updateOrder(orderId, {
      status: ORDER_STATUS.CANCELLED,
      cancelledReason: reason,
      cancelledAt: store.now(),
      cancelledBy: operator
    });

    EventService.logEvent(orderId, EVENT_TYPES.ORDER_CANCELLED, {
      reason
    }, operator);

    return { success: true, order: updatedOrder };
  }

  static _initiateCompensation(orderId, compensationData, operator = 'system') {
    const compensation = store.createCompensation({
      orderId,
      type: compensationData.type,
      reason: compensationData.reason,
      amount: compensationData.amount,
      status: PAYMENT_STATUS.PENDING,
      initiatedBy: operator,
      initiatedAt: store.now()
    });

    EventService.logEvent(orderId, EVENT_TYPES.COMPENSATION_INITIATED, {
      compensationId: compensation.id,
      amount: compensation.amount,
      reason: compensation.reason
    }, operator);

    return compensation;
  }

  static processCompensation(compensationId, operator = 'system') {
    const compensation = store.getCompensation(compensationId);
    if (!compensation) {
      return { success: false, error: '赔付记录不存在', errorCode: 'COMPENSATION_NOT_FOUND' };
    }

    if (compensation.status !== PAYMENT_STATUS.PENDING) {
      return { success: true, compensation, message: '已处理，幂等返回' };
    }

    const updated = store.updateCompensation(compensationId, {
      status: PAYMENT_STATUS.PAID,
      paidAt: store.now(),
      paidBy: operator
    });

    EventService.logEvent(compensation.orderId, EVENT_TYPES.COMPENSATION_PAID, {
      compensationId,
      amount: updated.amount
    }, operator);

    return { success: true, compensation: updated };
  }

  static getOrder(orderId) {
    const order = store.getOrder(orderId);
    if (!order) return null;

    const tech = order.technicianId ? store.getTechnician(order.technicianId) : null;
    const reschedules = store.listReschedulesByOrder(orderId);
    const compensations = store.listCompensations({ orderId });
    const events = store.listEvents(orderId);

    return {
      ...order,
      technician: tech ? { id: tech.id, name: tech.name, phone: tech.phone } : null,
      rescheduleHistory: reschedules,
      compensationHistory: compensations,
      events: events.map(e => ({
        timestamp: e.timestamp,
        eventType: e.eventType,
        details: e.details,
        operator: e.operator
      }))
    };
  }

  static listOrders(filters = {}) {
    return store.listOrders(filters).map(order => ({
      id: order.id,
      customerName: order.customerName,
      applianceType: order.applianceType,
      status: order.status,
      scheduledStartTime: order.scheduledStartTime,
      technicianId: order.technicianId,
      rescheduleCount: order.rescheduleCount,
      createdAt: order.createdAt
    }));
  }

  static manualCorrection(orderId, updates, operator, reason) {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在', errorCode: 'ORDER_NOT_FOUND' };
    }

    const beforeState = { ...order };
    const updatedOrder = store.updateOrder(orderId, updates);
    const afterState = { ...updatedOrder };

    EventService.logManualCorrection(orderId, beforeState, afterState, operator, reason);

    return { success: true, order: updatedOrder, diff: { before: beforeState, after: afterState } };
  }
}

module.exports = OrderService;
