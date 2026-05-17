const mongoose = require('mongoose');

const PreparedMealStatus = {
  AVAILABLE: 'available',
  OFF_SHELVES_PROCESSING: 'off_shelves_processing',
  OFF_SHELVED: 'off_shelved',
  RECOVERABLE: 'recoverable'
};

const preparedMealSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  originalPrice: {
    type: Number,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true,
    default: '份'
  },
  shelfLife: {
    type: Number,
    required: true
  },
  shelfLifeUnit: {
    type: String,
    required: true,
    default: '天'
  },
  storageCondition: {
    type: String,
    required: true
  },
  ingredients: [String],
  allergens: [String],
  nutritionInfo: {
    calories: Number,
    protein: Number,
    fat: Number,
    carbs: Number
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(PreparedMealStatus),
    default: PreparedMealStatus.AVAILABLE
  },
  imageUrl: String,
  description: String,
  supplier: {
    name: String,
    contact: String,
    address: String
  },
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

preparedMealSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = {
  PreparedMeal: mongoose.model('PreparedMeal', preparedMealSchema),
  PreparedMealStatus
};
