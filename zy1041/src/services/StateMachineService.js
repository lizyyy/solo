const { STATUS_TRANSITIONS, ORDER_STATUSES, ORDER_STATUS_NAMES } = require('../utils/constants');

class StateMachineService {
  static canTransition(fromStatus, toStatus, actor) {
    const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
    
    const transition = allowedTransitions.find(t => t.to === toStatus);
    
    if (!transition) {
      return {
        allowed: false,
        reason: `从状态"${ORDER_STATUS_NAMES[fromStatus]}"无法转换到"${ORDER_STATUS_NAMES[toStatus]}"`,
        fromStatus,
        toStatus
      };
    }

    const actorMatch = this.checkActorMatch(transition.actor, actor);
    
    if (!actorMatch) {
      return {
        allowed: false,
        reason: `只有${this.getActorDescription(transition.actor)}才能执行此操作，当前执行者是${this.getActorDescription(actor)}`,
        fromStatus,
        toStatus
      };
    }

    return {
      allowed: true,
      action: transition.action,
      description: transition.description,
      fromStatus,
      toStatus
    };
  }

  static checkActorMatch(requiredActor, actualActor) {
    switch (requiredActor) {
      case 'both':
        return ['requester', 'traveler'].includes(actualActor);
      case 'either':
        return ['requester', 'traveler', 'system'].includes(actualActor);
      case 'system':
        return actualActor === 'system';
      default:
        return requiredActor === actualActor;
    }
  }

  static getActorDescription(actor) {
    const descriptions = {
      'requester': '发起人',
      'traveler': '顺路人',
      'both': '发起人或顺路人',
      'either': '任一方（发起人或顺路人）',
      'system': '系统'
    };
    return descriptions[actor] || actor;
  }

  static getValidNextStates(currentStatus) {
    const transitions = STATUS_TRANSITIONS[currentStatus] || [];
    return transitions.map(t => ({
      status: t.to,
      statusName: ORDER_STATUS_NAMES[t.to],
      action: t.action,
      description: t.description,
      requiredActor: t.actor,
      requiredActorName: this.getActorDescription(t.actor)
    }));
  }

  static validateAndGetTransition(order, targetStatus, actor) {
    if (!order) {
      return {
        allowed: false,
        reason: '订单不存在'
      };
    }

    const currentStatus = order.status;

    if (currentStatus === targetStatus) {
      return {
        allowed: true,
        isNoOp: true,
        reason: '订单已经处于目标状态',
        currentStatus,
        targetStatus
      };
    }

    const terminalStatuses = [
      ORDER_STATUSES.DELIVERED,
      ORDER_STATUSES.CANCELLED,
      ORDER_STATUSES.TIMEOUT_RELEASED
    ];

    if (terminalStatuses.includes(currentStatus)) {
      return {
        allowed: false,
        reason: `订单已处于终止状态"${ORDER_STATUS_NAMES[currentStatus]}"，无法再进行状态变更`,
        currentStatus,
        targetStatus
      };
    }

    return this.canTransition(currentStatus, targetStatus, actor);
  }
}

module.exports = StateMachineService;
