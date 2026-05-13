const mongoose = require('mongoose');

const ruleHitSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: true
  },
  ruleType: {
    type: String,
    required: true
  },
  ruleName: {
    type: String,
    required: true
  },
  hitReason: {
    type: String,
    default: ''
  }
}, { _id: false });

const sampleResultSchema = new mongoose.Schema({
  sampleId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  userSegment: {
    type: String,
    default: 'general'
  },
  oldResult: {
    blocked: { type: Boolean, default: false },
    discountApplied: { type: Number, default: 0 },
    membershipBenefits: { type: mongoose.Schema.Types.Mixed, default: {} },
    hitRules: [ruleHitSchema]
  },
  newResult: {
    blocked: { type: Boolean, default: false },
    discountApplied: { type: Number, default: 0 },
    membershipBenefits: { type: mongoose.Schema.Types.Mixed, default: {} },
    hitRules: [ruleHitSchema]
  },
  isConflicting: {
    type: Boolean,
    default: false
  },
  conflictReason: {
    type: String,
    default: ''
  }
}, { _id: false });

const sandboxRunSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  oldRuleVersion: {
    type: String,
    required: true
  },
  newRuleVersion: {
    type: String,
    required: true
  },
  sampleSetId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  startTime: {
    type: Date,
    default: null
  },
  endTime: {
    type: Date,
    default: null
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  results: {
    affectedUsers: { type: Number, default: 0 },
    blockedOrders: { type: Number, default: 0 },
    unblockedOrders: { type: Number, default: 0 },
    increasedDiscount: { type: Number, default: 0 },
    decreasedDiscount: { type: Number, default: 0 },
    totalOrderAmountChange: { type: Number, default: 0 },
    falsePositives: { type: Number, default: 0 },
    falseNegatives: { type: Number, default: 0 },
    affectedSegments: { type: mongoose.Schema.Types.Mixed, default: {} },
    conflicts: { type: Number, default: 0 }
  },
  sampleResults: [sampleResultSchema],
  businessImpact: {
    type: String,
    default: ''
  },
  recommendation: {
    type: String,
    enum: ['recommended', 'not_recommended', 'needs_review'],
    default: 'needs_review'
  },
  errorMessage: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('SandboxRun', sandboxRunSchema);
