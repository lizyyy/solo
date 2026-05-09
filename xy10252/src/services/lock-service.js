const DataStore = require('../models/data-store');

const LockService = {
  createLock: (propertyId, lockData) => {
    const property = DataStore.getProperty(propertyId);
    if (!property) {
      throw new Error('Property not found');
    }
    
    return DataStore.addLock({
      propertyId,
      ...lockData
    });
  },
  
  updateBatteryLevel: (lockId, batteryLevel) => {
    const lock = DataStore.getLock(lockId);
    if (!lock) {
      throw new Error('Lock not found');
    }
    
    if (batteryLevel < 0 || batteryLevel > 100) {
      throw new Error('Invalid battery level. Must be between 0 and 100');
    }
    
    const updates = {
      batteryLevel,
      lastCheckedAt: DataStore.getTimestamp()
    };
    
    if (batteryLevel < 20 && lock.status === 'normal') {
      updates.status = 'low_battery';
      LockService.createBatteryAlert(lockId, batteryLevel);
    } else if (batteryLevel >= 20 && lock.status === 'low_battery') {
      updates.status = 'normal';
      LockService.resolveActiveAlerts(lockId);
    }
    
    return DataStore.updateLock(lockId, updates);
  },
  
  createBatteryAlert: (lockId, batteryLevel) => {
    const lock = DataStore.getLock(lockId);
    if (!lock) {
      throw new Error('Lock not found');
    }
    
    const activeAlerts = DataStore.getBatteryAlertsByLock(lockId)
      .filter(a => a.status === 'active');
    
    if (activeAlerts.length > 0) {
      return activeAlerts[0];
    }
    
    const urgency = batteryLevel < 10 ? 'critical' : 'warning';
    
    const bookings = DataStore.getBookingsByProperty(lock.propertyId);
    const upcomingBookings = bookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      const now = new Date();
      const diffDays = (checkIn - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3 && b.status === 'confirmed';
    });
    
    return DataStore.addBatteryAlert({
      lockId,
      propertyId: lock.propertyId,
      batteryLevel,
      urgency,
      impactAnalysis: {
        hasUpcomingBookings: upcomingBookings.length > 0,
        upcomingBookingsCount: upcomingBookings.length,
        recommendedAction: urgency === 'critical' ? 'immediate_replacement' : 'scheduled_replacement'
      }
    });
  },
  
  resolveActiveAlerts: (lockId) => {
    const activeAlerts = DataStore.getBatteryAlertsByLock(lockId)
      .filter(a => a.status === 'active');
    
    activeAlerts.forEach(alert => {
      DataStore.updateBatteryAlert(alert.id, {
        status: 'resolved',
        resolvedAt: DataStore.getTimestamp(),
        resolutionReason: 'battery_recovered'
      });
    });
  },
  
  acknowledgeAlert: (alertId, operator = 'system') => {
    const alert = DataStore.getBatteryAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    
    if (alert.status !== 'active') {
      throw new Error('Alert is not active');
    }
    
    return DataStore.updateBatteryAlert(alertId, {
      acknowledgedAt: DataStore.getTimestamp(),
      acknowledgedBy: operator
    });
  },
  
  resolveAlert: (alertId, resolutionReason, operator = 'system') => {
    const alert = DataStore.getBatteryAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    
    if (alert.status === 'resolved') {
      return alert;
    }
    
    return DataStore.updateBatteryAlert(alertId, {
      status: 'resolved',
      resolvedAt: DataStore.getTimestamp(),
      resolvedBy: operator,
      resolutionReason
    });
  },
  
  withdrawAlert: (alertId, reason, operator = 'system') => {
    const alert = DataStore.getBatteryAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    
    if (alert.status === 'resolved') {
      throw new Error('Cannot withdraw a resolved alert');
    }
    
    return DataStore.updateBatteryAlert(alertId, {
      status: 'withdrawn',
      resolvedAt: DataStore.getTimestamp(),
      resolvedBy: operator,
      resolutionReason: `withdrawn: ${reason}`
    });
  },
  
  getLockWithDetails: (lockId) => {
    const lock = DataStore.getLock(lockId);
    if (!lock) {
      return null;
    }
    
    const alerts = DataStore.getBatteryAlertsByLock(lockId);
    const property = DataStore.getProperty(lock.propertyId);
    const bookings = DataStore.getBookingsByProperty(lock.propertyId);
    
    return {
      ...lock,
      property,
      alerts,
      bookings
    };
  }
};

module.exports = LockService;
