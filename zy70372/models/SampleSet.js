const mongoose = require('mongoose');

const sampleSchema = new mongoose.Schema({
  sampleId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  userSegment: {
    type: String,
    default: 'general'
  },
  orderAmount: {
    type: Number,
    default: 0
  },
  orderDate: {
    type: Date,
    required: true
  },
  purchaseHistory: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  riskScore: {
    type: Number,
    default: 0
  },
  membershipLevel: {
    type: String,
    default: 'basic'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

const sampleSetSchema = new mongoose.Schema({
  setId: {
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
  samples: [sampleSchema],
  sampleCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SampleSet', sampleSetSchema);
