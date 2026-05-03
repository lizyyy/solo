const sequelize = require('../config/database');

const Flatmate = require('./Flatmate');
const Bill = require('./Bill');
const SplitRule = require('./SplitRule');
const PaymentRecord = require('./PaymentRecord');
const ChoreTask = require('./ChoreTask');
const PointAdjustment = require('./PointAdjustment');
const Dispute = require('./Dispute');
const Notification = require('./Notification');

// 模型关联关系

// 室友与账单的关系
Flatmate.hasMany(Bill, {
  foreignKey: 'creator_id',
  as: 'createdBills',
});
Flatmate.hasMany(Bill, {
  foreignKey: 'advanced_by_id',
  as: 'advancedBills',
});
Bill.belongsTo(Flatmate, {
  foreignKey: 'creator_id',
  as: 'creator',
});
Bill.belongsTo(Flatmate, {
  foreignKey: 'advanced_by_id',
  as: 'advancedBy',
});

// 账单与分摊规则的关系
Bill.hasMany(SplitRule, {
  foreignKey: 'bill_id',
  as: 'splitRules',
});
SplitRule.belongsTo(Bill, {
  foreignKey: 'bill_id',
  as: 'bill',
});

// 室友与分摊规则的关系
Flatmate.hasMany(SplitRule, {
  foreignKey: 'flatmate_id',
  as: 'splitRules',
});
SplitRule.belongsTo(Flatmate, {
  foreignKey: 'flatmate_id',
  as: 'flatmate',
});

// 账单与付款记录的关系
Bill.hasMany(PaymentRecord, {
  foreignKey: 'bill_id',
  as: 'paymentRecords',
});
PaymentRecord.belongsTo(Bill, {
  foreignKey: 'bill_id',
  as: 'bill',
});

// 分摊规则与付款记录的关系
SplitRule.hasMany(PaymentRecord, {
  foreignKey: 'split_rule_id',
  as: 'paymentRecords',
});
PaymentRecord.belongsTo(SplitRule, {
  foreignKey: 'split_rule_id',
  as: 'splitRule',
});

// 室友与付款记录的关系
Flatmate.hasMany(PaymentRecord, {
  foreignKey: 'payer_id',
  as: 'paymentsMade',
});
Flatmate.hasMany(PaymentRecord, {
  foreignKey: 'receiver_id',
  as: 'paymentsReceived',
});
Flatmate.hasMany(PaymentRecord, {
  foreignKey: 'confirmed_by_id',
  as: 'confirmedPayments',
});
PaymentRecord.belongsTo(Flatmate, {
  foreignKey: 'payer_id',
  as: 'payer',
});
PaymentRecord.belongsTo(Flatmate, {
  foreignKey: 'receiver_id',
  as: 'receiver',
});
PaymentRecord.belongsTo(Flatmate, {
  foreignKey: 'confirmed_by_id',
  as: 'confirmer',
});

// 室友与家务任务的关系
Flatmate.hasMany(ChoreTask, {
  foreignKey: 'assigned_to_id',
  as: 'assignedTasks',
});
Flatmate.hasMany(ChoreTask, {
  foreignKey: 'completed_by_id',
  as: 'completedTasks',
});
Flatmate.hasMany(ChoreTask, {
  foreignKey: 'verified_by_id',
  as: 'verifiedTasks',
});
ChoreTask.belongsTo(Flatmate, {
  foreignKey: 'assigned_to_id',
  as: 'assignedTo',
});
ChoreTask.belongsTo(Flatmate, {
  foreignKey: 'completed_by_id',
  as: 'completedBy',
});
ChoreTask.belongsTo(Flatmate, {
  foreignKey: 'verified_by_id',
  as: 'verifiedBy',
});

// 室友与积分调整的关系
Flatmate.hasMany(PointAdjustment, {
  foreignKey: 'flatmate_id',
  as: 'pointAdjustments',
});
PointAdjustment.belongsTo(Flatmate, {
  foreignKey: 'flatmate_id',
  as: 'flatmate',
});

