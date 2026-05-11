const { v4: uuidv4 } = require('uuid');
const dataStore = require('../models/dataStore');

const ERROR_CODES = {
  SUCCESS: 'SUCCESS',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_FIELDS: 'MISSING_FIELDS',
  ACTIVITY_NOT_FOUND: 'ACTIVITY_NOT_FOUND',
  ACTIVITY_INACTIVE: 'ACTIVITY_INACTIVE',
  GIFT_NOT_FOUND: 'GIFT_NOT_FOUND',
  USER_NOT_QUALIFIED: 'USER_NOT_QUALIFIED',
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
  LOCK_NOT_FOUND: 'LOCK_NOT_FOUND',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  ALREADY_RELEASED: 'ALREADY_RELEASED',
  RELEASE_FAILED: 'RELEASE_FAILED',
  NEEDS_MANUAL_CORRECTION: 'NEEDS_MANUAL_CORRECTION'
};

const LOCK_STATES = {
  LOCKED: 'LOCKED',
  RELEASED: 'RELEASED',
  CONFIRMED: 'CONFIRMED',
  MANUAL_CORRECTION_NEEDED: 'MANUAL_CORRECTION_NEEDED'
};

class GiftLockService {
  validateLockRequest(request) {
    const requiredFields = ['activityId', 'giftId', 'userId', 'orderId', 'orderAmount'];
    const missingFields = requiredFields.filter(field => !(field in request));

    if (missingFields.length > 0) {
      return {
        valid: false,
        errorCode: ERROR_CODES.MISSING_FIELDS,
        errorMessage: `缺少必要字段: ${missingFields.join(', ')}`,
        missingFields
      };
    }

    return { valid: true };
  }

  checkActivityValidity(activityId) {
    const activity = dataStore.activities.get(activityId);
    if (!activity) {
      return {
        valid: false,
        errorCode: ERROR_CODES.ACTIVITY_NOT_FOUND,
        errorMessage: '活动不存在'
      };
    }

    const now = new Date();
    const startTime = new Date(activity.startTime);
    const endTime = new Date(activity.endTime);

    if (activity.status !== 'ACTIVE' || now < startTime || now > endTime) {
      return {
        valid: false,
        errorCode: ERROR_CODES.ACTIVITY_INACTIVE,
        errorMessage: '活动未开始、已结束或已停用',
        activityStatus: activity.status,
        activityTimeRange: { start: activity.startTime, end: activity.endTime }
      };
    }

    return { valid: true, activity };
  }

  checkGiftValidity(giftId, activityId) {
    const gift = dataStore.gifts.get(giftId);
    if (!gift) {
      return {
        valid: false,
        errorCode: ERROR_CODES.GIFT_NOT_FOUND,
        errorMessage: '赠品不存在'
      };
    }

    if (gift.activityId !== activityId) {
      return {
        valid: false,
        errorCode: ERROR_CODES.GIFT_NOT_FOUND,
        errorMessage: '赠品不属于该活动'
      };
    }

    return { valid: true, gift };
  }

  checkUserQualification(userId, activityId, orderAmount, activityRules) {
    const qualification = dataStore.userQualifications.get(userId);

    if (!qualification) {
      return {
        valid: false,
        errorCode: ERROR_CODES.USER_NOT_QUALIFIED,
        errorMessage: '用户资格数据不存在',
        qualified: false,
        details: {
          userId,
          qualificationExists: false,
          requiredLevel: activityRules.requiredUserLevel,
          actualLevel: null,
          requiredAmount: activityRules.minOrderAmount,
          actualAmount: orderAmount
        }
      };
    }

    const checks = {
      userLevelOk: qualification.userLevel === activityRules.requiredUserLevel,
      orderAmountOk: orderAmount >= activityRules.minOrderAmount,
      notReceivedGift: !qualification.hasReceivedGift
    };

    const allQualified = Object.values(checks).every(v => v);

    if (!allQualified) {
      const failures = [];
      if (!checks.userLevelOk) failures.push('用户等级不符合要求');
      if (!checks.orderAmountOk) failures.push('订单金额未达到门槛');
      if (!checks.notReceivedGift) failures.push('用户已领取过赠品');

      return {
        valid: false,
        errorCode: ERROR_CODES.USER_NOT_QUALIFIED,
        errorMessage: `用户资格校验失败: ${failures.join('; ')}`,
        qualified: false,
        details: {
          userId,
          qualified: false,
          requiredLevel: activityRules.requiredUserLevel,
          actualLevel: qualification.userLevel,
          requiredAmount: activityRules.minOrderAmount,
          actualAmount: orderAmount,
          hasReceivedGift: qualification.hasReceivedGift,
          checks
        }
      };
    }

    return {
      valid: true,
      qualified: true,
      details: {
        userId,
        qualified: true,
        checks
      }
    };
  }

