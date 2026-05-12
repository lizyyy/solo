const store = require('../data/store');
const rules = require('./businessRules');
const idempotency = require('./idempotency');

class PickupService {

  createChild(data, operator = 'system') {
    const childId = store.generateId();
    const child = {
      id: childId,
      name: data.name,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      class: data.class,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    store.children.set(childId, child);
    store.addHistory('child', childId, 'created', { before: null, after: child }, operator);
    
    return child;
  }

  createFixedAuthorization(data, operator = 'system') {
    const authId = store.generateId();
    const auth = {
      id: authId,
      childId: data.childId,
      authorizerId: data.authorizerId,
      authorizerName: data.authorizerName,
      authorizerPhone: data.authorizerPhone,
      authorizerIdNumber: data.authorizerIdNumber,
      relation: data.relation,
      validFrom: data.validFrom || new Date().toISOString(),
      validUntil: data.validUntil,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    store.authorizers.set(authId, auth);
    store.addHistory('authorization', authId, 'created', { before: null, after: auth }, operator);
    
    return auth;
  }

  createTemporaryAuthorization(data, operator = 'system') {
    const tempAuthId = store.generateId();
    const tempAuth = {
      id: tempAuthId,
      childId: data.childId,
      authorizerId: data.authorizerId,
      authorizerName: data.authorizerName,
      authorizerPhone: data.authorizerPhone,
      authorizerIdNumber: data.authorizerIdNumber,
      relation: data.relation,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      pickupTime: data.pickupTime,
      status: 'pending_confirmation',
      confirmedBy: null,
      confirmedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectReason: null,
      createdBy: operator,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    store.tempAuthorizations.set(tempAuthId, tempAuth);
    store.addHistory('temp_authorization', tempAuthId, 'created', { before: null, after: tempAuth }, operator);
    
    return tempAuth;
  }

  confirmTemporaryAuthorization(tempAuthId, operator = 'system') {
    const tempAuth = store.tempAuthorizations.get(tempAuthId);
    if (!tempAuth) {
      throw new Error('临时授权不存在');
    }
    
    const beforeState = { ...tempAuth };
    tempAuth.status = 'confirmed';
    tempAuth.confirmedBy = operator;
    tempAuth.confirmedAt = new Date().toISOString();
    tempAuth.updatedAt = new Date().toISOString();
    
    store.addHistory('temp_authorization', tempAuthId, 'confirmed', { before: beforeState, after: { ...tempAuth } }, operator);
    
    return tempAuth;
  }

  rejectTemporaryAuthorization(tempAuthId, reason, operator = 'system') {
    const tempAuth = store.tempAuthorizations.get(tempAuthId);
    if (!tempAuth) {
      throw new Error('临时授权不存在');
    }
    
    const beforeState = { ...tempAuth };
    tempAuth.status = 'rejected';
    tempAuth.rejectedBy = operator;
    tempAuth.rejectedAt = new Date().toISOString();
    tempAuth.rejectReason = reason;
    tempAuth.updatedAt = new Date().toISOString();
    
    store.addHistory('temp_authorization', tempAuthId, 'rejected', { before: beforeState, after: { ...tempAuth }, reason }, operator);
    
    return tempAuth;
  }

  addToBlacklist(data, operator = 'system') {
    const blacklistId = store.generateId();
    const item = {
      id: blacklistId,
      authorizerId: data.authorizerId,
      authorizerName: data.authorizerName,
      authorizerPhone: data.authorizerPhone,
      reason: data.reason,
      addedBy: operator,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      removedAt: null,
      removedBy: null,
      removeReason: null
    };
    
    store.blacklist.set(blacklistId, item);
    store.addHistory('blacklist', blacklistId, 'added', { before: null, after: item }, operator);
    
    return item;
  }

  removeFromBlacklist(blacklistId, reason, operator = 'system') {
    const item = store.blacklist.get(blacklistId);
    if (!item) {
      throw new Error('黑名单记录不存在');
    }
    
    const beforeState = { ...item };
    item.status = 'inactive';
    item.removedAt = new Date().toISOString();
    item.removedBy = operator;
    item.removeReason = reason;
    item.updatedAt = new Date().toISOString();
    
    store.addHistory('blacklist', blacklistId, 'removed', { before: beforeState, after: { ...item }, reason }, operator);
    
    return item;
  }

  checkIn(data, idempotencyKey, operator = 'system') {
    if (idempotencyKey) {
      const check = idempotency.checkAndRecord(idempotencyKey, data, 'checkin');
      if (check.isDuplicate) {
        return { ...check.originalResult.result, isDuplicate: true };
      }
    }

    const child = store.children.get(data.childId);
    if (!child) {
      const exception = store.addException('checkin', data.childId || 'unknown', 'CHILD_NOT_FOUND', '儿童档案不存在', data);
      throw { exception, message: '儿童档案不存在' };
    }

    const currentStatus = rules.getChildCurrentStatus(data.childId, data.checkInTime?.split('T')[0]);
    if (currentStatus.status === 'in_school') {
      const exception = store.addException('checkin', data.childId, 'DUPLICATE_CHECKIN', '儿童已在园，重复签到', { currentStatus });
      throw { exception, message: '儿童已在园，重复签到' };
    }

    const checkInId = store.generateId();
    const checkIn = {
      id: checkInId,
      childId: data.childId,
      childName: child.name,
      checkInTime: data.checkInTime || new Date().toISOString(),
      checkedInBy: operator,
      notes: data.notes,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    store.checkIns.set(checkInId, checkIn);
    store.addHistory('checkin', checkInId, 'completed', { before: null, after: checkIn }, operator);

    const result = {
      success: true,
      checkIn,
      childStatus: rules.getChildCurrentStatus(data.childId, data.checkInTime?.split('T')[0])
    };

    if (idempotencyKey) {
      const check = idempotency.checkAndRecord(idempotencyKey, data, 'checkin');
      check.record(result);
    }

    return { ...result, isDuplicate: false };
  }

  pickup(data, idempotencyKey, operator = 'system') {
    if (idempotencyKey) {
      const check = idempotency.checkAndRecord(idempotencyKey, data, 'pickup');
      if (check.isDuplicate) {
        return { ...check.originalResult.result, isDuplicate: true };
      }
    }

    const validation = rules.validatePickupAuthorization(
      data.childId,
      data.authorizerId,
      data.pickupTime || new Date().toISOString()
    );

    if (!validation.valid) {
      const exception = store.addException(
        'pickup',
        data.childId,
        validation.reason,
        validation.message,
        { 
          authorizerId: data.authorizerId,
          authorizerName: data.authorizerName,
          validationResult: validation
        }
      );
      throw { 
        exception, 
        message: validation.message,
        validation,
        authorized: false
      };
    }

    const child = store.children.get(data.childId);
    const pickupId = store.generateId();
    const pickup = {
      id: pickupId,
      childId: data.childId,
      childName: child.name,
      authorizerId: data.authorizerId,
      authorizerName: data.authorizerName,
      authorizationType: validation.authorizationType,
      authorizationId: validation.authorization.id,
      pickupTime: data.pickupTime || new Date().toISOString(),
      pickedUpBy: operator,
      notes: data.notes,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    store.pickups.set(pickupId, pickup);
    store.addHistory('pickup', pickupId, 'completed', { before: null, after: pickup }, operator);

    const result = {
      success: true,
      pickup,
      authorization: validation,
      childStatus: rules.getChildCurrentStatus(data.childId, data.pickupTime?.split('T')[0])
    };

    if (idempotencyKey) {
      const check = idempotency.checkAndRecord(idempotencyKey, data, 'pickup');
      check.record(result);
    }

    return { ...result, isDuplicate: false };
  }

  getChildStatus(childId, date) {
    const child = store.children.get(childId);
    if (!child) {
      throw new Error('儿童档案不存在');
    }

    const currentStatus = rules.getChildCurrentStatus(childId, date);
    
    const fixedAuths = Array.from(store.authorizers.values())
      .filter(a => a.childId === childId)
      .map(a => ({
        ...a,
        isValid: rules.isAuthorizationValid(a, new Date())
      }));

    const tempAuths = Array.from(store.tempAuthorizations.values())
      .filter(a => a.childId === childId)
      .map(a => ({
        ...a,
        isValid: rules.isAuthorizationValid(a, new Date()),
        isConfirmed: rules.isTempAuthorizationConfirmed(a)
      }));

    const history = store.getHistoryByEntity('child', childId);
    
    const checkIns = Array.from(store.checkIns.values())
      .filter(ci => ci.childId === childId)
      .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));

    const pickups = Array.from(store.pickups.values())
      .filter(p => p.childId === childId)
      .sort((a, b) => new Date(b.pickupTime) - new Date(a.pickupTime));

    return {
      child,
      currentStatus,
      fixedAuthorizations: fixedAuths,
      temporaryAuthorizations: tempAuths,
      checkIns,
      pickups,
      history
    };
  }

  getExceptions(filters = {}) {
    let exceptions = Array.from(store.exceptions.values());
    
    if (filters.status) {
      exceptions = exceptions.filter(e => e.status === filters.status);
    }
    
    if (filters.entityType) {
      exceptions = exceptions.filter(e => e.entityType === filters.entityType);
    }
    
    if (filters.exceptionType) {
      exceptions = exceptions.filter(e => e.exceptionType === filters.exceptionType);
    }

    return exceptions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  resolveException(exceptionId, resolution, operator, beforeState, afterState) {
    return store.resolveException(exceptionId, resolution, operator, beforeState, afterState);
  }

  generatePickupReport(date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const checkIns = Array.from(store.checkIns.values())
      .filter(ci => ci.checkInTime.startsWith(targetDate));
    
    const pickups = Array.from(store.pickups.values())
      .filter(p => p.pickupTime.startsWith(targetDate));

    const children = Array.from(store.children.values());
    const childReports = children.map(child => {
      const childCheckIns = checkIns.filter(ci => ci.childId === child.id);
      const childPickups = pickups.filter(p => p.childId === child.id);
      const status = rules.getChildCurrentStatus(child.id, targetDate);

      return {
        childId: child.id,
        childName: child.name,
        class: child.class,
        checkInCount: childCheckIns.length,
        pickupCount: childPickups.length,
        currentStatus: status.status,
        lastCheckIn: childCheckIns[childCheckIns.length - 1] || null,
        lastPickup: childPickups[childPickups.length - 1] || null
      };
    });

    const exceptions = Array.from(store.exceptions.values())
      .filter(e => e.timestamp.startsWith(targetDate));

    const stats = {
      totalChildren: children.length,
      checkedIn: childReports.filter(r => r.checkInCount > 0).length,
      pickedUp: childReports.filter(r => r.currentStatus === 'picked_up').length,
      inSchool: childReports.filter(r => r.currentStatus === 'in_school').length,
      notArrived: childReports.filter(r => r.currentStatus === 'not_arrived').length,
      exceptionCount: exceptions.length,
      openExceptions: exceptions.filter(e => e.status === 'open').length
    };

    return {
      date: targetDate,
      generatedAt: new Date().toISOString(),
      stats,
      childReports,
      exceptions
    };
  }
}

module.exports = new PickupService();
