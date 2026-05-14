const mongoose = require('mongoose');

const featureSwitchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  targetUsers: [{
    type: String,
    required: true
  }],
  ruleExpression: {
    type: String,
    required: true,
    default: 'true'
  },
  rules: {
    rollbackOnError: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 1 }
    },
    idempotent: {
      enabled: { type: Boolean, default: true },
      windowMs: { type: Number, default: 60000 }
    },
    retryLimit: {
      enabled: { type: Boolean, default: true },
      maxRetries: { type: Number, default: 3 }
    }
  },
  isActive: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

featureSwitchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('FeatureSwitch', featureSwitchSchema);
