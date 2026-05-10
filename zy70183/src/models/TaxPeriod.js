const mongoose = require('mongoose');

const taxPeriodSchema = new mongoose.Schema({
  periodCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  periodType: {
    type: String,
    enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'],
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number
  },
  quarter: {
    type: Number
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  declarationDeadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'CLOSED'],
    default: 'ACTIVE'
  },
  description: String
}, {
  timestamps: true,
  versionKey: false
});

taxPeriodSchema.index({ periodType: 1, year: 1, month: 1 });
taxPeriodSchema.index({ status: 1, declarationDeadline: 1 });

taxPeriodSchema.statics.generatePeriodCode = function(periodType, year, month, quarter) {
  switch (periodType) {
    case 'MONTHLY':
      return `${year}${String(month).padStart(2, '0')}`;
    case 'QUARTERLY':
      return `${year}Q${quarter}`;
    case 'YEARLY':
      return `${year}Y`;
    default:
      return `${year}`;
  }
};

module.exports = mongoose.model('TaxPeriod', taxPeriodSchema);
