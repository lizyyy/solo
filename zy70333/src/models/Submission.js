const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const SubmissionSchema = new mongoose.Schema({
  submissionId: { type: String, unique: true, default: () => uuidv4() },
  formId: { type: String, required: true, index: true },
  version: { type: Number, required: true },
  submissionKey: { type: String, required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  validationErrors: [{
    field: { type: String },
    message: { type: String }
  }],
  isValid: { type: Boolean, default: true },
  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

SubmissionSchema.index({ formId: 1, submissionKey: 1 }, { unique: true });

const Submission = mongoose.model('Submission', SubmissionSchema);

module.exports = Submission;