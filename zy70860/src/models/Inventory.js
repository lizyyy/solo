const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  materialCode: {
    type: String,
    required: true,
    index: true
  },
  materialName: {
    type: String,
    required: true
  },
  specification: {
    type: String
  },
  unit: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  batchNumber: {
    type: String,
    required: true,
    index: true
  },
  warehouse: {
    type: String,
    required: true
  },
  location: {
    type: String
  },
  safetyStock: {
    type: Number,
    default: 0
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  supplier: {
    type: String
  },
  productionDate: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['normal', 'low_stock', 'negative', 'reserved'],
    default: 'normal'
  },
  remarks: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

inventorySchema.index({ materialCode: 1, batchNumber: 1 }, { unique: true });

inventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.quantity < 0) {
    this.status = 'negative';
  } else if (this.quantity <= this.safetyStock) {
    this.status = 'low_stock';
  } else {
    this.status = 'normal';
  }
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);
