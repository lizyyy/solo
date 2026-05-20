const mongoose = require('mongoose');

const repairOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  repairType: {
    type: String,
    required: true,
    enum: ['pipe_repair', 'valve_replacement', 'meter_repair', 'emergency', 'other']
  },
  location: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  vehicleId: {
    type: String,
    ref: 'Vehicle',
    index: true
  },
  teamName: {
    type: String,
    index: true
  },
  reporter: {
    type: String
  },
  reportTime: {
    type: Date
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  responsiblePerson: {
    type: String
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

repairOrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('RepairOrder', repairOrderSchema);
