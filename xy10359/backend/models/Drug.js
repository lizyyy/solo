const mongoose = require('mongoose');

const drugSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  genericName: {
    type: String,
    required: true
  },
  activeIngredients: [{
    name: {
      type: String,
      required: true
    }
  }],
  category: {
    type: String,
    enum: ['处方药', '非处方药', '特殊管理药品']
  },
  maxDosePerDay: {
    type: Number,
    required: true
  },
  maxDosePerCourse: {
    type: Number
  },
  unit: {
    type: String,
    required: true
  },
  contraindications: [String],
  sideEffects: [String]
});

module.exports = mongoose.model('Drug', drugSchema);
