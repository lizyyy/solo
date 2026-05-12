const mongoose = require('mongoose');

const orderEventSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'ORDER_CREATED',
      'PAYMENT_INITIATED',
      'PAYMENT_SUCCEEDED',
      'PAYMENT_FAILED',
      'INVENTORY_LOCKED',
      'INVENTORY_FAILED',
      'SHIPPING_INITIATED',
      'SHIPPED',
      'DELIVERED',
      'CANCEL_REQUESTED',
      'CANCEL_APPROVED',
      'CANCEL_REJECTED',
      'REFUND_INITIATED',
      'REFUND_SUCCEEDED',
      'REFUND_FAILED',
      'COMPENSATION_INVENTORY_RELEASED',
      'COMPENSATION_PAYMENT_REFUNDED',
      'COMPENSATION_EVENT'
    ]
  },
  eventVersion: {
    type: Number,
    required: true,
    default: 1
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  metadata: {
    operator: String,
    source: String,
    requestId: String,
    description: String
  },
  isCompensation: {
    type: Boolean,
    default: false
  },
  compensatesEventId: {
    type: String,
    default: null
  },
  isValid: {
    type: Boolean,
    default: true
  },
  validationErrors: {
    type: [String],
    default: []
  },
  isProcessed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

orderEventSchema.index({ orderId: 1, eventVersion: 1 }, { unique: true });

module.exports = mongoose.model('OrderEvent', orderEventSchema);
