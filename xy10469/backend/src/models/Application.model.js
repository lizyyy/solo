const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicationNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true
  },
  boothId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booth',
    required: true
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: true
  },
  businessType: {
    type: String,
    required: true,
    trim: true
  },
  requiredElectricity: {
    type: Number,
    required: true,
    min: 0
  },
  specialRequirements: {
    type: String,
    trim: true
  },
  expectedRevenue: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  applicationDate: {
    type: Date,
    default: Date.now
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  reviewNote: {
    type: String,
    trim: true
  },
  reviewedBy: {
    type: String,
    trim: true
  },
  reviewedAt: {
    type: Date
  },
  depositPaid: {
    type: Boolean,
    default: false
  },
  electricityApproved: {
    type: Boolean,
    default: false
  },
  admissionConfirmed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

applicationSchema.index({ applicationNo: 1 });
applicationSchema.index({ merchantId: 1 });
applicationSchema.index({ boothId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Application', applicationSchema);