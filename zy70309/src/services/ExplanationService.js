const eventSourcingService = require('./OrderEventSourcingService');
const eventRepository = require('../repositories/EventRepository');
const { StateMachine, ORDER_STATES } = require('./StateMachine');
const { AppError } = require('../utils/errorHandler');

class ExplanationService {
  constructor() {
    this.stateMachine = new StateMachine();
  }

  async generateExplanationReport(orderId, options = {}) {
    const timeline = await eventSourcingService.getOrderTimeline(orderId);
    const projection = await eventSourcingService.getProjection(orderId);
    const consistency = await eventSourcingService.checkConsistency(orderId);

    const report = {
      orderId,
      generatedAt: new Date(),
      summary: this.generateSummary(timeline, projection, consistency),
      customerServiceView: this.generateCustomerServiceView(timeline, projection),
      developerView: this.generateDeveloperView(timeline, projection, consistency),
      commonQuestions: await this.answerCommonQuestions(timeline, projection),
      recommendations: this.generateRecommendations(timeline, consistency),
      rawData: options.includeRawData ? {
        timeline,
        projection,
        consistency
      } : undefined
    };

    return report;
  }

  generateSummary(timeline, projection, consistency) {
    const stateTransitions = timeline.stateTransitions;
    const lastTransition = stateTransitions[stateTransitions.length - 1];

    return {
      currentStatus: projection.currentStateDescription,
      currentState: projection.currentState,
      totalEvents: timeline.totalEvents,
      validEvents: timeline.validEvents,
      invalidEvents: timeline.invalidEvents,
      lastAction: lastTransition ? lastTransition.description : null,
      lastActionTime: lastTransition ? lastTransition.timestamp : null,
      isConsistent: consistency.isConsistent,
      issuesCount: consistency.inconsistencyDetails.length,
      hasCompensations: timeline.events.some(e => e.isCompensation),
      compensationCount: timeline.events.filter(e => e.isCompensation).length
    };
  }

  generateCustomerServiceView(timeline, projection) {
    const stateTransitions = timeline.stateTransitions;

    return {
      overview: `订单状态流转时间线：`,
      timeline: stateTransitions.map((transition, index) => ({
        step: index + 1,
        time: transition.timestamp,
        action: transition.description,
        from: transition.fromStateDescription || '初始状态',
        to: transition.toStateDescription
      })),
      currentStatus: `当前订单状态：${projection.currentStateDescription}`,
      keyInfo: this.extractKeyInfo(projection),
      cancellationInfo: this.extractCancellationInfo(projection),
      refundInfo: this.extractRefundInfo(projection),
      compensationInfo: this.extractCompensationInfo(timeline)
    };
  }

  extractKeyInfo(projection) {
    const info = {};

    if (projection.paymentInfo && projection.paymentInfo.status) {
      info.paymentStatus = projection.paymentInfo.status === 'SUCCEEDED' ? 
        `已支付 ¥${projection.paymentInfo.amount} (${new Date(projection.paymentInfo.paidAt).toLocaleString()})` :
        projection.paymentInfo.status;
    }

    if (projection.inventoryInfo && projection.inventoryInfo.locked) {
      info.inventoryStatus = '库存已锁定';
    }

    if (projection.shippingInfo && projection.shippingInfo.status === 'SHIPPED') {
      info.shippingInfo = `已通过 ${projection.shippingInfo.logisticsCompany} 发货，运单号：${projection.shippingInfo.trackingNumber}`;
    } else if (projection.shippingInfo && projection.shippingInfo.status === 'DELIVERED') {
      info.shippingInfo = `已签收于 ${new Date(projection.shippingInfo.deliveredAt).toLocaleString()}`;
    }

    return info;
  }

  extractCancellationInfo(projection) {
    if (projection.cancellationInfo && projection.cancellationInfo.requested) {
      return {
        requested: true,
        requestedAt: projection.cancellationInfo.requestedAt,
        reason: projection.cancellationInfo.reason,
        status: projection.cancellationInfo.approved === true ? '已批准' :
          projection.cancellationInfo.approved === false ? '已拒绝' : '待处理',
        rejectionReason: projection.cancellationInfo.rejectionReason
      };
    }
    return { requested: false };
  }

