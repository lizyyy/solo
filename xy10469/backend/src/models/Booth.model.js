const mongoose = require('mongoose');

const boothSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['food', 'cultural', 'promotion'],
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: Number,
    required: true,
    min: 0
  },
  standardElectricity: {
    type: Number,
    default: 5,
    min: 0
  },
  standardRental: {
    type: Number,
    required: true,
    min: 0
  },
  standardDeposit: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'disabled'],
    default: 'available'
  },
  description: {
    type: String,
    trim: true
  },
  equipment: [{
    type: String,
    trim: true
  }],
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

boothSchema.index({ code: 1 });
boothSchema.index({ type: 1 });
boothSchema.index({ status: 1 });

module.exports = mongoose.model('Booth', boothSchema);