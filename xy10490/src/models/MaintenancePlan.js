const mongoose = require('mongoose');

const maintenancePlanSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  equipmentId: {
    type: String,
    required: true,
    index: true
  },
  cycleType: {
    type: String,
    enum: ['hour', 'date'],
    required: true
  },
  cycleValue: {
    type: Number,
    required: true
  },
  planType: {
    type: String,
    enum: ['regular', 'catchup'],
    default: 'regular'
  },
  targetHours: {
    type: Number
  },
  targetDate: {
    type: Date
  },
  actualHours: {
    type: Number
  },
  actualDate: {
    type: Date
  },
  deadlineHours: {
    type: Number
  },
  deadlineDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'skipped', 'overdue'],
    default: 'pending',
    index: true
  },
  reminderEnabled: {
    type: Boolean,
    default: true
  },
  completedBy: {
    type: String
  },
  completedAt: {
    type: Date
  },
  completedNotes: {
    type: String
  },
  skipRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SkipRequest'
  },
  previousPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaintenancePlan'
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

maintenancePlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MaintenancePlan', maintenancePlanSchema);
