const DataStore = require('../models/data-store');
const LockService = require('./lock-service');

const RepairService = {
  createFromAlert: (alertId, operator = 'system') => {
    const alert = DataStore.getBatteryAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    
    if (alert.status !== 'active') {
      throw new Error('Can only create repair order from active alert');
    }
    
    const lock = DataStore.getLock(alert.lockId);
    const property = DataStore.getProperty(alert.propertyId);
    
    const bookings = DataStore.getBookingsByProperty(alert.propertyId);
    const upcomingBookings = bookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      const now = new Date();
      const diffDays = (checkIn - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3 && b.status === 'confirmed';
    });
    
    const priority = alert.urgency === 'critical' ? 'high' : 
                     upcomingBookings.length > 0 ? 'high' : 'medium';
    
    const order = DataStore.addRepairOrder({
      propertyId: alert.propertyId,
      lockId: alert.lockId,
      alertId: alertId,
      type: 'battery_replacement',
      priority,
      urgency: alert.urgency,
      description: `门锁电量低: ${alert.batteryLevel}%`,
      impactAnalysis: {
        hasUpcomingBookings: upcomingBookings.length > 0,
        upcomingBookingsCount: upcomingBookings.length,
        propertyName: property?.name,
        lockName: lock?.name
      },
      createdBy: operator
    });
    
    DataStore.updateBatteryAlert(alertId, {
      repairOrderId: order.id
    });
    
    return order;
  },
  
  createManual: (propertyId, lockId, description, priority = 'medium', operator = 'system') => {
    const property = DataStore.getProperty(propertyId);
    if (!property) {
      throw new Error('Property not found');
    }
    
    const lock = DataStore.getLock(lockId);
    if (!lock) {
      throw new Error('Lock not found');
    }
    
    if (lock.propertyId !== propertyId) {
      throw new Error('Lock does not belong to property');
    }
    
    return DataStore.addRepairOrder({
      propertyId,
      lockId,
      type: 'manual',
      priority,
      urgency: priority === 'high' ? 'critical' : 'warning',
      description,
      createdBy: operator
    });
  },
  
  assign: (orderId, technician, operator = 'system') => {
    const order = DataStore.getRepairOrder(orderId);
    if (!order) {
      throw new Error('Repair order not found');
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error('Cannot assign a completed or cancelled order');
    }
    
    return DataStore.updateRepairOrder(orderId, {
      status: 'assigned',
      assignedTo: technician,
      assignedAt: DataStore.getTimestamp(),
      assignedBy: operator
    });
  },
  
  start: (orderId, operator = 'system') => {
    const order = DataStore.getRepairOrder(orderId);
    if (!order) {
      throw new Error('Repair order not found');
    }
    
    if (order.status !== 'assigned') {
      throw new Error('Can only start an assigned order');
    }
    
    return DataStore.updateRepairOrder(orderId, {
      status: 'in_progress',
      startedAt: DataStore.getTimestamp(),
      startedBy: operator
    });
  },
  
  complete: (orderId, notes, operator = 'system') => {
    const order = DataStore.getRepairOrder(orderId);
    if (!order) {
      throw new Error('Repair order not found');
    }
    
    if (order.status !== 'in_progress') {
      throw new Error('Can only complete an in-progress order');
    }
    
    const updatedOrder = DataStore.updateRepairOrder(orderId, {
      status: 'completed',
      completedAt: DataStore.getTimestamp(),
      completedBy: operator,
      completionNotes: notes
    });
    
    if (order.alertId) {
      LockService.resolveAlert(order.alertId, `维修完成: ${notes}`, operator);
    }
    
    if (order.lockId) {
      DataStore.updateLock(order.lockId, {
        batteryLevel: 100,
        status: 'normal',
        lastCheckedAt: DataStore.getTimestamp()
      });
    }
    
    return updatedOrder;
  },
  
  cancel: (orderId, reason, operator = 'system') => {
    const order = DataStore.getRepairOrder(orderId);
    if (!order) {
      throw new Error('Repair order not found');
    }
    
    if (order.status === 'completed') {
      throw new Error('Cannot cancel a completed order');
    }
    
    return DataStore.updateRepairOrder(orderId, {
      status: 'cancelled',
      cancelledAt: DataStore.getTimestamp(),
      cancelledBy: operator,
      cancelReason: reason
    });
  },
  
  revise: (orderId, updates, operator = 'system') => {
    const order = DataStore.getRepairOrder(orderId);
    if (!order) {
      throw new Error('Repair order not found');
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new Error('Cannot revise a completed or cancelled order');
    }
    
    const allowedUpdates = ['description', 'priority', 'urgency'];
    const filteredUpdates = {};
    
    allowedUpdates.forEach(key => {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    filteredUpdates.revisedBy = operator;
    filteredUpdates.revisedAt = DataStore.getTimestamp();
    
    return DataStore.updateRepairOrder(orderId, filteredUpdates);
  },
  
  getOrderWithDetails: (orderId) => {
    const order = DataStore.getRepairOrder(orderId);
    if (!order) {
      return null;
    }
    
    const property = DataStore.getProperty(order.propertyId);
    const lock = DataStore.getLock(order.lockId);
    const alert = order.alertId ? DataStore.getBatteryAlert(order.alertId) : null;
    const history = DataStore.getHistory('repairOrder', orderId);
    
    return {
      ...order,
      property,
      lock,
      alert,
      history
    };
  },
  
  getOrdersByUrgency: (urgency) => {
    return DataStore.repairOrders
      .filter(o => o.urgency === urgency && o.status !== 'completed' && o.status !== 'cancelled')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
};

module.exports = RepairService;
