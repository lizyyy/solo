const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  batchName: {
    type: String,
    required: true
  },
  batchType: {
    type: String,
    enum: ['借阅申请', '归还批次', '催还批次', '涉密审查'],
    required: true
  },
  description: String,
  totalRecords: {
    type: Number,
    default: 0
  },
  processedRecords: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['新建', '处理中', '已完成', '已取消'],
    default: '新建'
  },
  createdBy: {
    type: String,
    required: true
  },
  createdById: String,
  processedBy: String,
  processedById: String,
  completedAt: Date,
  recordIds: [String],
  metadata: {
    type: Map,
    of: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

batchSchema.index({ status: 1, createdAt: -1 });
batchSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Batch', batchSchema);
