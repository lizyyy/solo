const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true, index: true },
  batchType: {
    type: String,
    required: true,
    enum: ['报修记录', '维修工', '评分记录']
  },
  fileName: String,
  recordCount: { type: Number, default: 0 },
  importedBy: { type: String, required: true },
  importStatus: {
    type: String,
    enum: ['待确认', '部分成功', '全部成功', '已作废'],
    default: '待确认'
  },
  errors: [{
    row: Number,
    field: String,
    message: String
  }],
  confirmedAt: Date,
  confirmedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

batchSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Batch', batchSchema);
