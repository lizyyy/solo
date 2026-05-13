const Order = require('../models/Order');
const TrackPoint = require('../models/TrackPoint');
const DelayEvent = require('../models/DelayEvent');
const ReassignmentEvent = require('../models/ReassignmentEvent');
const SignatureEvent = require('../models/SignatureEvent');
const ETACalculatorService = require('./ETACalculatorService');
const { getCurrentTime } = require('../utils/idGenerator');

class OrderService {
  static createOrder(orderData) {
    const requiredFields = ['customerName', 'destinationAddress', 'destinationLat', 'destinationLon'];
    
    for (const field of requiredFields) {
      if (orderData[field] === undefined || orderData[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const order = Order.create({
      ...orderData,
      status: 'created',
      isClosed: false
    });

    ETACalculatorService.updateAndRecordETA(order.id, 'order_created', {
      initialEtaSet: true
    });

    return order;
  }

  static submitTrackPoint(orderId, trackData) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const signature = SignatureEvent.getSignatureByOrderId(orderId);
    if (signature) {
      TrackPoint.create({
        ...trackData,
        orderId: orderId,
        isLateData: true
      });
      
      return {
        message: '订单已签收，轨迹数据已记录为迟到数据',
        isLateData: true,
        orderStatus: 'completed'
      };
    }

    const currentRiderId = ReassignmentEvent.getActiveRider(orderId, order.riderId);
    
    if (trackData.riderId !== currentRiderId) {
      const reassignments = ReassignmentEvent.findByOrderId(orderId);
      if (reassignments.length > 0) {
        TrackPoint.create({
          ...trackData,
          orderId: orderId,
          isOldRiderData: true
        });
        
        return {
          message: '该骑手已不再负责此订单，轨迹数据已记录但不计入ETA计算',
          isOldRiderData: true,
          currentRiderId: currentRiderId
        };
      }
    }

    if (TrackPoint.isDuplicate({
      orderId: orderId,
      riderId: trackData.riderId,
      latitude: trackData.latitude,
      longitude: trackData.longitude,
      timestamp: trackData.timestamp
    })) {
      return {
        message: '重复的位置上报已被忽略（幂等处理）',
        isDuplicate: true
      };
    }

    const trackPoint = TrackPoint.create({
      ...trackData,
      orderId: orderId
    });

    if (order.riderId === null && trackData.riderId) {
      order.riderId = trackData.riderId;
      order.status = 'in_transit';
      Order.update(orderId, order);
    }

    const etaUpdate = ETACalculatorService.updateAndRecordETA(orderId, 'rider_position_updated', {
      trackPointId: trackPoint.id,
      latitude: trackPoint.latitude,
      longitude: trackPoint.longitude
    });

    return {
      trackPoint: trackPoint,
      etaUpdate: etaUpdate
    };
  }

  static reportDelay(orderId, delayData) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const signature = SignatureEvent.getSignatureByOrderId(orderId);
    if (signature) {
      return {
        message: '订单已签收，无法添加延误事件',
        isSigned: true
      };
    }

    if (!delayData.type || !delayData.reason) {
      throw new Error('Missing required fields: type or reason');
    }

    const delayEvent = DelayEvent.create({
      ...delayData,
      orderId: orderId
    });

    const etaUpdate = ETACalculatorService.updateAndRecordETA(orderId, `delay_${delayData.type}`, {
      delayEventId: delayEvent.id,
      delayReason: delayData.reason,
      delayMinutes: delayData.delayMinutes,
      affectedAreas: delayData.affectedAreas || []
    });

    return {
      delayEvent: delayEvent,
      etaUpdate: etaUpdate
    };
  }

  static reassignRider(orderId, reassignmentData) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const signature = SignatureEvent.getSignatureByOrderId(orderId);
    if (signature) {
      return {
        message: '订单已签收，无法进行改派',
        isSigned: true
      };
    }

    if (!reassignmentData.newRiderId) {
      throw new Error('Missing required field: newRiderId');
    }

    const oldRiderId = ReassignmentEvent.getActiveRider(orderId, order.riderId);
    
    if (oldRiderId === reassignmentData.newRiderId) {
      return {
        message: '新骑手与当前骑手相同，无需改派',
        noChange: true
      };
    }

    const reassignmentEvent = ReassignmentEvent.create({
      orderId: orderId,
      oldRiderId: oldRiderId,
      newRiderId: reassignmentData.newRiderId,
      reason: reassignmentData.reason || 'rider_offline'
    });

    order.riderId = reassignmentData.newRiderId;
    Order.update(orderId, order);

    const etaUpdate = ETACalculatorService.updateAndRecordETA(orderId, 'rider_reassignment', {
      reassignmentEventId: reassignmentEvent.id,
      oldRiderId: oldRiderId,
      newRiderId: reassignmentData.newRiderId,
      reason: reassignmentEvent.reason
    });

    return {
      reassignmentEvent: reassignmentEvent,
      etaUpdate: etaUpdate
    };
  }

