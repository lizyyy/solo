const Order = require('../models/Order');
const Request = require('../models/Request');
const Trip = require('../models/Trip');
const AuditLog = require('../models/AuditLog');
const StateMachineService = require('./StateMachineService');
const LockService = require('./LockService');
const MatchingEngine = require('./MatchingEngine');
const { ORDER_STATUSES, AUDIT_ACTIONS } = require('../utils/constants');

class OrderService {
  static async createOrder(request, trip) {
    const order = await Order.create({
      request_id: request.id,
      trip_id: trip.id,
      requester_id: request.requester_id,
      traveler_id: trip.traveler_id,
      tip_amount: request.tip_amount || 0,
      status: ORDER_STATUSES.PENDING_MATCHING
    });

    await AuditLog.create({
      request_id: request.id,
      order_id: order.id,
      actor_id: trip.traveler_id,
      actor_type: 'traveler',
      action: AUDIT_ACTIONS.MATCHING_SUCCESS,
      details: {
        trip_id: trip.id,
        request_id: request.id,
        order_id: order.id
      }
    });

    return order;
  }

  static async lockOrder(requestId, travelerId, idempotencyKey = null) {
    const request = await Request.findById(requestId);
    if (!request) {
      return {
        success: false,
        error: 'REQUEST_NOT_FOUND',
        message: '请求单不存在'
      };
    }

    if (request.status !== 'pending') {
      return {
        success: false,
        error: 'REQUEST_NOT_AVAILABLE',
        message: `请求单状态为"${request.status}"，无法锁定`
      };
    }

    const existingOrder = await Order.findActiveByRequestId(requestId);
    if (existingOrder) {
      if (existingOrder.traveler_id === travelerId) {
        if (existingOrder.status === ORDER_STATUSES.LOCKED) {
          return {
            success: true,
            isIdempotent: true,
            message: '您已锁定该订单',
            order: existingOrder
          };
        }
        if (existingOrder.status === ORDER_STATUSES.PENDING_MATCHING) {
          const updateResult = await Order.updateStatus(existingOrder.id, ORDER_STATUSES.LOCKED);
          if (updateResult) {
            await AuditLog.create({
              request_id: requestId,
              order_id: existingOrder.id,
              actor_id: travelerId,
              actor_type: 'traveler',
              action: AUDIT_ACTIONS.ORDER_LOCKED,
              details: {
                previous_status: existingOrder.status,
                new_status: ORDER_STATUSES.LOCKED
              }
            });

            const updatedOrder = await Order.findById(existingOrder.id);
            return {
              success: true,
              order: updatedOrder
            };
          }
        }
      }

      return {
        success: false,
        error: 'ORDER_ALREADY_LOCKED',
        message: '该请求单已被其他顺路人锁定',
        locked_by: existingOrder.traveler_id,
        current_status: existingOrder.status
      };
    }

    const lockResult = await LockService.checkAndAcquireRequestLock(requestId, travelerId);
    
    if (!lockResult.acquired) {
      return {
        success: false,
        error: 'CONCURRENT_LOCK_FAILED',
        message: '并发冲突：该请求单正在被其他用户处理',
        lockInfo: lockResult
      };
    }

    try {
      const trips = await Trip.findAllActive();
      const travelerTrips = trips.filter(t => t.traveler_id === travelerId);

      let matchedTrip = null;
      for (const trip of travelerTrips) {
        const matchResult = MatchingEngine.calculateMatchScore(request, trip);
        if (matchResult.matched) {
          matchedTrip = trip;
          break;
        }
      }

      if (!matchedTrip && travelerTrips.length > 0) {
        matchedTrip = travelerTrips[0];
      }

      if (!matchedTrip) {
        await LockService.releaseRequestLock(requestId, travelerId);
        return {
          success: false,
          error: 'NO_TRIP_FOUND',
          message: '该顺路人没有可用的行程'
        };
      }

      const order = await Order.create({
        request_id: requestId,
        trip_id: matchedTrip.id,
        requester_id: request.requester_id,
        traveler_id: travelerId,
        tip_amount: request.tip_amount || 0,
        status: ORDER_STATUSES.LOCKED
      });

      await Request.updateStatus(requestId, 'locked');

      await AuditLog.create({
        request_id: requestId,
        order_id: order.id,
        actor_id: travelerId,
        actor_type: 'traveler',
        action: AUDIT_ACTIONS.ORDER_LOCKED,
        details: {
          trip_id: matchedTrip.id,
          idempotency_key: idempotencyKey
        }
      });

      await LockService.releaseRequestLock(requestId, travelerId);

      return {
        success: true,
        order
      };

    } catch (error) {
      await LockService.releaseRequestLock(requestId, travelerId);
      throw error;
    }
  }