  checkInventory(giftId) {
    const inventory = dataStore.inventory.get(giftId);
    if (!inventory || inventory.available <= 0) {
      return {
        valid: false,
        errorCode: ERROR_CODES.INSUFFICIENT_INVENTORY,
        errorMessage: '赠品库存不足',
        inventory: inventory ? { available: inventory.available, locked: inventory.locked, total: inventory.total } : null
      };
    }

    return { valid: true, inventory };
  }

  checkDuplicateSubmission(orderId, giftId) {
    const existingRelation = Array.from(dataStore.orderGiftRelations.values()).find(
      r => r.orderId === orderId && r.giftId === giftId
    );

    if (existingRelation) {
      return {
        valid: false,
        errorCode: ERROR_CODES.DUPLICATE_SUBMISSION,
        errorMessage: '该订单已申请过此赠品',
        existingRelation: {
          orderId: existingRelation.orderId,
          giftId: existingRelation.giftId,
          lockRecordId: existingRelation.lockRecordId
        }
      };
    }

    return { valid: true };
  }

  lockGift(request) {
    const validation = this.validateLockRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'FIX_REQUEST',
        ...validation
      };
    }

    const activityCheck = this.checkActivityValidity(request.activityId);
    if (!activityCheck.valid) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_ACTIVITY',
        ...activityCheck
      };
    }

    const giftCheck = this.checkGiftValidity(request.giftId, request.activityId);
    if (!giftCheck.valid) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_GIFT',
        ...giftCheck
      };
    }

    const qualificationCheck = this.checkUserQualification(
      request.userId,
      request.activityId,
      request.orderAmount,
      activityCheck.activity.rules
    );
    if (!qualificationCheck.valid) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_QUALIFICATION',
        ...qualificationCheck
      };
    }

    const inventoryCheck = this.checkInventory(request.giftId);
    if (!inventoryCheck.valid) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_INVENTORY',
        ...inventoryCheck
      };
    }

    const duplicateCheck = this.checkDuplicateSubmission(request.orderId, request.giftId);
    if (!duplicateCheck.valid) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_DUPLICATE',
        ...duplicateCheck
      };
    }

    const lockRecordId = 'LOCK_' + uuidv4().substring(0, 8).toUpperCase();
    const now = new Date().toISOString();

    const lockRecord = {
      lockRecordId,
      activityId: request.activityId,
      giftId: request.giftId,
      userId: request.userId,
      orderId: request.orderId,
      orderAmount: request.orderAmount,
      state: LOCK_STATES.LOCKED,
      lockedAt: now,
      releasedAt: null,
      confirmedAt: null,
      qualificationSnapshot: {
        userLevel: qualificationCheck.details.qualified ? 'VIP' : null,
        orderAmount: request.orderAmount,
        rulesApplied: { ...activityCheck.activity.rules }
      },
      inventorySnapshot: {
        availableBefore: inventoryCheck.inventory.available,
        lockedBefore: inventoryCheck.inventory.locked
      }
    };

    dataStore.lockRecords.set(lockRecordId, lockRecord);
    dataStore.orderGiftRelations.set(lockRecordId, {
      lockRecordId,
      orderId: request.orderId,
      giftId: request.giftId,
      createdAt: now
    });

    const inventory = inventoryCheck.inventory;
    inventory.available -= 1;
    inventory.locked += 1;

    return {
      success: true,
      resultType: 'NORMAL',
      actionRequired: 'NONE',
      errorCode: ERROR_CODES.SUCCESS,
      lockRecordId,
      state: LOCK_STATES.LOCKED,
      message: '赠品库存锁定成功',
      details: {
        activity: {
          id: activityCheck.activity.activityId,
          name: activityCheck.activity.name
        },
        gift: {
          id: giftCheck.gift.giftId,
          sku: giftCheck.gift.sku,
          name: giftCheck.gift.name
        },
        qualification: qualificationCheck.details,
        inventory: {
          available: inventory.available,
          locked: inventory.locked,
          total: inventory.total
        }
      }
    };
  }

  releaseGift(request) {
    const { lockRecordId, reason } = request;

    if (!lockRecordId) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'FIX_REQUEST',
        errorCode: ERROR_CODES.MISSING_FIELDS,
        errorMessage: '缺少锁定记录ID'
      };
    }

    const lockRecord = dataStore.lockRecords.get(lockRecordId);
    if (!lockRecord) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_LOCK_RECORD',
        errorCode: ERROR_CODES.LOCK_NOT_FOUND,
        errorMessage: '锁定记录不存在',
        lockRecordId
      };
    }

    const releaseLog = {
      lockRecordId,
      attemptTime: new Date().toISOString(),
      currentState: lockRecord.state,
      reason: reason || '订单取消'
    };

    if (lockRecord.state === LOCK_STATES.RELEASED) {
      releaseLog.result = 'FAILED_DUPLICATE_RELEASE';
      releaseLog.errorMessage = '锁定记录已释放，不能重复释放';
      dataStore.releaseLogs.push(releaseLog);

      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'MANUAL_VERIFICATION',
        errorCode: ERROR_CODES.ALREADY_RELEASED,
        errorMessage: '锁定记录已释放，可能存在重复释放',
        currentState: lockRecord.state,
        suggestion: '请核对库存和订单状态，确认是否需要人工修正'
      };
    }

    if (lockRecord.state === LOCK_STATES.MANUAL_CORRECTION_NEEDED) {
      releaseLog.result = 'FAILED_NEEDS_CORRECTION';
      releaseLog.errorMessage = '记录处于需要人工修正状态';
      dataStore.releaseLogs.push(releaseLog);

      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'MANUAL_CORRECTION',
        errorCode: ERROR_CODES.NEEDS_MANUAL_CORRECTION,
        errorMessage: '该记录需要先进行人工修正',
        currentState: lockRecord.state
      };
    }

    if (lockRecord.state !== LOCK_STATES.LOCKED) {
      releaseLog.result = 'FAILED_INVALID_STATE';
      releaseLog.errorMessage = `非法状态流转: ${lockRecord.state} -> RELEASED`;
      dataStore.releaseLogs.push(releaseLog);

      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_STATE',
        errorCode: ERROR_CODES.INVALID_STATE_TRANSITION,
        errorMessage: `非法状态流转: 当前状态 ${lockRecord.state} 不允许释放`,
        allowedStates: [LOCK_STATES.LOCKED],
        currentState: lockRecord.state
      };
    }

    const inventory = dataStore.inventory.get(lockRecord.giftId);
    if (!inventory) {
      releaseLog.result = 'FAILED_INVENTORY_NOT_FOUND';
      releaseLog.errorMessage = '赠品库存数据不存在';
      dataStore.releaseLogs.push(releaseLog);

      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'MANUAL_CORRECTION',
        errorCode: ERROR_CODES.RELEASE_FAILED,
        errorMessage: '库存数据异常，无法自动释放',
        suggestion: '需要人工核对库存并进行修正'
      };
    }

    if (inventory.locked <= 0) {
      releaseLog.result = 'FAILED_INVENTORY_INCONSISTENT';
      releaseLog.errorMessage = '锁定库存为0，数据可能不一致';
      releaseLog.currentInventory = { available: inventory.available, locked: inventory.locked };
      dataStore.releaseLogs.push(releaseLog);

      lockRecord.state = LOCK_STATES.MANUAL_CORRECTION_NEEDED;
      dataStore.lockRecords.set(lockRecordId, lockRecord);

      dataStore.manualCorrections.push({
        lockRecordId,
        type: 'INVENTORY_INCONSISTENCY',
        detectedAt: new Date().toISOString(),
        description: '释放时发现锁定库存为0，可能存在数据不一致'
      });

      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'MANUAL_CORRECTION',
        errorCode: ERROR_CODES.NEEDS_MANUAL_CORRECTION,
        errorMessage: '库存数据不一致，需要人工处理',
        details: {
          currentState: lockRecord.state,
          expectedLocked: 1,
          actualLocked: inventory.locked
        }
      };
    }

    lockRecord.state = LOCK_STATES.RELEASED;
    lockRecord.releasedAt = new Date().toISOString();
    dataStore.lockRecords.set(lockRecordId, lockRecord);

    inventory.locked -= 1;
    inventory.available += 1;

    releaseLog.result = 'SUCCESS';
    releaseLog.finalInventory = { available: inventory.available, locked: inventory.locked };
    dataStore.releaseLogs.push(releaseLog);

    return {
      success: true,
      resultType: 'NORMAL',
      actionRequired: 'NONE',
      errorCode: ERROR_CODES.SUCCESS,
      message: '赠品库存释放成功',
      details: {
        lockRecordId,
        previousState: LOCK_STATES.LOCKED,
        newState: LOCK_STATES.RELEASED,
        inventory: {
          available: inventory.available,
          locked: inventory.locked
        }
      }
    };
  }

  manualCorrect(request) {
    const { lockRecordId, correctionType, operatorId, correctionReason } = request;

    if (!lockRecordId || !correctionType || !operatorId) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'FIX_REQUEST',
        errorCode: ERROR_CODES.MISSING_FIELDS,
        errorMessage: '缺少必要字段'
      };
    }

    const lockRecord = dataStore.lockRecords.get(lockRecordId);
    if (!lockRecord) {
      return {
        success: false,
        resultType: 'FAILURE',
        actionRequired: 'CHECK_LOCK_RECORD',
        errorCode: ERROR_CODES.LOCK_NOT_FOUND,
        errorMessage: '锁定记录不存在'
      };
    }

    const correctionRecord = {
      correctionId: 'CORR_' + uuidv4().substring(0, 8).toUpperCase(),
      lockRecordId,
      correctionType,
      operatorId,
      correctionReason: correctionReason || '人工修正',
      previousState: lockRecord.state,
      appliedAt: new Date().toISOString()
    };

    const inventory = dataStore.inventory.get(lockRecord.giftId);

    switch (correctionType) {
      case 'FORCE_RELEASE':
        lockRecord.state = LOCK_STATES.RELEASED;
        lockRecord.releasedAt = new Date().toISOString();
        lockRecord.manuallyCorrected = true;
        if (inventory && inventory.locked > 0) {
          inventory.locked -= 1;
          inventory.available += 1;
        }
        correctionRecord.newState = LOCK_STATES.RELEASED;
        correctionRecord.inventoryChange = { locked: -1, available: +1 };
        break;

      case 'RESET_TO_LOCKED':
        lockRecord.state = LOCK_STATES.LOCKED;
        lockRecord.releasedAt = null;
        lockRecord.manuallyCorrected = true;
        if (inventory && inventory.available > 0) {
          inventory.available -= 1;
          inventory.locked += 1;
        }
        correctionRecord.newState = LOCK_STATES.LOCKED;
        correctionRecord.inventoryChange = { available: -1, locked: +1 };
        break;

      case 'MARK_RESOLVED':
        lockRecord.state = LOCK_STATES.RELEASED;
        lockRecord.manuallyCorrected = true;
        correctionRecord.newState = LOCK_STATES.RELEASED;
        correctionRecord.inventoryChange = null;
        break;

      default:
        return {
          success: false,
          resultType: 'FAILURE',
          actionRequired: 'CHECK_CORRECTION_TYPE',
          errorCode: ERROR_CODES.INVALID_REQUEST,
          errorMessage: `不支持的修正类型: ${correctionType}`,
          supportedTypes: ['FORCE_RELEASE', 'RESET_TO_LOCKED', 'MARK_RESOLVED']
        };
    }

    dataStore.lockRecords.set(lockRecordId, lockRecord);
    dataStore.manualCorrectionsLog.push(correctionRecord);

    return {
      success: true,
      resultType: 'CORRECTED',
      actionRequired: 'RETRY_OPERATION',
      errorCode: ERROR_CODES.SUCCESS,
      message: '人工修正已应用',
      details: {
        correctionRecord,
        finalState: lockRecord.state,
        inventory: inventory ? {
          available: inventory.available,
          locked: inventory.locked
        } : null
      }
    };
  }

  getLockStatus(lockRecordId) {
    const lockRecord = dataStore.lockRecords.get(lockRecordId);
    if (!lockRecord) {
      return {
        found: false,
        lockRecordId
      };
    }

    const inventory = dataStore.inventory.get(lockRecord.giftId);

    return {
      found: true,
      lockRecordId,
      state: lockRecord.state,
      details: lockRecord,
      currentInventory: inventory ? {
        available: inventory.available,
        locked: inventory.locked,
        total: inventory.total
      } : null,
      needsManualCorrection: lockRecord.state === LOCK_STATES.MANUAL_CORRECTION_NEEDED
    };
  }

  verifyQualification(request) {
    const { userId, activityId, orderAmount } = request;

    if (!userId || !activityId) {
      return {
        success: false,
        errorCode: ERROR_CODES.MISSING_FIELDS,
        errorMessage: '缺少必要字段'
      };
    }

    const activity = dataStore.activities.get(activityId);
    if (!activity) {
      return {
        success: false,
        errorCode: ERROR_CODES.ACTIVITY_NOT_FOUND,
        errorMessage: '活动不存在'
      };
    }

    const qualification = dataStore.userQualifications.get(userId);

    return {
      success: true,
      verification: {
        userId,
        activityId,
        activityRules: activity.rules,
        userQualification: qualification || null,
        orderAmount: orderAmount || null,
        qualified: qualification ? (
          qualification.userLevel === activity.rules.requiredUserLevel &&
          (orderAmount == null || orderAmount >= activity.rules.minOrderAmount) &&
          !qualification.hasReceivedGift
        ) : false
      }
    };
  }

  getAllLockRecords() {
    return Array.from(dataStore.lockRecords.values());
  }

  getAllReleaseLogs() {
    return dataStore.releaseLogs;
  }

  getAllManualCorrections() {
    return dataStore.manualCorrectionsLog;
  }
}

module.exports = {
  GiftLockService,
  ERROR_CODES,
  LOCK_STATES
};
