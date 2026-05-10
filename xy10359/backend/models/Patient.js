const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  idCard: {
    type: String,
    required: true,
    unique: true
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['男', '女'],
    required: true
  },
  allergies: [{
    drugName: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['轻度', '中度', '重度'],
      default: '中度'
    },
    description: String
  }],
  medicalHistory: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Patient', patientSchema);
