const mongoose = require('mongoose');
const config = require('../config');

const machineLabelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: String, required: true }
});

const conflictInfoSchema = new mongoose.Schema({
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
  overlappedWindow: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  releasePlan: { type: String },
  description: { type: String }
});

const approvalInfoSchema = new mongoose.Schema({
  approver: { type: String, required: true },
  approvedAt: { type: Date, default: Date.now },
  comment: { type: String }
});

const releaseInfoSchema = new mongoose.Schema({
  releasedBy: { type: String },
  releasedAt: { type: Date },
  reason: { type: String }
});

const reservationSchema = new mongoose.Schema({
  reservationNo: { type: String, unique: true, required: true },
  applicant: { type: String, required: true },
  applicantDepartment: { type: String, required: true },
  purpose: { type: String, required: true },
  pressureTestResource: {
    cpu: { type: Number, required: true },
    memory: { type: Number, required: true },
    memoryUnit: { type: String, required: true },
    instances: { type: Number, required: true },
    description: { type: String }
  },
  machineLabels: [machineLabelSchema],
  drillWindow: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  status: {
    type: String,
    enum: Object.values(config.reservation.status),
    default: config.reservation.status.PENDING
  },
  conflicts: [conflictInfoSchema],
  approval: approvalInfoSchema,
  release: releaseInfoSchema,
  conflictDescription: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

reservationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

reservationSchema.index({ 'drillWindow.start': 1, 'drillWindow.end': 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ 'machineLabels.name': 1, 'machineLabels.value': 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
