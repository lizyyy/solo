const mongoose = require('mongoose');

const OperationSource = {
  HEADQUARTERS: 'headquarters',
  STORE: 'store',
  API: 'api',
  BATCH_IMPORT: 'batch_import',
  SYSTEM: 'system'
};

const OffShelvesReason = {
  QUALITY_ISSUE: 'quality_issue',
  SUPPLIER_ISSUE: 'supplier_issue',
  SEASONAL: 'seasonal',
  INVENTORY_CLEARANCE: 'inventory_clearance',
  STRATEGY_ADJUSTMENT: 'strategy_adjustment',
  CUSTOMER_COMPLAINT: 'customer_complaint',
  REGULATORY_REQUIREMENT: 'regulatory_requirement',
  EXPIRED: 'expired',
  OTHER: 'other'
};

const offShelvesHistorySchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true
  },
  preparedMealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PreparedMeal',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  },
  sku: {
    type: String,
    required: true
  },
  storeCode: String,
  previousStatus: {
    type: String,
    required: true
  },
  newStatus: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: Object.values(OffShelvesReason)
  },
  reasonDetail: String,
  operationSource: {
    type: String,
    required: true,
    enum: Object.values(OperationSource)
  },
  operator: {
    id: String,
    name: String,
    role: String,
    department: String
  },
  hasInventoryConflict: {
    type: Boolean,
    default: false
  },
  inventoryConflictDetail: {
    storeCode: String,
    storeName: String,
    quantity: Number,
    availableQuantity: Number
  },
  forceOffShelves: {
    type: Boolean,
    default: false
  },
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'document', 'email', 'meeting_minutes', 'other']
    },
    url: String,
    name: String,
    description: String,
    uploadedAt: Date
  }],
  importRowNumber: Number,
  importError: String,
  remarks: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

offShelvesHistorySchema.index({ batchId: 1 });
offShelvesHistorySchema.index({ preparedMealId: 1, createdAt: -1 });
offShelvesHistorySchema.index({ sku: 1, createdAt: -1 });
offShelvesHistorySchema.index({ 'operator.id': 1, createdAt: -1 });

module.exports = {
  OffShelvesHistory: mongoose.model('OffShelvesHistory', offShelvesHistorySchema),
  OperationSource,
  OffShelvesReason
};
