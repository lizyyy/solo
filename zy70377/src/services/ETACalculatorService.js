const Order = require('../models/Order');
const TrackPoint = require('../models/TrackPoint');
const DelayEvent = require('../models/DelayEvent');
const ReassignmentEvent = require('../models/ReassignmentEvent');
const EtaHistory = require('../models/EtaHistory');
const { getCurrentTime, formatTime } = require('../utils/idGenerator');

class ETACalculatorService {
  static calculateBaseRemainingTime(order, currentRiderId) {
    const latestTrack = TrackPoint.findLatestByOrderIdAndRiderId(order.id, currentRiderId);
    
    if (!latestTrack) {
      return order.baseEtaMinutes;
    }
    
    const distance = this.calculateHaversineDistance(
      latestTrack.latitude, latestTrack.longitude,
      order.destinationLat, order.destinationLon
    );
    
    const avgSpeedKmPerMin = 0.5;
    const estimatedMinutes = Math.ceil(distance / avgSpeedKmPerMin);
    
    return Math.max(5, Math.min(estimatedMinutes, order.baseEtaMinutes));
  }

  static calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRad(deg) {
    return deg * (Math.PI / 180);
  }

  static calculateDelayAdjustments(order) {
    const activeDelays = DelayEvent.findActiveByOrderId(order.id);
    let totalDelayMinutes = 0;
    const delayBreakdown = [];

    for (const delay of activeDelays) {
      totalDelayMinutes += delay.delayMinutes;
      delayBreakdown.push({
        type: delay.type,
        reason: delay.reason,
        delayMinutes: delay.delayMinutes,
        affectedAreas: delay.affectedAreas
      });
    }

    return { totalDelayMinutes, delayBreakdown };
  }

  static calculateRiderOfflineAdjustment(order, currentRiderId) {
    const latestTrack = TrackPoint.findLatestByOrderIdAndRiderId(order.id, currentRiderId);
    
    if (!latestTrack) {
      return { adjustment: 0, isOffline: false };
    }

    const now = getCurrentTime();
    const timeSinceLastTrack = (now - latestTrack.timestamp) / 60000;
    
    if (timeSinceLastTrack > 15 || !latestTrack.isOnline) {
      return { 
        adjustment: 15, 
        isOffline: true,
        offlineMinutes: Math.floor(timeSinceLastTrack)
      };
    }

    return { adjustment: 0, isOffline: false };
  }

  static calculatePriorityAdjustment(order) {
    if (order.priority === 'high') {
      return { adjustment: -5, reason: 'high_priority_skip_queue' };
    }
    if (order.priority === 'urgent') {
      return { adjustment: -10, reason: 'urgent_priority_immediate' };
    }
    return { adjustment: 0, reason: null };
  }

  static calculateETA(orderId) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const signature = require('../models/SignatureEvent').getSignatureByOrderId(orderId);
    if (signature) {
      return {
        finalEta: order.currentEta || order.initialEta,
        isSigned: true,
        signedAt: signature.timestamp
      };
    }

    const currentRiderId = ReassignmentEvent.getActiveRider(orderId, order.riderId);
    const baseRemaining = this.calculateBaseRemainingTime(order, currentRiderId);
    const delayAdjustments = this.calculateDelayAdjustments(order);
    const offlineAdjustment = this.calculateRiderOfflineAdjustment(order, currentRiderId);
    const priorityAdjustment = this.calculatePriorityAdjustment(order);

    let totalETA = baseRemaining + delayAdjustments.totalDelayMinutes + offlineAdjustment.adjustment;
    totalETA = Math.max(5, totalETA);

    if (priorityAdjustment.adjustment < 0) {
      totalETA = Math.max(5, totalETA + priorityAdjustment.adjustment);
    }

    const now = getCurrentTime();
    const etaTimestamp = now + (totalETA * 60 * 1000);

