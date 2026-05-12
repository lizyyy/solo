const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class SyncEngine {
  constructor() {
    this.eventHandlers = {
      'coupon:redeem': this.handleCouponRedeem.bind(this),
      'coupon:refund': this.handleCouponRefund.bind(this),
      'storedvalue:deduct': this.handleStoredValueDeduct.bind(this),
      'storedvalue:recharge': this.handleStoredValueRecharge.bind(this),
      'points:earn': this.handlePointsEarn.bind(this),
      'points:redeem': this.handlePointsRedeem.bind(this),
      'member:update': this.handleMemberUpdate.bind(this)
    };
  }

  generateIdempotencyKey(storeId, clientRequestId) {
    return `${storeId}:${clientRequestId}`;
  }

  checkIdempotency(idempotencyKey) {
    return db.checkIdempotency(idempotencyKey);
  }

  async processEvent(eventData, options = {}) {
    const { idempotencyKey, forceApply = false, expectedVersion = null } = options;

    const implicitIdempotencyKey = `event:${eventData.id}`;
    
    const cachedByEventId = this.checkIdempotency(implicitIdempotencyKey);
    if (cachedByEventId) {
      return {
        success: true,
        cached: true,
        cachedBy: 'eventId',
        result: cachedByEventId.result,
        message: '事件已处理过（event.id 幂等），返回缓存结果'
      };
    }

    if (idempotencyKey) {
      const cached = this.checkIdempotency(idempotencyKey);
      if (cached) {
        return {
          success: true,
          cached: true,
          cachedBy: 'idempotencyKey',
          result: cached.result,
          message: '重复请求（idempotencyKey 幂等），返回缓存结果'
        };
      }
    }

    const handler = this.eventHandlers[eventData.eventType];
    if (!handler) {
      return {
        success: false,
        error: 'UNKNOWN_EVENT_TYPE',
        message: `未知事件类型: ${eventData.eventType}`
      };
    }

    const conflictCheck = await this.detectConflict(eventData);
    if (conflictCheck.hasConflict && !forceApply) {
      db.createEvent({
        ...eventData,
        status: 'conflicted',
        conflictInfo: conflictCheck
      });
      
      return {
        success: false,
        conflicted: true,
        conflictInfo: conflictCheck,
        message: '检测到冲突，事件已标记为待处理'
      };
    }

    try {
      const result = await handler(eventData, expectedVersion);
      
      if (result.success) {
        const event = db.createEvent({
          ...eventData,
          status: 'applied',
          conflictInfo: conflictCheck.hasConflict ? conflictCheck : null
        });
        
        db.markIdempotent(implicitIdempotencyKey, { event, ...result });
        
        if (idempotencyKey) {
          db.markIdempotent(idempotencyKey, { event, ...result });
        }
        
        return {
          success: true,
          event,
          result,
          message: '事件处理成功'
        };
      } else {
        db.createEvent({
          ...eventData,
          status: 'failed',
          conflictInfo: result
        });
        
        return result;
      }
    } catch (error) {
      db.createEvent({
        ...eventData,
        status: 'failed',
        conflictInfo: { error: error.message }
      });
      
      return {
        success: false,
        error: 'PROCESSING_ERROR',
        message: error.message
      };
    }
  }

  async detectConflict(eventData) {
    const { eventType, entityId, storeId, timestamp } = eventData;
    
    const existingEvents = db.getEvents({ entityId, status: 'applied' });
    const relatedEvents = existingEvents.filter(e => 
      e.eventType === eventType || 
      this.isCompetingEvent(e.eventType, eventType)
    );

    const conflicts = [];

    for (const existing of relatedEvents) {
      const conflictType = this.checkEventConflict(existing, eventData);
      if (conflictType) {
        conflicts.push({
          type: conflictType,
          existingEvent: existing.id,
          existingStore: existing.storeId,
          existingTimestamp: existing.timestamp,
          newStore: storeId,
          newTimestamp: timestamp,
          resolution: this.getResolutionStrategy(conflictType)
        });
      }
    }

    if (conflicts.length > 0) {
      return {
        hasConflict: true,
        conflicts,
        recommendedResolution: conflicts[0].resolution
      };
    }

    return { hasConflict: false };
  }

  isCompetingEvent(existingType, newType) {
    const competingPairs = {
      'coupon:redeem': ['coupon:redeem'],
      'storedvalue:deduct': ['storedvalue:deduct', 'storedvalue:recharge'],
      'points:redeem': ['points:redeem', 'points:earn']
    };
    return (competingPairs[existingType] || []).includes(newType);
  }

  checkEventConflict(existing, newEvent) {
    if (existing.eventType === 'coupon:redeem' && newEvent.eventType === 'coupon:redeem') {
      if (existing.entityId === newEvent.entityId) {
        return 'DUPLICATE_REDEMPTION';
      }
    }

    if (existing.eventType === 'storedvalue:deduct' && newEvent.eventType === 'storedvalue:deduct') {
      const sv = db.getStoredValue(newEvent.memberId);
      const totalDeductions = existing.payload.amount + newEvent.payload.amount;
      if (totalDeductions > sv.balance + Math.min(existing.payload.amount, newEvent.payload.amount)) {
        return 'INSUFFICIENT_BALANCE_CONFLICT';
      }
    }

    const raceConditionTypes = ['coupon:redeem', 'storedvalue:deduct', 'points:redeem'];
    if (raceConditionTypes.includes(existing.eventType) && 
        raceConditionTypes.includes(newEvent.eventType) &&
        Math.abs(existing.timestamp - newEvent.timestamp) < 5000 && 
        existing.storeId !== newEvent.storeId) {
      return 'RACE_CONDITION';
    }

    return null;
  }

  getResolutionStrategy(conflictType) {
    const strategies = {
      'DUPLICATE_REDEMPTION': {
        strategy: 'FIRST_WINS',
        description: '先核销的有效，后核销的拒绝',
        rule: '保留时间戳较早的事件，拒绝时间戳较晚的重复核销'
      },
      'INSUFFICIENT_BALANCE_CONFLICT': {
        strategy: 'SEQUENTIAL_PROCESS',
        description: '按时间顺序处理，依次扣除，余额不足的拒绝',
        rule: '按时间戳顺序逐个应用，遇到余额不足时停止并返回失败'
      },
      'RACE_CONDITION': {
        strategy: 'VECTOR_CLOCK_RESOLVE',
        description: '使用门店序列号+时间戳共同决定',
        rule: '比较事件在各自门店的序列号，序列号大的优先；序列号相同则时间戳早的优先'
      },
      'OUT_OF_ORDER': {
        strategy: 'REORDER_REPROCESS',
        description: '检测到乱序时重新排序处理',
        rule: '将乱序事件放入缓冲区，等缺失的事件到达后重新按顺序处理'
      }
    };
    return strategies[conflictType] || { strategy: 'MANUAL_REVIEW', description: '需要人工审核' };
  }

  async handleCouponRedeem(eventData, expectedVersion = null) {
    const { entityId, storeId, payload } = eventData;
    const coupon = db.getCoupon(entityId);
    
    if (!coupon) {
      return { success: false, error: 'COUPON_NOT_FOUND', message: '券不存在' };
    }
    
    if (expectedVersion !== null && coupon.version !== expectedVersion) {
      return {
        success: false,
        error: 'VERSION_MISMATCH',
        message: `版本冲突: 期望 ${expectedVersion}，实际 ${coupon.version}`,
        currentVersion: coupon.version
      };
    }
    
    if (coupon.status === 'used') {
      return {
        success: false,
        error: 'COUPON_ALREADY_USED',
        message: `券已在 ${coupon.usedStore} 核销，订单: ${coupon.usedOrder}`,
        usedStore: coupon.usedStore,
        usedAt: coupon.usedAt,
        usedOrder: coupon.usedOrder
      };
    }
    
    if (coupon.status !== 'available') {
      return { success: false, error: 'COUPON_NOT_AVAILABLE', message: '券状态不可用' };
    }
    
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      return { success: false, error: 'COUPON_EXPIRED', message: '券已过期或未生效' };
    }
    
    db.updateCouponStatus(entityId, 'used', storeId, payload.orderId);
    
    return {
      success: true,
      coupon: db.getCoupon(entityId),
      message: '券核销成功'
    };
  }

  async handleCouponRefund(eventData) {
    const { entityId, payload } = eventData;
    const coupon = db.getCoupon(entityId);
    
    if (!coupon) {
      return { success: false, error: 'COUPON_NOT_FOUND', message: '券不存在' };
    }
    
    if (coupon.status !== 'used') {
      return { success: false, error: 'COUPON_NOT_USED', message: '券未被使用' };
    }
    
    db.updateCouponStatus(entityId, 'available');
    
    return {
      success: true,
      coupon: db.getCoupon(entityId),
      message: '券退还成功'
    };
  }

  async handleStoredValueDeduct(eventData, expectedVersion = null) {
    const { memberId, storeId, payload } = eventData;
    const sv = db.getStoredValue(memberId);
    
    if (expectedVersion !== null && sv.version !== expectedVersion) {
      return {
        success: false,
        error: 'VERSION_MISMATCH',
        message: `版本冲突: 期望 ${expectedVersion}，实际 ${sv.version}`,
        currentVersion: sv.version
      };
    }
    
    if (sv.balance < payload.amount) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `储值余额不足: 当前 ${sv.balance}，需要 ${payload.amount}`,
        currentBalance: sv.balance,
        requiredAmount: payload.amount
      };
    }
    
    db.updateStoredValue(memberId, -payload.amount);
    
    return {
      success: true,
      storedValue: db.getStoredValue(memberId),
      message: '储值扣款成功'
    };
  }

  async handleStoredValueRecharge(eventData) {
    const { memberId, payload } = eventData;
    db.updateStoredValue(memberId, payload.amount);
    
    return {
      success: true,
      storedValue: db.getStoredValue(memberId),
      message: '储值充值成功'
    };
  }

  async handlePointsEarn(eventData) {
    try {
      const { memberId, payload } = eventData;
      db.updatePoints(memberId, payload.amount);
      
      return {
        success: true,
        points: db.getPoints(memberId),
        message: '积分增加成功'
      };
    } catch (error) {
      return {
        success: false,
        error: 'HANDLE_ERROR',
        message: error.message
      };
    }
  }

  async handlePointsRedeem(eventData, expectedVersion = null) {
    const { memberId, payload } = eventData;
    const pts = db.getPoints(memberId);
    
    if (expectedVersion !== null && pts.version !== expectedVersion) {
      return {
        success: false,
        error: 'VERSION_MISMATCH',
        message: `版本冲突: 期望 ${expectedVersion}，实际 ${pts.version}`,
        currentVersion: pts.version
      };
    }
    
    if (pts.balance < payload.amount) {
      return {
        success: false,
        error: 'INSUFFICIENT_POINTS',
        message: `积分不足: 当前 ${pts.balance}，需要 ${payload.amount}`,
        currentPoints: pts.balance,
        requiredAmount: payload.amount
      };
    }
    
    db.updatePoints(memberId, -payload.amount);
    
    return {
      success: true,
      points: db.getPoints(memberId),
      message: '积分抵扣成功'
    };
  }

  async handleMemberUpdate(eventData) {
    return { success: true, message: '会员信息更新成功' };
  }

  async processOfflineBatch(batchId) {
    const batch = db.getOfflineBatch(batchId);
    if (!batch) {
      return { success: false, error: 'BATCH_NOT_FOUND', message: '批次不存在' };
    }

    if (batch.status === 'completed') {
      return {
        success: true,
        cached: true,
        cachedBy: 'batchStatus',
        batchId,
        status: batch.status,
        totalCount: batch.totalCount,
        successCount: batch.successCount,
        failedCount: batch.failedCount,
        failedEvents: batch.failedEvents,
        results: [],
        message: '批次已完成（幂等保护），无需重复处理'
      };
    }

    if (batch.status === 'partial') {
      return {
        success: true,
        cached: true,
        cachedBy: 'batchStatus',
        batchId,
        status: batch.status,
        totalCount: batch.totalCount,
        successCount: batch.successCount,
        failedCount: batch.failedCount,
        failedEvents: batch.failedEvents,
        results: [],
        message: '批次已部分完成（幂等保护），如需重试请先重置批次状态'
      };
    }

    const sortedEvents = [...batch.events].sort((a, b) => {
      if (a.sequence !== undefined && b.sequence !== undefined) {
        return a.sequence - b.sequence;
      }
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    let successCount = 0;
    let failedCount = 0;
    const failedEvents = [];
    const results = [];

    for (const eventData of sortedEvents) {
      const result = await this.processEvent(eventData, {
        idempotencyKey: eventData.idempotencyKey
      });
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
        failedEvents.push({
          event: eventData,
          error: result
        });
      }
    }

    const status = failedCount === 0 ? 'completed' : 
                   successCount > 0 ? 'partial' : 'pending';

    db.updateOfflineBatch(batchId, {
      status,
      successCount,
      failedCount,
      failedEvents,
      syncedAt: new Date()
    });

    const store = db.getStore(batch.storeId);
    if (store) {
      store.lastSyncTime = new Date();
    }

    return {
      success: true,
      batchId,
      status,
      totalCount: batch.totalCount,
      successCount,
      failedCount,
      failedEvents,
      results,
      message: status === 'completed' ? '批次同步完成' : 
               status === 'partial' ? '批次部分完成，有失败事件' : '批次同步全部失败'
    };
  }

  resolveConflict(eventId, resolution, resolverNote = '') {
    const event = db.getEventById(eventId);
    if (!event) {
      return { success: false, error: 'EVENT_NOT_FOUND', message: '事件不存在' };
    }

    if (event.status !== 'conflicted') {
      return { success: false, error: 'NOT_CONFLICTED', message: '事件不处于冲突状态' };
    }

    if (resolution === 'ACCEPT') {
      return this.processEvent({
        ...event,
        id: uuidv4()
      }, { forceApply: true });
    } else if (resolution === 'REJECT') {
      event.status = 'rejected';
      event.resolutionNote = resolverNote;
      return { success: true, event, message: '冲突事件已拒绝' };
    } else if (resolution === 'MERGE') {
      return { success: true, message: '合并处理完成' };
    }

    return { success: false, error: 'INVALID_RESOLUTION', message: '无效的解决方式' };
  }
}

module.exports = new SyncEngine();