  static signOrder(orderId, signatureData) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const existingSignature = SignatureEvent.getSignatureByOrderId(orderId);
    if (existingSignature) {
      return {
        message: '订单已签收，重复签收请求已被忽略',
        isDuplicate: true,
        existingSignature: existingSignature
      };
    }

    const currentRiderId = ReassignmentEvent.getActiveRider(orderId, order.riderId);
    
    if (signatureData.riderId && signatureData.riderId !== currentRiderId) {
      return {
        message: '签收骑手与当前负责骑手不符',
        riderMismatch: true,
        expectedRiderId: currentRiderId,
        providedRiderId: signatureData.riderId
      };
    }

    const finalETA = ETACalculatorService.calculateETA(orderId);
    
    const signatureEvent = SignatureEvent.create({
      ...signatureData,
      orderId: orderId,
      riderId: signatureData.riderId || currentRiderId
    });

    order.status = 'completed';
    order.signedAt = signatureEvent.timestamp;
    order.isClosed = true;
    Order.update(orderId, order);

    ETACalculatorService.updateAndRecordETA(orderId, 'order_completed', {
      signatureEventId: signatureEvent.id,
      finalEtaSnapshot: finalETA,
      actualDeliveryMinutes: Math.ceil((signatureEvent.timestamp - order.createdAt) / 60000)
    });

    return {
      signatureEvent: signatureEvent,
      order: order,
      finalEtaSnapshot: finalETA
    };
  }

  static updateOrderPriority(orderId, priorityData) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const signature = SignatureEvent.getSignatureByOrderId(orderId);
    if (signature) {
      return {
        message: '订单已签收，无法更新优先级',
        isSigned: true
      };
    }

    const validPriorities = ['normal', 'high', 'urgent'];
    if (!validPriorities.includes(priorityData.priority)) {
      throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
    }

    const oldPriority = order.priority;
    if (oldPriority === priorityData.priority) {
      return {
        message: '优先级未发生变化',
        noChange: true
      };
    }

    order.priority = priorityData.priority;
    Order.update(orderId, order);

    const etaUpdate = ETACalculatorService.updateAndRecordETA(orderId, 'priority_updated', {
      oldPriority: oldPriority,
      newPriority: priorityData.priority
    });

    return {
      order: order,
      etaUpdate: etaUpdate
    };
  }

  static resolveDelay(delayId) {
    const delayEvent = DelayEvent.resolve(delayId);
    if (!delayEvent) {
      throw new Error('Delay event not found');
    }

    const etaUpdate = ETACalculatorService.updateAndRecordETA(delayEvent.orderId, 'delay_resolved', {
      delayEventId: delayId,
      resolvedAt: delayEvent.resolvedAt
    });

    return {
      delayEvent: delayEvent,
      etaUpdate: etaUpdate
    };
  }
}

module.exports = OrderService;
