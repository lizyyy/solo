const path = require('path');

module.exports = {
  app: {
    port: process.env.PORT || 3000,
    name: '售后换新库存 API',
    version: '1.0.0'
  },
  db: {
    path: path.resolve(__dirname, '../../data.sqlite')
  },
  business: {
    warranty: {
      defaultExtensionDays: 365,
      inheritMode: 'inherit',
      extensionMode: 'extend'
    },
    recycle: {
      defaultTimeoutDays: 7,
      maxTimeoutDays: 30
    },
    status: {
      APPLICATION_PENDING: 'APPLICATION_PENDING',
      FAULT_AUDITING: 'FAULT_AUDITING',
      FAULT_APPROVED: 'FAULT_APPROVED',
      FAULT_REJECTED: 'FAULT_REJECTED',
      INVENTORY_CHECKING: 'INVENTORY_CHECKING',
      INVENTORY_ALLOCATED: 'INVENTORY_ALLOCATED',
      INVENTORY_SHORTAGE: 'INVENTORY_SHORTAGE',
      SHIPPING: 'SHIPPING',
      SHIPPED: 'SHIPPED',
      WAITING_RECYCLE: 'WAITING_RECYCLE',
      RECYCLING: 'RECYCLING',
      RECYCLED: 'RECYCLED',
      RECYCLE_OVERDUE: 'RECYCLE_OVERDUE',
      WARRANTY_CALCULATING: 'WARRANTY_CALCULATING',
      WARRANTY_UPDATED: 'WARRANTY_UPDATED',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
      FAILED: 'FAILED',
      NEED_MANUAL_CORRECTION: 'NEED_MANUAL_CORRECTION'
    },
    faultStatus: {
      PENDING: 'PENDING',
      CONFIRMED: 'CONFIRMED',
      REJECTED: 'REJECTED'
    },
    inventoryStatus: {
      AVAILABLE: 'AVAILABLE',
      ALLOCATED: 'ALLOCATED',
      SHIPPED: 'SHIPPED'
    },
    recycleStatus: {
      PENDING: 'PENDING',
      IN_PROGRESS: 'IN_PROGRESS',
      RECEIVED: 'RECEIVED',
      INSPECTING: 'INSPECTING',
      COMPLETED: 'COMPLETED',
      OVERDUE: 'OVERDUE',
      CANCELLED: 'CANCELLED'
    }
  }
};
