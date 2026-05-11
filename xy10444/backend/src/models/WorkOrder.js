const mongoose = require('mongoose');

const materialItemSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },
  materialName: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  quantityTaken: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  quantityUsed: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  quantityReturned: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
}, {
  _id: false
});

const workOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  repairType: {
    type: String,
    required: true,
    enum: ['水管', '门禁', '照明', '其他']
  },
  repairCategory: {
    type: String,
    required: true,
    enum: ['公共区域', '住户自费']
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  reporterName: {
    type: String,
    required: true,
    trim: true
  },
  reporterPhone: {
    type: String,
    default: ''
  },
  houseNumber: {
    type: String,
    default: ''
  },
  technician: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['待处理', '处理中', '待确认', '已完成', '已取消'],
    default: '待处理'
  },
  materials: [materialItemSchema],
  ownerConfirmed: {
    type: Boolean,
    default: false
  },
  confirmedBy: {
    type: String,
    default: ''
  },
  confirmedAt: {
    type: Date
  },
  settled: {
    type: Boolean,
    default: false
  },
  settledAt: {
    type: Date
  },
  settlementType: {
    type: String,
    enum: ['业主付费', '公共维修基金', '无需结算']
  }
}, {
  timestamps: true
});

workOrderSchema.pre('save', function(next) {
  const now = new Date();
  if (!this.orderNumber) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `WO${year}${month}${day}${random}`;
  }
  next();
});

module.exports = mongoose.model('WorkOrder', workOrderSchema);
