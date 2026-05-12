const mongoose = require('mongoose');

const orderProjectionSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  currentState: {
    type: String,
    required: true,
    enum: [
      'CREATED',
      'PENDING_PAYMENT',
      'PAYMENT_SUCCEEDED',
      'PAYMENT_FAILED',
      'INVENTORY_LOCKED',
      'INVENTORY_FAILED',
      'SHIPPING_PENDING',
      'SHIPPED',
      'DELIVERED',
      'CANCEL_PENDING',
      'CANCELLED',
      'CANCEL_REJECTED',
      'REFUND_PENDING',
      'REFUNDED',
      'REFUND_FAILED',
      'COMPENSATION_IN_PROGRESS',
      'COMPENSATED'
    ],
    default: 'CREATED'
  },
  version: {
    type: Number,
    required: true,
    default: 0
  },
  lastEventId: {
    type: String,
    required: true
  },
  lastEventTimestamp: {
    type: Date,
    required: true
  },
  orderDetails: {
    userId: String,
    items: [{
      productId: String,
      productName: String,
      quantity: Number,
      unitPrice: Number,
      totalPrice: Number
    }],
    totalAmount: Number,
    shippingAddress: {
      province: String,
      city: String,
      district: String,
      detail: String,
      phone: String,
      name: String
    },
    paymentMethod: String,
    remark: String
  },
  paymentInfo: {
    paymentId: String,
    amount: Number,
    paidAt: Date,
    status: String
  },
  inventoryInfo: {
    locked: Boolean,
    lockedAt: Date,
    items: [{
      productId: String,
      lockedQuantity: Number
    }]
  },
  shippingInfo: {
    shippingId: String,
    logisticsCompany: String,
    trackingNumber: String,
    shippedAt: Date,
    deliveredAt: Date,
    status: String
  },
  cancellationInfo: {
    requested: Boolean,
    requestedAt: Date,
    reason: String,
    approved: Boolean,
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String
  },
  refundInfo: {
    refundId: String,
    amount: Number,
    status: String,
    refundedAt: Date,
    reason: String
  },
  compensationInfo: {
    isCompensated: Boolean,
    compensatedAt: Date,
    events: [{
      eventId: String,
      eventType: String,
      compensatesEventId: String,
      appliedAt: Date
    }]
  },
  stateHistory: [{
    state: String,
    eventId: String,
    timestamp: Date,
    description: String
  }],
  isConsistent: {
    type: Boolean,
    default: true
  },
  inconsistencyDetails: [String]
}, {
  timestamps: true
});

module.exports = mongoose.model('OrderProjection', orderProjectionSchema);
