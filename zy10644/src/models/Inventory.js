const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  preparedMealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PreparedMeal',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  sku: {
    type: String,
    required: true
  },
  storeCode: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  availableQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reservedQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  safetyStock: {
    type: Number,
    default: 10
  },
  unit: {
    type: String,
    default: '份'
  },
  costPrice: Number,
  lastStockDate: Date,
  nextRestockDate: Date,
  batchNo: String,
  productionDate: Date,
  expiryDate: Date,
  location: String,
  notes: String,
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

inventorySchema.index({ preparedMealId: 1, storeId: 1 }, { unique: true });
inventorySchema.index({ sku: 1, storeCode: 1 }, { unique: true });

inventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);
