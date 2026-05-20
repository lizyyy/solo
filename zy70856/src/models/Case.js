const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  securityLevel: {
    type: String,
    enum: ['公开', '内部', '秘密', '机密', '绝密'],
    required: true
  },
  department: String,
  createDate: Date,
  archiveDate: Date,
  description: String,
  keywords: [String],
  status: {
    type: String,
    enum: ['在库', '借出', '归档', '销毁'],
    default: '在库'
  },
  metadata: {
    type: Map,
    of: String
  },
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

caseSchema.index({ securityLevel: 1 });
caseSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Case', caseSchema);
