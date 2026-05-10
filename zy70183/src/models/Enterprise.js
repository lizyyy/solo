const mongoose = require('mongoose');

const enterpriseSchema = new mongoose.Schema({
  enterpriseCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  enterpriseName: {
    type: String,
    required: true
  },
  taxRegistrationNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  industry: {
    type: String
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  contactPerson: String,
  contactPhone: String,
  contactEmail: String,
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true,
  versionKey: false
});

enterpriseSchema.index({ enterpriseCode: 1, status: 1 });

module.exports = mongoose.model('Enterprise', enterpriseSchema);
