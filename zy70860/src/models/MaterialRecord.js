const mongoose = require('mongoose');

const materialRecordSchema = new mongoose.Schema({
  recordId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderNumber: {
    type: String,
    ref: 'RepairOrder',
    required: true,
    index: true
  },
  vehicleId: {
    type: String,
    ref: 'Vehicle',
    index: true
  },
  teamName: {
    type: String,
    index: true
  },
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
  requestedQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  actualQuantity: {
    type: Number,
    default: 0
  },
  returnedQuantity: {
    type: Number,
    default: 0
  },
  batchNumber: {
    type: String,
    index: true
  },
  warehouse: {
    type: String
  },
  recordType: {
    type: String,
    enum: ['normal', 'emergency', 'return'],
    default: 'normal',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'approved', 'rejected', 'returned', 'completed'],
    default: 'pending',
    index: true
  },
  applicant: {
    type: String,
    required: true
  },
  applicationTime: {
    type: Date,
    default: Date.now
  },
  handler: {
    type: String
  },
  handleTime: {
    type: Date
  },
  returnHandler: {
    type: String
  },
  returnTime: {
    type: Date
  },
  reason: {
    type: String
  },
  rejectionReason: {
    type: String
  },
  returnReason: {
    type: String
  },
  remarks: {
    type: String
  },
  auditTrail: [{
    action: {
      type: String,
      required: true
    },
    status: {
      type: String
    },
    handler: {
      type: String,
      required: true
    },
    handleTime: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String
    },
    remarks: {
      type: String
    }
  }],
  hasException: {
    type: Boolean,
    default: false
  },
  exceptionType: {
    type: String,
    enum: ['emergency_usage', 'return_difference', 'negative_stock', null]
  },
  exceptionReason: {
    type: String
  },
  exceptionHandler: {
    type: String
  },
  exceptionTime: {
    type: Date
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

materialRecordSchema.index({ orderNumber: 1, materialCode: 1 });
materialRecordSchema.index({ teamName: 1, batchNumber: 1 });

materialRecordSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

materialRecordSchema.methods.addAuditTrail = function(action, handler, reason, remarks, status) {
  this.auditTrail.push({
    action,
    status: status || this.status,
    handler,
    handleTime: new Date(),
    reason,
    remarks
  });
};

materialRecordSchema.methods.markProcessing = function(handler, reason) {
  this.status = 'processing';
  this.handler = handler;
  this.handleTime = new Date();
  this.addAuditTrail('标记处理', handler, reason, null, 'processing');
};

materialRecordSchema.methods.approve = function(handler, reason) {
  this.status = 'approved';
  this.handler = handler;
  this.handleTime = new Date();
  this.addAuditTrail('审核通过', handler, reason, null, 'approved');
};

materialRecordSchema.methods.reject = function(handler, rejectionReason) {
  this.status = 'rejected';
  this.handler = handler;
  this.handleTime = new Date();
  this.rejectionReason = rejectionReason;
  this.addAuditTrail('审核拒绝', handler, rejectionReason, null, 'rejected');
};

materialRecordSchema.methods.returnForRevision = function(handler, returnReason) {
  this.status = 'returned';
  this.returnHandler = handler;
  this.returnTime = new Date();
  this.returnReason = returnReason;
  this.addAuditTrail('退回修改', handler, returnReason, null, 'returned');
};

materialRecordSchema.methods.complete = function(handler, reason) {
  this.status = 'completed';
  this.handler = handler;
  this.handleTime = new Date();
  this.addAuditTrail('完成', handler, reason, null, 'completed');
};

materialRecordSchema.methods.recordException = function(exceptionType, reason, handler) {
  this.hasException = true;
  this.exceptionType = exceptionType;
  this.exceptionReason = reason;
  this.exceptionHandler = handler;
  this.exceptionTime = new Date();
  this.addAuditTrail('异常记录', handler, `异常类型: ${exceptionType}, 原因: ${reason}`, null, this.status);
};

module.exports = mongoose.model('MaterialRecord', materialRecordSchema);
