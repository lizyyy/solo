const mongoose = require('mongoose');

const StoreStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
  TEMPORARILY_CLOSED: 'temporarily_closed'
};

const storeSchema = new mongoose.Schema({
  storeCode: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    province: String,
    city: String,
    district: String,
    detail: String,
    full: String
  },
  phone: String,
  manager: {
    name: String,
    phone: String,
    email: String
  },
  businessHours: [{
    day: String,
    openTime: String,
    closeTime: String
  }],
  area: Number,
  seatingCapacity: Number,
  kitchenCapacity: Number,
  status: {
    type: String,
    required: true,
    enum: Object.values(StoreStatus),
    default: StoreStatus.OPEN
  },
  openDate: Date,
  region: String,
  franchiseType: String,
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

storeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = {
  Store: mongoose.model('Store', storeSchema),
  StoreStatus
};
