const mongoose = require('mongoose');

const exceptionLogSchema = new mongoose.Schema({
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  recordId: {
    type: String,
    ref: 'MaterialRecord',
    index: true
  },
  orderNumber: {
    type: String,
    ref: 'RepairOrder',
    index: true
  },
  exceptionType: {
    type: String,
    enum: ['emergency_usage', 'return_difference', 'negative_stock'],
    required: true,
    index: true
  },
  materialCode: {
    type: String,
    index: true
  },
  materialName: {
    type: String
  },
  batchNumber: {
    type: String,
    index: true
  },
  quantity: {
    type: Number
  },
  expectedQuantity: {
    type: Number
  },
  actualQuantity: {
    type: Number
  },
  reason: {
    type: String,
    required: true
  },
  handler: {
    type: String,
    required: true
  },
  handleTime: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'closed'],
    default: 'pending',
    index: true
  },
  resolution: {
    type: String
  },
  resolvedBy: {
    type: String
  },
  resolvedTime: {
    type: Date
  },
  remarks: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

exceptionLogSchema.index({ orderNumber: 1, exceptionType: 1, createdAt: -1 });

module.exports = mongoose.model('ExceptionLog', exceptionLogSchema);
