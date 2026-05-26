const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  workerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  trade: { type: String, required: true, enum: ['水电', '土木', '暖通', '电子', '综合'] },
  phone: String,
  team: String,
  status: { type: String, enum: ['在岗', '休假', '停岗'], default: '在岗' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

workerSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Worker', workerSchema);
