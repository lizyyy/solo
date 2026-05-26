const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  ratingId: { type: String, required: true, unique: true, index: true },
  requestId: { type: String, required: true, ref: 'RepairRequest', index: true },
  workerId: { type: String, required: true, ref: 'Worker', index: true },
  score: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  ratedBy: { type: String, required: true },
  ratedAt: { type: Date, required: true, index: true },
  isMalicious: { type: Boolean, default: false },
  maliciousReason: String,
  maliciousHandledBy: String,
  maliciousHandledAt: Date,
  hasAppeal: { type: Boolean, default: false },
  appealStatus: {
    type: String,
    enum: ['无', '待审核', '通过', '驳回'],
    default: '无'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ratingSchema.index({ workerId: 1, ratedAt: -1 });
ratingSchema.index({ appealStatus: 1 });

ratingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Rating', ratingSchema);
