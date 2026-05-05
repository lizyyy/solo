const store = require('../store');

const PROBLEM_TYPES = {
  ACK_LOST: 'ack_lost',
  DUPLICATE_DELIVERY: 'duplicate_delivery',
  MAX_RETRY_REACHED: 'max_retry_reached',
  DEAD_LETTER: 'dead_letter',
  ORDER_KEY_VIOLATION: 'order_key_violation',
  CONSUMER_BACKLOG: 'consumer_backlog',
  IDEMPOTENCY_RISK: 'idempotency_risk'
};

class AnalysisService {
  constructor() {
    this.maxRetryAttempts = 5;
    this.backlogThreshold = 100;
  }

  analyzeMessage(messageId, taskId = null) {
    const message = store.getMessage(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    const deliveryEvents = store.getDeliveryEventsByMessageId(messageId);
    const problems = [];
    const analysisResult = {
      messageId,
      taskId,
      problems: [],
      deliveryChain: deliveryEvents.map(e => e.toJSON()),
      finalStatus: 'unknown',
      ackLost: false,
      duplicateDeliveries: 0,
      maxRetryReached: false,
      deadLetterReason: null,
      orderKeyViolation: false,
      consumerBacklog: 0,
      idempotencyRisk: false
    };

    if (deliveryEvents.length === 0) {
      analysisResult.finalStatus = 'undelivered';
      problems.push({
        type: 'undelivered',
        severity: 'high',
        message: 'Message was produced but never delivered to any consumer'
      });
    } else {
      analysisResult.ackLost = this.detectAckLost(deliveryEvents);
      if (analysisResult.ackLost) {
        problems.push({
          type: PROBLEM_TYPES.ACK_LOST,
          severity: 'high',
          message: 'ACK was lost. Consumer processed message but broker never received confirmation'
        });
      }

      analysisResult.duplicateDeliveries = this.countDuplicateDeliveries(deliveryEvents);
      if (analysisResult.duplicateDeliveries > 0) {
        problems.push({
          type: PROBLEM_TYPES.DUPLICATE_DELIVERY,
          severity: 'medium',
          message: `Message was delivered ${analysisResult.duplicateDeliveries + 1} times (${analysisResult.duplicateDeliveries} duplicates)`
        });
      }

      const maxRetryResult = this.detectMaxRetryReached(deliveryEvents);
      analysisResult.maxRetryReached = maxRetryResult.reached;
      if (analysisResult.maxRetryReached) {
        problems.push({
          type: PROBLEM_TYPES.MAX_RETRY_REACHED,
          severity: 'high',
          message: `Max retry attempts (${maxRetryResult.attempts}) reached`
        });
      }

      const deadLetterResult = this.detectDeadLetter(deliveryEvents);
      analysisResult.deadLetterReason = deadLetterResult.reason;
      if (analysisResult.deadLetterReason) {
        problems.push({
          type: PROBLEM_TYPES.DEAD_LETTER,
          severity: 'critical',
          message: `Message sent to dead letter queue: ${analysisResult.deadLetterReason}`
        });
      }

      analysisResult.idempotencyRisk = this.detectIdempotencyRisk(message, deliveryEvents);
      if (analysisResult.idempotencyRisk) {
        problems.push({
          type: PROBLEM_TYPES.IDEMPOTENCY_RISK,
          severity: 'high',
          message: 'Message has idempotency risk - no unique key or message ID found for deduplication'
        });
      }

      analysisResult.finalStatus = this.determineFinalStatus(deliveryEvents);
    }

    if (message.orderKey) {
      analysisResult.orderKeyViolation = this.detectOrderKeyViolation(message);
      if (analysisResult.orderKeyViolation) {
        problems.push({
          type: PROBLEM_TYPES.ORDER_KEY_VIOLATION,
          severity: 'medium',
          message: `Order key violation detected for orderKey: ${message.orderKey}`
        });
      }
    }

    const consumerGroups = [...new Set(deliveryEvents.map(e => e.consumerGroup).filter(Boolean))];
    for (const group of consumerGroups) {
      const backlog = this.calculateConsumerBacklog(group, message.topic);
      if (backlog > this.backlogThreshold) {
        analysisResult.consumerBacklog = backlog;
        problems.push({
          type: PROBLEM_TYPES.CONSUMER_BACKLOG,
          severity: 'high',
          message: `Consumer group ${group} has backlog of ${backlog} messages on topic ${message.topic}`
        });
        break;
      }
    }

    analysisResult.problems = problems;
    return store.addAnalysisResult(analysisResult);
  }

  detectAckLost(deliveryEvents) {
    const deliveries = deliveryEvents.filter(e => e.type === 'deliver');
    const acks = deliveryEvents.filter(e => e.type === 'ack');
    
    if (deliveries.length === 0) return false;
    
    const lastDelivery = deliveries[deliveries.length - 1];
    const ackForLastDelivery = acks.some(ack => 
      ack.timestamp > lastDelivery.timestamp
    );
    
    if (!ackForLastDelivery) {
      const nacks = deliveryEvents.filter(e => e.type === 'nack');
      const retries = deliveryEvents.filter(e => e.type === 'retry');
      const deadLetters = deliveryEvents.filter(e => e.type === 'dead-letter');
      
      const hasFollowUpEvent = [...nacks, ...retries, ...deadLetters].some(event =>
        event.timestamp > lastDelivery.timestamp
      );
      
      return !hasFollowUpEvent;
    }
    
    return false;
  }

  countDuplicateDeliveries(deliveryEvents) {
    const deliveries = deliveryEvents.filter(e => e.type === 'deliver');
    const uniqueAttempts = new Set(deliveries.map(d => d.attempt));
    return Math.max(0, deliveries.length - uniqueAttempts.size);
  }

  detectMaxRetryReached(deliveryEvents) {
    const retries = deliveryEvents.filter(e => e.type === 'retry');
    const maxAttempt = Math.max(...deliveryEvents.map(e => e.attempt || 0), 0);
    
    return {
      reached: maxAttempt >= this.maxRetryAttempts,
      attempts: maxAttempt
    };
  }

  detectDeadLetter(deliveryEvents) {
    const deadLetterEvent = deliveryEvents.find(e => e.type === 'dead-letter');
    if (deadLetterEvent) {
      return {
        reason: deadLetterEvent.error || 'Unknown reason'
      };
    }
    return { reason: null };
  }

  detectOrderKeyViolation(message) {
    if (!message.orderKey) return false;
    
    const messagesWithSameOrderKey = store.getMessagesByOrderKey(message.orderKey)
      .filter(m => m.topic === message.topic)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    if (messagesWithSameOrderKey.length <= 1) return false;
    
    const currentIndex = messagesWithSameOrderKey.findIndex(m => m.id === message.id);
    if (currentIndex === -1) return false;
    
    const expectedOffset = messagesWithSameOrderKey[currentIndex].offset;
    
    for (let i = 0; i < currentIndex; i++) {
      if (messagesWithSameOrderKey[i].offset > expectedOffset) {
        return true;
      }
    }
    
    for (let i = currentIndex + 1; i < messagesWithSameOrderKey.length; i++) {
      if (messagesWithSameOrderKey[i].offset < expectedOffset) {
        return true;
      }
    }
    
    return false;
  }

  calculateConsumerBacklog(consumerGroup, topic) {
    const allMessages = store.getMessagesByTopic(topic);
    const events = store.getDeliveryEventsByConsumerGroup(consumerGroup);
    
    const ackedMessageIds = new Set(
      events.filter(e => e.type === 'ack').map(e => e.messageId)
    );
    
    const deadLetterMessageIds = new Set(
      events.filter(e => e.type === 'dead-letter').map(e => e.messageId)
    );
    
    const processedMessageIds = new Set([...ackedMessageIds, ...deadLetterMessageIds]);
    
    return allMessages.filter(m => !processedMessageIds.has(m.id)).length;
  }

  detectIdempotencyRisk(message, deliveryEvents) {
    if (deliveryEvents.length <= 1) return false;
    
    const hasUniqueKey = message.key || message.orderKey;
    const hasMessageIdHeader = message.headers && message.headers['message-id'];
    const hasIdempotencyKey = message.headers && 
      (message.headers['idempotency-key'] || message.headers['request-id']);
    
    const wasDeliveredMultipleTimes = this.countDuplicateDeliveries(deliveryEvents) > 0;
    
    return wasDeliveredMultipleTimes && !hasUniqueKey && !hasMessageIdHeader && !hasIdempotencyKey;
  }

  determineFinalStatus(deliveryEvents) {
    if (deliveryEvents.length === 0) return 'undelivered';
    
    const sortedEvents = [...deliveryEvents].sort((a, b) => a.timestamp - b.timestamp);
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    
    switch (lastEvent.type) {
      case 'ack':
        return 'success';
      case 'nack':
        return 'failed';
      case 'retry':
        return 'retrying';
      case 'dead-letter':
        return 'dead-letter';
      case 'deliver':
        return this.detectAckLost(deliveryEvents) ? 'ack-lost' : 'processing';
      default:
        return 'unknown';
    }
  }

  replayMessage(messageId, consumerGroup, taskId = null) {
    const message = store.getMessage(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    const originalEvents = store.getDeliveryEventsByMessageId(messageId);
    
    const replayResult = {
      messageId,
      taskId,
      consumerGroup,
      originalStatus: this.determineFinalStatus(originalEvents),
      simulatedEvents: [],
      issues: []
    };

    const lastDelivery = originalEvents
      .filter(e => e.type === 'deliver')
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (lastDelivery) {
      const hasAck = originalEvents.some(e => 
        e.type === 'ack' && e.timestamp > lastDelivery.timestamp
      );

      if (!hasAck) {
        replayResult.issues.push({
          type: 'simulated_ack_timeout',
          message: 'Simulating re-delivery due to missing ACK'
        });
        
        replayResult.simulatedEvents.push({
          type: 'retry',
          attempt: lastDelivery.attempt + 1,
          timestamp: new Date().toISOString(),
          reason: 'ACK timeout'
        });
        
        const maxRetry = this.detectMaxRetryReached(originalEvents);
        if (maxRetry.reached) {
          replayResult.simulatedEvents.push({
            type: 'dead-letter',
            attempt: lastDelivery.attempt + 1,
            timestamp: new Date().toISOString(),
            reason: 'Max retries exceeded'
          });
        }
      } else {
        replayResult.issues.push({
          type: 'already_processed',
          message: 'Message was already successfully processed'
        });
      }
    } else {
      replayResult.issues.push({
        type: 'no_delivery_found',
        message: 'No delivery events found for this message'
      });
    }

    return replayResult;
  }

  getMessageDeliveryChain(messageId) {
    const message = store.getMessage(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    const deliveryEvents = store.getDeliveryEventsByMessageId(messageId);
    
    return {
      message: message.toJSON(),
      deliveryChain: deliveryEvents.map(e => e.toJSON()).sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      ),
      analysis: this.analyzeMessage(messageId).toJSON()
    };
  }

  batchAnalyze(messageIds, taskId = null) {
    const results = [];
    const errors = [];

    for (const messageId of messageIds) {
      try {
        const result = this.analyzeMessage(messageId, taskId);
        results.push(result.toJSON());
      } catch (error) {
        errors.push({
          messageId,
          error: error.message
        });
      }
    }

    return {
      total: messageIds.length,
      success: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  getStatistics() {
    const messages = store.getAllMessages();
    const events = store.getAllDeliveryEvents();
    const results = store.getAllAnalysisResults();

    const stats = {
      totalMessages: messages.length,
      totalDeliveryEvents: events.length,
      totalAnalysisResults: results.length,
      problemCounts: {
        [PROBLEM_TYPES.ACK_LOST]: 0,
        [PROBLEM_TYPES.DUPLICATE_DELIVERY]: 0,
        [PROBLEM_TYPES.MAX_RETRY_REACHED]: 0,
        [PROBLEM_TYPES.DEAD_LETTER]: 0,
        [PROBLEM_TYPES.ORDER_KEY_VIOLATION]: 0,
        [PROBLEM_TYPES.CONSUMER_BACKLOG]: 0,
        [PROBLEM_TYPES.IDEMPOTENCY_RISK]: 0
      },
      statusCounts: {
        success: 0,
        failed: 0,
        retrying: 0,
        'dead-letter': 0,
        'ack-lost': 0,
        processing: 0,
        undelivered: 0,
        unknown: 0
      }
    };

    for (const result of results) {
      for (const problem of result.problems) {
        if (stats.problemCounts[problem.type] !== undefined) {
          stats.problemCounts[problem.type]++;
        }
      }
      
      if (result.finalStatus && stats.statusCounts[result.finalStatus] !== undefined) {
        stats.statusCounts[result.finalStatus]++;
      }
    }

    return stats;
  }
}

module.exports = new AnalysisService();
