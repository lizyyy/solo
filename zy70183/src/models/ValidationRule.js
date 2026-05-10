const mongoose = require('mongoose');

const validationRuleSchema = new mongoose.Schema({
  ruleCode: {
    type: String,
    required: true,
    unique: true
  },
  ruleName: {
    type: String,
    required: true
  },
  periodType: {
    type: String,
    enum: ['MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL'],
    default: 'ALL'
  },
  applicableIndustries: {
    type: [String],
    default: []
  },
  requiredAttachments: [{
    attachmentType: {
      type: String,
      required: true
    },
    attachmentName: {
      type: String,
      required: true
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    allowedFormats: {
      type: [String],
      default: ['pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx', 'doc', 'docx']
    },
    maxSize: {
      type: Number,
      default: 10 * 1024 * 1024
    },
    description: String
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  priority: {
    type: Number,
    default: 0
  },
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true,
  versionKey: false
});

validationRuleSchema.index({ periodType: 1, status: 1 });
validationRuleSchema.index({ applicableIndustries: 1 });

module.exports = mongoose.model('ValidationRule', validationRuleSchema);
