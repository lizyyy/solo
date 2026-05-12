const store = require('../data/store');

class BusinessRules {
  
  isAuthorizationValid(authorization, pickupTime) {
    const now = pickupTime || new Date();
    const startTime = new Date(authorization.validFrom);
    const endTime = new Date(authorization.validUntil);
    
    return authorization.status === 'active' &&
           now >= startTime &&
           now <= endTime;
  }

  isTempAuthorizationConfirmed(auth) {
    return auth.status === 'confirmed';
  }

  isInBlacklist(authorizerId) {
    const blacklistItems = Array.from(store.blacklist.values()).filter(
      item => item.authorizerId === authorizerId && item.status === 'active'
    );
    return blacklistItems.length > 0;
  }

  getChildCurrentStatus(childId, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const todayCheckIns = Array.from(store.checkIns.values()).filter(
      ci => ci.childId === childId && 
            ci.checkInTime.startsWith(targetDate) &&
            ci.status !== 'cancelled'
    ).sort((a, b) => new Date(a.checkInTime) - new Date(b.checkInTime));

    const todayPickups = Array.from(store.pickups.values()).filter(
      p => p.childId === childId && 
           p.pickupTime.startsWith(targetDate) &&
           p.status === 'completed'
    ).sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));

    const lastCheckIn = todayCheckIns[todayCheckIns.length - 1];
    const lastPickup = todayPickups[todayPickups.length - 1];

    if (!lastCheckIn) {
      return { status: 'not_arrived', checkIn: null, pickup: null };
    }

    if (!lastPickup) {
      return { status: 'in_school', checkIn: lastCheckIn, pickup: null };
    }

    if (new Date(lastPickup.pickupTime) > new Date(lastCheckIn.checkInTime)) {
      return { status: 'picked_up', checkIn: lastCheckIn, pickup: lastPickup };
    }

    return { status: 'in_school', checkIn: lastCheckIn, pickup: lastPickup };
  }

  validatePickupAuthorization(childId, authorizerId, pickupTime) {
    const child = store.children.get(childId);
    if (!child) {
      return { valid: false, reason: 'CHILD_NOT_FOUND', message: '儿童档案不存在' };
    }

    if (this.isInBlacklist(authorizerId)) {
      return { valid: false, reason: 'BLACKLISTED', message: '接送人在黑名单中，禁止接送' };
    }

    const currentStatus = this.getChildCurrentStatus(childId, pickupTime?.split('T')[0]);
    if (currentStatus.status === 'picked_up') {
      return { valid: false, reason: 'DUPLICATE_PICKUP', message: '儿童已被接送，禁止重复离园' };
    }

    if (currentStatus.status === 'not_arrived') {
      return { valid: false, reason: 'NOT_CHECKED_IN', message: '儿童今日未入园' };
    }

    const fixedAuths = Array.from(store.authorizers.values()).filter(
      a => a.childId === childId && a.authorizerId === authorizerId
    );

    for (const auth of fixedAuths) {
      if (this.isAuthorizationValid(auth, new Date(pickupTime))) {
        return { 
          valid: true, 
          authorizationType: 'fixed',
          authorization: auth,
          message: '固定授权验证通过'
        };
      }
    }

    const tempAuths = Array.from(store.tempAuthorizations.values()).filter(
      a => a.childId === childId && a.authorizerId === authorizerId
    );

    for (const auth of tempAuths) {
      if (!this.isTempAuthorizationConfirmed(auth)) {
        continue;
      }
      
      if (this.isAuthorizationValid(auth, new Date(pickupTime))) {
        return { 
          valid: true, 
          authorizationType: 'temporary',
          authorization: auth,
          message: '临时授权验证通过'
        };
      }
    }

    const allTempAuths = Array.from(store.tempAuthorizations.values()).filter(
      a => a.childId === childId && a.authorizerId === authorizerId
    );

    for (const auth of allTempAuths) {
      if (!this.isTempAuthorizationConfirmed(auth)) {
        return { 
          valid: false, 
          reason: 'TEMP_AUTH_UNCONFIRMED',
          message: '临时授权未确认，禁止接送',
          pendingAuth: auth
        };
      }
    }

    const expiredAuths = [...fixedAuths, ...tempAuths].filter(
      a => a.status === 'active' && !this.isAuthorizationValid(a, new Date(pickupTime))
    );

    if (expiredAuths.length > 0) {
      return { 
        valid: false, 
        reason: 'AUTHORIZATION_EXPIRED',
        message: '授权已过期',
        expiredAuth: expiredAuths[0]
      };
    }

    return { valid: false, reason: 'NO_AUTHORIZATION', message: '无有效授权' };
  }

  checkTimeoutForPickup(childId, pickupDeadline) {
    const now = new Date();
    const deadline = new Date(pickupDeadline);
    
    if (now > deadline) {
      const currentStatus = this.getChildCurrentStatus(childId);
      if (currentStatus.status === 'in_school') {
        return {
          isTimeout: true,
          message: '儿童超时未被接送',
          overdueMinutes: Math.floor((now - deadline) / 60000)
        };
      }
    }
    
    return { isTimeout: false };
  }
}

module.exports = new BusinessRules();
