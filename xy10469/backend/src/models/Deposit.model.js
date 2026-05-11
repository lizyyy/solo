const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  transactionNo: {
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
  type: {
    type: String,
    enum: ['deposit', 'refund', 'deduction', 'rent', 'electricity'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'wechat', 'alipay', 'card'],
    default: 'bank_transfer'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deposit'
  },
  deductionDetails: [{
    itemName: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String
    }
  }],
  reason: {
    type: String,
    trim: true
  },
  operator: {
    type: String,
    trim: true
  },
  transactionDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

depositSchema.index({ transactionNo: 1 });
depositSchema.index({ applicationId: 1 });
depositSchema.index({ merchantId: 1 });
depositSchema.index({ type: 1 });
depositSchema.index({ status: 1 });
depositSchema.index({ transactionDate: 1 });

module.exports = mongoose.model('Deposit', depositSchema);