const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema({
  appealId: { type: String, required: true, unique: true, index: true },
  ratingId: { type: String, required: true, ref: 'Rating', index: true },
  requestId: { type: String, required: true, ref: 'RepairRequest', index: true },
  workerId: { type: String, required: true, ref: 'Worker', index: true },
  appellant: { type: String, required: true },
  appellantRole: { type: String, enum: ['维修工', '宿舍管理员', '其他'], required: true },
  appealReason: { type: String, required: true },
  appealStatus: {
    type: String,
    enum: ['待审核', '通过', '驳回'],
    default: '待审核',
    index: true
  },
  reviewReason: String,
  reviewedBy: String,
  reviewedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

appealSchema.index({ workerId: 1, createdAt: -1 });
appealSchema.index({ appealStatus: 1, createdAt: -1 });

appealSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Appeal', appealSchema);