  static async confirmOrder(orderId, actorId, actorType) {
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      };
    }

    const transitionCheck = StateMachineService.validateAndGetTransition(
      order,
      ORDER_STATUSES.BOTH_CONFIRMED,
      actorType
    );

    if (!transitionCheck.allowed) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: transitionCheck.reason,
        details: transitionCheck
      };
    }

    if (transitionCheck.isNoOp) {
      return {
        success: true,
        isIdempotent: true,
        message: '订单已处于已确认状态',
        order
      };
    }

    const updated = await Order.updateStatus(orderId, ORDER_STATUSES.BOTH_CONFIRMED);
    if (!updated) {
      return {
        success: false,
        error: 'UPDATE_FAILED',
        message: '更新订单状态失败'
      };
    }

    await AuditLog.create({
      request_id: order.request_id,
      order_id: order.id,
      actor_id: actorId,
      actor_type: actorType,
      action: AUDIT_ACTIONS.ORDER_CONFIRMED,
      details: {
        previous_status: order.status,
        new_status: ORDER_STATUSES.BOTH_CONFIRMED
      }
    });

    const updatedOrder = await Order.findById(orderId);
    return {
      success: true,
      order: updatedOrder
    };
  }

  static async pickupItem(orderId, travelerId) {
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      };
    }

    if (order.traveler_id !== travelerId) {
      return {
        success: false,
        error: 'UNAUTHORIZED',
        message: '只有接单的顺路人才能标记取到物品'
      };
    }

    const transitionCheck = StateMachineService.validateAndGetTransition(
      order,
      ORDER_STATUSES.PICKED_UP,
      'traveler'
    );

    if (!transitionCheck.allowed) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: transitionCheck.reason
      };
    }

    if (transitionCheck.isNoOp) {
      return {
        success: true,
        isIdempotent: true,
        message: '已标记取到物品',
        order
      };
    }

    const updated = await Order.updateStatus(orderId, ORDER_STATUSES.PICKED_UP);
    if (!updated) {
      return {
        success: false,
        error: 'UPDATE_FAILED',
        message: '更新订单状态失败'
      };
    }

    await AuditLog.create({
      request_id: order.request_id,
      order_id: order.id,
      actor_id: travelerId,
      actor_type: 'traveler',
      action: AUDIT_ACTIONS.ITEM_PICKED_UP,
      details: {
        previous_status: order.status,
        new_status: ORDER_STATUSES.PICKED_UP
      }
    });

    const updatedOrder = await Order.findById(orderId);
    return {
      success: true,
      order: updatedOrder
    };
  }

  static async deliverItem(orderId, travelerId) {
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      };
    }

    if (order.traveler_id !== travelerId) {
      return {
        success: false,
        error: 'UNAUTHORIZED',
        message: '只有接单的顺路人才能标记送达'
      };
    }

    const transitionCheck = StateMachineService.validateAndGetTransition(
      order,
      ORDER_STATUSES.DELIVERED,
      'traveler'
    );

    if (!transitionCheck.allowed) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: transitionCheck.reason
      };
    }

    if (transitionCheck.isNoOp) {
      return {
        success: true,
        isIdempotent: true,
        message: '已标记送达',
        order
      };
    }

    const updated = await Order.updateStatus(orderId, ORDER_STATUSES.DELIVERED);
    if (!updated) {
      return {
        success: false,
        error: 'UPDATE_FAILED',
        message: '更新订单状态失败'
      };
    }

    await Request.updateStatus(order.request_id, 'completed');

    await AuditLog.create({
      request_id: order.request_id,
      order_id: order.id,
      actor_id: travelerId,
      actor_type: 'traveler',
      action: AUDIT_ACTIONS.ITEM_DELIVERED,
      details: {
        previous_status: order.status,
        new_status: ORDER_STATUSES.DELIVERED
      }
    });

    const updatedOrder = await Order.findById(orderId);
    return {
      success: true,
      order: updatedOrder
    };
  }

  static async cancelOrder(orderId, actorId, actorType, reason = '') {
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      };
    }

    const transitionCheck = StateMachineService.validateAndGetTransition(
      order,
      ORDER_STATUSES.CANCELLED,
      actorType
    );

    if (!transitionCheck.allowed) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: transitionCheck.reason
      };
    }

    if (transitionCheck.isNoOp) {
      return {
        success: true,
        isIdempotent: true,
        message: '订单已取消',
        order
      };
    }

    const updated = await Order.updateStatus(orderId, ORDER_STATUSES.CANCELLED);
    if (!updated) {
      return {
        success: false,
        error: 'UPDATE_FAILED',
        message: '更新订单状态失败'
      };
    }

    await Request.updateStatus(order.request_id, 'cancelled');

    await AuditLog.create({
      request_id: order.request_id,
      order_id: order.id,
      actor_id: actorId,
      actor_type: actorType,
      action: AUDIT_ACTIONS.ORDER_CANCELLED,
      details: {
        previous_status: order.status,
        new_status: ORDER_STATUSES.CANCELLED,
        reason
      }
    });

    const updatedOrder = await Order.findById(orderId);
    return {
      success: true,
      order: updatedOrder
    };
  }

  static async raiseDispute(orderId, actorId, actorType, disputeReason) {
    const order = await Order.findById(orderId);
    if (!order) {
      return {
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      };
    }

    const transitionCheck = StateMachineService.validateAndGetTransition(
      order,
      ORDER_STATUSES.IN_DISPUTE,
      actorType
    );

    if (!transitionCheck.allowed) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: transitionCheck.reason
      };
    }

    const updated = await Order.updateStatus(orderId, ORDER_STATUSES.IN_DISPUTE);
    if (!updated) {
      return {
        success: false,
        error: 'UPDATE_FAILED',
        message: '更新订单状态失败'
      };
    }

    await AuditLog.create({
      request_id: order.request_id,
      order_id: order.id,
      actor_id: actorId,
      actor_type: actorType,
      action: AUDIT_ACTIONS.DISPUTE_RAISED,
      details: {
        previous_status: order.status,
        new_status: ORDER_STATUSES.IN_DISPUTE,
        dispute_reason: disputeReason
      }
    });

    const updatedOrder = await Order.findById(orderId);
    return {
      success: true,
      order: updatedOrder
    };
  }

  static async getOrderStatus(orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      return null;
    }

    const validNextStates = StateMachineService.getValidNextStates(order.status);
    const auditLogs = await AuditLog.findByOrderId(orderId);

    return {
      ...order,
      valid_next_states: validNextStates,
      audit_logs: auditLogs
    };
  }
}

module.exports = OrderService;