  extractRefundInfo(projection) {
    if (projection.refundInfo && projection.refundInfo.status) {
      return {
        hasRefund: true,
        amount: projection.refundInfo.amount,
        reason: projection.refundInfo.reason,
        status: projection.refundInfo.status,
        refundedAt: projection.refundInfo.refundedAt,
        failureReason: projection.refundInfo.failureReason
      };
    }
    return { hasRefund: false };
  }

  extractCompensationInfo(timeline) {
    const compensations = timeline.events.filter(e => e.isCompensation);
    
    if (compensations.length > 0) {
      return {
        hasCompensations: true,
        compensationEvents: compensations.map(c => ({
          time: c.timestamp,
          type: c.eventTypeDescription,
          reason: `补偿原事件: ${c.compensatesEventId}`
        }))
      };
    }
    return { hasCompensations: false };
  }

  generateDeveloperView(timeline, projection, consistency) {
    const invalidEvents = timeline.events.filter(e => !e.isValid);

    return {
      eventStream: timeline.events.map(event => ({
        eventId: event.eventId,
        version: event.eventVersion,
        type: event.eventType,
        time: event.timestamp,
        valid: event.isValid,
        processed: event.isProcessed,
        validationErrors: event.validationErrors,
        isCompensation: event.isCompensation,
        compensates: event.compensatesEventId
      })),
      projectionInfo: {
        version: projection.version,
        lastEventId: projection.lastEventId,
        lastEventTime: projection.lastEventTimestamp,
        stateHistory: projection.stateHistory,
        isConsistent: consistency.isConsistent,
        inconsistencies: consistency.inconsistencyDetails
      },
      invalidEvents: invalidEvents.map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        version: event.eventVersion,
        errors: event.validationErrors,
        interceptedAt: event.timestamp
      })),
      stateMachineAnalysis: this.analyzeStateTransitions(timeline.stateTransitions)
    };
  }

  analyzeStateTransitions(transitions) {
    return {
      totalTransitions: transitions.length,
      transitions: transitions.map((t, i) => ({
        index: i + 1,
        from: t.fromState,
        to: t.toState,
        eventType: t.eventType,
        eventId: t.eventId,
        description: t.description
      }))
    };
  }

  async answerCommonQuestions(timeline, projection) {
    const answers = {};

    answers['为什么订单没发货？'] = this.answerWhyNotShipped(projection);
    answers['为什么退款被拒？'] = this.answerWhyRefundRejected(projection);
    answers['为什么订单被取消了？'] = this.answerWhyCancelled(projection);
    answers['库存状态如何？'] = this.answerInventoryStatus(projection);
    answers['可以继续发货吗？'] = this.answerCanShip(projection);

    return answers;
  }

  answerWhyNotShipped(projection) {
    const reasons = [];

    if (projection.currentState === ORDER_STATES.CREATED) {
      reasons.push('订单刚创建，尚未支付');
    }
    if (projection.currentState === ORDER_STATES.PENDING_PAYMENT) {
      reasons.push('订单待支付');
    }
    if (projection.currentState === ORDER_STATES.PAYMENT_FAILED) {
      reasons.push('支付失败');
    }
    if (projection.currentState === ORDER_STATES.INVENTORY_FAILED) {
      reasons.push('库存锁定失败: ' + (projection.inventoryInfo.failureReason || '未知原因'));
    }
    if (projection.currentState === ORDER_STATES.CANCEL_PENDING) {
      reasons.push('取消申请待处理');
    }
    if (projection.currentState === ORDER_STATES.CANCELLED) {
      reasons.push('订单已取消');
    }
    if (projection.currentState === ORDER_STATES.REFUND_PENDING) {
      reasons.push('退款申请待处理');
    }
    if (projection.currentState === ORDER_STATES.REFUNDED) {
      reasons.push('订单已退款');
    }
    if (projection.currentState === ORDER_STATES.COMPENSATED) {
      reasons.push('订单已补偿');
    }
    if (reasons.length === 0) {
      if (!projection.inventoryInfo.locked) {
        reasons.push('库存未锁定');
      }
    }

    return {
      currentState: projection.currentStateDescription,
      reasons: reasons.length > 0 ? reasons : ['未知原因'],
      canShip: this.stateMachine.getAllowedEvents(projection.currentState).includes('SHIPPING_INITIATED')
    };
  }

  answerWhyRefundRejected(projection) {
    if (projection.cancellationInfo && projection.cancellationInfo.approved === false) {
      return {
        hasRejection: true,
        rejectionTime: projection.cancellationInfo.rejectedAt,
        rejectionReason: projection.cancellationInfo.rejectionReason,
        operator: projection.cancellationInfo.operator
      };
    }

    if (projection.refundInfo && projection.refundInfo.status === 'FAILED') {
      return {
        hasRejection: true,
        failureReason: projection.refundInfo.failureReason
      };
    }

    return { hasRejection: false };
  }

  answerWhyCancelled(projection) {
    if (projection.currentState === ORDER_STATES.CANCELLED) {
      return {
        isCancelled: true,
        cancellationReason: projection.cancellationInfo.reason,
        cancellationTime: projection.cancellationInfo.approvedAt
      };
    }
    return { isCancelled: false };
  }

  answerInventoryStatus(projection) {
    if (projection.inventoryInfo && projection.inventoryInfo.locked) {
      return {
        locked: true,
        lockedAt: projection.inventoryInfo.lockedAt,
        items: projection.inventoryInfo.items
      };
    } else {
      return {
        locked: false,
        failureReason: projection.inventoryInfo ? projection.inventoryInfo.failureReason : undefined
      };
    }
  }

  answerCanShip(projection) {
    const allowedEvents = this.stateMachine.getAllowedEvents(projection.currentState);
    return {
      canShip: allowedEvents.includes('SHIPPING_INITIATED'),
      currentState: projection.currentStateDescription,
      allowedActions: allowedEvents
    };
  }

  generateRecommendations(timeline, consistency) {
    const recommendations = [];

    if (!consistency.isConsistent) {
      recommendations.push({
        type: 'CRITICAL',
        title: '投影与事件流不一致',
        description: '检测到投影状态与事件流回放结果不一致',
        action: '建议调用重建投影',
        details: consistency.inconsistencyDetails
      });
    }

    const invalidEvents = timeline.events.filter(e => !e.isValid);
    if (invalidEvents.length > 0) {
      recommendations.push({
        type: 'WARNING',
        title: '检测到非法事件',
        description: `共有 ${invalidEvents.length} 个事件被拦截`,
        action: '请检查非法事件的原因，必要时添加补偿事件',
        details: invalidEvents.map(e => ({
          eventId: e.eventId,
          errors: e.validationErrors
        }))
      });
    }

    const compensations = timeline.events.filter(e => e.isCompensation);
    if (compensations.length > 0) {
      recommendations.push({
        type: 'INFO',
        title: '存在补偿事件',
        description: `订单存在 ${compensations.length} 个补偿事件`,
        action: '请确认补偿操作是否完整'
      });
    }

    return recommendations;
  }

  async exportReportAsText(orderId) {
    const report = await this.generateExplanationReport(orderId);

    let text = `========================================
订单事件溯源解释报告
订单号: ${report.orderId}
生成时间: ${report.generatedAt.toLocaleString()}
========================================

【当前状态概览】
状态: ${report.summary.currentStatus}
总事件数: ${report.summary.totalEvents}
有效事件: ${report.summary.validEvents}
非法事件: ${report.summary.invalidEvents}
一致性: ${report.summary.isConsistent ? '一致' : '不一致'}
${report.summary.hasCompensations ? `补偿事件数: ${report.summary.compensationCount}` : ''}

【状态流转时间线】
${report.customerServiceView.timeline.map((t, i) => `${i + 1}. [${t.time.toLocaleString()}] ${t.action}
   ${t.from} → ${t.to}
`).join('\n')}

【关键问题解答】
${Object.entries(report.commonQuestions).map(([q, a]) => `
Q: ${q}
A: ${JSON.stringify(a, null, 2)}
`).join('\n')}

【建议】
${report.recommendations.map(r => `
[${r.type}] ${r.title}
  ${r.description}
  建议: ${r.action}
`).join('\n')}

========================================
`;

    return text;
  }
}

module.exports = new ExplanationService();
