const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true, index: true },
  reportType: {
    type: String,
    required: true,
    enum: ['维修明细', '评分汇总', '申诉汇总', '楼栋统计', '师傅统计', '综合报告']
  },
  title: { type: String, required: true },
  filters: mongoose.Schema.Types.Mixed,
  summary: {
    totalCount: Number,
    statusBreakdown: mongoose.Schema.Types.Mixed,
    scoreDistribution: mongoose.Schema.Types.Mixed,
    avgScore: Number
  },
  recordRefs: [{
    type: { type: String, enum: ['RepairRequest', 'Rating', 'Appeal'] },
    id: String
  }],
  generatedBy: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now, index: true },
  expireAt: { type: Date, index: true, expires: 0 },
  createdAt: { type: Date, default: Date.now }
});

reportSchema.index({ reportType: 1, generatedAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
