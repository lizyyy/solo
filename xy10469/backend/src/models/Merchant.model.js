const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  businessType: {
    type: String,
    required: true,
    trim: true
  },
  licenseNumber: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'blacklisted'],
    default: 'active'
  },
  creditScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  notes: {
    type: String,
    trim: true
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

merchantSchema.index({ name: 1 });
merchantSchema.index({ phone: 1 });
merchantSchema.index({ status: 1 });

module.exports = mongoose.model('Merchant', merchantSchema);