    return {
      currentEta: totalETA,
      etaTimestamp: etaTimestamp,
      baseRemainingMinutes: baseRemaining,
      delayBreakdown: delayAdjustments.delayBreakdown,
      totalDelayMinutes: delayAdjustments.totalDelayMinutes,
      isRiderOffline: offlineAdjustment.isOffline,
      offlineAdjustmentMinutes: offlineAdjustment.adjustment,
      priorityAdjustment: priorityAdjustment.adjustment,
      priorityReason: priorityAdjustment.reason,
      currentRiderId: currentRiderId
    };
  }

  static updateAndRecordETA(orderId, triggerReason, triggerDetails = {}) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const signature = require('../models/SignatureEvent').getSignatureByOrderId(orderId);
    if (signature) {
      return {
        message: '订单已签收，无法更新ETA',
        isSigned: true
      };
    }

    const previousEta = order.currentEta;
    const etaResult = this.calculateETA(orderId);
    
    if (etaResult.isSigned) {
      return etaResult;
    }

    const newEta = etaResult.currentEta;
    const deltaMinutes = previousEta !== null ? newEta - previousEta : 0;
    
    const now = getCurrentTime();
    const hasSignificantChange = previousEta === null || 
                                 Math.abs(deltaMinutes) >= 2 || 
                                 etaResult.isRiderOffline;

    if (hasSignificantChange) {
      let reasonCategory = 'normal';
      let responsibleParty = 'system';

      if (etaResult.isRiderOffline) {
        reasonCategory = 'rider_offline';
        responsibleParty = 'rider';
      } else if (etaResult.totalDelayMinutes > 0) {
        const weatherDelay = etaResult.delayBreakdown.find(d => d.type === 'weather');
        const trafficDelay = etaResult.delayBreakdown.find(d => d.type === 'traffic');
        
        if (weatherDelay) {
          reasonCategory = 'weather_delay';
          responsibleParty = 'external';
        } else if (trafficDelay) {
          reasonCategory = 'traffic_delay';
          responsibleParty = 'external';
        } else {
          reasonCategory = 'other_delay';
          responsibleParty = 'system';
        }
      } else if (etaResult.priorityAdjustment < 0) {
        reasonCategory = 'priority_adjustment';
        responsibleParty = 'system';
      } else if (triggerReason === 'reassignment') {
        reasonCategory = 'rider_reassignment';
        responsibleParty = 'system';
      }

      const historyRecord = EtaHistory.create({
        orderId: orderId,
        previousEta: previousEta,
        newEta: newEta,
        deltaMinutes: deltaMinutes,
        reason: triggerReason,
        reasonCategory: reasonCategory,
        responsibleParty: responsibleParty,
        timestamp: now,
        details: {
          ...triggerDetails,
          etaBreakdown: etaResult
        }
      });

      if (order.initialEta === null) {
        order.initialEta = newEta;
      }

      order.currentEta = newEta;
      order.currentEtaTimestamp = etaResult.etaTimestamp;
      Order.update(orderId, order);

      return {
        previousEta: previousEta,
        newEta: newEta,
        deltaMinutes: deltaMinutes,
        etaTimestamp: etaResult.etaTimestamp,
        historyRecord: historyRecord
      };
    }

    return {
      previousEta: previousEta,
      newEta: newEta,
      deltaMinutes: 0,
      etaTimestamp: etaResult.etaTimestamp,
      noSignificantChange: true
    };
  }

  static getEtaWithExplanation(orderId) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const signature = require('../models/SignatureEvent').getSignatureByOrderId(orderId);
    const etaResult = this.calculateETA(orderId);
    const etaHistory = EtaHistory.findByOrderId(orderId);
    const reassignments = ReassignmentEvent.findByOrderId(orderId);
    const activeDelays = DelayEvent.findActiveByOrderId(orderId);
    const currentRiderId = ReassignmentEvent.getActiveRider(orderId, order.riderId);
    const keyTrackPoints = this.getKeyTrackPoints(orderId, currentRiderId);

    const explanation = this.generateCustomerServiceExplanation(
      order,
      etaResult,
      signature,
      etaHistory,
      reassignments,
      activeDelays
    );

    const delayAttribution = this.analyzeDelayAttribution(
      etaHistory,
      activeDelays,
      reassignments
    );

    return {
      orderId: orderId,
      status: signature ? 'completed' : order.status,
      isSigned: !!signature,
      currentEta: etaResult.currentEta || order.currentEta || order.initialEta,
      currentEtaTimestamp: etaResult.etaTimestamp || order.currentEtaTimestamp,
      initialEta: order.initialEta,
      etaBreakdown: {
        baseRemainingMinutes: etaResult.baseRemainingMinutes,
        totalDelayMinutes: etaResult.totalDelayMinutes,
        delayBreakdown: etaResult.delayBreakdown,
        isRiderOffline: etaResult.isRiderOffline,
        offlineAdjustmentMinutes: etaResult.offlineAdjustmentMinutes,
        priorityAdjustment: etaResult.priorityAdjustment
      },
      currentRiderId: etaResult.currentRiderId,
      etaChangeHistory: etaHistory.map(h => ({
        timestamp: formatTime(h.timestamp),
        previousEta: h.previousEta,
        newEta: h.newEta,
        deltaMinutes: h.deltaMinutes,
        reason: h.reason,
        reasonCategory: h.reasonCategory,
        responsibleParty: h.responsibleParty
      })),
      keyTrackPoints: keyTrackPoints,
      delayAttribution: delayAttribution,
      customerServiceExplanation: explanation
    };
  }

  static getKeyTrackPoints(orderId, currentRiderId) {
    const allPoints = TrackPoint.findByOrderId(orderId);
    const currentRiderPoints = TrackPoint.findByOrderIdAndRiderId(orderId, currentRiderId);
    
    const points = [];
    
    if (allPoints.length > 0) {
      points.push({
        type: 'first_reported',
        trackPoint: allPoints[0],
        isOldRider: allPoints[0].riderId !== currentRiderId
      });
    }
    
    if (currentRiderPoints.length > 0) {
      const latest = currentRiderPoints[currentRiderPoints.length - 1];
      points.push({
        type: 'latest',
        trackPoint: latest,
        isOldRider: false
      });
      
      if (currentRiderPoints.length >= 3) {
        const midIndex = Math.floor(currentRiderPoints.length / 2);
        points.splice(1, 0, {
          type: 'mid_progress',
          trackPoint: currentRiderPoints[midIndex],
          isOldRider: false
        });
      }
    }

    return points.map(p => ({
      type: p.type,
      latitude: p.trackPoint.latitude,
      longitude: p.trackPoint.longitude,
      timestamp: formatTime(p.trackPoint.timestamp),
      riderId: p.trackPoint.riderId,
      isOnline: p.trackPoint.isOnline,
      isOldRider: p.isOldRider
    }));
  }

  static analyzeDelayAttribution(etaHistory, activeDelays, reassignments) {
    const attribution = {
      totalDelayMinutes: 0,
      byCategory: {
        weather: 0,
        traffic: 0,
        rider_offline: 0,
        reassignment: 0,
        other: 0
      },
      byParty: {
        rider: 0,
        external: 0,
        system: 0
      },
      details: []
    };

    for (const delay of activeDelays) {
      attribution.totalDelayMinutes += delay.delayMinutes;
      
      if (delay.type === 'weather') {
        attribution.byCategory.weather += delay.delayMinutes;
        attribution.byParty.external += delay.delayMinutes;
      } else if (delay.type === 'traffic') {
        attribution.byCategory.traffic += delay.delayMinutes;
        attribution.byParty.external += delay.delayMinutes;
      } else {
        attribution.byCategory.other += delay.delayMinutes;
        attribution.byParty.system += delay.delayMinutes;
      }
      
      attribution.details.push({
        type: delay.type,
        reason: delay.reason,
        minutes: delay.delayMinutes,
        source: 'delay_event'
      });
    }

    for (const event of etaHistory) {
      if (event.deltaMinutes > 0) {
        if (event.reasonCategory === 'rider_offline') {
          attribution.byCategory.rider_offline += event.deltaMinutes;
          attribution.byParty.rider += event.deltaMinutes;
        } else if (event.reasonCategory === 'rider_reassignment') {
          attribution.byCategory.reassignment += event.deltaMinutes;
          attribution.byParty.system += event.deltaMinutes;
        }
      }
    }

    return attribution;
  }

  static generateCustomerServiceExplanation(order, etaResult, signature, etaHistory, reassignments, activeDelays) {
    const parts = [];
    
    if (signature) {
      parts.push(`订单已于 ${formatTime(signature.timestamp)} 签收完成。`);
      if (order.currentEta && order.initialEta) {
        const actualMinutes = Math.ceil((signature.timestamp - order.createdAt) / 60000);
        const difference = actualMinutes - order.initialEta;
        if (difference > 0) {
          parts.push(`实际配送时间 ${actualMinutes} 分钟，比最初预估 ${order.initialEta} 分钟晚了 ${difference} 分钟。`);
        } else if (difference < 0) {
          parts.push(`实际配送时间 ${actualMinutes} 分钟，比最初预估 ${order.initialEta} 分钟提前了 ${Math.abs(difference)} 分钟。`);
        }
      }
      return parts.join(' ');
    }

    if (order.currentEta !== null) {
      parts.push(`当前预计送达时间为 ${order.currentEta} 分钟后（${formatTime(order.currentEtaTimestamp)}）。`);
    }

    if (order.initialEta !== null && order.currentEta !== order.initialEta) {
      const change = (order.currentEta || 0) - (order.initialEta || 0);
      if (change > 0) {
        parts.push(`相比最初预估的 ${order.initialEta} 分钟，预计送达时间推迟了 ${change} 分钟。`);
      } else if (change < 0) {
        parts.push(`相比最初预估的 ${order.initialEta} 分钟，预计送达时间提前了 ${Math.abs(change)} 分钟。`);
      }
    }

    if (etaResult.isRiderOffline) {
      parts.push(`骑手位置信息已超过15分钟未更新，系统已自动增加15分钟缓冲时间。`);
    }

    if (activeDelays.length > 0) {
      const delayReasons = activeDelays.map(d => {
        const areaInfo = d.affectedAreas && d.affectedAreas.length > 0 
          ? `（影响区域：${d.affectedAreas.join('、')}）` 
          : '';
        return `${d.reason}${areaInfo}（延误约 ${d.delayMinutes} 分钟）`;
      });
      parts.push(`当前存在延误因素：${delayReasons.join('；')}。`);
    }

    if (reassignments.length > 0) {
      const latestReassign = reassignments[reassignments.length - 1];
      parts.push(`订单曾发生改派，最新改派原因：${latestReassign.reason}。`);
      parts.push(`原骑手轨迹数据已不再计入ETA计算。`);
    }

    if (order.priority !== 'normal') {
      const priorityText = order.priority === 'high' ? '高优先级' : '加急';
      const adjustment = order.priority === 'high' ? 5 : 10;
      parts.push(`订单为${priorityText}订单，已优先处理，ETA缩短了 ${adjustment} 分钟。`);
    }

    if (etaHistory.length > 1) {
      const recentChanges = etaHistory.slice(-3).reverse();
      const changeTexts = recentChanges.map(h => {
        const direction = h.deltaMinutes > 0 ? '增加' : '减少';
        return `${formatTime(h.timestamp)} 因${h.reason}${direction}${Math.abs(h.deltaMinutes)}分钟`;
      });
      parts.push(`最近ETA变化记录：${changeTexts.join('；')}。`);
    }

    return parts.join(' ');
  }
}

module.exports = ETACalculatorService;