// 家务任务与积分调整的关系
ChoreTask.hasMany(PointAdjustment, {
  foreignKey: 'task_id',
  as: 'pointAdjustments',
});
PointAdjustment.belongsTo(ChoreTask, {
  foreignKey: 'task_id',
  as: 'task',
});

// 账单与积分调整的关系
Bill.hasMany(PointAdjustment, {
  foreignKey: 'bill_id',
  as: 'pointAdjustments',
});
PointAdjustment.belongsTo(Bill, {
  foreignKey: 'bill_id',
  as: 'bill',
});

// 账单与争议单的关系
Bill.hasMany(Dispute, {
  foreignKey: 'bill_id',
  as: 'disputes',
});
Dispute.belongsTo(Bill, {
  foreignKey: 'bill_id',
  as: 'bill',
});

// 分摊规则与争议单的关系
SplitRule.hasMany(Dispute, {
  foreignKey: 'split_rule_id',
  as: 'disputes',
});
Dispute.belongsTo(SplitRule, {
  foreignKey: 'split_rule_id',
  as: 'splitRule',
});

// 付款记录与争议单的关系
PaymentRecord.hasMany(Dispute, {
  foreignKey: 'payment_id',
  as: 'disputes',
});
Dispute.belongsTo(PaymentRecord, {
  foreignKey: 'payment_id',
  as: 'payment',
});

// 家务任务与争议单的关系
ChoreTask.hasMany(Dispute, {
  foreignKey: 'task_id',
  as: 'disputes',
});
Dispute.belongsTo(ChoreTask, {
  foreignKey: 'task_id',
  as: 'task',
});

// 室友与争议单的关系
Flatmate.hasMany(Dispute, {
  foreignKey: 'raised_by_id',
  as: 'raisedDisputes',
});
Flatmate.hasMany(Dispute, {
  foreignKey: 'assigned_to_id',
  as: 'assignedDisputes',
});
Flatmate.hasMany(Dispute, {
  foreignKey: 'resolved_by_id',
  as: 'resolvedDisputes',
});
Dispute.belongsTo(Flatmate, {
  foreignKey: 'raised_by_id',
  as: 'raisedBy',
});
Dispute.belongsTo(Flatmate, {
  foreignKey: 'assigned_to_id',
  as: 'assignedTo',
});
Dispute.belongsTo(Flatmate, {
  foreignKey: 'resolved_by_id',
  as: 'resolvedBy',
});

// 室友与通知的关系
Flatmate.hasMany(Notification, {
  foreignKey: 'recipient_id',
  as: 'notifications',
});
Notification.belongsTo(Flatmate, {
  foreignKey: 'recipient_id',
  as: 'recipient',
});

// 账单与通知的关系
Bill.hasMany(Notification, {
  foreignKey: 'bill_id',
  as: 'notifications',
});
Notification.belongsTo(Bill, {
  foreignKey: 'bill_id',
  as: 'bill',
});

// 付款记录与通知的关系
PaymentRecord.hasMany(Notification, {
  foreignKey: 'payment_id',
  as: 'notifications',
});
Notification.belongsTo(PaymentRecord, {
  foreignKey: 'payment_id',
  as: 'payment',
});

// 家务任务与通知的关系
ChoreTask.hasMany(Notification, {
  foreignKey: 'task_id',
  as: 'notifications',
});
Notification.belongsTo(ChoreTask, {
  foreignKey: 'task_id',
  as: 'task',
});

// 争议单与通知的关系
Dispute.hasMany(Notification, {
  foreignKey: 'dispute_id',
  as: 'notifications',
});
Notification.belongsTo(Dispute, {
  foreignKey: 'dispute_id',
  as: 'dispute',
});

module.exports = {
  sequelize,
  Flatmate,
  Bill,
  SplitRule,
  PaymentRecord,
  ChoreTask,
  PointAdjustment,
  Dispute,
  Notification,
};
