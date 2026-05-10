const mongoose = require('mongoose');

const prescriptionItemSchema = new mongoose.Schema({
  drugId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drug',
    required: true
  },
  drugName: {
    type: String,
    required: true
  },
  genericName: String,
  dosage: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  dailyDose: {
    type: Number
  },
  route: {
    type: String,
    default: '口服'
  },
  instructions: String
});

const reviewHistorySchema = new mongoose.Schema({
  reviewer: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['创建', '提交', '通过', '退回', '需补充', '重新提交', '发药'],
    required: true
  },
  reason: String,
  riskDetails: [{
    type: String,
    category: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: String
});

const prescriptionSchema = new mongoose.Schema({
  prescriptionNo: {
    type: String,
    required: true,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  doctorName: {
    type: String,
    required: true
  },
  department: String,
  diagnosis: {
    type: String,
    required: true
  },
  items: [prescriptionItemSchema],
  status: {
    type: String,
    enum: ['待复核', '已通过', '已退回', '需补充', '已发药'],
    default: '待复核'
  },
  risks: [{
    type: String,
    category: {
      type: String,
      enum: ['过敏风险', '重复成分', '剂量超限', '其他']
    },
    severity: {
      type: String,
      enum: ['高', '中', '低']
    },
    description: String
  }],
  reviewHistory: [reviewHistorySchema],
  consultationRecord: {
    consultationTime: Date,
    symptoms: String,
    physicalExamination: String,
    assistantAdvice: String
  },
  canDispense: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date
});

prescriptionSchema.index({ status: 1, createdAt: -1 });
prescriptionSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
