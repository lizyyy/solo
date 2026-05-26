const mongoose = require('mongoose');

const repairRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true, index: true },
  batchId: { type: String, index: true },
  building: { type: String, required: true, index: true },
  room: { type: String, required: true },
  repairType: {
    type: String,
    required: true,
    enum: ['水电', '土木', '暖通', '电子', '综合']
  },
  description: { type: String, required: true },
  reporter: { type: String, required: true },
  reporterPhone: String,
  reportedAt: { type: Date, required: true, index: true },
  assignedWorkerId: { type: String, ref: 'Worker' },
  assignedAt: Date,
  status: {
    type: String,
    enum: ['待处理', '已派单', '处理中', '已完成', '已退回', '已关闭'],
    default: '待处理',
    index: true
  },
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: { type: String, ref: 'RepairRequest' },
  duplicateReason: String,
  completedAt: Date,
  closedAt: Date,
  closedReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

repairRequestSchema.index({ building: 1, reportedAt: -1 });
repairRequestSchema.index({ assignedWorkerId: 1, status: 1 });

repairRequestSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('RepairRequest', repairRequestSchema);
