const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: true
  },
  ruleType: {
    type: String,
    enum: ['discount_threshold', 'purchase_limit', 'risk_control', 'membership_benefit'],
    required: true
  },
  ruleName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  conditions: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  actions: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  priority: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  mutuallyExclusiveGroup: {
    type: String,
    default: null
  }
}, { _id: false });

const ruleVersionSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  rules: [ruleSchema],
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isLocked: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('RuleVersion', ruleVersionSchema);
