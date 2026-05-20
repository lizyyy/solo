const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  plateNumber: {
    type: String,
    required: true
  },
  teamName: {
    type: String,
    required: true,
    index: true
  },
  driver: {
    type: String,
    required: true
  },
  crewMembers: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['active', 'maintenance', 'inactive'],
    default: 'active'
  },
  capacity: {
    type: Number,
    default: 0
  },
  currentLocation: {
    type: String
  },
  lastMaintenanceDate: {
    type: Date
  },
  remarks: {
    type: String
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

vehicleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
