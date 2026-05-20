const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  event: { type: String, required: true },
  operator: { type: String, required: true },
  description: String,
}, { _id: true, timestamps: true });

const evidenceSchema = new mongoose.Schema({
  type: { type: String, enum: ['log', 'screenshot', 'document', 'link'], required: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  description: String,
  uploadedBy: { type: String, required: true },
}, { _id: true, timestamps: true });

const affectedInterfaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  method: String,
  path: String,
  affectedCount: { type: Number, default: 0 },
  errorRate: { type: Number, default: 0 },
  customerImpact: { type: String, required: true },
}, { _id: true, timestamps: true });

const actionItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  assignee: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  dueDate: Date,
  completedAt: Date,
}, { _id: true, timestamps: true });

const reviewConclusionSchema = new mongoose.Schema({
  rootCause: { type: String, required: true },
  rootCauseCategory: String,
  impactSummary: { type: String, required: true },
  lessonsLearned: { type: String, required: true },
  improvementMeasures: [String],
  reviewedBy: { type: String, required: true },
  reviewedAt: Date,
}, { _id: true, timestamps: true });

const compensationRecordSchema = new mongoose.Schema({
  type: { type: String, required: true },
  description: { type: String, required: true },
  operator: { type: String, required: true },
  result: String,
  executedAt: Date,
}, { _id: true, timestamps: true });

const failureReasonSchema = new mongoose.Schema({
  reason: { type: String, required: true },
  operator: { type: String, required: true },
  category: String,
  timestamp: { type: Date, default: Date.now },
}, { _id: true, timestamps: true });

const incidentSchema = new mongoose.Schema({
  incidentId: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: { 
    type: String, 
    enum: ['critical', 'high', 'medium', 'low'], 
    required: true 
  },
  status: {
    type: String,
    enum: ['detecting', 'verifying', 'fixing', 'monitoring', 'reviewing', 'archived'],
    default: 'detecting'
  },
  startTime: { type: Date, required: true },
  endTime: Date,
  detectedBy: { type: String, required: true },
  owner: { type: String, required: true },
  
  affectedInterfaces: [affectedInterfaceSchema],
  evidences: [evidenceSchema],
  timelines: [timelineSchema],
  actionItems: [actionItemSchema],
  reviewConclusion: reviewConclusionSchema,
  compensationRecords: [compensationRecordSchema],
  
  failureReasons: [failureReasonSchema],
  tags: [String],
  
  archivedAt: Date,
  archivedBy: String,
}, { timestamps: true });

incidentSchema.pre('validate', function(next) {
  if (!this.incidentId) {
    this.incidentId = 'INC-' + Date.now().toString(36).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Incident', incidentSchema);
