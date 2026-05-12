const { StateMachine, EVENT_TYPES } = require('./StateMachine');
const eventRepository = require('../repositories/EventRepository');

class RuleEngine {
  constructor() {
    this.stateMachine = new StateMachine();
  }

  async validateEvent(eventData, currentState, latestVersion) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      isIdempotent: false
    };

    if (eventData.eventId) {
      const existingEvent = await eventRepository.findEventById(eventData.eventId);
      if (existingEvent) {
        validationResult.isIdempotent = true;
        validationResult.existingEvent = existingEvent;
        validationResult.warnings.push('事件已存在，幂等处理');
      }
    }

    if (eventData.eventVersion !== undefined && eventData.eventVersion !== null) {
      if (eventData.eventVersion <= latestVersion) {
        validationResult.isValid = false;
        validationResult.errors.push(
          `事件版本号 ${eventData.eventVersion} 必须大于最新版本 ${latestVersion}`
        );
      }
    }

    if (eventData.isCompensation) {
      const compensationValidation = await this.validateCompensationEvent(eventData);
      validationResult.errors.push(...compensationValidation.errors);
      validationResult.warnings.push(...compensationValidation.warnings);
      validationResult.isValid = compensationValidation.isValid && validationResult.isValid;
    }

    if (!eventData.isCompensation && currentState) {
      const transitionValid = this.stateMachine.isValidTransition(
        currentState,
        eventData.eventType
      );
      
      if (!transitionValid) {
        validationResult.isValid = false;
        validationResult.errors.push(
          `非法状态跳转: 当前状态 [${currentState}] 不允许执行事件 [${eventData.eventType}]`
        );
        
        const allowedEvents = this.stateMachine.getAllowedEvents(currentState);
        if (allowedEvents.length > 0) {
          validationResult.errors.push(
            `当前状态允许的事件: ${allowedEvents.join(', ')}`
          );
        } else {
          validationResult.errors.push(
            `当前状态为终态，不允许任何状态变更`
          );
        }
      }
    }

    const businessValidation = this.validateBusinessRules(eventData, currentState);
    validationResult.errors.push(...businessValidation.errors);
    validationResult.warnings.push(...businessValidation.warnings);
    validationResult.isValid = businessValidation.isValid && validationResult.isValid;

    return validationResult;
  }

  async validateCompensationEvent(eventData) {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!eventData.compensatesEventId) {
      result.isValid = false;
      result.errors.push('补偿事件必须指定 compensatesEventId');
      return result;
    }

    const originalEvent = await eventRepository.findEventById(eventData.compensatesEventId);
    if (!originalEvent) {
      result.isValid = false;
      result.errors.push(`原事件 ${eventData.compensatesEventId} 不存在`);
      return result;
    }

    if (originalEvent.isCompensation) {
      result.isValid = false;
      result.errors.push('不能对补偿事件再进行补偿');
      return result;
    }

    const existingCompensations = await eventRepository.findCompensationsForEvent(
      eventData.compensatesEventId
    );

    if (existingCompensations.length > 0) {
      result.warnings.push(
        `原事件 ${eventData.compensatesEventId} 已存在 ${existingCompensations.length} 个补偿事件`
      );
    }

    return result;
  }

  validateBusinessRules(eventData, currentState) {
    const result = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!eventData.payload) {
      result.isValid = false;
      result.errors.push('事件必须包含 payload');
      return result;
    }

    switch (eventData.eventType) {
      case EVENT_TYPES.ORDER_CREATED:
        this.validateOrderCreated(eventData.payload, result);
        break;

      case EVENT_TYPES.PAYMENT_SUCCEEDED:
        this.validatePaymentSucceeded(eventData.payload, result);
        break;

      case EVENT_TYPES.PAYMENT_FAILED:
        this.validatePaymentFailed(eventData.payload, result);
        break;

      case EVENT_TYPES.INVENTORY_LOCKED:
        this.validateInventoryLocked(eventData.payload, result);
        break;

      case EVENT_TYPES.CANCEL_REQUESTED:
        this.validateCancelRequested(eventData.payload, result);
        break;

      case EVENT_TYPES.CANCEL_APPROVED:
      case EVENT_TYPES.CANCEL_REJECTED:
        this.validateCancelResponse(eventData.payload, result);
        break;

      case EVENT_TYPES.REFUND_INITIATED:
        this.validateRefundInitiated(eventData.payload, result);
        break;

      case EVENT_TYPES.REFUND_SUCCEEDED:
      case EVENT_TYPES.REFUND_FAILED:
        this.validateRefundResponse(eventData.payload, result);
        break;

      case EVENT_TYPES.SHIPPED:
        this.validateShipped(eventData.payload, result);
        break;

      case EVENT_TYPES.DELIVERED:
        this.validateDelivered(eventData.payload, result);
        break;

      default:
        break;
    }

    return result;
  }

  validateOrderCreated(payload, result) {
    if (!payload.userId) {
      result.errors.push('订单创建事件必须包含 userId');
      result.isValid = false;
    }
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      result.errors.push('订单创建事件必须包含至少一个商品项');
      result.isValid = false;
    }
    if (!payload.totalAmount || payload.totalAmount <= 0) {
      result.errors.push('订单总金额必须大于 0');
      result.isValid = false;
    }
    if (!payload.shippingAddress) {
      result.errors.push('订单创建事件必须包含收货地址');
      result.isValid = false;
    }
  }

  validatePaymentSucceeded(payload, result) {
    if (!payload.paymentId) {
      result.errors.push('支付成功事件必须包含 paymentId');
      result.isValid = false;
    }
    if (!payload.amount) {
      result.errors.push('支付成功事件必须包含支付金额');
      result.isValid = false;
    }
  }

  validatePaymentFailed(payload, result) {
    if (!payload.reason) {
      result.warnings.push('建议支付失败事件包含失败原因');
    }
  }

  validateInventoryLocked(payload, result) {
    if (!payload.items || !Array.isArray(payload.items)) {
      result.errors.push('库存锁定事件必须包含锁定的商品列表');
      result.isValid = false;
    }
  }

  validateCancelRequested(payload, result) {
    if (!payload.reason) {
      result.warnings.push('建议取消申请包含取消原因');
    }
  }

  validateCancelResponse(payload, result) {
    if (!payload.operator) {
      result.warnings.push('建议取消审批包含操作人信息');
    }
  }

  validateRefundInitiated(payload, result) {
    if (!payload.reason) {
      result.errors.push('退款申请必须包含退款原因');
      result.isValid = false;
    }
    if (!payload.amount || payload.amount <= 0) {
      result.errors.push('退款金额必须大于 0');
      result.isValid = false;
    }
  }

  validateRefundResponse(payload, result) {
    if (!payload.refundId) {
      result.errors.push('退款结果事件必须包含 refundId');
      result.isValid = false;
    }
  }

  validateShipped(payload, result) {
    if (!payload.logisticsCompany || !payload.trackingNumber) {
      result.errors.push('发货事件必须包含物流公司和运单号');
      result.isValid = false;
    }
  }

  validateDelivered(payload, result) {
    if (!payload.signedBy) {
      result.warnings.push('建议签收事件包含签收人信息');
    }
  }

  async checkConsistency(orderId, projection) {
    const inconsistencyDetails = [];
    
    const eventCount = await eventRepository.countEvents(orderId);
    const validEvents = await eventRepository.findEventsByOrderId(orderId, { isValid: true });
    const latestEvent = validEvents[validEvents.length - 1];

    if (projection.version !== validEvents.length) {
      inconsistencyDetails.push(
        `投影版本号 [${projection.version}] 与有效事件数量 [${validEvents.length}] 不一致`
      );
    }

    if (latestEvent && projection.lastEventId !== latestEvent.eventId) {
      inconsistencyDetails.push(
        `投影最后事件ID [${projection.lastEventId}] 与实际最后事件ID [${latestEvent.eventId}] 不一致`
      );
    }

    if (latestEvent && projection.lastEventTimestamp.getTime() !== latestEvent.timestamp.getTime()) {
      inconsistencyDetails.push(
        `投影最后事件时间与实际最后事件时间不一致`
      );
    }

    const replayedProjection = await this.replayEvents(validEvents);
    if (replayedProjection.currentState !== projection.currentState) {
      inconsistencyDetails.push(
        `投影当前状态 [${projection.currentState}] 与事件回放状态 [${replayedProjection.currentState}] 不一致`
      );
    }

    return {
      isConsistent: inconsistencyDetails.length === 0,
      inconsistencyDetails
    };
  }

  async replayEvents(events) {
    const { StateMachine, ORDER_STATES } = require('./StateMachine');
    const stateMachine = new StateMachine();

    let projection = {
      currentState: null,
      version: 0,
      orderDetails: {},
      paymentInfo: {},
      inventoryInfo: { locked: false, items: [] },
      shippingInfo: {},
      cancellationInfo: { requested: false },
      refundInfo: {},
      compensationInfo: { isCompensated: false, events: [] },
      stateHistory: []
    };

    for (const event of events) {
      if (!event.isValid) continue;

      projection = this.applyEvent(projection, event, stateMachine);
      projection.version++;

      const { EVENT_TO_STATE_MAPPING } = require('./StateMachine');
      const newState = EVENT_TO_STATE_MAPPING[event.eventType];
      
      if (newState && event.eventType !== 'ORDER_CREATED') {
        const description = stateMachine.getTransitionDescription(
          projection.currentState || ORDER_STATES.CREATED,
          event.eventType
        );
        
        projection.stateHistory.push({
          state: newState,
          eventId: event.eventId,
          timestamp: event.timestamp,
          description: description || stateMachine.getEventDescription(event.eventType)
        });
      }

      if (event.eventType === 'ORDER_CREATED') {
        projection.currentState = ORDER_STATES.CREATED;
      } else {
        projection.currentState = newState || projection.currentState;
      }
    }

    return projection;
  }

  applyEvent(projection, event, stateMachine) {
    const newProjection = JSON.parse(JSON.stringify(projection));
    const { EVENT_TYPES } = require('./StateMachine');

    switch (event.eventType) {
      case EVENT_TYPES.ORDER_CREATED:
        newProjection.orderDetails = {
          userId: event.payload.userId,
          items: event.payload.items,
          totalAmount: event.payload.totalAmount,
          shippingAddress: event.payload.shippingAddress,
          paymentMethod: event.payload.paymentMethod,
          remark: event.payload.remark
        };
        break;

      case EVENT_TYPES.PAYMENT_INITIATED:
        newProjection.paymentInfo = {
          status: 'PENDING'
        };
        break;

      case EVENT_TYPES.PAYMENT_SUCCEEDED:
        newProjection.paymentInfo = {
          paymentId: event.payload.paymentId,
          amount: event.payload.amount,
          paidAt: event.timestamp,
          status: 'SUCCEEDED'
        };
        break;

      case EVENT_TYPES.PAYMENT_FAILED:
        newProjection.paymentInfo = {
          ...newProjection.paymentInfo,
          status: 'FAILED',
          failureReason: event.payload.reason
        };
        break;

      case EVENT_TYPES.INVENTORY_LOCKED:
        newProjection.inventoryInfo = {
          locked: true,
          lockedAt: event.timestamp,
          items: event.payload.items
        };
        break;

      case EVENT_TYPES.INVENTORY_FAILED:
        newProjection.inventoryInfo = {
          locked: false,
          failureReason: event.payload.reason
        };
        break;

      case EVENT_TYPES.SHIPPING_INITIATED:
        newProjection.shippingInfo = {
          status: 'PENDING'
        };
        break;

      case EVENT_TYPES.SHIPPED:
        newProjection.shippingInfo = {
          shippingId: event.payload.shippingId,
          logisticsCompany: event.payload.logisticsCompany,
          trackingNumber: event.payload.trackingNumber,
          shippedAt: event.timestamp,
          status: 'SHIPPED'
        };
        break;

      case EVENT_TYPES.DELIVERED:
        newProjection.shippingInfo = {
          ...newProjection.shippingInfo,
          deliveredAt: event.timestamp,
          status: 'DELIVERED',
          signedBy: event.payload.signedBy
        };
        break;

      case EVENT_TYPES.CANCEL_REQUESTED:
        newProjection.cancellationInfo = {
          requested: true,
          requestedAt: event.timestamp,
          reason: event.payload.reason
        };
        break;

      case EVENT_TYPES.CANCEL_APPROVED:
        newProjection.cancellationInfo = {
          ...newProjection.cancellationInfo,
          approved: true,
          approvedAt: event.timestamp,
          operator: event.payload.operator
        };
        break;

      case EVENT_TYPES.CANCEL_REJECTED:
        newProjection.cancellationInfo = {
          ...newProjection.cancellationInfo,
          approved: false,
          rejectedAt: event.timestamp,
          rejectionReason: event.payload.reason,
          operator: event.payload.operator
        };
        break;

      case EVENT_TYPES.REFUND_INITIATED:
        newProjection.refundInfo = {
          amount: event.payload.amount,
          reason: event.payload.reason,
          status: 'PENDING'
        };
        break;

      case EVENT_TYPES.REFUND_SUCCEEDED:
        newProjection.refundInfo = {
          ...newProjection.refundInfo,
          refundId: event.payload.refundId,
          status: 'SUCCEEDED',
          refundedAt: event.timestamp
        };
        break;

      case EVENT_TYPES.REFUND_FAILED:
        newProjection.refundInfo = {
          ...newProjection.refundInfo,
          refundId: event.payload.refundId,
          status: 'FAILED',
          failureReason: event.payload.reason
        };
        break;

      case EVENT_TYPES.COMPENSATION_INVENTORY_RELEASED:
      case EVENT_TYPES.COMPENSATION_PAYMENT_REFUNDED:
      case EVENT_TYPES.COMPENSATION_EVENT:
        if (!newProjection.compensationInfo.events) {
          newProjection.compensationInfo.events = [];
        }
        newProjection.compensationInfo.events.push({
          eventId: event.eventId,
          eventType: event.eventType,
          compensatesEventId: event.compensatesEventId,
          appliedAt: event.timestamp
        });
        newProjection.compensationInfo.isCompensated = true;
        newProjection.compensationInfo.compensatedAt = event.timestamp;
        
        if (event.eventType === EVENT_TYPES.COMPENSATION_INVENTORY_RELEASED) {
          newProjection.inventoryInfo.locked = false;
        }
        break;
    }

    return newProjection;
  }
}

module.exports = new RuleEngine();
