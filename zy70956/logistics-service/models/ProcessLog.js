const mongoose = require('mongoose');

const processLogSchema = new mongoose.Schema({
  logId: { type: String, required: true, unique: true, index: true },
  targetType: {
    type: String,
    required: true,
    enum: ['RepairRequest', 'Rating', 'Batch', 'Appeal']
  },
  targetId: { type: String, required: true, index: true },
  action: {
    type: String,
    required: true,
    enum: [
      '导入',
      '新增',
      '派单',
      '处理中',
      '完成',
      '退回',
      '关闭',
      '标记重复',
      '取消重复标记',
      '超时罚分',
      '标记恶意评分',
      '申诉提交',
      '申诉通过',
      '申诉驳回',
      '确认导入',
      '作废批次',
      '导出',
      '修改'
    ]
  },
  reason: { type: String, required: true },
  operator: { type: String, required: true },
  operatedAt: { type: Date, default: Date.now, index: true },
  oldStatus: String,
  newStatus: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

processLogSchema.index({ targetType: 1, targetId: 1, operatedAt: -1 });
processLogSchema.index({ operator: 1, operatedAt: -1 });

module.exports = mongoose.model('ProcessLog', processLogSchema);
