const mongoose = require('mongoose');

const operationHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['提交', '审批通过', '退回修改', '借出', '续借', '归还', '超期催还', '涉密拦截', '放行', '要求补材料']
  },
  operator: {
    type: String,
    required: true
  },
  operatorId: String,
  reason: String,
  readableReason: String,
  comment: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true,
  timestamps: false
});

const borrowRecordSchema = new mongoose.Schema({
  recordId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  batchId: {
    type: String,
    index: true
  },
  caseId: {
    type: String,
    required: true,
    ref: 'Case'
  },
  caseTitle: String,
  securityLevel: String,
  borrowerId: {
    type: String,
    required: true,
    ref: 'UserPermission'
  },
  borrowerName: String,
  borrowerDepartment: String,
  borrowDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  returnDate: Date,
  renewCount: {
    type: Number,
    default: 0
  },
  maxRenewCount: {
    type: Number,
    default: 2
  },
  purpose: String,
  status: {
    type: String,
    enum: ['待处理', '审批中', '已批准', '已借出', '续借中', '已归还', '已退回', '已取消', '超期', '涉密待审'],
    default: '待处理',
    index: true
  },
  approvalStatus: {
    type: String,
    enum: ['待审批', '通过', '驳回', '需补充材料'],
    default: '待审批'
  },
  approverId: String,
  approverName: String,
  approvalComment: String,
  approvalDate: Date,
  overdueDays: {
    type: Number,
    default: 0
  },
  isOverdue: {
    type: Boolean,
    default: false,
    index: true
  },
  isSecretCase: {
    type: Boolean,
    default: false
  },
  operationHistory: [operationHistorySchema],
  flags: {
    overdueReminderSent: {
      type: Boolean,
      default: false
    },
    specialApprovalRequired: {
      type: Boolean,
      default: false
    },
    materialsSupplemented: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    type: Map,
    of: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

borrowRecordSchema.index({ borrowerId: 1, status: 1 });
borrowRecordSchema.index({ securityLevel: 1 });
borrowRecordSchema.index({ borrowDate: -1 });
borrowRecordSchema.index({ dueDate: 1 });
borrowRecordSchema.index({ 'operationHistory.action': 1 });

borrowRecordSchema.methods.addAction = function(action, operator, reason, readableReason, comment) {
  this.operationHistory.push({
    action,
    operator,
    reason,
    readableReason,
    comment
  });
  this.markModified('operationHistory');
};

borrowRecordSchema.methods.getCurrentStatusExplanation = function() {
  const lastAction = this.operationHistory[this.operationHistory.length - 1];
  if (!lastAction) {
    return '记录已创建，等待处理';
  }
  
  const explanations = {
    '提交': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 提交申请`,
    '审批通过': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 审批通过${lastAction.readableReason ? '：' + lastAction.readableReason : ''}`,
    '退回修改': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 退回修改${lastAction.readableReason ? '：' + lastAction.readableReason : ''}`,
    '借出': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 办理借出手续`,
    '续借': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 办理续借，当前续借次数：${this.renewCount}次`,
    '归还': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 确认归还`,
    '超期催还': `于 ${lastAction.timestamp.toLocaleString('zh-CN')} 发送超期催还通知${lastAction.readableReason ? '：' + lastAction.readableReason : ''}`,
    '涉密拦截': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 进行涉密拦截${lastAction.readableReason ? '：' + lastAction.readableReason : ''}`,
    '放行': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 予以放行${lastAction.readableReason ? '：' + lastAction.readableReason : ''}`,
    '要求补材料': `由 ${lastAction.operator} 于 ${lastAction.timestamp.toLocaleString('zh-CN')} 要求补充材料${lastAction.readableReason ? '：' + lastAction.readableReason : ''}`
  };
  
  return explanations[lastAction.action] || lastAction.readableReason || `${lastAction.action} - ${lastAction.operator}`;
};

module.exports = mongoose.model('BorrowRecord', borrowRecordSchema);
