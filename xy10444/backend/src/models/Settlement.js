const mongoose = require('mongoose');

const settlementItemSchema = new mongoose.Schema({
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
  quantityUsed: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  _id: false
});

const settlementSchema = new mongoose.Schema({
  settlementNumber: {
    type: String,
    unique: true,
    required: true
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder',
    required: true
  },
  workOrderNumber: {
    type: String,
    required: true
  },
  repairCategory: {
    type: String,
    required: true,
    enum: ['公共区域', '住户自费']
  },
  repairType: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  technician: {
    type: String,
    required: true
  },
  houseNumber: {
    type: String,
    default: ''
  },
  settlementType: {
    type: String,
    required: true,
    enum: ['业主付费', '公共维修基金']
  },
  items: [settlementItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  createdBy: {
    type: String,
    default: '系统'
  },
  remark: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

settlementSchema.pre('save', function(next) {
  const now = new Date();
  if (!this.settlementNumber) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.settlementNumber = `ST${year}${month}${day}${random}`;
  }
  next();
});

module.exports = mongoose.model('Settlement', settlementSchema);
