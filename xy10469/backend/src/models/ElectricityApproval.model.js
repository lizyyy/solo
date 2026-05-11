const mongoose = require('mongoose');

const electricityApprovalSchema = new mongoose.Schema({
  approvalNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
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
  standardElectricity: {
    type: Number,
    required: true,
    min: 0
  },
  requestedElectricity: {
    type: Number,
    required: true,
    min: 0
  },
  exceedsStandard: {
    type: Boolean,
    default: false
  },
  equipmentList: [{
    name: {
      type: String,
      required: true
    },
    power: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'partially_approved'],
    default: 'pending'
  },
  approvedElectricity: {
    type: Number,
    min: 0
  },
  reason: {
    type: String,
    trim: true
  },
  safetyCheck: {
    type: Boolean,
    default: false
  },
  safetyNote: {
    type: String,
    trim: true
  },
  approvedBy: {
    type: String,
    trim: true
  },
  approvedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

electricityApprovalSchema.index({ approvalNo: 1 });
electricityApprovalSchema.index({ applicationId: 1 });
electricityApprovalSchema.index({ boothId: 1 });
electricityApprovalSchema.index({ status: 1 });

module.exports = mongoose.model('ElectricityApproval', electricityApprovalSchema);